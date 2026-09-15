import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import { optionalServices } from '../src/config/optional-services.ts'
import { addonRequestSchema, addonPaymentDraftSchema, addonReviewSchema, operationalTransitions, priceDisclaimer, requestConfirmation } from '../src/lib/portal/addons.ts'
import { handleAddonRequest } from '../netlify/functions/addon-api.mts'
import { HttpError } from '../netlify/functions/_subscription-shared.mts'
import { escapeHtml, sendAddonAdminEmail } from '../netlify/functions/_addon-shared.mts'

const user = '00000000-0000-4000-8000-00000000000a'
const property = '20000000-0000-4000-8000-00000000000a'
const requestId = '30000000-0000-4000-8000-00000000000a'
const client = '10000000-0000-4000-8000-00000000000a'
const generic = () => ({ idempotencyKey: '40000000-0000-4000-8000-00000000000a', propertyId: property, serviceCode: 'storm-check', customerNotes: 'Please check the terrace.', serviceDetails: {} })
const shopping = () => ({ ...generic(), serviceCode: 'pre-arrival-shopping', serviceDetails: { arrivalDate: '2026-10-20', arrivalTime: '15:30', specialInstructions: 'Please put chilled items in the fridge.', items: [ { product: 'Water', quantity: '6 bottles', preferredBrand: 'Luso', alternativePolicy: 'any_suitable', alternativeProduct: '', notes: 'Still water' }, { product: 'Milk', quantity: '2 litres', preferredBrand: 'Brand A', alternativePolicy: 'specific', alternativeProduct: 'Brand B', notes: '' } ] } })
const transfer = (direction = 'airport_to_property') => ({ ...generic(), serviceCode: 'airport-transfer-coordination', serviceDetails: { direction, airport: 'Faro', date: '2026-10-20', time: '15:30', flightNumber: 'BA123', passengers: 4, luggage: '3 cases', childSeats: '1 seat' } })

// Query spy checks actual handler constraints/projections without connecting to
// production. Database transaction/RLS assertions are in addon-rls.sql.
function mockDatabase(options: { denied?: boolean; ownership?: boolean; clientAccess?: boolean; failedEmail?: boolean; sentEmail?: boolean } = {}) {
  const calls: any[] = []
  const record = { id: requestId, client_id: client, property_id: property, status: 'requested', request_reference: 'GSR-TEST', properties: { display_name: 'Test property' }, service_code: 'storm-check', customer_notes: '', clients: { first_name: 'Test', last_name: 'Client', email: 'test@example.invalid' } }
  const delivery: any = { sent_at: options.sentEmail === false ? null : '2026-10-01', request_id: requestId, claimed_at: null, first_attempt_at: null }
  const db: any = {
    from(table: string) {
      const call: any = { table, steps: [] }; calls.push(call)
      const query: any = {}
      for (const method of ['select','eq','in','neq','order','limit','is','or','update']) query[method] = (...args: any[]) => { call.steps.push([method, ...args]); return query }
      function result(single: boolean) {
        if (table === 'addon_requests') return { data: single ? record : [record], error: null }
        if (table === 'property_users') return { data: single ? options.ownership === false ? null : { id: 'access' } : [{ property_id: property }], error: null }
        if (table === 'client_users') return { data: single ? options.clientAccess === false ? null : { id: 'client-access' } : [{ client_id: client }], error: null }
        if (table === 'addon_request_email_delivery') { const update = call.steps.find((step: any[]) => step[0] === 'update'); if (update) Object.assign(delivery, update[1]); return { data: { ...delivery }, error: null } }
        return { data: single ? { id: requestId } : [], error: null }
      }
      query.maybeSingle = query.single = async () => result(true)
      query.then = (resolve: any, reject: any) => Promise.resolve(result(false)).then(resolve, reject)
      return query
    },
    async rpc(name: string, args: any) { calls.push({ rpc: name, args }); return options.denied ? { data: null, error: { code: '42501' } } : { data: requestId, error: null } },
  }
  return { db, calls }
}
async function invoke(path: string, method = 'GET', body?: unknown, role = 'customer', options = {}) {
  const { db, calls } = mockDatabase(options)
  let emails = 0
  const response = await handleAddonRequest(new Request(`https://guardemar.com/api/addons/${path}`, { method, ...(body ? { body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } } : {}) }), { authenticate: async () => ({ user: { id: user } as any, role: role as any, database: db }), sendEmail: async () => { emails++ } })
  return { response, body: await response.json(), calls, emails }
}
test('canonical catalogue has twelve exact published fees', () => {
  assert.equal(optionalServices.length, 12)
  assert.deepEqual(optionalServices.map((s) => s.fee), ['€15/month + VAT','€80 + VAT','€25 + VAT','€35 + VAT','€25 + VAT','€50 + VAT','€40 + VAT','€25/month + VAT','€30 + VAT','€40 + VAT','€75 + VAT','€60 + VAT'])
  assert.equal(new Set(optionalServices.map((s) => s.id)).size, 12)
  for (const service of optionalServices) assert.equal(addonRequestSchema.parse({ ...generic(), serviceCode: service.id, serviceDetails: service.id === 'pre-arrival-shopping' ? shopping().serviceDetails : service.id === 'airport-transfer-coordination' ? transfer().serviceDetails : {} }).publishedPrice, service.fee)
})
test('request derives price snapshot and cannot accept client, status or amount', () => {
  const parsed = addonRequestSchema.parse(generic())
  assert.equal(parsed.publishedPrice, '€60 + VAT'); assert.equal(parsed.customerNotes, 'Please check the terrace.')
  for (const field of ['client_id','clientId','status','amount','publishedPrice','requested_by']) assert.equal(addonRequestSchema.safeParse({ ...generic(), [field]: 'spoof' }).success, false)
  assert.equal(addonRequestSchema.safeParse({ ...generic(), serviceCode: 'unknown' }).success, false)
})
test('notes maximum, trimming, text safety and strict structured fields', () => {
  assert.equal(addonRequestSchema.safeParse({ ...generic(), customerNotes: 'a'.repeat(5000) }).success, true)
  assert.equal(addonRequestSchema.safeParse({ ...generic(), customerNotes: 'a'.repeat(5001) }).success, false)
  assert.equal(addonRequestSchema.safeParse({ ...generic(), customerNotes: 'unsafe\u0000' }).success, false)
  assert.equal(addonRequestSchema.parse({ ...generic(), customerNotes: '  hello  ' }).customerNotes, 'hello')
  assert.equal(escapeHtml('<script>alert("x")</script>'), '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;')
  assert.equal(addonRequestSchema.safeParse({ ...generic(), serviceDetails: { amount: 1 } }).success, false)
})
test('shopping multiple products, brands, quantities, alternatives, notes and arrival', () => {
  const data = addonRequestSchema.parse(shopping())
  assert.equal(data.shoppingItems.length, 2); assert.equal(data.shoppingItems[0].quantity, '6 bottles'); assert.equal(data.shoppingItems[0].preferredBrand, 'Luso'); assert.equal(data.shoppingItems[0].notes, 'Still water')
  assert.equal(data.shoppingItems[1].alternativeProduct, 'Brand B'); assert.equal(data.publishedPrice, '€80 + VAT'); assert.equal(data.publishedPriceNote, 'shopping expenses additional')
  assert.equal(data.serviceDetails.arrivalDate, '2026-10-20'); assert.equal(data.serviceDetails.arrivalTime, '15:30'); assert.ok(data.serviceDetails.specialInstructions)
  assert.equal('items' in data.serviceDetails, false)
  const bad = shopping(); bad.serviceDetails.items[1].alternativeProduct = ''; assert.equal(addonRequestSchema.safeParse(bad).success, false)
  const none = shopping(); none.serviceDetails.items[0].alternativePolicy = 'no_substitute'; assert.equal(addonRequestSchema.safeParse(none).success, true)
  const empty = shopping(); empty.serviceDetails.items = []; assert.equal(addonRequestSchema.safeParse(empty).success, false)
  const tooMany = shopping(); tooMany.serviceDetails.items = Array(61).fill(tooMany.serviceDetails.items[0]); assert.equal(addonRequestSchema.safeParse(tooMany).success, false)
})
test('transfer validates both directions, flight, time, passenger count and extra cost', () => {
  for (const direction of ['airport_to_property','property_to_airport']) {
    const data = addonRequestSchema.parse(transfer(direction)); assert.equal(data.serviceDetails.direction, direction); assert.equal(data.serviceDetails.passengers, 4); assert.equal(data.serviceDetails.flightNumber, 'BA123'); assert.equal(data.serviceDetails.luggage, '3 cases'); assert.equal(data.serviceDetails.childSeats, '1 seat'); assert.equal(data.publishedPrice, '€25 + VAT'); assert.equal(data.publishedPriceNote, 'transfer cost additional')
  }
  for (const patch of [{ passengers: 0 }, { passengers: 1.5 }, { time: '24:00' }, { date: '2026-02-30' }, { direction: 'other' }]) assert.equal(addonRequestSchema.safeParse({ ...transfer(), serviceDetails: { ...transfer().serviceDetails, ...patch } }).success, false)
})
test('authenticated catalogue/history and request route use authorised properties/clients', async () => {
  const result = await invoke(''); assert.equal(result.response.status, 200)
  const query = result.calls.find((c) => c.table === 'addon_requests')
  assert.ok(query.steps.some((s: any[]) => s[0] === 'in' && s[1] === 'property_id'))
  assert.ok(query.steps.some((s: any[]) => s[0] === 'in' && s[1] === 'client_id'))
})
test('generic, shopping and transfer submissions create only request and admin email', async () => {
  for (const input of [generic(), shopping(), transfer()]) {
    const result = await invoke('', 'POST', input); assert.equal(result.response.status, 201); assert.equal(result.body.request.status, 'requested'); assert.equal(result.emails, 1)
    const rpc = result.calls.find((c) => c.rpc); assert.equal(rpc.rpc, 'create_addon_request'); assert.equal(rpc.args.actor, user); assert.equal(rpc.args.input.propertyId, property); assert.equal('client_id' in rpc.args.input, false); assert.equal(rpc.args.fingerprint.length, 64)
    assert.equal(result.calls.some((c) => c.table === 'addon_payments'), false)
  }
})
test('RPC property denial fails before notification; spoofed input rejected', async () => {
  const denied = await invoke('', 'POST', generic(), 'customer', { denied: true }); assert.equal(denied.response.status, 403); assert.equal(denied.emails, 0)
  for (const patch of [{ client_id: client }, { amount: 100 }, { serviceCode: 'fake' }]) { const result = await invoke('', 'POST', { ...generic(), ...patch }); assert.equal(result.response.status, 400); assert.equal(result.calls.some((c) => c.rpc), false) }
})
test('authentication failure returns 401', async () => {
  const response = await handleAddonRequest(new Request('https://guardemar.com/api/addons/'), { authenticate: async () => { throw new HttpError(401, 'Sign in again.') }, sendEmail: async () => {} }); assert.equal(response.status, 401)
})
test('detail checks property AND client; hides internal notes, customer email and Stripe IDs', async () => {
  for (const options of [{ ownership: false }, { clientAccess: false }]) assert.equal((await invoke(`requests/${requestId}`, 'GET', undefined, 'customer', options)).response.status, 404)
  const result = await invoke(`requests/${requestId}`); assert.equal(result.response.status, 200); assert.equal('internalNotes' in result.body, false); assert.equal('history' in result.body, false)
  assert.equal(result.calls.some((c) => c.table === 'addon_internal_notes' || c.table === 'audit_events'), false)
  const payment = result.calls.find((c) => c.table === 'addon_payments'); assert.ok(payment.steps.some((s: any[]) => s[0] === 'neq' && s[2] === 'draft')); assert.ok(!payment.steps[0][1].includes('stripe_'))
  const projection = result.calls.filter((c) => c.table === 'addon_requests').at(-1).steps[0][1]; assert.ok(!projection.includes('clients('))
})
test('customer cannot manage requests or create/deliver payments; staff cannot create payments', async () => {
  for (const path of ['admin','admin/payments',`admin/requests/${requestId}`]) assert.equal((await invoke(path, 'POST', {})).response.status, 403)
  assert.equal((await invoke(`requests/${requestId}`, 'PATCH', {})).response.status, 403)
  assert.equal((await invoke('admin/payments', 'POST', {}, 'staff')).response.status, 403)
})
test('staff review uses compare status, internal note and controlled transitions', async () => {
  const result = await invoke(`admin/requests/${requestId}`, 'PATCH', { expectedStatus: 'requested', status: 'under_review', internalNote: 'Call customer' }, 'staff'); assert.equal(result.response.status, 200)
  assert.equal(result.calls.find((c) => c.rpc).args.expected_status, 'requested')
  assert.equal((await invoke(`admin/requests/${requestId}`, 'PATCH', { expectedStatus: 'requested', status: 'paid', internalNote: '' }, 'admin')).response.status, 400)
  for (const transitions of Object.values(operationalTransitions)) assert.equal(transitions.includes('paid'), false)
  assert.equal(addonReviewSchema.safeParse({ expectedStatus: 'requested', status: 'invented', internalNote: '' }).success, false)
})
test('payment draft uses explicitly admin-entered amount, EUR and linked request', async () => {
  const input = { requestId, idempotencyKey: generic().idempotencyKey, email: 'test@example.invalid', amountEur: '123.45', description: 'Reviewed request', currency: 'EUR' }
  assert.equal(addonPaymentDraftSchema.parse(input).amountEur, 12345)
  for (const patch of [{ amountEur: '0' }, { amountEur: '-1' }, { amountEur: '1.001' }, { amountEur: '1e3' }, { currency: 'USD' }, { email: 'invalid' }, { client_id: client }]) assert.equal(addonPaymentDraftSchema.safeParse({ ...input, ...patch }).success, false)
  const result = await invoke('admin/payments', 'POST', input, 'admin'); assert.equal(result.response.status, 201); assert.equal(result.emails, 0); assert.equal(result.calls.find((c) => c.rpc).args.input.amountEur, 12345); assert.equal(result.body.livePaymentsEnabled, false)
})
test('send/resend/replacement fail closed without Stripe creation or email', async () => {
  for (const action of ['send','resend','replace']) {
    const result = await invoke(`admin/payments/${requestId}/${action}`, 'POST', {}, 'admin'); assert.equal(result.response.status, 409); assert.equal(result.body.error.code, 'ADDON_PAYMENT_APPROVAL_REQUIRED'); assert.equal(result.calls.length, 0); assert.equal(result.emails, 0)
  }
})
test('persistent sent marker prevents duplicate admin email', async () => {
  const { db, calls } = mockDatabase()
  ;(globalThis as any).Netlify = { env: { get: (name: string) => name === 'RESEND_API_KEY' ? 'test-key-not-used' : '' } }
  await sendAddonAdminEmail(db, requestId); await sendAddonAdminEmail(db, requestId)
  assert.equal(calls.length, 2); assert.equal(calls.every((call) => call.table === 'addon_request_email_delivery'), true)
})
test('UI navigation, detail/confirmation wording and mobile shopping layout', () => {
  const shell = readFileSync('src/components/portal/shell.tsx', 'utf8'); assert.ok(shell.includes("label: 'Services'")); assert.ok(shell.includes("label: 'Add-on Payments'"))
  const ui = readFileSync('src/components/portal/addon-services.tsx', 'utf8'); assert.ok(ui.includes('View service')); assert.ok(ui.includes('SEND REQUEST')); assert.ok(ui.includes('Request received')); assert.ok(ui.includes('Shopping expenses: Additional')); assert.ok(ui.includes('type="radio"')); assert.ok(ui.includes('placeholder="e.g. Still water 1.5L"'))
  assert.ok(priceDisclaimer.includes('confirm the final amount before payment')); assert.ok(requestConfirmation.includes('contact you')); assert.ok(requestConfirmation.includes('secure payment link'))
  const css = readFileSync('src/styles.css', 'utf8'); assert.ok(css.includes('.addon-shopping-card .admin-form')); assert.ok(css.includes('grid-template-columns: minmax(0, 1fr)'))
})
test('admin notification email contains request/customer/property and stable Resend key once', async () => {
  const { db } = mockDatabase({ sentEmail: false }); const messages: any[] = []
  const sender = async (message: any, options: any) => { messages.push({ message, options }); return { error: null, data: { id: 'email-test' } } }
  await sendAddonAdminEmail(db, requestId, sender); await sendAddonAdminEmail(db, requestId, sender)
  assert.equal(messages.length, 1); assert.equal(messages[0].options.idempotencyKey, `guardemar-addon-request-${requestId}`)
  assert.ok(messages[0].message.text.includes('GSR-TEST')); assert.ok(messages[0].message.text.includes('Test Client')); assert.ok(messages[0].message.text.includes('Test property')); assert.ok(messages[0].message.text.includes(`/admin/services/${requestId}`)); assert.ok(!messages[0].message.text.includes('stripe_'))
})
test('provider failure leaves durable marker pending and submission still confirms request', async () => {
  const { db } = mockDatabase({ sentEmail: false })
  await assert.rejects(sendAddonAdminEmail(db, requestId, async () => ({ error: { message: 'Provider failed' }, data: null })))
  const response = await handleAddonRequest(new Request('https://guardemar.com/api/addons/', { method: 'POST', body: JSON.stringify(generic()) }), { authenticate: async () => ({ user: { id: user } as any, role: 'customer', database: db }), sendEmail: async () => { throw new Error('Email offline') } })
  assert.equal(response.status, 201)
})
test('network retry uses same submission fingerprint and database idempotency key', async () => {
  const first = await invoke('', 'POST', generic()); const second = await invoke('', 'POST', generic())
  assert.equal(first.calls.find((c) => c.rpc).args.fingerprint, second.calls.find((c) => c.rpc).args.fingerprint)
  assert.equal(first.calls.find((c) => c.rpc).args.input.idempotencyKey, second.calls.find((c) => c.rpc).args.input.idempotencyKey)
})
test('return URL and arbitrary payment-confirmation calls cannot mark paid', async () => {
  for (const path of ['success', `requests/${requestId}/paid`, `admin/payments/${requestId}/confirm`]) assert.equal((await invoke(path, 'POST', {}, 'admin')).response.status, 404)
})
