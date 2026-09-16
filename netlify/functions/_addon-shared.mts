import { Resend } from 'resend'
import { optionalServices } from '../../src/config/optional-services.ts'
import { business } from '../../src/config/site.ts'
import { environment, HttpError, type AuthContext } from './_subscription-shared.mts'

export function checked<T>(result: { data: T; error: { code?: string; message?: string } | null }): T {
  if (result.error) {
    const status = result.error.code === '42501' ? 403 : ['22023','40001','23505'].includes(result.error.code ?? '') ? 409 : 500
    throw new HttpError(status, status === 403 ? 'You do not have access to this request.' : status === 409 ? 'This request has changed or already has a payment. Refresh and review it before trying again.' : 'The service record could not be saved.', 'DATABASE_ERROR')
  }
  return result.data
}
export async function requireAddonAccess(auth: AuthContext, id: string) {
  const request = checked(await auth.database.from('addon_requests').select('*').eq('id', id).maybeSingle())
  if (!request) throw new HttpError(404, 'Service request not found.', 'NOT_FOUND')
  if (auth.role === 'customer') {
    const property = checked(await auth.database.from('property_users').select('id').eq('property_id', request.property_id).eq('user_id', auth.user.id).maybeSingle())
    const client = checked(await auth.database.from('client_users').select('id').eq('client_id', request.client_id).eq('user_id', auth.user.id).maybeSingle())
    if (!property || !client) throw new HttpError(404, 'Service request not found.', 'NOT_FOUND')
  }
  return request
}
export function escapeHtml(value: unknown) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!)
}
type AdminEmailSender = (message: { from: string; to: string[]; replyTo: string; subject: string; text: string; html: string }, options: { idempotencyKey: string }) => Promise<{ error: unknown; data: { id: string } | null }>
export async function sendAddonAdminEmail(database: AuthContext['database'], requestId: string, sender?: AdminEmailSender) {
  const apiKey = environment('RESEND_API_KEY')
  if (!apiKey) throw new HttpError(503, 'Operational email is not configured.')
  const delivery = checked(await database.from('addon_request_email_delivery').select('*').eq('request_id', requestId).single())
  if (delivery.sent_at) return
  // Resend retains idempotency keys for 24 hours. A stale ambiguous delivery is
  // never automatically retried outside that window; staff must reconcile it.
  if (delivery.first_attempt_at && Date.now() - new Date(delivery.first_attempt_at).getTime() > 23 * 60 * 60 * 1000) return
  if (delivery.claimed_at && Date.now() - new Date(delivery.claimed_at).getTime() < 5 * 60 * 1000) return
  const now = new Date().toISOString()
  let query = database.from('addon_request_email_delivery').update({ claimed_at: now, first_attempt_at: delivery.first_attempt_at ?? now }).eq('request_id', requestId).is('sent_at', null)
  query = delivery.claimed_at ? query.eq('claimed_at', delivery.claimed_at) : query.is('claimed_at', null)
  const claim = checked(await query.select('request_id').maybeSingle())
  if (!claim) return
  const request = checked(await database.from('addon_requests').select('*,clients(first_name,last_name,email),properties(display_name)').eq('id', requestId).single())
  const items = checked(await database.from('addon_shopping_items').select('product,quantity').eq('request_id', requestId).order('display_order')) ?? []
  const service = optionalServices.find((item) => item.id === request.service_code)
  const customer = `${request.clients.first_name} ${request.clients.last_name}`.trim()
  const url = `https://guardemar.com/admin/services/${requestId}`
  const summary = items.length ? `\nShopping list: ${items.length} items. ${items.slice(0, 10).map((item) => `${item.product} (${item.quantity})`).join('; ')}. Full list in Operations.` : ''
  const text = `New Optional Service Request\n\nRequest reference: ${request.request_reference}\nCustomer: ${customer}\nProperty: ${request.properties.display_name}\nService: ${service?.name ?? request.service_code}\nCustomer observations: ${request.customer_notes || 'None provided'}${summary}\n\nReview request: ${url}`
  const send = sender ?? ((message, options) => new Resend(apiKey).emails.send(message, options))
  const result = await send({ from: `GUARDEMAR <${business.email}>`, to: [business.email], replyTo: request.clients.email, subject: `New Guardemar service request — ${service?.name ?? request.service_code} — ${customer}`, text, html: `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#06275a"><h1>New Optional Service Request</h1><p style="white-space:pre-wrap">${escapeHtml(text)}</p><p><a href="${url}">Review service request</a></p></div>` }, { idempotencyKey: `guardemar-addon-request-${requestId}` })
  if (result.error || !result.data?.id) throw new HttpError(502, 'Operational email delivery will be retried.')
  checked(await database.from('addon_request_email_delivery').update({ sent_at: new Date().toISOString(), provider_message_id: result.data.id }).eq('request_id', requestId))
}
