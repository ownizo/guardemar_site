import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

// Root cause: property_users is the sole table customer-facing RLS checks on
// public.properties (see properties_select_authorised in the foundation migration),
// by design — it is what lets a co-owner, spouse, or other authorised user be
// restricted to selected properties. Neither create_admin_property (adding a
// property) nor link_client_portal_user (linking a customer to a client) ever
// inserted into it, so a client visibly having a property and a customer visibly
// being linked to that client never implied the customer could actually see it.
const migrationPath = new URL('../supabase/migrations/20260907180000_auto_grant_property_access.sql', import.meta.url)
const foundationPath = new URL('../supabase/migrations/20260904074341_create_guardemar_portal_foundation.sql', import.meta.url)
const clientRoutePath = new URL('../src/routes/admin.clients_.$id.tsx', import.meta.url)

test('customer RLS on properties is (still) authoritative through property_users only', async () => {
  const foundation = await readFile(foundationPath, 'utf8')
  assert.match(foundation, /properties_select_authorised[\s\S]*from public\.property_users[\s\S]*property_users\.user_id = \(select auth\.uid\(\)\)/)
})

test('the fix never touches RLS policies or the explicit restrict/revoke mechanism', async () => {
  const migration = await readFile(migrationPath, 'utf8')
  assert.doesNotMatch(migration, /create policy|alter policy|drop policy/i)
  // set_client_portal_property_access (the fine-grained "Manage access" restriction
  // mechanism) and revoke_client_portal_access are untouched — they remain the only
  // way to narrow or remove access below the new default.
  assert.doesNotMatch(migration, /function public\.set_client_portal_property_access/)
  assert.doesNotMatch(migration, /function public\.revoke_client_portal_access/)
})

test('creating a property grants access to that client\'s already-linked portal users, scoped to that one property', async () => {
  const migration = await readFile(migrationPath, 'utf8')
  const fn = migration.slice(migration.indexOf('function public.create_admin_property'), migration.indexOf('function public.link_client_portal_user'))
  assert.match(fn, /insert into public\.property_users \(property_id, user_id\)/)
  assert.match(fn, /select created\.id, cu\.user_id/)
  assert.match(fn, /from public\.client_users cu/)
  assert.match(fn, /where cu\.client_id = created\.client_id/)
  // No duplicate grants on repeated/concurrent calls.
  assert.match(fn, /on conflict \(property_id, user_id\) do nothing/)
})

test('linking a customer backfills access to the client\'s existing active properties, only on a genuinely new link', async () => {
  const migration = await readFile(migrationPath, 'utf8')
  const fn = migration.slice(migration.indexOf('function public.link_client_portal_user'), migration.lastIndexOf('-- One-time idempotent backfill'))
  assert.match(fn, /already_linked boolean/)
  assert.match(fn, /select exists \(\s*select 1 from public\.client_users where client_id = client_uuid and user_id = user_uuid\s*\) into already_linked/)
  const guardStart = fn.indexOf('if not already_linked then')
  const backfillGuard = fn.slice(guardStart, fn.indexOf('end if;', guardStart))
  assert.match(backfillGuard, /insert into public\.property_users \(property_id, user_id\)/)
  assert.match(backfillGuard, /where p\.client_id = client_uuid and p\.active/)
  assert.match(backfillGuard, /on conflict \(property_id, user_id\) do nothing/)
  // The insert into client_users itself must precede the new-link check being acted
  // on, and updating only the relationship label on an existing link must not repeat
  // the backfill (asserted by the already_linked guard above).
})

test('the one-time backfill only grants access where none was ever configured, so it cannot override a deliberate partial restriction', async () => {
  const migration = await readFile(migrationPath, 'utf8')
  const backfill = migration.slice(migration.lastIndexOf('insert into public.property_users (property_id, user_id)\nselect p.id, cu.user_id'))
  assert.match(backfill, /from public\.client_users cu/)
  assert.match(backfill, /join public\.properties p on p\.client_id = cu\.client_id/)
  assert.match(backfill, /where p\.active/)
  // Scoped to users with zero existing property_users rows — anyone with at least one
  // grant has genuinely had "Manage access" used for them and is left untouched.
  assert.match(backfill, /not exists \(select 1 from public\.property_users pu where pu\.user_id = cu\.user_id\)/)
  assert.match(backfill, /on conflict \(property_id, user_id\) do nothing/)
})

test('get_admin_client now returns the same camelCase shape as every other admin RPC', async () => {
  const migration = await readFile(migrationPath, 'utf8')
  const fn = migration.slice(migration.indexOf('function public.get_admin_client'))
  assert.match(fn, /'firstName', c\.first_name/)
  assert.match(fn, /'lastName', c\.last_name/)
  assert.match(fn, /'taxNumber', c\.tax_number/)
  assert.match(fn, /'billingAddress', c\.billing_address/)
  assert.match(fn, /'internalNotes', c\.internal_notes/)
  // The old bug: serialising the whole row with to_jsonb(c) instead of naming fields
  // explicitly, which produced snake_case keys the frontend never reads.
  assert.doesNotMatch(fn, /to_jsonb\(c\)/)
})

test('the client detail page never interpolates a possibly-missing name directly — it always goes through formatPersonName', async () => {
  const source = await readFile(clientRoutePath, 'utf8')
  assert.match(source, /import \{ formatPersonName \} from '@\/lib\/portal\/client-display'/)
  assert.match(source, /const clientName = formatPersonName\(client\.firstName, client\.lastName, client\.email\)/)
  assert.doesNotMatch(source, /\$\{client\.firstName\}/)
  assert.doesNotMatch(source, /\$\{client\.lastName\}/)
})
