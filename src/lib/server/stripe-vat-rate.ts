import { subscriptionVat } from '../../config/subscriptions.ts'

export const EXPECTED_STRIPE_ACCOUNT = 'acct_1QjMaJHFqsWIut8W'

const CREATE_IDEMPOTENCY_KEY = 'guardemar-live-portugal-vat-23-exclusive-v1'

type StripeError = { error?: { code?: string } }
type StripeAccount = StripeError & { id?: string }
export type StripeTaxRate = StripeError & {
  id?: string
  active?: boolean
  livemode?: boolean
  display_name?: string
  description?: string | null
  percentage?: number
  inclusive?: boolean
  country?: string | null
  tax_type?: string | null
}
type StripeTaxRateList = StripeError & { data?: StripeTaxRate[]; has_more?: boolean }

export type VatProvisionResult = {
  taxRateId: string
  provisioning: 'reused' | 'created'
  percentage: number
  country: string
  inclusive: boolean
  taxType: string
  livemode: true
}

export class StripeVatProvisionError extends Error {
  readonly status?: number
  readonly code: string
  readonly stripeCode?: string

  constructor(message: string, code: string, status?: number, stripeCode?: string) {
    super(message)
    this.code = code
    this.status = status
    this.stripeCode = stripeCode
  }
}

export function requireLiveStripeSecretKey(value: string | undefined) {
  const key = value?.trim() || ''
  if (!key) throw new StripeVatProvisionError('STRIPE_SECRET_KEY is missing.', 'missing_stripe_secret')
  if (key.startsWith('sk_test_') || key.startsWith('rk_test_')) {
    throw new StripeVatProvisionError('Refusing to use Stripe test-mode credentials.', 'non_live_stripe_secret')
  }
  if (!key.startsWith('sk_live_') && !key.startsWith('rk_live_')) {
    throw new StripeVatProvisionError('STRIPE_SECRET_KEY must contain a Stripe LIVE secret or restricted key.', 'invalid_stripe_secret')
  }
  return key
}

function validateApprovedConfiguration() {
  if (subscriptionVat.percentage !== 23) throw new StripeVatProvisionError('Refusing to create a non-23% Tax Rate.', 'invalid_approved_configuration')
  if (subscriptionVat.inclusive !== false) throw new StripeVatProvisionError('Refusing to create an inclusive Tax Rate.', 'invalid_approved_configuration')
  if (subscriptionVat.country !== 'PT') throw new StripeVatProvisionError('Refusing to create a non-Portuguese Tax Rate.', 'invalid_approved_configuration')
  if (subscriptionVat.taxType !== 'vat' || subscriptionVat.displayName !== 'IVA') {
    throw new StripeVatProvisionError('Refusing to create a Tax Rate outside the approved Portuguese VAT configuration.', 'invalid_approved_configuration')
  }
}

async function stripeRequest<T extends StripeError>(fetcher: typeof fetch, key: string, path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers)
  headers.set('Authorization', `Bearer ${key}`)
  if (init.body) headers.set('Content-Type', 'application/x-www-form-urlencoded')

  const response = await fetcher(`https://api.stripe.com/v1${path}`, { ...init, headers })
  const payload = await response.json() as T
  if (!response.ok) {
    throw new StripeVatProvisionError('Stripe rejected the Tax Rate operation.', 'stripe_request_failed', response.status, payload.error?.code)
  }
  return payload
}

function isExactActiveMatch(taxRate: StripeTaxRate) {
  return taxRate.active === true
    && taxRate.livemode === true
    && taxRate.percentage === subscriptionVat.percentage
    && taxRate.inclusive === subscriptionVat.inclusive
    && taxRate.country?.toUpperCase() === subscriptionVat.country
    && taxRate.tax_type?.toLowerCase() === subscriptionVat.taxType
    && taxRate.display_name === subscriptionVat.displayName
    && taxRate.description === subscriptionVat.description
}

function resultFromTaxRate(taxRate: StripeTaxRate, provisioning: VatProvisionResult['provisioning']): VatProvisionResult {
  if (!isExactActiveMatch(taxRate) || !taxRate.id?.startsWith('txr_')) {
    throw new StripeVatProvisionError('Stripe returned a Tax Rate that does not match the approved LIVE Portuguese VAT configuration.', 'invalid_tax_rate_response')
  }
  return {
    taxRateId: taxRate.id,
    provisioning,
    percentage: subscriptionVat.percentage,
    country: subscriptionVat.country,
    inclusive: subscriptionVat.inclusive,
    taxType: subscriptionVat.taxType,
    livemode: true,
  }
}

async function listActiveTaxRates(fetcher: typeof fetch, key: string) {
  const taxRates: StripeTaxRate[] = []
  let startingAfter = ''
  do {
    const query = new URLSearchParams({ active: 'true', limit: '100' })
    if (startingAfter) query.set('starting_after', startingAfter)
    const page = await stripeRequest<StripeTaxRateList>(fetcher, key, `/tax_rates?${query}`)
    const data = page.data ?? []
    taxRates.push(...data)
    if (!page.has_more) break
    const lastId = data.at(-1)?.id
    if (!lastId) throw new StripeVatProvisionError('Stripe returned an incomplete Tax Rate page; refusing to continue.', 'invalid_tax_rate_page')
    startingAfter = lastId
  } while (true)
  return taxRates
}

export async function provisionApprovedLiveVatRate(input: { secretKey: string; fetcher?: typeof fetch }) {
  validateApprovedConfiguration()
  const key = requireLiveStripeSecretKey(input.secretKey)
  const fetcher = input.fetcher ?? fetch
  const account = await stripeRequest<StripeAccount>(fetcher, key, '/account')
  if (account.id !== EXPECTED_STRIPE_ACCOUNT) {
    throw new StripeVatProvisionError('Refusing to modify a Stripe account other than the approved Guardemar LIVE account.', 'unexpected_stripe_account')
  }

  const matches = (await listActiveTaxRates(fetcher, key)).filter(isExactActiveMatch)
  if (matches.length > 1) {
    throw new StripeVatProvisionError('Multiple exact active LIVE Portuguese VAT Tax Rates exist; refusing to continue.', 'duplicate_exact_tax_rates')
  }
  if (matches.length === 1) return resultFromTaxRate(matches[0], 'reused')

  const body = new URLSearchParams({
    display_name: subscriptionVat.displayName,
    description: subscriptionVat.description,
    percentage: String(subscriptionVat.percentage),
    inclusive: String(subscriptionVat.inclusive),
    country: subscriptionVat.country,
    tax_type: subscriptionVat.taxType,
  })
  const created = await stripeRequest<StripeTaxRate>(fetcher, key, '/tax_rates', {
    method: 'POST',
    body,
    headers: { 'Idempotency-Key': CREATE_IDEMPOTENCY_KEY },
  })
  return resultFromTaxRate(created, 'created')
}
