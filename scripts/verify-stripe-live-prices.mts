const expectations = [
  ['STRIPE_PRICE_CARE_MONTHLY', 7_900, 'month'],
  ['STRIPE_PRICE_CARE_YEARLY', 85_320, 'year'],
  ['STRIPE_PRICE_CARE_PLUS_MONTHLY', 12_900, 'month'],
  ['STRIPE_PRICE_CARE_PLUS_YEARLY', 139_320, 'year'],
  ['STRIPE_PRICE_COMPLETE_MONTHLY', 18_900, 'month'],
  ['STRIPE_PRICE_COMPLETE_YEARLY', 204_120, 'year'],
] as const

const key = process.env.STRIPE_SECRET_KEY?.trim()
if (!key || (!key.startsWith('rk_live_') && !key.startsWith('sk_live_'))) {
  console.error('STRIPE_SECRET_KEY must contain a LIVE restricted or secret key.')
  process.exit(1)
}

let failed = false
for (const [variable, expectedAmount, expectedInterval] of expectations) {
  const priceId = process.env[variable]?.trim()
  if (!priceId?.startsWith('price_')) {
    console.error(`${variable}: missing live Price ID`)
    failed = true
    continue
  }
  const response = await fetch(`https://api.stripe.com/v1/prices/${encodeURIComponent(priceId)}`, { headers: { Authorization: `Bearer ${key}` } })
  const price = await response.json() as { active?: boolean; livemode?: boolean; currency?: string; unit_amount?: number; type?: string; tax_behavior?: string; recurring?: { interval?: string }; error?: { message?: string } }
  const valid = response.ok && price.livemode === true && price.active === true && price.type === 'recurring' && price.tax_behavior === 'exclusive' && price.currency?.toUpperCase() === 'EUR' && price.unit_amount === expectedAmount && price.recurring?.interval === expectedInterval
  if (!valid) {
    console.error(`${variable}: FAILED — expected EUR ${(expectedAmount / 100).toFixed(2)} recurring ${expectedInterval} with exclusive tax behaviour`)
    if (!response.ok) console.error(`Stripe rejected the read-only check: ${price.error?.message || response.status}`)
    failed = true
  } else {
    console.log(`${variable}: PASS — LIVE EUR ${(expectedAmount / 100).toFixed(2)} recurring ${expectedInterval}, tax exclusive`)
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
import { subscriptionVat } from '../src/config/subscriptions.ts'
