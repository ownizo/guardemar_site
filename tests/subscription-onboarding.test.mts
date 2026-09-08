import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

// Root cause: authenticate() resolved the caller's own profiles.role using the
// service-role client, even though profiles_select_own already lets a user read
// their own row with their own session. That made this one check — uniquely among
// the portal's authorization paths — depend on SUPABASE_SERVICE_ROLE_KEY being
// configured correctly, so subscription onboarding broke while every other portal
// page (which authenticates the same way, without touching the service-role key)
// kept working.
const sharedPath = new URL('../netlify/functions/_subscription-shared.mts', import.meta.url)
const apiPath = new URL('../netlify/functions/subscription-api.mts', import.meta.url)
const routePath = new URL('../src/routes/portal.subscriptions_.new.tsx', import.meta.url)
const stylesPath = new URL('../src/styles.css', import.meta.url)
const domainMigrationPath = new URL('../supabase/migrations/20260905120000_create_subscription_and_payment_domain.sql', import.meta.url)
const foundationPath = new URL('../supabase/migrations/20260904074341_create_guardemar_portal_foundation.sql', import.meta.url)

test('resolving the caller\'s own profile role no longer requires the service-role client', async () => {
  const source = await readFile(sharedPath, 'utf8')
  const authFn = source.slice(source.indexOf('export async function authenticate'), source.indexOf('export async function requirePropertyAccess'))
  // The bearer-token-attached client (RLS-scoped as the caller) is what reads the
  // profile, not the service-role `database`/`serviceDatabase()` client.
  assert.match(authFn, /authenticatedClient\.from\('profiles'\)\.select\('role'\)\.eq\('id', data\.user\.id\)\.maybeSingle\(\)/)
  assert.doesNotMatch(authFn.slice(0, authFn.indexOf("select('role')")), /database\.from\('profiles'\)/)
  // The authenticated client carries the caller's own bearer token, matching
  // portal-api.mts's authenticated-client pattern (not an anonymous/service client).
  assert.match(authFn, /global: \{ headers: \{ Authorization: `Bearer \$\{token\}` \} \}/)
})

test('a customer reading their own profile role is already permitted by RLS (profiles_select_authorised)', async () => {
  const foundation = await readFile(foundationPath, 'utf8')
  assert.match(foundation, /profiles_select_authorised[\s\S]*using \(id = \(select auth\.uid\(\)\) or private\.is_staff\(\)\)/)
})

test('the property selector still uses property_users, the same access model as /portal/properties', async () => {
  const source = await readFile(apiPath, 'utf8')
  const optionsHandler = source.slice(source.indexOf("path === 'options'"), source.indexOf("path === ''"))
  assert.match(optionsHandler, /from\('property_users'\)\.select\('properties\(/)
  assert.match(optionsHandler, /\.eq\('user_id', auth\.user\.id\)/)
  assert.doesNotMatch(optionsHandler, /from\('client_users'\)/)
})

test('the browser can never supply a client_id — it is derived server-side from the selected property', async () => {
  const api = await readFile(apiPath, 'utf8')
  const acceptanceInput = api.slice(api.indexOf('const acceptanceInput = z.object({'), api.indexOf('const checkoutInput'))
  assert.doesNotMatch(acceptanceInput, /clientId/)
  assert.match(acceptanceInput, /propertyId: z\.string\(\)\.uuid\(\)/)

  const migration = await readFile(domainMigrationPath, 'utf8')
  const rpc = migration.slice(migration.indexOf('function public.create_service_agreement_acceptance'))
  // No client_uuid parameter exists on the RPC at all — client_record comes only
  // from the property's own client_id.
  assert.doesNotMatch(rpc.slice(0, rpc.indexOf('begin')), /client_uuid/)
  assert.match(rpc, /select \* into client_record from public\.clients where id = property_record\.client_id/)
})

test('the server re-verifies property_users access before creating any agreement, regardless of what the browser claims', async () => {
  const migration = await readFile(domainMigrationPath, 'utf8')
  const rpc = migration.slice(migration.indexOf('function public.create_service_agreement_acceptance'))
  assert.match(rpc, /not exists \(\s*select 1 from public\.property_users\s*where property_id = property_uuid and user_id = actor_user_id\s*\) then raise exception 'property access denied'/)

  const api = await readFile(apiPath, 'utf8')
  const acceptRoute = api.slice(api.indexOf("path === 'accept'"), api.indexOf("path === 'checkout'"))
  assert.match(acceptRoute, /await requirePropertyAccess\(auth, input\.propertyId\)/)
})

test('a property belongs to exactly one client, so no multi-client disambiguation is ever needed for this flow', async () => {
  // The RPC derives client_id purely from the chosen property's own client_id
  // (properties.client_id is a required, single foreign key — see the foundation
  // migration) rather than from any user -> client_users lookup, so there is no
  // "which of this customer's clients" ambiguity to resolve in the first place.
  const foundation = await readFile(foundationPath, 'utf8')
  assert.match(foundation, /client_id uuid not null references public\.clients\(id\) on delete restrict/)
})

test('the stepper renders through the existing styled subscription-steps component, not the unstyled leftover markup', async () => {
  const source = await readFile(routePath, 'utf8')
  assert.match(source, /<ol className="subscription-steps" aria-label="Subscription steps">/)
  assert.match(source, /<small>\{label\}<\/small>/)
  assert.match(source, /aria-current=\{index === step \? 'step' : undefined\}/)
  assert.doesNotMatch(source, /className="wizard-steps"/)
  assert.doesNotMatch(source, /'done'/)

  const styles = await readFile(stylesPath, 'utf8')
  assert.match(styles, /\.subscription-steps\{/)
  assert.match(styles, /\.subscription-steps li\.active,\.subscription-steps li\.complete\{/)
})
