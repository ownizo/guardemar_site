import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const source = (path: string) => readFile(new URL(path, import.meta.url), 'utf8')

function extractProceedToCheckout(wizard: string) {
  const start = wizard.indexOf('async function proceedToCheckout()')
  const end = wizard.indexOf('return <PrivateShell', start)
  assert.ok(start >= 0 && end > start, 'proceedToCheckout function not found')
  return wizard.slice(start, end)
}

// Regression coverage for the "Subscription not found." defect on the checkout step:
// the RPC returned the correct IDs and the correct data was persisted, but the API
// layer's own read of the freshly-created subscription (to embed its acceptance)
// failed with PostgREST error PGRST201 ("more than one relationship was found"),
// because service_subscriptions and service_agreement_acceptances have two foreign
// keys between them in opposite directions and every embed was unqualified.

test('the SQL RPC returns real subscription/acceptance table IDs, not swapped', async () => {
  const migration = await source('../supabase/migrations/20260905120000_create_subscription_and_payment_domain.sql')
  assert.match(migration, /returning \* into subscription_record;/)
  assert.match(migration, /returning \* into acceptance_record;/)
  assert.match(migration, /return jsonb_build_object\('subscriptionId', subscription_record\.id, 'acceptanceId', acceptance_record\.id\);/)
})

test('the two records are linked in both directions before the RPC returns', async () => {
  const migration = await source('../supabase/migrations/20260905120000_create_subscription_and_payment_domain.sql')
  assert.match(migration, /insert into public\.service_agreement_acceptances \(\s*subscription_id, user_id, client_id, property_id, terms_version/)
  assert.match(migration, /\) values \(\s*subscription_record\.id, actor_user_id, client_record\.id, property_record\.id, terms_record\.version,/)
  assert.match(migration, /update public\.service_subscriptions\s*set agreement_acceptance_id = acceptance_record\.id/)
})

test('a retry with the same idempotency key returns the SAME subscription/acceptance IDs and creates nothing new', async () => {
  const migration = await source('../supabase/migrations/20260905120000_create_subscription_and_payment_domain.sql')
  const retryBranch = migration.match(/select \* into subscription_record from public\.service_subscriptions\s*where acceptance_idempotency_key = acceptance_idempotency and created_by = actor_user_id;\s*if found then\s*return jsonb_build_object\('subscriptionId', subscription_record\.id, 'acceptanceId', subscription_record\.agreement_acceptance_id\);\s*end if;/)
  assert.ok(retryBranch, 'idempotent retry branch must return existing IDs before any insert')
})

test('acceptance_idempotency_key is unique, so duplicate acceptances/subscriptions cannot be created by a retried request', async () => {
  const migration = await source('../supabase/migrations/20260905120000_create_subscription_and_payment_domain.sql')
  assert.match(migration, /acceptance_idempotency_key uuid not null unique/)
  assert.match(migration, /subscription_id uuid not null unique references public\.service_subscriptions\(id\)/)
})

test('checkout resolves the exact subscription id accept() returns, using a disambiguated embed (regression for PGRST201)', async () => {
  const api = await source('../netlify/functions/subscription-api.mts')
  // Two foreign keys exist between these tables in opposite directions
  // (service_agreement_acceptances.subscription_id, and
  // service_subscriptions.agreement_acceptance_id), which makes unqualified
  // `service_agreement_acceptances(...)` embedding ambiguous to PostgREST.
  // Every embed of service_agreement_acceptances under service_subscriptions
  // must disambiguate via the subscription_id foreign key.
  const embeds = [...api.matchAll(/service_agreement_acceptances(!subscription_id)?\(/g)]
  assert.ok(embeds.length >= 3, 'expected at least three embeds of service_agreement_acceptances in subscription-api.mts')
  for (const embed of embeds) assert.equal(embed[1], '!subscription_id', `unqualified/ambiguous embed found: ${embed[0]}`)
})

test('accept() defensively re-verifies the RPC-returned subscription before trusting it', async () => {
  const api = await source('../netlify/functions/subscription-api.mts')
  assert.match(api, /uuidPattern\.test\(returned\.subscriptionId\)/)
  assert.match(api, /uuidPattern\.test\(returned\.acceptanceId\)/)
  assert.match(api, /verification\.data\.created_by !== auth\.user\.id/)
  assert.match(api, /verification\.data\.property_id !== input\.propertyId/)
  assert.match(api, /verification\.data\.agreement_acceptance_id !== returned\.acceptanceId/)
  assert.match(api, /verification\.data\.acceptance_idempotency_key !== input\.idempotencyKey/)
  assert.match(api, /verification\.data\.plan_code !== input\.planCode/)
  assert.match(api, /verification\.data\.billing_interval !== input\.billingInterval/)
})

test('a malformed or mismatched RPC response fails closed instead of returning an unverified ID', async () => {
  const api = await source('../netlify/functions/subscription-api.mts')
  assert.match(api, /typeof returned\.subscriptionId !== 'string'[\s\S]{0,450}throw new HttpError\(500, 'Agreement acceptance could not be verified\. Please try again\.', 'ACCEPTANCE_VERIFICATION_FAILED'\)/)
  const linkageMismatchBlock = api.match(/if \(\s*verification\.error \|\| !verification\.data[\s\S]{0,600}ACCEPTANCE_LINKAGE_MISMATCH[\s\S]{0,200}ACCEPTANCE_VERIFICATION_FAILED/)
  assert.ok(linkageMismatchBlock, 'a linkage mismatch must fail closed with a 500, not silently return an unverifiable subscriptionId')
  assert.doesNotMatch(api, /return json\(result\.data, \{ status: 201 \}\)/, 'the raw unverified RPC result must never be returned directly')
})

test('the wizard only advances to Confirmation / redirects once the Checkout URL is verified to be a live Stripe Checkout URL', async () => {
  const wizard = await source('../src/routes/portal.subscriptions_.new.tsx')
  const body = extractProceedToCheckout(wizard)
  // Must validate the Stripe-specific hosted-checkout URL shape (a live Checkout
  // Session id in the standard /c/pay/ path), not a fixed host -- Stripe Checkout can
  // legitimately be served from a Stripe-verified custom domain, not only
  // checkout.stripe.com.
  assert.match(body, /\/\^https:\\\/\\\/\[\^\/\]\+\\\/c\\\/pay\\\/cs_live_\[A-Za-z0-9\]\+\//)
  assert.doesNotMatch(body, /checkout\\\.stripe\\\.com/, 'must not hardcode checkout.stripe.com as the only valid host')
  const urlCheckIndex = body.indexOf('.test(checkout.url)')
  const setStepIndex = body.indexOf('setStep(7)')
  const assignIndex = body.indexOf('window.location.assign(checkout.url)')
  assert.ok(urlCheckIndex >= 0 && setStepIndex > urlCheckIndex, 'setStep(7) must come after the Checkout URL is validated')
  assert.ok(assignIndex > urlCheckIndex, 'the redirect must come after the Checkout URL is validated')
})

test('a failed checkout preparation keeps the customer on the Payment step and allows retry with the same idempotency key', async () => {
  const wizard = await source('../src/routes/portal.subscriptions_.new.tsx')
  const body = extractProceedToCheckout(wizard)
  // The whole accept+checkout+redirect sequence is inside one try; the catch only
  // clears pending/sets an error, it never advances step or navigates away.
  assert.match(body, /try \{[\s\S]*catch \(requestError\) \{\s*setError\(/)
  const catchBlock = body.match(/catch \(requestError\) \{[\s\S]*?\}/)
  assert.ok(catchBlock)
  assert.doesNotMatch(catchBlock[0], /setStep\(/, 'the catch branch must not advance the step')
  assert.doesNotMatch(catchBlock[0], /window\.location\.assign/, 'the catch branch must not navigate away')
  assert.match(catchBlock[0], /setPending\(false\)/)
  // idempotencyKey is generated once per wizard mount (useState initialiser, no
  // dependency array to reset it), so a retry after a failure reuses the same key
  // and hits the RPC's idempotent-return branch rather than creating a new agreement.
  assert.match(wizard, /const \[idempotencyKey\] = useState\(\(\) => crypto\.randomUUID\(\)\)/)
})
