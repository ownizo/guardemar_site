import { Resend } from 'resend'
import { addonServiceCatalogue } from '../../src/config/optional-services.ts'
import { business } from '../../src/config/site.ts'
import { shoppingPaymentMessage } from '../../src/lib/portal/addons.ts'
import { checked, escapeHtml } from './_addon-shared.mts'
import { environment, HttpError, type AuthContext } from './_subscription-shared.mts'

export function billingEmailEnvelope(payment: Record<string, any>, kind: 'link' | 'confirmed' | 'activated', url?: string) {
  const monthly = payment.payment_type === 'monthly'
  const service = addonServiceCatalogue.find((item) => item.id === payment.service_code)?.name ?? payment.service_code
  const name = payment.clients ? `${payment.clients.first_name} ${payment.clients.last_name}`.trim() : ''
  const total = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'EUR' }).format(payment.amount / 100)
  const subject = kind === 'link' ? monthly ? `Activate your Guardemar monthly service — ${service}` : `Your Guardemar payment link — ${service}` : kind === 'activated' ? `Your Guardemar monthly service is active — ${service}` : `Your Guardemar payment is confirmed — ${service}`
  const copy = kind === 'link' ? monthly ? 'By completing Stripe Checkout, you are setting up a recurring monthly payment.' : 'Please review the confirmed service and final amount before payment.' : kind === 'activated' ? 'Stripe has confirmed your first payment. Your monthly payment setup is now active. Payment does not mean the operational service is completed.' : 'Stripe has confirmed your payment. Guardemar will arrange the operational service separately.'
  const amountLabel = monthly ? 'Monthly amount' : 'Final amount'
  const taxLabel = payment.payment_category === 'guardemar_service' ? 'VAT included (23%)' : 'Final charge. External provider tax treatment is recorded separately.'
  const cta = monthly ? 'Set up monthly payment' : 'Proceed to secure payment'
  if (kind === 'link' && !url?.startsWith('https://checkout.stripe.com/')) throw new HttpError(409, 'Invalid secure payment URL.')
  const text = `${name ? `Dear ${name},` : 'Hello,'}\n\n${copy}\n\nService: ${service}\n${payment.properties?.display_name ? `Property: ${payment.properties.display_name}\n` : ''}Description: ${payment.description}\n${amountLabel}: ${total}\n${taxLabel}\nBilling frequency: ${monthly ? 'Monthly recurring' : 'One-time'}\n${payment.service_code === 'pre-arrival-shopping' ? `\n${shoppingPaymentMessage}\n` : ''}\nPayments are non-refundable once paid.\nYour payment is processed securely by Stripe.${kind === 'link' ? `\n\n${cta}: ${url}` : ''}\n\nKind regards,\nGUARDEMAR`
  return { from: `GUARDEMAR <${business.email}>`, to: [payment.customer_email], subject, text, html: `<div style="font-family:Arial,sans-serif;color:#06275a;line-height:1.7"><h1>${escapeHtml(subject)}</h1><p style="white-space:pre-wrap">${escapeHtml(text)}</p>${kind === 'link' ? `<p><a href="${escapeHtml(url)}" style="background:#06275a;color:white;padding:14px 20px;text-decoration:none;display:inline-block">${cta}</a></p>` : ''}</div>` }
}
export async function queueAddonBillingEmail(database: AuthContext['database'], paymentId: string, emailKey: string, kind: 'link' | 'confirmed' | 'activated', url?: string, actorId?: string) {
  const payment = checked(await database.from('addon_payments').select('*,clients(first_name,last_name),properties(display_name)').eq('id', paymentId).single())
  const subscription = payment.payment_type === 'monthly' ? checked(await database.from('addon_subscriptions').select('id').eq('addon_payment_id', paymentId).single()) : null
  const audit = kind === 'link' ? { audit_event_type: subscription ? emailKey.includes('-resend-') ? 'ADDON_SUBSCRIPTION_LINK_RESENT' : 'ADDON_SUBSCRIPTION_LINK_SENT' : emailKey.includes('-resend-') ? 'ADDON_PAYMENT_LINK_RESENT' : 'ADDON_PAYMENT_LINK_SENT', audit_entity_type: subscription ? 'addon_subscription' : 'addon_payment', audit_entity_id: subscription?.id ?? paymentId, actor_user_id: actorId ?? payment.created_by_admin } : {}
  const result = await database.from('addon_email_deliveries').insert({ ...audit, email_key: emailKey, addon_payment_id: paymentId, envelope: billingEmailEnvelope(payment, kind, url) })
  if (result.error?.code !== '23505') checked(result)
}
export async function deliverAddonBillingEmail(database: AuthContext['database'], emailKey: string, sender?: (envelope: any, options: { idempotencyKey: string }) => Promise<{ error: unknown; data: { id: string } | null }>) {
  const delivery = checked(await database.from('addon_email_deliveries').select('*').eq('email_key', emailKey).single())
  if (delivery.sent_at) return true
  if (delivery.first_attempt_at && Date.now() - new Date(delivery.first_attempt_at).getTime() > 23 * 3600000) return false
  if (delivery.claimed_at && Date.now() - new Date(delivery.claimed_at).getTime() < 5 * 60000) return false
  const apiKey = environment('RESEND_API_KEY')
  if (!apiKey) throw new HttpError(503, 'Transactional email is not configured.')
  let query = database.from('addon_email_deliveries').update({ claimed_at: new Date().toISOString(), first_attempt_at: delivery.first_attempt_at ?? new Date().toISOString() }).eq('email_key', emailKey).is('sent_at', null)
  query = delivery.claimed_at ? query.eq('claimed_at', delivery.claimed_at) : query.is('claimed_at', null)
  if (!checked(await query.select('email_key').maybeSingle())) return false
  const send = sender ?? ((envelope, options) => new Resend(apiKey).emails.send(envelope, options))
  const result = await send(delivery.envelope, { idempotencyKey: emailKey })
  if (result.error || !result.data?.id) throw new HttpError(502, 'Email delivery will be retried.')
  checked(await database.rpc('record_addon_email_sent', { delivery_key: emailKey, provider_id: result.data.id }))
  return true
}
