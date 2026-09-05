import assert from 'node:assert/strict'
import test from 'node:test'
import { createVatProvisionHandler } from '../netlify/functions/admin-provision-vat-rate-once.mts'
import { provisionApprovedLiveVatRate, type StripeTaxRate } from '../src/lib/server/stripe-vat-rate.ts'

const provisionToken = 'high-entropy-temporary-token-example-1234567890'
const stripeSecret = 'sk_live_example_not_a_real_credential'
const endpoint = 'https://guardemar.com/.netlify/functions/admin-provision-vat-rate-once'

const exactRate = (id: string): StripeTaxRate => ({
  id,
  active: true,
  livemode: true,
  display_name: 'IVA',
  description: 'Portugal VAT 23% — GUARDEMAR services',
  percentage: 23,
  inclusive: false,
  country: 'PT',
  tax_type: 'vat',
})

function environment(overrides: Record<string, string | undefined> = {}) {
  const values: Record<string, string | undefined> = {
    GUARDEMAR_VAT_PROVISION_TOKEN: provisionToken,
    CONTEXT: 'production',
    STRIPE_SECRET_KEY: stripeSecret,
    ...overrides,
  }
  return (name: string) => values[name]
}

function post(authorization = `Bearer ${provisionToken}`, url = endpoint, body?: string) {
  return new Request(url, {
    method: 'POST',
    headers: authorization ? { Authorization: authorization } : {},
    body,
  })
}

function stripeFetch(input: {
  accountId?: string
  listedRates?: StripeTaxRate[]
  createdRate?: StripeTaxRate
  calls?: Array<{ url: string; method: string; body: string; idempotencyKey: string | null }>
}) {
  return async (request: string | URL | Request, init?: RequestInit) => {
    const url = String(request)
    const method = init?.method ?? 'GET'
    const headers = new Headers(init?.headers)
    input.calls?.push({ url, method, body: String(init?.body ?? ''), idempotencyKey: headers.get('idempotency-key') })
    if (url.endsWith('/account')) return Response.json({ id: input.accountId ?? 'acct_1QjMaJHFqsWIut8W' })
    if (url.includes('/tax_rates?')) return Response.json({ data: input.listedRates ?? [], has_more: false })
    if (url.endsWith('/tax_rates') && method === 'POST') return Response.json(input.createdRate ?? exactRate('txr_created'))
    return Response.json({ error: { code: 'unexpected_test_request' } }, { status: 500 })
  }
}

test('rejects GET with JSON and no-store caching', async () => {
  const response = await createVatProvisionHandler() (new Request(endpoint))
  assert.equal(response.status, 405)
  assert.equal(response.headers.get('cache-control'), 'no-store')
  assert.match(response.headers.get('content-type') ?? '', /application\/json/)
})

test('rejects missing auth', async () => {
  const response = await createVatProvisionHandler({ getEnv: environment() })(post(''))
  assert.equal(response.status, 401)
})

test('rejects malformed auth', async () => {
  const response = await createVatProvisionHandler({ getEnv: environment() })(post(`Token ${provisionToken}`))
  assert.equal(response.status, 401)
})

test('rejects wrong token', async () => {
  const response = await createVatProvisionHandler({ getEnv: environment() })(post('Bearer incorrect-token'))
  assert.equal(response.status, 401)
})

test('rejects missing provisioning env token', async () => {
  const response = await createVatProvisionHandler({ getEnv: environment({ GUARDEMAR_VAT_PROVISION_TOKEN: undefined }) })(post())
  assert.equal(response.status, 503)
})

test('rejects non-production execution', async () => {
  const response = await createVatProvisionHandler({ getEnv: environment({ CONTEXT: 'deploy-preview' }) })(post())
  assert.equal(response.status, 403)
})

test('rejects missing STRIPE_SECRET_KEY', async () => {
  const response = await createVatProvisionHandler({ getEnv: environment({ STRIPE_SECRET_KEY: undefined }) })(post())
  assert.equal(response.status, 503)
})

test('rejects non-LIVE Stripe credentials', async () => {
  const handler = createVatProvisionHandler({
    getEnv: environment({ STRIPE_SECRET_KEY: 'sk_test_example_not_a_real_credential' }),
    provision: ({ secretKey }) => provisionApprovedLiveVatRate({ secretKey, fetcher: stripeFetch({}) as typeof fetch }),
    logError: () => undefined,
  })
  const response = await handler(post())
  assert.equal(response.status, 502)
})

test('rejects query and body parameters', async () => {
  const handler = createVatProvisionHandler({ getEnv: environment() })
  assert.equal((await handler(post(`Bearer ${provisionToken}`, `${endpoint}?percentage=20`))).status, 400)
  assert.equal((await handler(post(`Bearer ${provisionToken}`, endpoint, 'country=ES'))).status, 400)
})

test('rejects unexpected Stripe account without creating a Tax Rate', async () => {
  const calls: Array<{ url: string; method: string; body: string; idempotencyKey: string | null }> = []
  const handler = createVatProvisionHandler({
    getEnv: environment(),
    provision: ({ secretKey }) => provisionApprovedLiveVatRate({ secretKey, fetcher: stripeFetch({ accountId: 'acct_unexpected', calls }) as typeof fetch }),
    logError: () => undefined,
  })
  const response = await handler(post())
  assert.equal(response.status, 502)
  assert.equal(calls.length, 1)
  assert.ok(calls[0].url.endsWith('/account'))
})

test('successfully reuses one exact Tax Rate', async () => {
  const handler = createVatProvisionHandler({
    getEnv: environment(),
    provision: ({ secretKey }) => provisionApprovedLiveVatRate({ secretKey, fetcher: stripeFetch({ listedRates: [exactRate('txr_reused')] }) as typeof fetch }),
  })
  const response = await handler(post())
  const payload = await response.json()
  assert.equal(response.status, 200)
  assert.deepEqual(payload, {
    success: true,
    tax_rate_id: 'txr_reused',
    provisioning: 'reused',
    percentage: 23,
    country: 'PT',
    inclusive: false,
    tax_type: 'vat',
    livemode: true,
  })
})

test('reuses an approved Tax Rate with a null description without creating another', async () => {
  const calls: Array<{ url: string; method: string; body: string; idempotencyKey: string | null }> = []
  const handler = createVatProvisionHandler({
    getEnv: environment(),
    provision: ({ secretKey }) => provisionApprovedLiveVatRate({ secretKey, fetcher: stripeFetch({ listedRates: [{ ...exactRate('txr_null_description'), description: null }], calls }) as typeof fetch }),
  })
  const response = await handler(post())
  const payload = await response.json()
  assert.equal(response.status, 200)
  assert.equal(payload.tax_rate_id, 'txr_null_description')
  assert.equal(payload.provisioning, 'reused')
  assert.equal(calls.some((call) => call.method === 'POST'), false)
})

test('reuses an approved Tax Rate with a different description without creating another', async () => {
  const calls: Array<{ url: string; method: string; body: string; idempotencyKey: string | null }> = []
  const handler = createVatProvisionHandler({
    getEnv: environment(),
    provision: ({ secretKey }) => provisionApprovedLiveVatRate({ secretKey, fetcher: stripeFetch({ listedRates: [{ ...exactRate('txr_different_description'), description: 'Existing Stripe description' }], calls }) as typeof fetch }),
  })
  const response = await handler(post())
  const payload = await response.json()
  assert.equal(response.status, 200)
  assert.equal(payload.tax_rate_id, 'txr_different_description')
  assert.equal(payload.provisioning, 'reused')
  assert.equal(calls.some((call) => call.method === 'POST'), false)
})

test('successfully creates the fixed Tax Rate when none exists', async () => {
  const calls: Array<{ url: string; method: string; body: string; idempotencyKey: string | null }> = []
  const handler = createVatProvisionHandler({
    getEnv: environment(),
    provision: ({ secretKey }) => provisionApprovedLiveVatRate({ secretKey, fetcher: stripeFetch({ createdRate: exactRate('txr_created'), calls }) as typeof fetch }),
  })
  const response = await handler(post())
  const payload = await response.json()
  const createCall = calls.find((call) => call.method === 'POST')
  assert.equal(response.status, 200)
  assert.equal(payload.provisioning, 'created')
  assert.equal(payload.tax_rate_id, 'txr_created')
  assert.ok(createCall?.idempotencyKey)
  assert.equal(new URLSearchParams(createCall?.body).get('percentage'), '23')
  assert.equal(new URLSearchParams(createCall?.body).get('country'), 'PT')
})

test('rejects a newly created Tax Rate without the approved description', async () => {
  const calls: Array<{ url: string; method: string; body: string; idempotencyKey: string | null }> = []
  const handler = createVatProvisionHandler({
    getEnv: environment(),
    provision: ({ secretKey }) => provisionApprovedLiveVatRate({ secretKey, fetcher: stripeFetch({ createdRate: { ...exactRate('txr_invalid_description'), description: null }, calls }) as typeof fetch }),
    logError: () => undefined,
  })
  const response = await handler(post())
  assert.equal(response.status, 502)
  assert.equal(calls.filter((call) => call.method === 'POST').length, 1)
})

test('fails closed on more than one exact Tax Rate', async () => {
  const handler = createVatProvisionHandler({
    getEnv: environment(),
    provision: ({ secretKey }) => provisionApprovedLiveVatRate({ secretKey, fetcher: stripeFetch({ listedRates: [{ ...exactRate('txr_one'), description: null }, { ...exactRate('txr_two'), description: 'Different existing description' }] }) as typeof fetch }),
    logError: () => undefined,
  })
  const response = await handler(post())
  assert.equal(response.status, 502)
})

test('successful response contains no secret and only exposes the Tax Rate resource ID', async () => {
  const handler = createVatProvisionHandler({
    getEnv: environment(),
    provision: ({ secretKey }) => provisionApprovedLiveVatRate({ secretKey, fetcher: stripeFetch({ listedRates: [exactRate('txr_safe')] }) as typeof fetch }),
  })
  const response = await handler(post())
  const text = await response.text()
  assert.doesNotMatch(text, new RegExp(stripeSecret))
  assert.doesNotMatch(text, new RegExp(provisionToken))
  assert.deepEqual(text.match(/(?:acct|cus|cs|sub|in|pi|ch|prod|price|txr)_[A-Za-z0-9_]+/g), ['txr_safe'])
})
