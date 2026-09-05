import type { Config } from '@netlify/functions'
import { Resend } from 'resend'

import { formatEuro, subscriptionPlans } from '../../src/config/subscriptions.ts'
import { environment, HttpError, json, serviceDatabase, stripeRequest, verifyStripePrice, verifyStripeSignature, verifyStripeTaxRate } from './_subscription-shared.mts'

type StripeEvent = { id: string; type: string; api_version?: string; livemode: boolean; created: number; data: { object: Record<string, any>; previous_attributes?: Record<string, any> } }

function requireDatabase<T>(result: { data: T; error: { code?: string } | null }, operation: string) {
  if (result.error) throw new Error(`${operation} failed (${result.error.code || 'database_error'})`)
  return result.data
}

function unixDate(value: unknown) {
  return typeof value === 'number' ? new Date(value * 1000).toISOString() : null
}

function invoiceTaxAmount(object: Record<string, any>) {
  const taxes = Array.isArray(object.total_taxes) ? object.total_taxes : Array.isArray(object.total_tax_amounts) ? object.total_tax_amounts : []
  return taxes.reduce((sum: number, item: { amount?: number }) => sum + (item.amount ?? 0), 0)
}

function subscriptionIdFrom(object: Record<string, any>) {
  return object.metadata?.guardemar_subscription_id
    || object.subscription_details?.metadata?.guardemar_subscription_id
    || object.parent?.subscription_details?.metadata?.guardemar_subscription_id
    || null
}

function stripeSubscriptionIdFrom(object: Record<string, any>) {
  return typeof object.subscription === 'string'
    ? object.subscription
    : typeof object.parent?.subscription_details?.subscription === 'string'
      ? object.parent.subscription_details.subscription
      : object.object === 'subscription' ? object.id : null
}

function escapeHtml(value: unknown) {
  return String(value ?? '').replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character] || character)
}

function webhookLedgerPayload(event: StripeEvent) {
  const object = event.data.object
  return {
    id: event.id,
    type: event.type,
    api_version: event.api_version ?? null,
    livemode: event.livemode,
    created: event.created,
    object: {
      id: object.id ?? null,
      object: object.object ?? null,
      customer: typeof object.customer === 'string' ? object.customer : null,
      subscription: stripeSubscriptionIdFrom(object),
      status: object.status ?? null,
      metadata: object.metadata ?? object.subscription_details?.metadata ?? object.parent?.subscription_details?.metadata ?? {},
    },
  }
}

function eventMetadata(object: Record<string, any>) {
  return object.metadata ?? object.subscription_details?.metadata ?? object.parent?.subscription_details?.metadata ?? {}
}

function assertEventOwnership(local: Record<string, any>, object: Record<string, any>) {
  const metadata = eventMetadata(object)
  if (metadata.guardemar_subscription_id && metadata.guardemar_subscription_id !== local.id) throw new HttpError(409, 'Stripe metadata subscription ownership mismatch.', 'STRIPE_STATE_ERROR')
  if (metadata.client_id && metadata.client_id !== local.client_id) throw new HttpError(409, 'Stripe metadata client ownership mismatch.', 'STRIPE_STATE_ERROR')
  if (metadata.property_id && metadata.property_id !== local.property_id) throw new HttpError(409, 'Stripe metadata property ownership mismatch.', 'STRIPE_STATE_ERROR')
  if (metadata.agreement_acceptance_id && metadata.agreement_acceptance_id !== local.agreement_acceptance_id) throw new HttpError(409, 'Stripe metadata agreement ownership mismatch.', 'STRIPE_STATE_ERROR')
}

async function locateSubscription(database: ReturnType<typeof serviceDatabase>, object: Record<string, any>) {
  const localId = subscriptionIdFrom(object)
  if (localId) {
    const local = await database.from('service_subscriptions').select('*').eq('id', localId).maybeSingle()
    requireDatabase(local, 'subscription metadata lookup')
    if (local.data) return local.data
  }
  const stripeSubscriptionId = stripeSubscriptionIdFrom(object)
  if (!stripeSubscriptionId) return null
  const existing = await database.from('service_subscriptions').select('*').eq('stripe_subscription_id', stripeSubscriptionId).maybeSingle()
  requireDatabase(existing, 'Stripe subscription lookup')
  if (existing.data) return existing.data
  const stripeSubscription = object.object === 'subscription' ? object : await stripeRequest<Record<string, any>>(`/subscriptions/${encodeURIComponent(stripeSubscriptionId)}`)
  const metadataId = stripeSubscription.metadata?.guardemar_subscription_id
  if (!metadataId) return null
  const byMetadata = await database.from('service_subscriptions').select('*').eq('id', metadataId).maybeSingle()
  requireDatabase(byMetadata, 'Stripe metadata subscription lookup')
  return byMetadata.data ?? null
}

async function sendEmail(database: ReturnType<typeof serviceDatabase>, local: Record<string, any>, subject: string, heading: string, copy: string, idempotencyKey: string, actionUrl?: string) {
  const resendKey = environment('RESEND_API_KEY')
  if (!resendKey) return
  const client = await database.from('clients').select('first_name,last_name,email').eq('id', local.client_id).single()
  const property = await database.from('properties').select('display_name').eq('id', local.property_id).single()
  requireDatabase(client, 'subscription email client lookup')
  requireDatabase(property, 'subscription email property lookup')
  const name = escapeHtml(`${client.data.first_name} ${client.data.last_name}`.trim())
  const propertyName = escapeHtml(property.data.display_name)
  const plan = subscriptionPlans[local.plan_code as keyof typeof subscriptionPlans]
  const action = actionUrl?.startsWith('https://') ? `<p><a href="${escapeHtml(actionUrl)}" style="display:inline-block;padding:12px 18px;background:#06275a;color:#fff;text-decoration:none;font-weight:bold">Review secure payment</a></p>` : ''
  const html = `<div style="font-family:Arial,sans-serif;color:#17324d;line-height:1.6"><h1 style="font-family:Georgia,serif;color:#06275a">${escapeHtml(heading)}</h1><p>Dear ${name},</p><p>${escapeHtml(copy)}</p>${action}<p><strong>Property:</strong> ${propertyName}<br><strong>Plan:</strong> ${escapeHtml(plan.name)}<br><strong>Billing:</strong> ${local.billing_interval === 'month' ? 'Monthly in advance under a 12-month service agreement' : 'Annually in advance under a 12-month service agreement'}<br><strong>Amount:</strong> ${escapeHtml(formatEuro(local.gross_amount))} including ${escapeHtml(local.tax_display_name)}</p><p>Kind regards,<br>GUARDEMAR<br>Private Property Care</p></div>`
  const resend = new Resend(resendKey)
  await resend.emails.send({ from: 'GUARDEMAR <info@guardemar.com>', to: [client.data.email], bcc: ['info@guardemar.com'], subject, html }, { idempotencyKey })
}

async function audit(database: ReturnType<typeof serviceDatabase>, event: StripeEvent, localId: string, eventType: string, metadata: Record<string, unknown> = {}) {
  const result = await database.from('audit_events').insert({ actor_user_id: null, event_type: eventType, entity_type: 'service_subscription', entity_id: localId, metadata: { ...metadata, stripeEventId: event.id } })
  if (result.error && result.error.code !== '23505') requireDatabase(result, 'subscription audit write')
}

async function recordPayment(database: ReturnType<typeof serviceDatabase>, event: StripeEvent, localId: string, status: 'paid' | 'failed' | 'action_required', object: Record<string, any>) {
  const gross = object.amount_paid ?? object.amount_due ?? null
  const tax = invoiceTaxAmount(object)
  const result = await database.from('subscription_payment_events').upsert({
    subscription_id: localId,
    stripe_event_id: event.id,
    stripe_invoice_id: object.id,
    event_type: event.type,
    payment_status: status,
    amount_net: gross !== null && tax !== null ? gross - tax : null,
    amount_tax: tax,
    amount_gross: gross,
    currency: object.currency?.toUpperCase() ?? null,
    action_url: typeof object.hosted_invoice_url === 'string' ? object.hosted_invoice_url : null,
    occurred_at: new Date(event.created * 1000).toISOString(),
    metadata: { attemptCount: object.attempt_count ?? null, nextPaymentAttempt: unixDate(object.next_payment_attempt) },
  }, { onConflict: 'stripe_event_id,event_type', ignoreDuplicates: true })
  requireDatabase(result, 'subscription payment history write')
}

async function verifyPaidInvoice(database: ReturnType<typeof serviceDatabase>, local: Record<string, any>, object: Record<string, any>) {
  const stripeSubscriptionId = stripeSubscriptionIdFrom(object)
  if (!stripeSubscriptionId) throw new HttpError(409, 'Paid invoice is missing its Stripe subscription.', 'STRIPE_STATE_ERROR')
  if (object.currency?.toUpperCase() !== 'EUR') throw new HttpError(409, 'Paid invoice currency does not match the accepted Service Order.', 'STRIPE_STATE_ERROR')
  const paidTax = invoiceTaxAmount(object)
  if (object.amount_paid !== local.gross_amount || paidTax !== local.tax_amount) throw new HttpError(409, 'Paid invoice net, tax, or gross amount does not match the accepted Service Order.', 'STRIPE_STATE_ERROR')
  const stripeSubscription = await stripeRequest<Record<string, any>>(`/subscriptions/${encodeURIComponent(stripeSubscriptionId)}`)
  if (!stripeSubscription.livemode || stripeSubscription.status !== 'active') throw new HttpError(409, 'Stripe subscription is not live and active.', 'STRIPE_STATE_ERROR')
  if (stripeSubscription.customer !== local.stripe_customer_id) throw new HttpError(409, 'Stripe Customer does not match the Guardemar client record.', 'STRIPE_STATE_ERROR')
  const item = stripeSubscription.items?.data?.[0]
  const defaultTaxRateIds = (stripeSubscription.default_tax_rates ?? []).map((taxRate: string | { id?: string }) => typeof taxRate === 'string' ? taxRate : taxRate.id)
  if (!item || item.quantity !== 1 || item.price?.id !== local.stripe_price_id || !defaultTaxRateIds.includes(local.stripe_tax_rate_id)) throw new HttpError(409, 'Stripe subscription Price or default Tax Rate does not match the accepted Service Order.', 'STRIPE_STATE_ERROR')
  const acceptance = await database.from('service_agreement_acceptances').select('stripe_price_id,stripe_tax_rate_id,tax_percentage,tax_amount,gross_amount').eq('id', local.agreement_acceptance_id).single()
  if (acceptance.error || acceptance.data.stripe_price_id !== local.stripe_price_id || acceptance.data.stripe_tax_rate_id !== local.stripe_tax_rate_id || acceptance.data.tax_amount !== local.tax_amount || acceptance.data.gross_amount !== local.gross_amount) throw new HttpError(409, 'Immutable agreement Price or tax evidence does not match the subscription.', 'STRIPE_STATE_ERROR')
  await verifyStripePrice(acceptance.data.stripe_price_id, local.selected_net_amount, local.billing_interval, 'The Stripe Price attached to the paid subscription', !local.activated_at)
  await verifyStripeTaxRate(acceptance.data.stripe_tax_rate_id, Number(acceptance.data.tax_percentage), !local.activated_at)
  return stripeSubscriptionId
}

async function processEvent(database: ReturnType<typeof serviceDatabase>, event: StripeEvent) {
  const object = event.data.object
  let local = await locateSubscription(database, object)
  if (!local && ['payment_method.attached', 'payment_method.detached', 'customer.updated'].includes(event.type)) {
    const customerId = event.type === 'customer.updated' ? object.id : object.customer
    const byCustomer = typeof customerId === 'string' ? await database.from('service_subscriptions').select('*').eq('stripe_customer_id', customerId).order('created_at', { ascending: false }).limit(1).maybeSingle() : { data: null, error: null }
    requireDatabase(byCustomer, 'Stripe Customer subscription lookup')
    local = byCustomer.data ?? null
  }
  if (!local) return
  assertEventOwnership(local, object)
  const now = new Date().toISOString()

  if (event.type === 'checkout.session.completed') {
    if (local.stripe_checkout_session_id && local.stripe_checkout_session_id !== object.id) return
    if (local.local_status === 'active') {
      await audit(database, event, local.id, 'checkout_completed', { checkoutSessionId: object.id })
      return
    }
    if (typeof object.customer === 'string' && local.stripe_customer_id && object.customer !== local.stripe_customer_id) throw new HttpError(409, 'Checkout Customer does not match the Guardemar client record.', 'STRIPE_STATE_ERROR')
    const update = await database.from('service_subscriptions').update({
      stripe_checkout_session_id: object.id,
      stripe_customer_id: typeof object.customer === 'string' ? object.customer : local.stripe_customer_id,
      stripe_subscription_id: typeof object.subscription === 'string' ? object.subscription : local.stripe_subscription_id,
      local_status: 'pending_payment', payment_status: 'pending', updated_at: now,
    }).eq('id', local.id)
    requireDatabase(update, 'Checkout completion update')
    await audit(database, event, local.id, 'checkout_completed', { checkoutSessionId: object.id })
    return
  }

  if (event.type === 'checkout.session.expired') {
    if (local.stripe_checkout_session_id !== object.id || local.local_status !== 'pending_payment') return
    const update = await database.from('service_subscriptions').update({ local_status: 'accepted', payment_status: 'not_started', checkout_expires_at: unixDate(object.expires_at), updated_at: now }).eq('id', local.id)
    requireDatabase(update, 'Checkout expiry update')
    await audit(database, event, local.id, 'subscription_updated', { reason: 'checkout_expired', checkoutSessionId: object.id })
    return
  }

  if (event.type.startsWith('customer.subscription.')) {
    const eventOccurredAt = new Date(event.created * 1000).toISOString()
    if (local.stripe_state_updated_at && new Date(local.stripe_state_updated_at).getTime() > event.created * 1000) return
    const firstItem = object.items?.data?.[0]
    if (typeof object.customer === 'string' && local.stripe_customer_id && object.customer !== local.stripe_customer_id) throw new HttpError(409, 'Stripe subscription Customer does not match the Guardemar client record.', 'STRIPE_STATE_ERROR')
    if (firstItem?.price?.id && local.stripe_price_id && firstItem.price.id !== local.stripe_price_id) throw new HttpError(409, 'Stripe subscription Price does not match the immutable Guardemar agreement.', 'STRIPE_STATE_ERROR')
    const periodStart = object.current_period_start ?? firstItem?.current_period_start
    const periodEnd = object.current_period_end ?? firstItem?.current_period_end
    const update: Record<string, unknown> = {
      stripe_subscription_id: object.id,
      stripe_customer_id: typeof object.customer === 'string' ? object.customer : local.stripe_customer_id,
      stripe_subscription_status: object.status,
      stripe_current_period_start: unixDate(periodStart),
      stripe_current_period_end: unixDate(periodEnd),
      renews_at: unixDate(periodEnd)?.slice(0, 10),
      stripe_state_updated_at: eventOccurredAt,
      updated_at: now,
    }
    if (event.type === 'customer.subscription.deleted' || ['canceled', 'incomplete_expired'].includes(object.status)) Object.assign(update, { local_status: 'ended', ended_at: now })
    else if (object.status === 'past_due') Object.assign(update, { local_status: 'past_due' })
    else if (object.status === 'unpaid' || object.status === 'paused') Object.assign(update, { local_status: 'suspended' })
    else if (object.status === 'incomplete') Object.assign(update, { local_status: 'pending_payment' })
    const subscriptionUpdate = await database.from('service_subscriptions').update(update).eq('id', local.id)
    requireDatabase(subscriptionUpdate, 'Stripe subscription state update')
    await audit(database, event, local.id, event.type === 'customer.subscription.deleted' ? 'subscription_ended' : 'subscription_updated', { stripeStatus: object.status })
    return
  }

  if (event.type === 'invoice.paid') {
    if (local.payment_state_updated_at && new Date(local.payment_state_updated_at).getTime() > event.created * 1000) {
      await recordPayment(database, event, local.id, 'paid', object)
      return
    }
    const wasEverActivated = Boolean(local.activated_at)
    const verifiedStripeSubscriptionId = await verifyPaidInvoice(database, local, object)
    await recordPayment(database, event, local.id, 'paid', object)
    if (!wasEverActivated) {
      await sendEmail(database, local, 'Your Guardemar service subscription is confirmed', 'Your service subscription is confirmed', 'Stripe has confirmed payment and your Guardemar service subscription is now active. Your accepted Service Order and General Terms remain available in the client portal.', `${event.id}-subscription-confirmed`)
    }
    const activationUpdate = await database.from('service_subscriptions').update({
      local_status: 'active', payment_status: 'paid', stripe_subscription_id: verifiedStripeSubscriptionId,
      last_payment_failed_at: null,
      activated_at: local.activated_at || now,
      payment_state_updated_at: new Date(event.created * 1000).toISOString(), updated_at: now,
    }).eq('id', local.id)
    requireDatabase(activationUpdate, 'paid invoice activation update')
    await audit(database, event, local.id, 'payment_succeeded', { invoiceId: object.id })
    if (!wasEverActivated) {
      await audit(database, event, local.id, 'subscription_activated', { invoiceId: object.id })
    }
    return
  }

  if (event.type === 'invoice.payment_failed') {
    await recordPayment(database, event, local.id, 'failed', object)
    if (local.payment_state_updated_at && new Date(local.payment_state_updated_at).getTime() > event.created * 1000) return
    const failureUpdate = await database.from('service_subscriptions').update({ local_status: 'past_due', payment_status: 'failed', last_payment_failed_at: now, payment_state_updated_at: new Date(event.created * 1000).toISOString(), updated_at: now }).eq('id', local.id)
    requireDatabase(failureUpdate, 'failed invoice state update')
    await audit(database, event, local.id, 'payment_failed', { invoiceId: object.id, attemptCount: object.attempt_count ?? null })
    await sendEmail(database, local, 'Action needed: Guardemar payment was unsuccessful', 'Payment was unsuccessful', 'Stripe could not collect the scheduled payment. The service agreement, Service Order and payment history remain recorded. Please review the secure payment page or use the client portal to manage your payment method.', `${event.id}-payment-failed`, object.hosted_invoice_url)
    return
  }

  if (event.type === 'invoice.payment_action_required') {
    await recordPayment(database, event, local.id, 'action_required', object)
    if (local.payment_state_updated_at && new Date(local.payment_state_updated_at).getTime() > event.created * 1000) return
    const actionUpdate = await database.from('service_subscriptions').update({ local_status: 'payment_action_required', payment_status: 'action_required', payment_state_updated_at: new Date(event.created * 1000).toISOString(), updated_at: now }).eq('id', local.id)
    requireDatabase(actionUpdate, 'payment action-required state update')
    await audit(database, event, local.id, 'payment_action_required', { invoiceId: object.id })
    await sendEmail(database, local, 'Action needed to complete your Guardemar payment', 'Payment authentication is required', 'Your bank requires an additional authentication step before Stripe can complete payment. Please use the secure payment page to complete the required action.', `${event.id}-payment-action-required`, object.hosted_invoice_url)
    return
  }

  if (['payment_method.attached', 'payment_method.detached', 'customer.updated'].includes(event.type)) {
    if (event.type === 'customer.updated' && !event.data.previous_attributes?.invoice_settings && !('default_source' in (event.data.previous_attributes ?? {}))) return
    await audit(database, event, local.id, 'payment_method_updated', { sourceEvent: event.type, paymentMethodId: event.type.startsWith('payment_method.') ? object.id : null })
  }
}

export default async (req: Request) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, { status: 405 })
  const secret = environment('STRIPE_WEBHOOK_SECRET')
  if (!secret || !secret.startsWith('whsec_')) return json({ error: 'Stripe webhook is not configured.' }, { status: 503 })
  const rawBody = await req.text()
  const signature = req.headers.get('stripe-signature') || ''
  if (!verifyStripeSignature(rawBody, signature, secret)) return json({ error: 'Invalid Stripe signature.' }, { status: 400 })

  try {
    const event = JSON.parse(rawBody) as StripeEvent
    if (!event.livemode) return json({ error: 'Test-mode Stripe events are not accepted by this production endpoint.' }, { status: 400 })
    const database = serviceDatabase()
    const inserted = await database.from('stripe_webhook_events').insert({ stripe_event_id: event.id, event_type: event.type, api_version: event.api_version ?? null, livemode: event.livemode, payload: webhookLedgerPayload(event), processing_status: 'processing', last_attempt_at: new Date().toISOString() })
    if (inserted.error) {
      if (inserted.error.code !== '23505') throw inserted.error
      const existing = await database.from('stripe_webhook_events').select('processing_status,last_attempt_at').eq('stripe_event_id', event.id).single()
      requireDatabase(existing, 'webhook idempotency lookup')
      if (existing.data?.processing_status === 'processed') return json({ received: true, duplicate: true })
      const staleProcessing = existing.data?.processing_status === 'processing' && Date.now() - new Date(existing.data.last_attempt_at).getTime() > 5 * 60 * 1000
      if (existing.data?.processing_status === 'processing' && !staleProcessing) return json({ error: 'Webhook event is already processing.' }, { status: 409 })
      const retryUpdate = await database.from('stripe_webhook_events').update({ processing_status: 'processing', processing_error: null, last_attempt_at: new Date().toISOString() }).eq('stripe_event_id', event.id)
      requireDatabase(retryUpdate, 'webhook retry claim')
    }
    try {
      await processEvent(database, event)
      const processedUpdate = await database.from('stripe_webhook_events').update({ processing_status: 'processed', processed_at: new Date().toISOString(), processing_error: null }).eq('stripe_event_id', event.id)
      requireDatabase(processedUpdate, 'webhook completion write')
      return json({ received: true })
    } catch (processingError) {
      await database.from('stripe_webhook_events').update({ processing_status: 'failed', processing_error: processingError instanceof Error ? processingError.message.slice(0, 1000) : 'Unknown processing error' }).eq('stripe_event_id', event.id)
      throw processingError
    }
  } catch (error) {
    console.error('Stripe webhook processing failed', error instanceof Error ? error.message : 'unknown error')
    const status = error instanceof HttpError ? error.status : 500
    return json({ error: 'Webhook processing failed.' }, { status })
  }
}

export const config: Config = { path: '/api/stripe/webhook' }
