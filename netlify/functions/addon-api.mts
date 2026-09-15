import { createHash } from 'node:crypto'
import type { Config } from '@netlify/functions'
import { z } from 'zod'
import { addonPaymentDraftSchema, addonRequestSchema, addonReviewSchema, operationalTransitions } from '../../src/lib/portal/addons.ts'
import { authenticate, HttpError, json, type AuthContext } from './_subscription-shared.mts'
import { checked, requireAddonAccess, sendAddonAdminEmail } from './_addon-shared.mts'

const columns = 'id,request_reference,client_id,property_id,service_code,status,published_price_snapshot,published_price_note_snapshot,customer_notes,service_details,created_at,updated_at,properties(display_name,locality)'
const paymentsColumns = 'id,addon_request_id,description,currency,amount,amount_semantics,payment_status,created_at,paid_at'
function staff(auth: AuthContext) { if (auth.role !== 'staff' && auth.role !== 'admin') throw new HttpError(403, 'Staff access is required.', 'AUTHORIZATION_ERROR') }
export async function handleAddonRequest(req: Request, dependencies = { authenticate, sendEmail: sendAddonAdminEmail }) {
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
        query = query.in('property_id', properties.map((item) => item.property_id)).in('client_id', clients.map((item) => item.client_id))
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
    if (req.method === 'GET' && path === 'admin/payments') {
      return json({ payments: checked(await database.from('addon_payments').select(`${paymentsColumns},customer_email,addon_requests(request_reference,service_code),clients(first_name,last_name)`).order('created_at', { ascending: false }).limit(200)), livePaymentsEnabled: false })
    }
    if (req.method === 'POST' && path === 'admin/payments') {
      if (auth.role !== 'admin') throw new HttpError(403, 'Administrator access is required.')
      const input = addonPaymentDraftSchema.parse(await req.json())
      const id = checked(await database.rpc('create_addon_payment_draft', { actor: auth.user.id, input }))
      return json({ payment: checked(await database.from('addon_payments').select(paymentsColumns).eq('id', id).single()), livePaymentsEnabled: false }, { status: 201 })
    }
    // Fail closed. No env toggle can bypass unresolved accounting or create
    // LIVE Stripe objects. Activation requires reviewed implementation changes.
    if (req.method === 'POST' && /^admin\/payments\/[\w-]+\/(send|resend|replace)$/.test(path)) {
      if (auth.role !== 'admin') throw new HttpError(403, 'Administrator access is required.')
      throw new HttpError(409, 'Live add-on payments await accounting approval. No Stripe payment or customer email has been created.', 'ADDON_PAYMENT_APPROVAL_REQUIRED')
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
      const request = checked(await database.from('addon_requests').select(admin ? `${columns},clients(first_name,last_name,email,phone)` : columns).eq('id', record.id).single())
      const shoppingItems = checked(await database.from('addon_shopping_items').select('*').eq('request_id', id).order('display_order'))
      let paymentQuery = database.from('addon_payments').select(paymentsColumns).eq('addon_request_id', id)
      if (!admin) paymentQuery = paymentQuery.neq('payment_status', 'draft')
      const payments = checked(await paymentQuery)
      if (!admin) return json({ request, shoppingItems, payments })
      const internalNotes = checked(await database.from('addon_internal_notes').select('id,note,created_at').eq('request_id', id).order('created_at', { ascending: false }))
      const history = checked(await database.from('audit_events').select('id,event_type,created_at').in('entity_type', ['addon_request', 'addon_payment']).in('entity_id', [id, ...(payments ?? []).map((payment) => payment.id)]).order('created_at', { ascending: false }))
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
