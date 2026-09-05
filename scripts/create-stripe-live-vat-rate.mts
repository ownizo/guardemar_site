import { subscriptionVat } from '../src/config/subscriptions.ts'

const EXPECTED_STRIPE_ACCOUNT = 'acct_1QjMaJHFqsWIut8W'

type StripeError = { error?: { code?: string } }
type StripeAccount = StripeError & { id?: string }
type StripeTaxRate = StripeError & {
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

class StripeOperationError extends Error {
  readonly status?: number
  readonly code?: string

  constructor(message: string, status?: number, code?: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

function liveSecretKey() {
  const key = process.env.STRIPE_SECRET_KEY?.trim() || ''
  if (key.startsWith('sk_test_') || key.startsWith('rk_test_')) throw new Error('Refusing to use Stripe test-mode credentials.')
  if (!key.startsWith('sk_live_') && !key.startsWith('rk_live_')) throw new Error('STRIPE_SECRET_KEY must contain a Stripe LIVE secret or restricted key.')
  return key
}

function validateApprovedConfiguration() {
  if (subscriptionVat.percentage !== 23) throw new Error('Refusing to create a non-23% Tax Rate.')
  if (subscriptionVat.inclusive !== false) throw new Error('Refusing to create an inclusive Tax Rate.')
  if (subscriptionVat.country !== 'PT') throw new Error('Refusing to create a non-Portuguese Tax Rate.')
  if (subscriptionVat.taxType !== 'vat' || subscriptionVat.displayName !== 'IVA') throw new Error('Refusing to create a Tax Rate outside the approved Portuguese VAT configuration.')
}

async function stripeRequest<T extends StripeError>(key: string, path: string, init: RequestInit = {}) {
  const response = await fetch(`https://api.stripe.com/v1${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${key}`,
      ...(init.body ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
    },
  })
  const payload = await response.json() as T
  if (!response.ok) throw new StripeOperationError('Stripe rejected the Tax Rate operation.', response.status, payload.error?.code)
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
}

function isCreatedRateValid(taxRate: StripeTaxRate) {
  return isExactActiveMatch(taxRate) && taxRate.description === subscriptionVat.description
}

async function listActiveTaxRates(key: string) {
  const taxRates: StripeTaxRate[] = []
  let startingAfter = ''
  do {
    const query = new URLSearchParams({ active: 'true', limit: '100' })
    if (startingAfter) query.set('starting_after', startingAfter)
    const page = await stripeRequest<StripeTaxRateList>(key, `/tax_rates?${query}`)
    const data = page.data ?? []
    taxRates.push(...data)
    if (!page.has_more) break
    const lastId = data.at(-1)?.id
    if (!lastId) throw new Error('Stripe returned an incomplete Tax Rate page; refusing to continue.')
    startingAfter = lastId
  } while (true)
  return taxRates
}

async function main() {
  validateApprovedConfiguration()
  const key = liveSecretKey()
  const account = await stripeRequest<StripeAccount>(key, '/account')
  if (account.id !== EXPECTED_STRIPE_ACCOUNT) throw new Error('Refusing to modify a Stripe account other than the approved Guardemar LIVE account.')

  const matches = (await listActiveTaxRates(key)).filter(isExactActiveMatch)
  if (matches.length > 1) {
    console.error(`Multiple exact active LIVE Portuguese VAT Tax Rates exist: ${matches.map((rate) => rate.id).join(', ')}`)
    console.error('No Tax Rate was created. Review the listed txr_ IDs in Stripe before retrying.')
    process.exitCode = 1
    return
  }
  if (matches.length === 1) {
    console.log(`Reusing approved LIVE Tax Rate: ${matches[0].id}`)
    return
  }

  const body = new URLSearchParams({
    display_name: subscriptionVat.displayName,
    description: subscriptionVat.description,
    percentage: String(subscriptionVat.percentage),
    inclusive: String(subscriptionVat.inclusive),
    country: subscriptionVat.country,
    tax_type: subscriptionVat.taxType,
  })
  const created = await stripeRequest<StripeTaxRate>(key, '/tax_rates', { method: 'POST', body })
  if (!isCreatedRateValid(created) || !created.id?.startsWith('txr_')) throw new Error('Stripe returned a Tax Rate that does not match the approved LIVE Portuguese VAT configuration.')
  console.log(`Created approved LIVE Tax Rate: ${created.id}`)
}

main().catch((error: unknown) => {
  if (error instanceof StripeOperationError) {
    const detail = [error.status ? `HTTP ${error.status}` : '', error.code ? `code ${error.code}` : ''].filter(Boolean).join(', ')
    console.error(`${error.message}${detail ? ` (${detail})` : ''}`)
  } else {
    console.error(error instanceof Error ? error.message : 'The Stripe Tax Rate operation failed safely.')
  }
  process.exitCode = 1
})
