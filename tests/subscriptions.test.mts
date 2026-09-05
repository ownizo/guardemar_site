import assert from 'node:assert/strict'
import { createHash, createHmac } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import { annexCAcknowledgementKeys, calculateTaxAmount, feeSchedule, parseAnnexCAcknowledgements, selectedAmount, subscriptionPlans, subscriptionTerms, subscriptionVat } from '../src/config/subscriptions.ts'
import { verifyStripeSignature } from '../netlify/functions/_subscription-shared.mts'

const source = (path: string) => readFile(new URL(path, import.meta.url), 'utf8')

const combinations = [
  ['care', 'month', 7_900],
  ['care', 'year', 85_320],
  ['care_plus', 'month', 12_900],
  ['care_plus', 'year', 139_320],
  ['complete', 'month', 18_900],
  ['complete', 'year', 204_120],
] as const

const vatCombinations = [
  ['care', 'month', 7_900, 1_817, 9_717],
  ['care', 'year', 85_320, 19_624, 104_944],
  ['care_plus', 'month', 12_900, 2_967, 15_867],
  ['care_plus', 'year', 139_320, 32_044, 171_364],
  ['complete', 'month', 18_900, 4_347, 23_247],
  ['complete', 'year', 204_120, 46_948, 251_068],
] as const

test('all six plan and billing combinations use approved integer-cent Fees', () => {
  for (const [planCode, interval, expected] of combinations) assert.equal(selectedAmount(planCode, interval), expected)
  for (const plan of Object.values(subscriptionPlans)) {
    assert.equal(plan.annualListAmount, plan.monthlyAmount * 12)
    assert.equal(plan.annualDiscountAmount, plan.annualListAmount / 10)
    assert.equal(plan.yearlyAmount, plan.annualListAmount - plan.annualDiscountAmount)
  }
})

test('annual savings are exactly ten per cent without months-free wording', async () => {
  assert.deepEqual(Object.values(subscriptionPlans).map((plan) => plan.annualDiscountAmount), [9_480, 15_480, 22_680])
  const subscriptionSources = await Promise.all([
    source('../src/config/subscriptions.ts'),
    source('../src/routes/portal.subscriptions_.new.tsx'),
    source('../src/routes/plans.tsx'),
  ])
  for (const content of subscriptionSources) assert.doesNotMatch(content, /months? free/i)
})

test('public plan pricing derives from the canonical subscription configuration', async () => {
  const site = await source('../src/config/site.ts')
  assert.match(site, /import \{ subscriptionPlans \} from '@\/config\/subscriptions'/)
  assert.match(site, /price: subscriptionPlans\.care\.monthlyAmount \/ 100/)
  assert.doesNotMatch(site, /price: (79|129|189), annualPrice:/)
})

test('canonical Version 2.5 Terms and Fee Schedule hashes match exact attached documents', async () => {
  const terms = await source('../legal/guardemar-general-terms-v2.5.md')
  const fees = await source('../legal/guardemar-fee-schedule-2026-09-05.md')
  assert.equal(subscriptionTerms.version, '2.5')
  assert.equal(subscriptionTerms.effectiveDate, '2026-09-05')
  assert.equal(createHash('sha256').update(terms).digest('hex'), subscriptionTerms.sha256)
  assert.equal(createHash('sha256').update(fees).digest('hex'), feeSchedule.sha256)
  assert.match(terms, /\*\*Version 2\.5 — in force from 5 September 2026\.\*\*/)
  assert.match(fees, /\*\*Applicable from 5 September 2026\.\*\*/)
})

test('migration seeds the exact canonical Terms and Fee Schedule bytes', async () => {
  const migration = await source('../supabase/migrations/20260905120000_create_subscription_and_payment_domain.sql')
  const terms = await source('../legal/guardemar-general-terms-v2.5.md')
  const fees = await source('../legal/guardemar-fee-schedule-2026-09-05.md')
  assert.equal(migration.split('$guardemar_terms_v25$')[1], terms)
  assert.equal(migration.split('$guardemar_fees_20260905$')[1], fees)
  assert.match(migration, new RegExp(subscriptionTerms.sha256))
  assert.match(migration, new RegExp(feeSchedule.sha256))
  assert.match(migration, /extensions\.digest\(convert_to\(document_text, 'UTF8'\), 'sha256'\)/)
})

test('all Annex C acknowledgements are parsed verbatim from Version 2.5', async () => {
  const terms = await source('../legal/guardemar-general-terms-v2.5.md')
  const acknowledgements = parseAnnexCAcknowledgements(terms)
  assert.equal(acknowledgements.length, 13)
  assert.deepEqual(acknowledgements.map((item) => item.key), [...annexCAcknowledgementKeys])
  for (const acknowledgement of acknowledgements) assert.ok(terms.includes(`- ${acknowledgement.text}`))
  assert.match(acknowledgements[5].displayText, /Clauses 8\.6 to 8\.8/)
  assert.match(acknowledgements[11].displayText, /Early termination/)
})

test('Stripe webhook signatures require a current valid HMAC', () => {
  const secret = 'whsec_example_for_local_unit_test_only'
  const body = JSON.stringify({ id: 'evt_live_unit_test', livemode: true })
  const timestamp = 1_800_000_000
  const signature = createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex')
  assert.equal(verifyStripeSignature(body, `t=${timestamp},v1=${signature}`, secret, timestamp), true)
  assert.equal(verifyStripeSignature(`${body}x`, `t=${timestamp},v1=${signature}`, secret, timestamp), false)
  assert.equal(verifyStripeSignature(body, `t=${timestamp - 301},v1=${signature}`, secret, timestamp), false)
})

test('fixed Portuguese VAT calculations match Stripe cent rounding for all six combinations', () => {
  assert.deepEqual(subscriptionVat, {
    displayName: 'IVA',
    description: 'Portugal VAT 23% — GUARDEMAR services',
    percentage: 23,
    inclusive: false,
    country: 'PT',
    taxType: 'vat',
  })
  for (const [planCode, interval, expectedNet, expectedTax, expectedGross] of vatCombinations) {
    const net = selectedAmount(planCode, interval)
    const tax = calculateTaxAmount(net, subscriptionVat.percentage)
    assert.equal(net, expectedNet)
    assert.equal(tax, expectedTax)
    assert.equal(net + tax, expectedGross)
  }
})

test('server controls Price and Tax Rate selection and rejects browser monetary authority', async () => {
  const api = await source('../netlify/functions/subscription-api.mts')
  const shared = await source('../netlify/functions/_subscription-shared.mts')
  const wizard = await source('../src/routes/portal.subscriptions_.new.tsx')
  assert.match(api, /z\.enum\(\['care', 'care_plus', 'complete'\]\)/)
  assert.match(api, /z\.enum\(\['month', 'year'\]\)/)
  assert.match(shared, /STRIPE_PRICE_\$\{suffix\}_\$\{interval\}/)
  assert.match(shared, /STRIPE_TAX_RATE_ID/)
  assert.match(shared, /price\.tax_behavior !== 'exclusive'/)
  assert.match(shared, /taxRate\.percentage !== subscriptionVat\.percentage/)
  assert.match(shared, /taxRate\.country\?\.toUpperCase\(\) !== subscriptionVat\.country/)
  assert.match(shared, /taxRate\.tax_type\?\.toLowerCase\(\) !== subscriptionVat\.taxType/)
  assert.match(api, /approved_stripe_price_id: approvedPrice\.priceId/)
  assert.match(api, /approved_tax_rate_id: approvedTax\.taxRateId/)
  assert.match(api, /'subscription_data\[default_tax_rates\]\[0\]': acceptance\.stripe_tax_rate_id/)
  assert.doesNotMatch(api, /input\.(amount|currency|discount|stripePriceId|taxRateId)/)
  const submittedBody = wizard.match(/body: JSON\.stringify\(\{ idempotencyKey, propertyId, planCode, billingInterval, startDate, acknowledgements: checks, isConsumer:[^\n]+/)
  assert.ok(submittedBody)
  assert.doesNotMatch(submittedBody[0], /amount|currency|stripePrice|taxRate/)
})

test('Checkout is blocked until Service Order, Terms, Annex C, and withdrawal requirements are accepted', async () => {
  const api = await source('../netlify/functions/subscription-api.mts')
  const wizard = await source('../src/routes/portal.subscriptions_.new.tsx')
  const migration = await source('../supabase/migrations/20260905120000_create_subscription_and_payment_domain.sql')
  assert.match(api, /requiredKeys = \['serviceOrder', 'mainTerms', \.\.\.annexCAcknowledgementKeys\]/)
  assert.match(api, /Every contractual acknowledgement must be accepted/)
  assert.match(api, /early-start withdrawal request applies only/)
  assert.match(api, /input\.startDate <= fourteenDaysFromNow/)
  assert.match(migration, /consumer early-start acknowledgement is required/)
  assert.match(wizard, /disabled=\{!termsOpened\}/)
  assert.match(wizard, /opening or scrolling is not treated as proof/)
  assert.doesNotMatch(wizard, /defaultChecked|checked=\{true\}/)
})

test('Service Orders and acceptance evidence are immutable complete snapshots', async () => {
  const migration = await source('../supabase/migrations/20260905120000_create_subscription_and_payment_domain.sql')
  for (const field of ['termsSha256', 'feeSchedule', 'amountBeingChargedGross', 'contractualAcknowledgements', 'renewalArrangement', 'paymentAuthority']) assert.match(migration, new RegExp(`'${field}'`))
  assert.match(migration, /service_agreement_acceptances_immutable/)
  assert.match(migration, /legal_terms_versions_immutable/)
  assert.match(migration, /fee_schedule_versions_immutable/)
  assert.match(migration, /subscription_payment_events_immutable/)
  assert.match(migration, /before update or delete/)
})

test('webhook activation is payment-authoritative, tax-exact, and idempotent', async () => {
  const webhook = await source('../netlify/functions/stripe-webhook.mts')
  assert.match(webhook, /event\.type === 'invoice\.paid'/)
  assert.match(webhook, /local_status: 'active', payment_status: 'paid'/)
  assert.doesNotMatch(webhook, /checkout\.session\.completed'[\s\S]{0,700}local_status: 'active'/)
  assert.match(webhook, /stripe_webhook_events/)
  assert.match(webhook, /inserted\.error\.code !== '23505'/)
  assert.match(webhook, /last_attempt_at/)
  assert.match(webhook, /object\.amount_paid !== local\.gross_amount/)
  assert.match(webhook, /paidTax !== local\.tax_amount/)
  assert.match(webhook, /object\.total_taxes/)
  assert.match(webhook, /object\.total_tax_amounts/)
  assert.match(webhook, /stripeSubscription\.default_tax_rates/)
  assert.match(webhook, /verifyStripeTaxRate/)
  assert.match(webhook, /invoice\.payment_failed/)
  assert.match(webhook, /local_status: 'past_due', payment_status: 'failed'/)
  assert.match(webhook, /invoice\.payment_action_required/)
  assert.match(webhook, /local_status: 'payment_action_required', payment_status: 'action_required'/)
})

test('customer RLS isolation and admin-only webhook access are retained', async () => {
  const migration = await source('../supabase/migrations/20260905120000_create_subscription_and_payment_domain.sql')
  assert.match(migration, /service_subscriptions_authorised_select[\s\S]+private\.customer_has_property_access\(property_id\)/)
  assert.match(migration, /service_agreement_acceptances_authorised_select[\s\S]+private\.customer_has_property_access\(property_id\)/)
  assert.match(migration, /subscription_payment_events_authorised_select[\s\S]+private\.customer_has_subscription_access\(subscription_id\)/)
  assert.match(migration, /stripe_webhook_events_admin_select[\s\S]+private\.is_admin\(\)/)
  assert.match(migration, /revoke all on public\.legal_terms_versions, public\.fee_schedule_versions, public\.service_subscriptions/)
  assert.match(migration, /grant execute on function public\.create_service_agreement_acceptance[\s\S]+to service_role/)
  assert.doesNotMatch(migration, /grant (insert|update|delete)[\s\S]+to authenticated/i)
})

test('customer portal cannot cancel or change a fixed-term subscription', async () => {
  const api = await source('../netlify/functions/subscription-api.mts')
  const customerDetail = await source('../src/routes/portal.subscriptions_.$id.tsx')
  assert.match(api, /STRIPE_BILLING_PORTAL_CONFIGURATION/)
  assert.doesNotMatch(api, /\/subscriptions\/[^{`'\"]+.*method: 'DELETE'/)
  assert.doesNotMatch(api, /cancel_at_period_end|allow_promotion_codes/)
  assert.match(customerDetail, /does not permit subscription cancellation or plan changes/)
  assert.doesNotMatch(customerDetail, />Cancel subscription</i)
})

test('operational verification tools create no charges and print no credentials', async () => {
  const stripeCheck = await source('../scripts/verify-stripe-live-prices.mts')
  const taxRateSetup = await source('../scripts/create-stripe-live-vat-rate.mts')
  const legalHash = await source('../scripts/hash-guardemar-terms-v2.5.mts')
  assert.doesNotMatch(stripeCheck, /checkout\/sessions|payment_intents|subscriptions', \{ method: 'POST'/)
  assert.doesNotMatch(stripeCheck, /console\.log\([^\n]*(key|priceId)/)
  assert.match(stripeCheck, /tax_behavior === 'exclusive'/)
  assert.match(taxRateSetup, /acct_1QjMaJHFqsWIut8W/)
  assert.match(taxRateSetup, /\/tax_rates\?\$\{query\}/)
  assert.match(taxRateSetup, /matches\.length > 1/)
  assert.match(taxRateSetup, /'\/tax_rates', \{ method: 'POST', body \}/)
  assert.doesNotMatch(taxRateSetup, /\/checkout\/sessions|\/payment_intents|stripeRequest[^\n]+['"]\/(customers|invoices|subscriptions)['"]/)
  assert.doesNotMatch(taxRateSetup, /console\.(log|error)\([^\n]*(STRIPE_SECRET_KEY|process\.env|key\b)/)
  assert.match(legalHash, /Version 2\.5 — in force from 5 September 2026\./)
  assert.match(legalHash, /createHash\('sha256'\)/)
  assert.match(legalHash, new RegExp(subscriptionTerms.sha256))
})
