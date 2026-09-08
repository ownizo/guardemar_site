import { createHash, randomUUID } from 'node:crypto'

import type { Config } from '@netlify/functions'
import { z } from 'zod'

import { annexCAcknowledgementKeys, extractClause, extractFeeScheduleTaxStatement, feeSchedule, parseAnnexCAcknowledgements, subscriptionPlans, subscriptionTerms } from '../../src/config/subscriptions.ts'
import { authenticate, HttpError, json, requestIp, requirePropertyAccess, requireSubscriptionAccess, stripeRequest, verifyConfiguredTaxRate, verifyLivePrice, verifyStripePrice } from './_subscription-shared.mts'

const acceptanceInput = z.object({
  idempotencyKey: z.string().uuid(),
  propertyId: z.string().uuid(),
  planCode: z.enum(['care', 'care_plus', 'complete']),
  billingInterval: z.enum(['month', 'year']),
  startDate: z.string().date(),
  acknowledgements: z.record(z.string(), z.boolean()),
  isConsumer: z.boolean(),
  earlyStartRequested: z.boolean(),
})

const checkoutInput = z.object({ subscriptionId: z.string().uuid() })

function routePath(req: Request) {
  return new URL(req.url).pathname.replace(/^\/api\/subscriptions\/?/, '')
}

async function loadCanonicalDocuments(database: any) {
  const [termsResult, feeScheduleResult] = await Promise.all([
    database.from('legal_terms_versions').select('version,effective_date,title,document_text,sha256').eq('version', subscriptionTerms.version).eq('effective_date', subscriptionTerms.effectiveDate).maybeSingle(),
    database.from('fee_schedule_versions').select('effective_date,title,document_text,sha256').eq('effective_date', feeSchedule.effectiveDate).maybeSingle(),
  ])
  const terms = termsResult.data
  const fees = feeScheduleResult.data
  if (termsResult.error || !terms || terms.title !== subscriptionTerms.title || terms.sha256 !== subscriptionTerms.sha256) {
    throw new HttpError(503, 'The approved General Terms Version 2.5 document is not configured correctly. Checkout remains disabled.', 'LEGAL_CONFIGURATION_ERROR')
  }
  if (feeScheduleResult.error || !fees || fees.title !== feeSchedule.title || fees.sha256 !== feeSchedule.sha256) {
    throw new HttpError(503, 'The approved Fee Schedule applicable from 5 September 2026 is not configured correctly. Checkout remains disabled.', 'LEGAL_CONFIGURATION_ERROR')
  }
  const acknowledgements = parseAnnexCAcknowledgements(terms.document_text)
  const withdrawalClause = extractClause(terms.document_text, '5.4')
  const taxStatement = extractFeeScheduleTaxStatement(fees.document_text)
  const contractClauses = Object.fromEntries(['1.6', '5.1', '5.2', '5.3', '15.3', '15.4', '15.5', '15.6', '15.7'].map((clause) => [clause, extractClause(terms.document_text, clause)]))
  if (acknowledgements.length !== annexCAcknowledgementKeys.length || !withdrawalClause || !taxStatement || Object.values(contractClauses).some((clause) => !clause)) {
    throw new HttpError(503, 'The approved contractual documents do not contain the expected legal provisions. Checkout remains disabled.', 'LEGAL_CONFIGURATION_ERROR')
  }
  return { terms, fees, acknowledgements, withdrawalClause, taxStatement, contractClauses }
}

async function recordCheckoutAudit(database: any, userId: string, subscriptionId: string, checkoutSessionId: string, planCode: string, billingInterval: string) {
  const result = await database.from('audit_events').insert({ actor_user_id: userId, event_type: 'stripe_checkout_created', entity_type: 'service_subscription', entity_id: subscriptionId, metadata: { checkoutSessionId, planCode, billingInterval } })
  if (result.error && result.error.code !== '23505') throw new HttpError(500, 'Checkout audit evidence could not be stored.')
}

async function subscriptionDetails(database: any, id: string, includeAdminEvidence = false) {
  const subscriptionColumns = includeAdminEvidence
    ? '*'
    : 'id,client_id,property_id,plan_code,billing_interval,currency,monthly_net_amount,annual_list_net_amount,annual_discount_percent,annual_discount_net_amount,selected_net_amount,tax_percentage,tax_display_name,tax_amount,gross_amount,tax_configuration,contract_start_date,contract_end_date,renews_at,local_status,payment_status,stripe_current_period_end,created_at'
  const acceptanceColumns = includeAdminEvidence
    ? '*'
    : 'id,terms_version,terms_effective_date,terms_sha256,accepted_at,plan_code,billing_interval,currency,monthly_amount,annual_list_amount,annual_discount_percent,annual_discount_amount,selected_amount,tax_percentage,tax_display_name,tax_amount,gross_amount,service_order_snapshot,acknowledgements,withdrawal_early_start_requested,withdrawal_early_start_text'
  const subscription = await database.from('service_subscriptions').select(`${subscriptionColumns}, clients(first_name,last_name,email), properties(display_name,address_line_1,address_line_2,postal_code,locality,municipality,country), service_agreement_acceptances!subscription_id(${acceptanceColumns})`).eq('id', id).maybeSingle()
  if (subscription.error || !subscription.data) throw new HttpError(404, 'Subscription not found.', 'NOT_FOUND')
  const paymentColumns = includeAdminEvidence ? '*' : 'id,subscription_id,stripe_invoice_id,event_type,payment_status,amount_net,amount_tax,amount_gross,currency,action_url,occurred_at,created_at'
  const payments = await database.from('subscription_payment_events').select(paymentColumns).eq('subscription_id', id).order('occurred_at', { ascending: false })
  if (payments.error) throw new HttpError(500, 'Payment history could not be loaded.')
  const audit = includeAdminEvidence ? await database.from('audit_events').select('*').eq('entity_type', 'service_subscription').eq('entity_id', id).order('created_at', { ascending: false }) : { data: [], error: null }
  if (audit.error) throw new HttpError(500, 'Subscription audit history could not be loaded.')
  return { subscription: subscription.data, payments: payments.data ?? [], audit: audit.data ?? [] }
}

async function handler(req: Request) {
  const auth = await authenticate(req)
  const path = routePath(req)

  if (req.method === 'GET' && path === 'terms') {
    const requestedVersion = new URL(req.url).searchParams.get('version') || subscriptionTerms.version
    if (!/^\d+\.\d+$/.test(requestedVersion)) throw new HttpError(400, 'Terms version is invalid.', 'VALIDATION_ERROR')
    const result = await auth.database.from('legal_terms_versions').select('version,document_text,sha256').eq('version', requestedVersion).maybeSingle()
    if (result.error || !result.data) throw new HttpError(404, 'The requested General Terms version is unavailable.', 'NOT_FOUND')
    const calculatedHash = createHash('sha256').update(result.data.document_text, 'utf8').digest('hex')
    if (calculatedHash !== result.data.sha256) throw new HttpError(503, 'The requested General Terms failed integrity verification.', 'LEGAL_CONFIGURATION_ERROR')
    return new Response(result.data.document_text, {
      headers: {
        'Cache-Control': 'private, no-store',
        'Content-Type': 'text/markdown; charset=utf-8',
        'Content-Disposition': `attachment; filename="guardemar-general-terms-v${result.data.version}.md"`,
        'X-Content-Type-Options': 'nosniff',
      },
    })
  }

  if (req.method === 'GET' && path === 'options') {
    const access = auth.role === 'customer'
      ? await auth.database.from('property_users').select('properties(id,client_id,display_name,address_line_1,address_line_2,postal_code,locality,municipality,country,active,clients(first_name,last_name,email))').eq('user_id', auth.user.id)
      : { data: [], error: null }
    if (access.error) throw new HttpError(500, 'Properties could not be loaded.')
    let legalConfiguration: Awaited<ReturnType<typeof loadCanonicalDocuments>> | null = null
    let legalError: string | null = null
    try { legalConfiguration = await loadCanonicalDocuments(auth.database) }
    catch (error) { legalError = error instanceof HttpError ? error.message : 'The approved General Terms are unavailable.' }
    let taxConfiguration: Awaited<ReturnType<typeof verifyConfiguredTaxRate>> | null = null
    let taxError: string | null = null
    try { taxConfiguration = await verifyConfiguredTaxRate() }
    catch (error) { taxError = error instanceof HttpError ? error.message : 'The production tax configuration is unavailable.' }
    return json({
      properties: (access.data ?? []).flatMap((row: { properties: unknown }) => row.properties ? [row.properties] : []),
      plans: subscriptionPlans,
      terms: legalConfiguration ? { ...legalConfiguration.terms, available: true } : { ...subscriptionTerms, available: false, error: legalError },
      feeSchedule: legalConfiguration ? { effective_date: legalConfiguration.fees.effective_date, title: legalConfiguration.fees.title, sha256: legalConfiguration.fees.sha256, available: true } : { ...feeSchedule, available: false, error: legalError },
      tax: taxConfiguration ? { available: true, percentage: taxConfiguration.percentage, displayName: taxConfiguration.displayName, country: taxConfiguration.country, jurisdiction: taxConfiguration.jurisdiction } : { available: false, error: taxError },
      mainTermsAcceptance: legalConfiguration?.contractClauses['1.6'] ?? null,
      serviceOrderAcceptance: legalConfiguration?.contractClauses['5.1'] ?? null,
      withdrawalClause: legalConfiguration?.withdrawalClause ?? null,
      contractClauses: legalConfiguration?.contractClauses ?? null,
      acknowledgements: legalConfiguration?.acknowledgements ?? [],
    })
  }

  if (req.method === 'GET' && path === '') {
    const url = new URL(req.url)
    let query = auth.database.from('service_subscriptions').select('id,client_id,property_id,plan_code,billing_interval,currency,selected_net_amount,tax_percentage,tax_display_name,tax_amount,gross_amount,contract_start_date,contract_end_date,renews_at,local_status,payment_status,stripe_current_period_end,created_at,clients(first_name,last_name),properties(display_name,locality,municipality),service_agreement_acceptances!subscription_id(terms_version,accepted_at)').order('created_at', { ascending: false })
    if (auth.role === 'customer') {
      const access = await auth.database.from('property_users').select('property_id').eq('user_id', auth.user.id)
      if (access.error) throw new HttpError(500, 'Subscription access could not be checked.')
      const propertyIds = (access.data ?? []).map((row) => row.property_id)
      if (propertyIds.length === 0) return json({ subscriptions: [] })
      query = query.in('property_id', propertyIds)
    } else {
      const clientId = url.searchParams.get('clientId')
      const propertyId = url.searchParams.get('propertyId')
      if (clientId && !z.string().uuid().safeParse(clientId).success) throw new HttpError(400, 'Client filter is invalid.', 'VALIDATION_ERROR')
      if (propertyId && !z.string().uuid().safeParse(propertyId).success) throw new HttpError(400, 'Property filter is invalid.', 'VALIDATION_ERROR')
      if (clientId) query = query.eq('client_id', clientId)
      if (propertyId) query = query.eq('property_id', propertyId)
    }
    const result = await query
    if (result.error) throw new HttpError(500, 'Subscriptions could not be loaded.')
    return json({ subscriptions: result.data ?? [] })
  }

  if (req.method === 'GET' && /^[0-9a-f-]{36}$/i.test(path)) {
    await requireSubscriptionAccess(auth, path)
    return json(await subscriptionDetails(auth.database, path, auth.role !== 'customer'))
  }

  if (req.method === 'POST' && path === 'accept') {
    if (auth.role !== 'customer') throw new HttpError(403, 'Only an authorised client can accept a service agreement.', 'AUTHORIZATION_ERROR')
    const input = acceptanceInput.parse(await req.json())
    await requirePropertyAccess(auth, input.propertyId)
    const today = new Date().toISOString().slice(0, 10)
    if (input.startDate < today) throw new HttpError(400, 'The requested service start date cannot be in the past.', 'VALIDATION_ERROR')
    const existing = await auth.database.from('service_subscriptions').select('id,agreement_acceptance_id').eq('acceptance_idempotency_key', input.idempotencyKey).eq('created_by', auth.user.id).maybeSingle()
    if (existing.error) throw new HttpError(500, 'Agreement idempotency could not be checked.')
    if (existing.data) return json({ subscriptionId: existing.data.id, acceptanceId: existing.data.agreement_acceptance_id })
    const requiredKeys = ['serviceOrder', 'mainTerms', ...annexCAcknowledgementKeys]
    if (requiredKeys.some((key) => input.acknowledgements[key] !== true)) throw new HttpError(400, 'Every contractual acknowledgement must be accepted.', 'VALIDATION_ERROR')
    if (input.earlyStartRequested && !input.isConsumer) throw new HttpError(400, 'The early-start withdrawal request applies only when the client identifies as a consumer.', 'VALIDATION_ERROR')
    const fourteenDaysFromNow = new Date()
    fourteenDaysFromNow.setUTCDate(fourteenDaysFromNow.getUTCDate() + 14)
    if (input.isConsumer && input.startDate <= fourteenDaysFromNow.toISOString().slice(0, 10) && !input.earlyStartRequested) throw new HttpError(400, 'Please expressly request early service or select a start date after the 14-day withdrawal period.', 'VALIDATION_ERROR')

    const [{ terms, fees, acknowledgements, withdrawalClause, taxStatement, contractClauses }, approvedPrice] = await Promise.all([
      loadCanonicalDocuments(auth.database),
      verifyLivePrice(input.planCode, input.billingInterval),
    ])
    const approvedTax = await verifyConfiguredTaxRate(approvedPrice.amount)
    if (approvedTax.taxAmount === null || approvedTax.grossAmount === null) throw new HttpError(503, 'The production tax amount could not be calculated.', 'STRIPE_CONFIGURATION_ERROR')
    const acknowledgementEvidence = {
      serviceOrder: true,
      mainTerms: true,
      ...Object.fromEntries(annexCAcknowledgementKeys.map((key) => [key, true])),
      isConsumer: input.isConsumer,
      earlyStartRequested: input.earlyStartRequested,
      mainTermsText: contractClauses['1.6'],
      serviceOrderAcceptanceText: contractClauses['5.1'],
      annexC: acknowledgements.map((acknowledgement) => ({ key: acknowledgement.key, text: acknowledgement.text, accepted: true })),
      withdrawalClause5_4: withdrawalClause,
      contractClauses,
    }
    const result = await auth.database.rpc('create_service_agreement_acceptance', {
      actor_user_id: auth.user.id,
      acceptance_idempotency: input.idempotencyKey,
      property_uuid: input.propertyId,
      requested_plan: input.planCode,
      requested_billing: input.billingInterval,
      approved_stripe_price_id: approvedPrice.priceId,
      approved_service_scope: approvedPrice.plan.scope,
      approved_fee_schedule_effective_date: fees.effective_date,
      approved_fee_schedule_sha256: fees.sha256,
      approved_tax_statement: taxStatement,
      approved_tax_rate_id: approvedTax.taxRateId,
      approved_tax_percentage: approvedTax.percentage,
      approved_tax_display_name: approvedTax.displayName,
      approved_tax_amount: approvedTax.taxAmount,
      approved_gross_amount: approvedTax.grossAmount,
      requested_start_date: input.startDate,
      acknowledgement_evidence: acknowledgementEvidence,
      early_start_requested: input.earlyStartRequested,
      request_user_agent: req.headers.get('user-agent') || '',
      request_ip: requestIp(req),
      technical_metadata: { source: 'guardemar_portal', netlifyRequestId: req.headers.get('x-nf-request-id'), termsSha256: terms.sha256, feeScheduleSha256: fees.sha256 },
    })
    if (result.error) {
      const unavailable = result.error.message.includes('Version 2.5') || result.error.message.includes('tax configuration')
      if (!unavailable) console.error('Agreement acceptance failed', { code: result.error.code || 'DATABASE_ERROR' })
      throw new HttpError(unavailable ? 503 : 400, unavailable ? 'The approved legal or tax configuration is not available. Checkout remains disabled.' : 'Agreement acceptance could not be recorded. Check the property, start date and acknowledgements.', unavailable ? 'CONFIGURATION_ERROR' : 'VALIDATION_ERROR')
    }
    // Defensive verification: never trust the RPC's return shape blindly. Re-read the
    // subscription it claims to have created/found by the ID it returned, and confirm
    // every field the caller is trusted with actually matches what was requested,
    // before this response is ever used to open a Checkout Session.
    const returned = result.data as { subscriptionId?: unknown; acceptanceId?: unknown }
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (typeof returned.subscriptionId !== 'string' || typeof returned.acceptanceId !== 'string' || !uuidPattern.test(returned.subscriptionId) || !uuidPattern.test(returned.acceptanceId)) {
      console.error('Agreement acceptance failed', { code: 'MALFORMED_RPC_RESPONSE' })
      throw new HttpError(500, 'Agreement acceptance could not be verified. Please try again.', 'ACCEPTANCE_VERIFICATION_FAILED')
    }
    const verification = await auth.database.from('service_subscriptions').select('created_by,property_id,agreement_acceptance_id,acceptance_idempotency_key,plan_code,billing_interval').eq('id', returned.subscriptionId).maybeSingle()
    if (
      verification.error || !verification.data
      || verification.data.created_by !== auth.user.id
      || verification.data.property_id !== input.propertyId
      || verification.data.agreement_acceptance_id !== returned.acceptanceId
      || verification.data.acceptance_idempotency_key !== input.idempotencyKey
      || verification.data.plan_code !== input.planCode
      || verification.data.billing_interval !== input.billingInterval
    ) {
      console.error('Agreement acceptance failed', { code: 'ACCEPTANCE_LINKAGE_MISMATCH' })
      throw new HttpError(500, 'Agreement acceptance could not be verified. Please try again.', 'ACCEPTANCE_VERIFICATION_FAILED')
    }
    return json(returned, { status: 201 })
  }

  if (req.method === 'POST' && path === 'checkout') {
    if (auth.role !== 'customer') throw new HttpError(403, 'Only an authorised client can start Checkout.', 'AUTHORIZATION_ERROR')
    const input = checkoutInput.parse(await req.json())
    await requireSubscriptionAccess(auth, input.subscriptionId)
    const internal = await auth.database.from('service_subscriptions').select('*, service_agreement_acceptances!subscription_id(id,stripe_price_id,stripe_tax_rate_id,tax_percentage,tax_amount,gross_amount)').eq('id', input.subscriptionId).maybeSingle()
    if (internal.error || !internal.data) throw new HttpError(404, 'Subscription not found.', 'NOT_FOUND')
    const subscription = internal.data as Record<string, any>
    const acceptance = Array.isArray(subscription.service_agreement_acceptances) ? subscription.service_agreement_acceptances[0] : subscription.service_agreement_acceptances
    if (!subscription.agreement_acceptance_id || subscription.local_status === 'pending_acceptance') throw new HttpError(409, 'Contract acceptance must be completed before payment.', 'AGREEMENT_REQUIRED')
    if (subscription.local_status === 'active') throw new HttpError(409, 'This subscription is already active.', 'ALREADY_ACTIVE')
    if (!acceptance?.stripe_price_id || acceptance.stripe_price_id !== subscription.stripe_price_id) throw new HttpError(409, 'The accepted Stripe Price snapshot does not match the subscription record.', 'AGREEMENT_PRICE_MISMATCH')
    if (!acceptance?.stripe_tax_rate_id || acceptance.stripe_tax_rate_id !== subscription.stripe_tax_rate_id) throw new HttpError(409, 'The accepted Stripe Tax Rate snapshot does not match the subscription record.', 'AGREEMENT_TAX_MISMATCH')
    await verifyStripePrice(acceptance.stripe_price_id, subscription.selected_net_amount, subscription.billing_interval, 'The Stripe Price accepted in the Service Order')
    const verifiedTax = await verifyConfiguredTaxRate(subscription.selected_net_amount)
    if (verifiedTax.taxRateId !== acceptance.stripe_tax_rate_id || verifiedTax.percentage !== Number(acceptance.tax_percentage) || verifiedTax.taxAmount !== acceptance.tax_amount || verifiedTax.grossAmount !== acceptance.gross_amount) {
      throw new HttpError(503, 'The live Stripe tax configuration no longer matches the accepted Service Order.', 'STRIPE_CONFIGURATION_ERROR')
    }

    let checkoutIdempotencyKey = subscription.checkout_idempotency_key as string
    if (subscription.stripe_checkout_session_id) {
      const existing = await stripeRequest<{ status: string; url?: string }>(`/checkout/sessions/${encodeURIComponent(subscription.stripe_checkout_session_id)}`)
      if (existing.status === 'open' && existing.url) {
        await recordCheckoutAudit(auth.database, auth.user.id, subscription.id, subscription.stripe_checkout_session_id, subscription.plan_code, subscription.billing_interval)
        return json({ url: existing.url, reused: true })
      }
      if (existing.status === 'complete') throw new HttpError(409, 'Payment has been submitted and Guardemar is waiting for the verified Stripe confirmation.', 'PAYMENT_CONFIRMATION_PENDING')
      const replacementKey = randomUUID()
      const rotated = await auth.database.from('service_subscriptions').update({ checkout_idempotency_key: replacementKey, stripe_checkout_session_id: null, checkout_expires_at: null, updated_at: new Date().toISOString() }).eq('id', subscription.id).eq('checkout_idempotency_key', checkoutIdempotencyKey).select('checkout_idempotency_key').maybeSingle()
      if (rotated.error) throw new HttpError(500, 'Checkout retry state could not be prepared.')
      if (rotated.data) checkoutIdempotencyKey = rotated.data.checkout_idempotency_key
      else {
        const current = await auth.database.from('service_subscriptions').select('checkout_idempotency_key').eq('id', subscription.id).single()
        if (current.error) throw new HttpError(500, 'Checkout retry state could not be loaded.')
        checkoutIdempotencyKey = current.data.checkout_idempotency_key
      }
    }

    const clientResult = await auth.database.from('clients').select('id,first_name,last_name,email,stripe_customer_id').eq('id', subscription.client_id).single()
    if (clientResult.error) throw new HttpError(500, 'Client billing record could not be loaded.')
    let customerId = clientResult.data.stripe_customer_id as string | null
    if (!customerId) {
      const customerBody = new URLSearchParams({ name: `${clientResult.data.first_name} ${clientResult.data.last_name}`, email: clientResult.data.email, 'metadata[client_id]': clientResult.data.id })
      const customer = await stripeRequest<{ id: string; livemode: boolean }>('/customers', { method: 'POST', body: customerBody, idempotencyKey: `guardemar-client-${clientResult.data.id}` })
      if (!customer.livemode) throw new HttpError(503, 'Stripe returned a non-live customer. Checkout was stopped.', 'STRIPE_CONFIGURATION_ERROR')
      customerId = customer.id
      const customerUpdate = await auth.database.from('clients').update({ stripe_customer_id: customerId }).eq('id', clientResult.data.id)
      if (customerUpdate.error) throw new HttpError(500, 'Stripe customer ownership could not be stored.')
    }

    const origin = new URL(req.url).origin
    const body = new URLSearchParams({
      mode: 'subscription',
      customer: customerId,
      'line_items[0][price]': acceptance.stripe_price_id,
      'line_items[0][quantity]': '1',
      'subscription_data[default_tax_rates][0]': acceptance.stripe_tax_rate_id,
      success_url: `${origin}/portal/subscriptions/${subscription.id}?checkout=return`,
      cancel_url: `${origin}/portal/subscriptions/${subscription.id}?checkout=cancelled`,
      client_reference_id: subscription.id,
      'metadata[guardemar_subscription_id]': subscription.id,
      'metadata[client_id]': subscription.client_id,
      'metadata[property_id]': subscription.property_id,
      'metadata[agreement_acceptance_id]': subscription.agreement_acceptance_id,
      'metadata[plan_code]': subscription.plan_code,
      'metadata[billing_interval]': subscription.billing_interval,
      'subscription_data[metadata][guardemar_subscription_id]': subscription.id,
      'subscription_data[metadata][client_id]': subscription.client_id,
      'subscription_data[metadata][property_id]': subscription.property_id,
      'subscription_data[metadata][agreement_acceptance_id]': subscription.agreement_acceptance_id,
      'subscription_data[metadata][plan_code]': subscription.plan_code,
      'subscription_data[metadata][billing_interval]': subscription.billing_interval,
      billing_address_collection: 'required',
      'payment_method_collection': 'always',
    })
    const session = await stripeRequest<{ id: string; url: string; expires_at: number; livemode: boolean }>('/checkout/sessions', { method: 'POST', body, idempotencyKey: checkoutIdempotencyKey })
    if (!session.livemode) throw new HttpError(503, 'Stripe returned a non-live Checkout Session. Checkout was stopped.', 'STRIPE_CONFIGURATION_ERROR')
    const update = await auth.database.from('service_subscriptions').update({ stripe_customer_id: customerId, stripe_checkout_session_id: session.id, checkout_expires_at: new Date(session.expires_at * 1000).toISOString(), local_status: 'pending_payment', payment_status: 'pending', updated_at: new Date().toISOString() }).eq('id', subscription.id)
    if (update.error) throw new HttpError(500, 'Checkout state could not be stored.')
    await recordCheckoutAudit(auth.database, auth.user.id, subscription.id, session.id, subscription.plan_code, subscription.billing_interval)
    return json({ url: session.url })
  }

  if (req.method === 'POST' && path === 'billing-portal') {
    if (auth.role !== 'customer') throw new HttpError(403, 'Only the authorised client can open the Stripe billing portal.', 'AUTHORIZATION_ERROR')
    const input = checkoutInput.parse(await req.json())
    await requireSubscriptionAccess(auth, input.subscriptionId)
    const result = await auth.database.from('service_subscriptions').select('stripe_customer_id').eq('id', input.subscriptionId).single()
    if (result.error || !result.data.stripe_customer_id) throw new HttpError(409, 'No Stripe billing profile is available yet.')
    const portalConfiguration = Netlify.env.get('STRIPE_BILLING_PORTAL_CONFIGURATION')?.trim()
    if (!portalConfiguration?.startsWith('bpc_')) throw new HttpError(503, 'The secure billing portal is not configured for payment-method-only access.', 'STRIPE_CONFIGURATION_ERROR')
    const body = new URLSearchParams({ customer: result.data.stripe_customer_id, configuration: portalConfiguration, return_url: `${new URL(req.url).origin}/portal/subscriptions/${input.subscriptionId}` })
    const session = await stripeRequest<{ url: string }>('/billing_portal/sessions', { method: 'POST', body })
    return json({ url: session.url })
  }

  throw new HttpError(404, 'Subscription endpoint not found.', 'NOT_FOUND')
}

export default async (req: Request) => {
  try { return await handler(req) }
  catch (error) {
    if (error instanceof z.ZodError) return json({ error: { code: 'VALIDATION_ERROR', message: 'The submitted subscription details are invalid.' } }, { status: 400 })
    if (error instanceof HttpError) return json({ error: { code: error.code, message: error.message } }, { status: error.status })
    console.error('Subscription API failure', error instanceof Error ? error.message : 'unknown error')
    return json({ error: { code: 'SERVER_ERROR', message: 'The subscription service is temporarily unavailable.' } }, { status: 500 })
  }
}

export const config: Config = { path: '/api/subscriptions/*' }
