import { checked } from './_addon-shared.mts'
import { assertAddonMetadata, type BillingRow } from './_addon-billing.mts'
import { queueAddonBillingEmail } from './_addon-email.mts'
import { HttpError, stripeRequest, type AuthContext } from './_subscription-shared.mts'
export type AddonStripeEvent = { id: string; type: string; livemode: boolean; created: number; data: { object: BillingRow } }
export function stripeObjectMetadata(object: BillingRow) {
  return { ...object.parent?.subscription_details?.metadata, ...object.subscription_details?.metadata, ...object.metadata }
}
export function stripeObjectSubscription(object: BillingRow) {
  const value = object.object === 'subscription' ? object.id : object.subscription ?? object.parent?.subscription_details?.subscription
  return typeof value === 'string' ? value : value?.id ?? null
}
export function isAddonMetadata(metadata: BillingRow) { return metadata.payment_domain === 'addon' || !!metadata.addon_payment_id || !!metadata.addon_subscription_id }
function mismatch(message: string): never { throw new HttpError(409, message, 'STRIPE_STATE_ERROR') }
export function verifyAddonSubscription(stripe: BillingRow, payment: BillingRow, subscription: BillingRow) {
  assertAddonMetadata(stripe.metadata, payment, subscription)
  if (!stripe.livemode || (subscription.stripe_subscription_id && stripe.id !== subscription.stripe_subscription_id) || (payment.stripe_customer_id && stripe.customer !== payment.stripe_customer_id) || (subscription.stripe_customer_id && stripe.customer !== subscription.stripe_customer_id)) mismatch('Add-on subscription/customer mismatch.')
  const items = stripe.items?.data ?? []
  const item = items[0]
  if (items.length !== 1 || item.quantity !== 1 || item.price?.unit_amount !== payment.amount || item.price.currency !== 'eur' || item.price.recurring?.interval !== 'month' || item.price.recurring?.interval_count !== 1 || item.price.tax_behavior !== 'inclusive' || item.price.product !== payment.stripe_product_id || (subscription.stripe_price_id && subscription.stripe_price_id !== item.price.id)) mismatch('Add-on recurring price/amount mismatch.')
  const rates = (item.tax_rates?.length ? item.tax_rates : stripe.default_tax_rates ?? []).map((rate: string | BillingRow) => typeof rate === 'string' ? rate : rate.id)
  if (payment.payment_category === 'guardemar_service' && (rates.length !== 1 || rates[0] !== payment.stripe_tax_rate_id)) mismatch('Add-on inclusive VAT mismatch.')
  if (payment.payment_category === 'external_provider' && rates.length) mismatch('Unexpected external provider tax calculation.')
  if (stripe.discounts?.length || item.discounts?.length || stripe.automatic_tax?.enabled) mismatch('Unexpected discount or automatic tax.')
  return item.price.id as string
}
export async function processAddonStripeEvent(database: AuthContext['database'], event: AddonStripeEvent, dependencies = { stripe: stripeRequest, queueEmail: queueAddonBillingEmail }) {
  if (!event.livemode) mismatch('Non-live add-on event.')
  const object = event.data.object
  let metadata = stripeObjectMetadata(object)
  let sub: BillingRow | null = null
  let stripeSubscription: BillingRow | null = null
  const stripeSubId = stripeObjectSubscription(object)
  if (metadata.addon_subscription_id) sub = checked(await database.from('addon_subscriptions').select('*').eq('id', metadata.addon_subscription_id).maybeSingle())
  else if (stripeSubId) sub = checked(await database.from('addon_subscriptions').select('*').eq('stripe_subscription_id', stripeSubId).maybeSingle())
  if (stripeSubId && (event.type.startsWith('invoice.') || event.type.startsWith('customer.subscription.'))) {
    stripeSubscription = await dependencies.stripe<BillingRow>(`/subscriptions/${encodeURIComponent(stripeSubId)}`)
    metadata = stripeSubscription.metadata ?? {}
    if (!sub && metadata.addon_subscription_id) sub = checked(await database.from('addon_subscriptions').select('*').eq('id', metadata.addon_subscription_id).maybeSingle())
  }
  const paymentId = metadata.addon_payment_id ?? sub?.addon_payment_id
  if (!paymentId) mismatch('Add-on payment linkage missing.')
  const payment = checked(await database.from('addon_payments').select('*').eq('id', paymentId).maybeSingle()) as BillingRow | null
  if (!payment) mismatch('Add-on payment record missing.')
  if (!sub && payment.payment_type === 'monthly') sub = checked(await database.from('addon_subscriptions').select('*').eq('addon_payment_id', payment.id).maybeSingle())
  assertAddonMetadata(metadata, payment, sub)
  if (payment.payment_type === 'monthly' && (!sub || sub.addon_payment_id !== payment.id)) mismatch('Monthly linkage mismatch.')
  const eventTime = new Date(event.created * 1000).toISOString()
  async function apply(action: string, evidence: BillingRow) { return checked(await database.rpc('apply_addon_stripe_state', { payment_id: payment!.id, stripe_event: event.id, event_time: eventTime, action, evidence })) }
  if (event.type.startsWith('checkout.session.')) {
    const session = await dependencies.stripe<BillingRow>(`/checkout/sessions/${encodeURIComponent(object.id)}`)
    assertAddonMetadata(session.metadata, payment, sub)
    const attempt = checked(await database.from('addon_checkout_attempts').select('*').eq('id', session.metadata.addon_checkout_attempt_id).eq('addon_payment_id', payment.id).maybeSingle()) as BillingRow | null
    if (!attempt || (attempt.stripe_checkout_session_id && attempt.stripe_checkout_session_id !== session.id) || !session.livemode || session.mode !== (sub ? 'subscription' : 'payment') || (payment.stripe_customer_id && session.customer !== payment.stripe_customer_id)) mismatch('Checkout attempt/customer mismatch.')
    if (event.type === 'checkout.session.expired') {
      if (session.status !== 'expired' || session.payment_status === 'paid') mismatch('Checkout is not expired.')
      await apply('expired', { attemptId: attempt.id, sessionId: session.id }); return
    }
    if (sub) {
      if (session.status === 'complete' && typeof session.subscription === 'string') {
        const stripeSub = await dependencies.stripe<BillingRow>(`/subscriptions/${encodeURIComponent(session.subscription)}`)
        verifyAddonSubscription(stripeSub, payment, sub)
        checked(await database.from('addon_subscriptions').update({ stripe_subscription_id: stripeSub.id, stripe_customer_id: session.customer, stripe_checkout_session_id: session.id }).eq('id', sub.id))
      }
      // Completing Checkout is acceptance, not payment-authoritative activation.
      return
    }
    if (!['checkout.session.completed','checkout.session.async_payment_succeeded'].includes(event.type)) return
    if (session.payment_status !== 'paid') return
    if (session.status !== 'complete' || session.currency !== 'eur' || session.amount_total !== payment.amount || !session.payment_intent) mismatch('Checkout paid amount mismatch.')
    const intent = await dependencies.stripe<BillingRow>(`/payment_intents/${encodeURIComponent(typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent.id)}`)
    assertAddonMetadata(intent.metadata, payment)
    if (intent.metadata.addon_checkout_attempt_id !== attempt.id) mismatch('PaymentIntent Checkout attempt mismatch.')
    if (!intent.livemode || intent.status !== 'succeeded' || intent.currency !== 'eur' || intent.amount !== payment.amount || intent.amount_received !== payment.amount || (payment.stripe_customer_id && intent.customer !== payment.stripe_customer_id)) mismatch('PaymentIntent confirmation mismatch.')
    if (payment.payment_category === 'guardemar_service' && session.total_details?.amount_tax !== payment.amount_tax) mismatch('Paid VAT breakdown mismatch.')
    if (payment.payment_category === 'external_provider' && session.total_details?.amount_tax) mismatch('Unexpected external provider VAT.')
    await apply('paid', { amountGross: payment.amount, currency: 'EUR', paymentIntentId: intent.id, sessionId: session.id, attemptId: attempt.id })
    await dependencies.queueEmail(database, payment.id, `addon-confirmed-${payment.id}`, 'confirmed'); return
  }
  if (!sub || !stripeSubscription) return
  const priceId = verifyAddonSubscription(stripeSubscription, payment, sub)
  const evidence = { subscriptionId: stripeSubscription.id, customerId: stripeSubscription.customer, priceId }
  if (event.type === 'invoice.paid') {
    const invoice = await dependencies.stripe<BillingRow>(`/invoices/${encodeURIComponent(object.id)}`)
    const taxes = invoice.total_taxes ?? invoice.total_tax_amounts ?? []
    const tax = taxes.reduce((sum: number, entry: BillingRow) => sum + (entry.amount ?? 0), 0)
    if (!invoice.livemode || invoice.status !== 'paid' || invoice.currency !== 'eur' || invoice.amount_paid !== payment.amount || invoice.total !== payment.amount || stripeObjectSubscription(invoice) !== stripeSubscription.id || invoice.customer !== stripeSubscription.customer || (payment.payment_category === 'guardemar_service' && tax !== payment.amount_tax) || (payment.payment_category === 'external_provider' && tax !== 0)) mismatch('Invoice/customer/amount/VAT mismatch.')
    if (stripeSubscription.status !== 'active') return // Current Stripe state wins over a delayed historical paid event.
    const activated = await apply('invoice_paid', { ...evidence, amountGross: payment.amount, currency: 'EUR', invoiceId: invoice.id })
    if (activated || sub.activated_at) await dependencies.queueEmail(database, payment.id, `addon-activated-${sub.id}`, 'activated'); return
  }
  if (event.type === 'invoice.payment_failed') {
    const invoice = await dependencies.stripe<BillingRow>(`/invoices/${encodeURIComponent(object.id)}`)
    if (!invoice.livemode || stripeObjectSubscription(invoice) !== stripeSubscription.id || invoice.customer !== stripeSubscription.customer || invoice.currency !== 'eur') mismatch('Failed invoice ownership mismatch.')
    if (invoice.status === 'paid') return
  }
  if (['customer.subscription.created','customer.subscription.updated','customer.subscription.deleted','invoice.payment_failed'].includes(event.type)) {
    if (stripeSubscription.status === 'canceled') await apply('cancelled', evidence)
    else if (stripeSubscription.status === 'incomplete_expired') await apply('ended', evidence)
    else if (['past_due','unpaid','paused'].includes(stripeSubscription.status)) await apply('past_due', { ...evidence, invoiceId: event.type === 'invoice.payment_failed' ? object.id : undefined })
  }
}
// Called inside the existing verified/idempotent webhook ledger. Add-on events
// return before core dispatch, including contradictory core metadata.
export async function dispatchAddonOrCore(database: AuthContext['database'], event: AddonStripeEvent, core: (database: AuthContext['database'], event: any) => Promise<void>, addon = processAddonStripeEvent, stripe = stripeRequest) {
  const object = event.data.object
  const metadata = stripeObjectMetadata(object)
  if (isAddonMetadata(metadata)) { await addon(database, event); return }
  const subscriptionId = stripeObjectSubscription(object)
  if (subscriptionId) {
    const linked = checked(await database.from('addon_subscriptions').select('id').eq('stripe_subscription_id', subscriptionId).maybeSingle())
    if (linked) { await addon(database, event); return }
  }
  if (subscriptionId && event.type === 'invoice.paid' && !metadata.guardemar_subscription_id) {
    // The first invoice can arrive before Checkout binds the local Stripe ID.
    const subscription = await stripe<BillingRow>(`/subscriptions/${encodeURIComponent(subscriptionId)}`)
    if (isAddonMetadata(subscription.metadata ?? {})) { await addon(database, event); return }
  }
  await core(database, event)
}
