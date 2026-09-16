import { randomUUID } from 'node:crypto'
import { addonServiceCatalogue } from '../../src/config/optional-services.ts'
import { shoppingPaymentMessage } from '../../src/lib/portal/addons.ts'
import { checked } from './_addon-shared.mts'
import { environment, HttpError, stripeRequest, type AuthContext } from './_subscription-shared.mts'
import { queueAddonBillingEmail, deliverAddonBillingEmail } from './_addon-email.mts'

export type BillingRow = Record<string, any>
export type StripeCall = typeof stripeRequest
export function billingConfiguration() {
  return { livePaymentsEnabled: environment('STRIPE_ADDON_LIVE_ENABLED') === 'true', externalProviderEnabled: environment('STRIPE_ADDON_EXTERNAL_PROVIDER_ENABLED') === 'true' }
}
export function addonMetadata(payment: BillingRow, subscription: BillingRow | null, attemptId: string) {
  return {
    payment_domain: 'addon', payment_category: payment.payment_category, payment_type: payment.payment_type,
    addon_payment_id: payment.id, addon_checkout_attempt_id: attemptId,
    ...(subscription ? { addon_subscription_id: subscription.id } : {}),
    ...(payment.addon_request_id ? { addon_request_id: payment.addon_request_id } : {}),
    ...(payment.client_id ? { client_id: payment.client_id } : {}),
    ...(payment.property_id ? { property_id: payment.property_id } : {}), service_code: payment.service_code,
  }
}
export function assertAddonMetadata(metadata: Record<string, any>, payment: BillingRow, subscription?: BillingRow | null) {
  if (metadata.payment_domain !== 'addon' || metadata.guardemar_subscription_id || metadata.agreement_acceptance_id) throw new HttpError(409, 'Stripe billing domain mismatch.', 'STRIPE_STATE_ERROR')
  for (const [key, value] of Object.entries(addonMetadata(payment, subscription ?? null, metadata.addon_checkout_attempt_id))) {
    if (key !== 'addon_checkout_attempt_id' && metadata[key] !== value) throw new HttpError(409, 'Stripe add-on ownership mismatch.', 'STRIPE_STATE_ERROR')
  }
}
export function verifyAddonOpenSession(session: BillingRow, payment: BillingRow, subscription: BillingRow | null, attempt: BillingRow) {
  assertAddonMetadata(session.metadata ?? {}, payment, subscription)
  if (!session.livemode || session.status !== 'open' || session.payment_status === 'paid' || session.subscription || session.mode !== (subscription ? 'subscription' : 'payment') || session.currency !== 'eur' || session.amount_total !== payment.amount || session.metadata.addon_checkout_attempt_id !== attempt.id || (attempt.stripe_checkout_session_id && attempt.stripe_checkout_session_id !== session.id) || (payment.stripe_customer_id && session.customer !== payment.stripe_customer_id) || !session.url?.startsWith('https://checkout.stripe.com/')) throw new HttpError(409, 'Only the matching unpaid, open Stripe Checkout may be sent.')
  if (payment.payment_category === 'guardemar_service' && session.total_details?.amount_tax !== payment.amount_tax) throw new HttpError(409, 'Checkout gross amount/VAT does not match the agreed amount.')
  if (payment.payment_category === 'external_provider' && session.total_details?.amount_tax) throw new HttpError(409, 'Unexpected External Provider tax calculation.')
}
export function buildAddonCheckout(payment: BillingRow, subscription: BillingRow | null, attempt: BillingRow) {
  if (payment.amount_semantics === 'unapproved' || !Number.isSafeInteger(payment.amount) || payment.amount < 1 || payment.currency !== 'EUR') throw new HttpError(409, 'The final payment amount must be confirmed.')
  if (payment.service_code === 'pre-arrival-shopping' && !payment.service_fee_only_confirmed) throw new HttpError(409, 'Only the Guardemar service fee may be charged through Stripe.')
  if (payment.payment_type === 'monthly' && !subscription) throw new HttpError(409, 'The linked monthly subscription is missing.')
  if (!payment.stripe_product_id) throw new HttpError(503, 'The approved add-on Product is missing.')
  const monthly = payment.payment_type === 'monthly'
  const service = addonServiceCatalogue.find((item) => item.id === payment.service_code)
  if (!service) throw new HttpError(409, 'Unknown service.')
  const returnUrl = payment.addon_request_id ? `https://guardemar.com/portal/services/requests/${payment.addon_request_id}` : 'https://guardemar.com/portal/add-on-payment-return'
  const body = new URLSearchParams({
    mode: monthly ? 'subscription' : 'payment', currency: 'eur',
    'line_items[0][quantity]': '1', 'line_items[0][price_data][currency]': 'eur',
    'line_items[0][price_data][unit_amount]': String(payment.amount),
    'line_items[0][price_data][product]': payment.stripe_product_id,
    'line_items[0][price_data][tax_behavior]': 'inclusive',
    'automatic_tax[enabled]': 'false', 'adaptive_pricing[enabled]': 'false',
    client_reference_id: payment.id, success_url: `${returnUrl}?checkout=return`, cancel_url: `${returnUrl}?checkout=cancelled`,
    billing_address_collection: 'required',
    'custom_text[submit][message]': `${payment.description}. ${monthly ? 'This sets up a recurring monthly payment.' : 'This is a one-time payment.'} Payments are non-refundable once paid.${payment.service_code === 'pre-arrival-shopping' ? ` ${shoppingPaymentMessage}` : ''}`.slice(0, 1200),
  })
  body.set(`${monthly ? 'subscription_data' : 'payment_intent_data'}[description]`, payment.description)
  if (monthly) body.set('line_items[0][price_data][recurring][interval]', 'month')
  if (payment.stripe_customer_id) body.set('customer', payment.stripe_customer_id)
  else body.set('customer_email', payment.customer_email)
  if (payment.payment_category === 'guardemar_service') {
    if (!payment.stripe_tax_rate_id) throw new HttpError(503, 'A separate inclusive add-on VAT Tax Rate must be configured.')
    body.set('line_items[0][tax_rates][0]', payment.stripe_tax_rate_id)
  }
  for (const [key, value] of Object.entries(addonMetadata(payment, subscription, attempt.id))) {
    body.set(`metadata[${key}]`, value)
    body.set(`${monthly ? 'subscription_data' : 'payment_intent_data'}[metadata][${key}]`, value)
  }
  return body
}
async function prepareConfiguration(database: AuthContext['database'], payment: BillingRow, stripe: StripeCall) {
  let productId = payment.stripe_product_id
  if (!productId) productId = environment(`STRIPE_ADDON_PRODUCT_${payment.service_code.replaceAll('-', '_').toUpperCase()}`)
  if (!productId?.startsWith('prod_')) throw new HttpError(503, 'This add-on needs an approved shared Stripe Product.', 'STRIPE_CONFIGURATION_ERROR')
  const product = await stripe<BillingRow>(`/products/${encodeURIComponent(productId)}`)
  if (!product.livemode || !product.active || product.metadata?.payment_domain !== 'addon' || product.metadata?.service_code !== payment.service_code) throw new HttpError(503, 'The add-on Stripe Product does not match this service.', 'STRIPE_CONFIGURATION_ERROR')
  let taxRateId: string | null = null
  if (payment.payment_category === 'guardemar_service') {
    taxRateId = payment.stripe_tax_rate_id || environment('STRIPE_ADDON_VAT_INCLUSIVE_TAX_RATE_ID')
    if (!taxRateId?.startsWith('txr_')) throw new HttpError(503, 'Configure the separate inclusive 23% add-on VAT Tax Rate.', 'STRIPE_CONFIGURATION_ERROR')
    const rate = await stripe<BillingRow>(`/tax_rates/${encodeURIComponent(taxRateId)}`)
    if (!rate.livemode || !rate.active || rate.inclusive !== true || rate.percentage !== 23 || rate.country !== 'PT' || rate.tax_type !== 'vat') throw new HttpError(503, 'Add-on VAT must be LIVE, inclusive, Portuguese VAT at 23%.', 'STRIPE_CONFIGURATION_ERROR')
  }
  let customerId = payment.stripe_customer_id
  if (payment.client_id) {
    const client = checked(await database.from('clients').select('id,first_name,last_name,email,stripe_customer_id').eq('id', payment.client_id).single())
    if (!client) throw new HttpError(409, 'The linked client is missing.')
    if (customerId && client.stripe_customer_id && customerId !== client.stripe_customer_id) throw new HttpError(409, 'The canonical Stripe Customer has changed.')
    customerId = customerId || client.stripe_customer_id
    if (!customerId) {
      // Identical Customer idempotency and parameters to core subscriptions.
      const customer = await stripe<BillingRow>('/customers', { method: 'POST', body: new URLSearchParams({ name: `${client.first_name} ${client.last_name}`, email: client.email, 'metadata[client_id]': client.id }), idempotencyKey: `guardemar-client-${client.id}` })
      if (!customer.livemode) throw new HttpError(503, 'Stripe returned a non-live Customer.')
      const linked = checked(await database.from('clients').update({ stripe_customer_id: customer.id }).eq('id', client.id).is('stripe_customer_id', null).select('stripe_customer_id').maybeSingle())
      const canonical = linked ?? checked(await database.from('clients').select('stripe_customer_id').eq('id', client.id).single())
      if (!canonical || canonical.stripe_customer_id !== customer.id) throw new HttpError(409, 'Stripe Customer ownership could not be confirmed.')
      customerId = customer.id
    }
  }
  if (customerId) {
    const customer = await stripe<BillingRow>(`/customers/${encodeURIComponent(customerId)}`)
    if (customer.deleted || !customer.livemode || (payment.payment_category === 'guardemar_service' && customer.tax_exempt !== 'none')) throw new HttpError(409, 'Customer tax or LIVE state would change the confirmed gross amount.')
    if (payment.payment_type === 'monthly' && ((customer.balance ?? 0) !== 0 || Object.values(customer.invoice_credit_balance ?? {}).some((balance) => balance !== 0) || customer.discount || customer.discounts?.length)) throw new HttpError(409, 'Customer credits or discounts would change the agreed monthly amount. Reconcile them before creating the link.')
  }
  checked(await database.from('addon_payments').update({ stripe_customer_id: customerId || null, stripe_product_id: productId, stripe_tax_rate_id: taxRateId }).eq('id', payment.id))
  return { ...payment, stripe_customer_id: customerId || null, stripe_product_id: productId, stripe_tax_rate_id: taxRateId }
}
export async function sendAddonPayment(auth: AuthContext, paymentId: string, action: 'send' | 'resend' | 'replace', actionKey: string, dependencies = { stripe: stripeRequest, configuration: billingConfiguration, queueEmail: queueAddonBillingEmail, deliverEmail: deliverAddonBillingEmail }) {
  if (auth.role !== 'admin') throw new HttpError(403, 'Administrator access is required.')
  const configuration = dependencies.configuration()
  if (!configuration.livePaymentsEnabled) throw new HttpError(409, 'Controlled LIVE add-on tests await approval.', 'ADDON_PAYMENT_APPROVAL_REQUIRED')
  const database = auth.database
  let payment = checked(await database.from('addon_payments').select('*').eq('id', paymentId).single()) as BillingRow
  if (payment.payment_category === 'external_provider' && !configuration.externalProviderEnabled) throw new HttpError(409, 'External Provider LIVE accounting activation awaits approval.', 'EXTERNAL_PROVIDER_APPROVAL_REQUIRED')
  const subscription = checked(await database.from('addon_subscriptions').select('*').eq('addon_payment_id', paymentId).maybeSingle()) as BillingRow | null
  if (payment.payment_status === 'paid' || payment.payment_status === 'cancelled' || subscription?.activated_at || ['active','past_due','cancelled','ended'].includes(subscription?.status)) throw new HttpError(409, 'This payment or subscription cannot be recreated or resent.')
  const previous = checked(await database.from('addon_checkout_attempts').select('*').eq('addon_payment_id', paymentId).order('generation', { ascending: false }).limit(1).maybeSingle()) as BillingRow | null
  if (action === 'resend' && !previous?.stripe_checkout_session_id) throw new HttpError(409, 'There is no existing link to resend.')
  let existingSession: BillingRow | null = null
  if (previous?.stripe_checkout_session_id) {
    existingSession = await dependencies.stripe<BillingRow>(`/checkout/sessions/${encodeURIComponent(previous.stripe_checkout_session_id)}`)
    assertAddonMetadata(existingSession.metadata, payment, subscription)
    if (!existingSession.livemode || existingSession.status === 'complete' || existingSession.payment_status === 'paid' || existingSession.subscription) throw new HttpError(409, 'Stripe payment confirmation is pending or already complete. Replacement was stopped.')
    if (existingSession.payment_intent) {
      const intent = await dependencies.stripe<BillingRow>(`/payment_intents/${encodeURIComponent(typeof existingSession.payment_intent === 'string' ? existingSession.payment_intent : existingSession.payment_intent.id)}`)
      if (!intent.livemode || ['processing','succeeded'].includes(intent.status) || intent.amount_received > 0 || (existingSession.status === 'expired' && intent.status !== 'canceled')) throw new HttpError(409, 'PaymentIntent state prevents another payment link.')
    }
    if (existingSession.status !== 'open' && existingSession.status !== 'expired') throw new HttpError(409, 'Stripe state could not be reconciled.')
    if (existingSession.status === 'expired') {
      if (action !== 'replace') throw new HttpError(409, 'This link has expired. Use the controlled replacement action.')
      checked(await database.rpc('expire_addon_checkout', { actor: auth.user.id, attempt_id: previous.id, session_id: existingSession.id }))
    } else if (action === 'replace') throw new HttpError(409, 'A valid payment link already exists. Resend it instead.')
  } else if (action === 'replace') throw new HttpError(409, 'No expired Checkout exists to replace.')
  const lease = randomUUID()
  const attempt = checked(await database.rpc('claim_addon_checkout', { actor: auth.user.id, payment_id: paymentId, lease, replace_attempt: action === 'replace' ? previous?.id : null })) as BillingRow
  let session = existingSession?.status === 'open' ? existingSession : null
  if (attempt.status === 'open' && !session) session = await dependencies.stripe<BillingRow>(`/checkout/sessions/${encodeURIComponent(attempt.stripe_checkout_session_id)}`)
  if (!session) {
    payment = await prepareConfiguration(database, payment, dependencies.stripe)
    session = await dependencies.stripe<BillingRow>('/checkout/sessions', { method: 'POST', body: buildAddonCheckout(payment, subscription, attempt), idempotencyKey: attempt.idempotency_key })
    if (!session.livemode || session.status !== 'open' || !session.url?.startsWith('https://checkout.stripe.com/')) throw new HttpError(409, 'Stripe Checkout state could not be confirmed.')
    verifyAddonOpenSession(session, payment, subscription, attempt)
    checked(await database.rpc('record_addon_checkout', { actor: auth.user.id, attempt_id: attempt.id, lease, session_id: session.id, session_url: session.url, expiry: new Date(session.expires_at * 1000).toISOString() }))
  }
  verifyAddonOpenSession(session, payment, subscription, attempt)
  const current = checked(await database.from('addon_payments').select('payment_status').eq('id', paymentId).single())
  if (!current || current.payment_status === 'paid') throw new HttpError(409, 'Payment has already been confirmed.')
  const emailKey = action === 'resend' ? `addon-link-${attempt.id}-resend-${actionKey}` : `addon-link-${attempt.id}`
  await dependencies.queueEmail(database, paymentId, emailKey, 'link', session.url, auth.user.id)
  let delivered = false
  try { delivered = await dependencies.deliverEmail(database, emailKey) } catch { console.error('addon_billing_email_pending', { paymentId }) }
  return { sent: delivered, emailDeliveryPending: !delivered, reused: attempt.status === 'open' }
}
