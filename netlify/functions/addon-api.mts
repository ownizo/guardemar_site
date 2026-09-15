import { createHash } from 'node:crypto'
import type { Config } from '@netlify/functions'
import { z } from 'zod'
import { addonPaymentDraftSchema, addonRequestSchema, addonReviewSchema, operationalTransitions } from '../../src/lib/portal/addons.ts'
import { authenticate, HttpError, json, type AuthContext } from './_subscription-shared.mts'
import { addonServiceCatalogue } from '../../src/config/optional-services.ts'
import { billingConfiguration, sendAddonPayment } from './_addon-billing.mts'
import { stripeRequest } from './_subscription-shared.mts'
import { checked, requireAddonAccess, sendAddonAdminEmail } from './_addon-shared.mts'

const columns = 'id,request_reference,client_id,property_id,service_code,status,published_price_snapshot,published_price_note_snapshot,customer_notes,service_details,created_at,updated_at,properties(display_name,locality),addon_subscriptions(status,activated_at)'
const paymentsColumns = 'id,addon_request_id,service_code,payment_type,payment_category,description,currency,amount,amount_semantics,amount_net,amount_tax,payment_status,created_at,paid_at,addon_subscriptions(status,activated_at)'
function normalisePayment(payment: any) { return { ...payment, addon_subscriptions: Array.isArray(payment.addon_subscriptions) ? payment.addon_subscriptions : payment.addon_subscriptions ? [payment.addon_subscriptions] : [] } }
function staff(auth: AuthContext) { if (auth.role !== 'staff' && auth.role !== 'admin') throw new HttpError(403, 'Staff access is required.', 'AUTHORIZATION_ERROR') }
export async function handleAddonRequest(req: Request, dependencies: { authenticate: typeof authenticate; sendEmail: typeof sendAddonAdminEmail; sendPayment?: typeof sendAddonPayment } = { authenticate, sendEmail: sendAddonAdminEmail }) {
  try {
    if (!['GET','POST','PATCH'].includes(req.method)) throw new HttpError(405, 'Method not allowed.')
    if (Number(req.headers.get('content-length') ?? 0) > 120000) throw new HttpError(413, 'Request is too large.')
    const auth = await dependencies.authenticate(req)
    const path = new URL(req.url).pathname.replace(/^\/api\/addons\/?/, '').replace(/\/$/, '')
    const admin = path.startsWith('admin/') || path === 'admin'
    if (admin) staff(auth)
    const database = auth.database
    if (req.method === 'GET' && (path === '' || path === 'admin')) {
      let query = database.from('addon_requests').select(admin ? `${columns},clients(first_name,last_name,email,phone)` : columns).order('created_at', { ascending: false }).limit(200)
      if (!admin) {
        const properties = checked(await database.from('property_users').select('property_id').eq('user_id', auth.user.id)) ?? []
        const clients = checked(await database.from('client_users').select('client_id').eq('user_id', auth.user.id)) ?? []
        query = query.not('addon_subscriptions.stripe_checkout_session_id', 'is', null).in('property_id', properties.map((item) => item.property_id)).in('client_id', clients.map((item) => item.client_id))
      }
      return json({ requests: checked(await query) })
    }
    if (req.method === 'POST' && path === '') {
      if (auth.role !== 'customer') throw new HttpError(403, 'Customer access is required.')
      const raw = await req.text()
      if (raw.length > 120000) throw new HttpError(413, 'Request is too large.')
      const input = addonRequestSchema.parse(JSON.parse(raw))
      const fingerprint = createHash('sha256').update(JSON.stringify(input)).digest('hex')
      const id = checked(await database.rpc('create_addon_request', { actor: auth.user.id, input, fingerprint }))
      // Storage/audit are already committed. Provider failure cannot encourage the
      // customer to create a second request; the durable marker supports retry.
      try { await dependencies.sendEmail(database, id) } catch { console.error('addon_admin_email_pending', { requestId: id }) }
      const request = checked(await database.from('addon_requests').select(columns).eq('id', id).single())
      return json({ request }, { status: 201 })
    }
    if (req.method === 'GET' && path === 'admin/alerts') {
      const events = checked(await database.from('audit_events').select('id,event_type,entity_id,metadata,created_at').in('event_type', ['ADDON_PAYMENT_CONFIRMED','ADDON_SUBSCRIPTION_ACTIVATED','ADDON_SUBSCRIPTION_PAST_DUE']).order('created_at', { ascending: false }).limit(20)) ?? []
      const ids = [...new Set(events.map((event) => event.metadata?.paymentId ?? event.entity_id))]
      const payments = ids.length ? checked(await database.from('addon_payments').select('id,addon_request_id,service_code,description,customer_email,clients(first_name,last_name),properties(display_name)').in('id', ids)) ?? [] : []
      const labels: Record<string,string> = { ADDON_PAYMENT_CONFIRMED: 'Add-on payment received', ADDON_SUBSCRIPTION_ACTIVATED: 'Monthly Add-on activated', ADDON_SUBSCRIPTION_PAST_DUE: 'Monthly Add-on payment past due' }
      return json({ alerts: events.map((event) => ({ id: event.id, label: labels[event.event_type], created_at: event.created_at, payment: payments.find((payment) => payment.id === (event.metadata?.paymentId ?? event.entity_id)) })) })
    }
    if (req.method === 'GET' && path === 'admin/billing-options') {
      return json({ ...billingConfiguration(), clients: checked(await database.from('clients').select('id,first_name,last_name,email').eq('active', true).order('last_name').limit(500)), services: addonServiceCatalogue })
    }
    if (req.method === 'GET' && (path === 'admin/payments' || path === 'payments')) {
      let query = database.from('addon_payments').select(admin ? `${paymentsColumns},customer_email,clients(first_name,last_name)` : paymentsColumns).order('created_at', { ascending: false }).limit(200)
      if (!admin) {
        const clients = checked(await database.from('client_users').select('client_id').eq('user_id', auth.user.id)) ?? []
        const properties = checked(await database.from('property_users').select('property_id').eq('user_id', auth.user.id)) ?? []
        query = query.in('client_id', clients.map((c) => c.client_id)).neq('payment_status', 'draft').neq('payment_status', 'cancelled').or(`property_id.is.null,property_id.in.(${properties.map((p) => p.property_id).join(',') || '00000000-0000-0000-0000-000000000000'})`)
      }
      return json({ payments: (checked(await query) ?? []).map(normalisePayment), ...(admin ? billingConfiguration() : {}) })
    }
    if (req.method === 'POST' && path === 'admin/payments') {
      if (auth.role !== 'admin') throw new HttpError(403, 'Administrator access is required.')
      const input = addonPaymentDraftSchema.parse(await req.json())
      if (input.serviceCode && !addonServiceCatalogue.some((service) => service.id === input.serviceCode)) throw new HttpError(400, 'Unknown service.')
      const id = checked(await database.rpc('create_addon_payment_draft', { actor: auth.user.id, input }))
      return json({ payment: normalisePayment(checked(await database.from('addon_payments').select(`${paymentsColumns},customer_email,clients(first_name,last_name)`).eq('id', id).single())), ...billingConfiguration() }, { status: 201 })
    }
    const paymentAction = path.match(/^admin\/payments\/([\w-]+)\/(send|resend|replace|cancel-draft)$/)
    if (req.method === 'POST' && paymentAction) {
      if (auth.role !== 'admin') throw new HttpError(403, 'Administrator access is required.')
      const paymentId = z.string().uuid().parse(paymentAction[1])
      const input = z.object({ confirmed: z.literal(true), actionKey: z.string().uuid() }).strict().parse(await req.json())
      if (paymentAction[2] === 'cancel-draft') {
        checked(await database.rpc('cancel_addon_payment_draft', { actor: auth.user.id, payment_id: paymentId })); return json({ cancelled: true })
      }
      return json(await (dependencies.sendPayment ?? sendAddonPayment)(auth, paymentId, paymentAction[2] as 'send' | 'resend' | 'replace', input.actionKey))
    }
    const paymentLink = path.match(/^payments\/([\w-]+)\/link$/)
    if (req.method === 'GET' && paymentLink) {
      const paymentId = z.string().uuid().parse(paymentLink[1])
      const payment = checked(await database.from('addon_payments').select('*').eq('id', paymentId).maybeSingle())
      if (!payment) throw new HttpError(404, 'Payment not found.')
      if (auth.role === 'customer') {
        const client = payment.client_id && checked(await database.from('client_users').select('id').eq('client_id', payment.client_id).eq('user_id', auth.user.id).maybeSingle())
        const property = !payment.property_id || checked(await database.from('property_users').select('id').eq('property_id', payment.property_id).eq('user_id', auth.user.id).maybeSingle())
        if (!client || !property) throw new HttpError(404, 'Payment not found.')
      }
      if (['paid','cancelled'].includes(payment.payment_status) || !payment.stripe_checkout_session_id) throw new HttpError(409, 'This payment link is unavailable.')
      const session = await stripeRequest<Record<string, any>>(`/checkout/sessions/${encodeURIComponent(payment.stripe_checkout_session_id)}`)
      if (!session.livemode || session.status !== 'open' || session.payment_status === 'paid' || session.metadata?.addon_payment_id !== payment.id || session.metadata?.payment_domain !== 'addon' || !session.url?.startsWith('https://checkout.stripe.com/')) throw new HttpError(409, 'This payment link is unavailable.')
      return json({ url: session.url })
    }
    const match = path.match(/^(?:admin\/)?requests\/([\w-]+)$/)
    if (match) {
      const id = z.string().uuid().parse(match[1])
      const record = await requireAddonAccess(auth, id)
      if (req.method === 'PATCH') {
        staff(auth)
        const input = addonReviewSchema.parse(await req.json())
        if (input.status !== input.expectedStatus && !operationalTransitions[input.expectedStatus].includes(input.status)) throw new HttpError(400, 'This status transition is not permitted.')
        checked(await database.rpc('review_addon_request', { actor: auth.user.id, request_id: id, expected_status: input.expectedStatus, next_status: input.status, internal_note: input.internalNote }))
        return json({ saved: true })
      }
      if (req.method !== 'GET') throw new HttpError(405, 'Method not allowed.')
      let requestQuery = database.from('addon_requests').select(admin ? `${columns},clients(first_name,last_name,email,phone)` : columns).eq('id', record.id)
      if (!admin) requestQuery = requestQuery.not('addon_subscriptions.stripe_checkout_session_id', 'is', null)
      const request = checked(await requestQuery.single())
      const shoppingItems = checked(await database.from('addon_shopping_items').select('*').eq('request_id', id).order('display_order'))
      let paymentQuery = database.from('addon_payments').select(paymentsColumns).eq('addon_request_id', id)
      if (!admin) paymentQuery = paymentQuery.neq('payment_status', 'draft').neq('payment_status', 'cancelled')
      const payments = (checked(await paymentQuery) ?? []).map(normalisePayment)
      if (!admin) return json({ request, shoppingItems, payments })
      const internalNotes = checked(await database.from('addon_internal_notes').select('id,note,created_at').eq('request_id', id).order('created_at', { ascending: false }))
      const subscriptions = payments.length ? checked(await database.from('addon_subscriptions').select('id').in('addon_payment_id', payments.map((p) => p.id))) ?? [] : []
      const history = checked(await database.from('audit_events').select('id,event_type,created_at').in('entity_type', ['addon_request', 'addon_payment', 'addon_subscription']).in('entity_id', [id, ...payments.map((payment) => payment.id), ...subscriptions.map((sub) => sub.id)]).order('created_at', { ascending: false }))
      const emailDelivery = checked(await database.from('addon_request_email_delivery').select('sent_at,first_attempt_at').eq('request_id', id).maybeSingle())
      return json({ request, shoppingItems, payments, internalNotes, history, emailDelivery })
    }
    throw new HttpError(404, 'Not found.')
  } catch (error) {
    if (error instanceof z.ZodError || error instanceof SyntaxError) return json({ error: { code: 'VALIDATION_ERROR', message: 'Check the request details, required fields and maximum lengths.' } }, { status: 400 })
    const status = error instanceof HttpError ? error.status : 500
    return json({ error: { code: error instanceof HttpError ? error.code : 'REQUEST_ERROR', message: error instanceof HttpError ? error.message : 'The service request could not be completed.' } }, { status })
  }
}
export default (req: Request) => handleAddonRequest(req)
export const config: Config = { path: ['/api/addons', '/api/addons/*'], rateLimit: { action: 'rate_limit', aggregateBy: ['ip'], windowLimit: 60, windowSize: 60 } }
