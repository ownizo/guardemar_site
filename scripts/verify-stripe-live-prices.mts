import { subscriptionPlans, subscriptionVat, type SubscriptionPlanCode } from '../src/config/subscriptions.ts'

const expectations: Array<[variable: string, planCode: SubscriptionPlanCode, expectedAmount: number, expectedInterval: 'month' | 'year']> = [
  ['STRIPE_PRICE_CARE_MONTHLY', 'care', subscriptionPlans.care.monthlyAmount, 'month'],
  ['STRIPE_PRICE_CARE_YEARLY', 'care', subscriptionPlans.care.yearlyAmount, 'year'],
  ['STRIPE_PRICE_CARE_PLUS_MONTHLY', 'care_plus', subscriptionPlans.care_plus.monthlyAmount, 'month'],
  ['STRIPE_PRICE_CARE_PLUS_YEARLY', 'care_plus', subscriptionPlans.care_plus.yearlyAmount, 'year'],
  ['STRIPE_PRICE_COMPLETE_MONTHLY', 'complete', subscriptionPlans.complete.monthlyAmount, 'month'],
  ['STRIPE_PRICE_COMPLETE_YEARLY', 'complete', subscriptionPlans.complete.yearlyAmount, 'year'],
]

const key = process.env.STRIPE_SECRET_KEY?.trim()
if (!key || (!key.startsWith('rk_live_') && !key.startsWith('sk_live_'))) {
  console.error('STRIPE_SECRET_KEY must contain a LIVE restricted or secret key.')
  process.exit(1)
}

let failed = false
for (const [variable, planCode, expectedAmount, expectedInterval] of expectations) {
  const priceId = process.env[variable]?.trim()
  if (!priceId?.startsWith('price_')) {
    console.error(`${variable}: missing live Price ID`)
    failed = true
    continue
  }
  const expectedProductName = subscriptionPlans[planCode].name
  const response = await fetch(`https://api.stripe.com/v1/prices/${encodeURIComponent(priceId)}?expand[]=product`, { headers: { Authorization: `Bearer ${key}` } })
  const price = await response.json() as {
    active?: boolean
    livemode?: boolean
    currency?: string
    unit_amount?: number
    type?: string
    tax_behavior?: string
    recurring?: { interval?: string }
    product?: { id?: string; name?: string; active?: boolean; livemode?: boolean } | string
    error?: { message?: string }
  }
  const product = typeof price.product === 'object' ? price.product : undefined
  const valid = response.ok
    && price.livemode === true
    && price.active === true
    && price.type === 'recurring'
    && price.tax_behavior === 'exclusive'
    && price.currency?.toUpperCase() === 'EUR'
    && price.unit_amount === expectedAmount
    && price.recurring?.interval === expectedInterval
    && product?.livemode === true
    && product?.active === true
    && product?.name === expectedProductName
  if (!valid) {
    console.error(`${variable}: FAILED — expected EUR ${(expectedAmount / 100).toFixed(2)} recurring ${expectedInterval}, exclusive tax, LIVE active product "${expectedProductName}"`)
    if (!response.ok) console.error(`Stripe rejected the read-only check: ${price.error?.message || response.status}`)
    else if (!product) console.error('Stripe did not return an expanded product for this Price.')
    else if (product.name !== expectedProductName) console.error(`Price is attached to product "${product.name}", expected "${expectedProductName}".`)
    failed = true
  } else {
    console.log(`${variable}: PASS — LIVE EUR ${(expectedAmount / 100).toFixed(2)} recurring ${expectedInterval}, tax exclusive, product "${product.name}"`)
  }
}

const taxRateId = process.env.STRIPE_TAX_RATE_ID?.trim()
if (!taxRateId?.startsWith('txr_')) {
  console.error('STRIPE_TAX_RATE_ID: missing approved live Tax Rate ID')
  failed = true
} else {
  const response = await fetch(`https://api.stripe.com/v1/tax_rates/${encodeURIComponent(taxRateId)}`, { headers: { Authorization: `Bearer ${key}` } })
  const taxRate = await response.json() as { active?: boolean; livemode?: boolean; inclusive?: boolean; percentage?: number; display_name?: string; country?: string | null; tax_type?: string | null; error?: { message?: string } }
  const valid = response.ok && taxRate.livemode === true && taxRate.active === true && taxRate.inclusive === subscriptionVat.inclusive && taxRate.percentage === subscriptionVat.percentage && taxRate.display_name === subscriptionVat.displayName && taxRate.country?.toUpperCase() === subscriptionVat.country && taxRate.tax_type?.toLowerCase() === subscriptionVat.taxType
  if (!valid) {
    console.error('STRIPE_TAX_RATE_ID: FAILED — expected the approved LIVE Portuguese VAT Tax Rate: 23%, exclusive, PT, VAT, displayed as IVA')
    if (!response.ok) console.error(`Stripe rejected the read-only check: ${taxRate.error?.message || response.status}`)
    failed = true
  } else {
    console.log(`STRIPE_TAX_RATE_ID: PASS — LIVE exclusive ${taxRate.display_name} at ${taxRate.percentage}%`)
  }
}

if (failed) process.exit(1)
console.log('All six Guardemar LIVE Stripe Prices and the configured Tax Rate passed. No Checkout Session or charge was created.')
