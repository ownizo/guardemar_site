import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const migrationPath = new URL('../supabase/migrations/20260904090000_create_guardemar_portal_foundation.sql', import.meta.url)
const legacyMigrationPath = new URL('../netlify/database/migrations/20260904070446_create_portal_foundation/migration.sql', import.meta.url)
const sensitiveTables = ['profiles', 'clients', 'client_users', 'properties', 'property_users', 'staff_profiles', 'audit_events']

test('all Phase 1 operational tables are created in the Supabase migration', async () => {
  const migration = await readFile(migrationPath, 'utf8')
  for (const table of sensitiveTables) {
    assert.match(migration, new RegExp(`create table public\\.${table}`, 'i'))
    assert.match(migration, new RegExp(`alter table public\\.${table} enable row level security`, 'i'))
  }
})

test('customer property access resolves through auth.uid and property_users', async () => {
  const migration = await readFile(migrationPath, 'utf8')
  assert.match(migration, /property_users\.property_id = properties\.id[\s\S]*property_users\.user_id = \(select auth\.uid\(\)\)/)
})

test('normal role checks use profiles rather than email', async () => {
  const migration = await readFile(migrationPath, 'utf8')
  const roleFunction = migration.slice(
    migration.indexOf('create function private.current_application_role'),
    migration.indexOf('create function private.is_staff'),
  )
  assert.match(roleFunction, /from public\.profiles where id = \(select auth\.uid\(\)\)/)
  assert.doesNotMatch(roleFunction, /email/i)
})

test('private client and property columns are not granted for direct reads', async () => {
  const migration = await readFile(migrationPath, 'utf8')
  const clientGrant = migration.match(/grant select \([\s\S]*?\)\s+on public\.clients to authenticated;/i)?.[0] ?? ''
  const propertyGrant = migration.match(/grant select \([\s\S]*?\) on public\.properties to authenticated;/i)?.[0] ?? ''
  assert.doesNotMatch(clientGrant, /internal_notes/)
  assert.doesNotMatch(propertyGrant, /access_notes_private|internal_notes|has_alarm/)
})

test('portal API preserves the Supabase bearer token for RLS', async () => {
  const api = await readFile(new URL('../netlify/functions/portal-api.mts', import.meta.url), 'utf8')
  assert.match(api, /global: \{ headers: \{ Authorization: `Bearer \$\{token\}` \} \}/)
  assert.match(api, /\.from\('properties'\)/)
  assert.doesNotMatch(api, /@netlify\/database|getDatabase|set_config\('app\.user/)
})

test('customer property projection omits private and internal columns', async () => {
  const api = await readFile(new URL('../netlify/functions/portal-api.mts', import.meta.url), 'utf8')
  const customerQuery = api.slice(api.indexOf("pathname === 'properties'"), api.indexOf("segments[0] === 'admin'"))
  assert.doesNotMatch(customerQuery, /access_notes_private|internal_notes|has_alarm/)
})

test('service-role credentials are not required by Phase 1 code', async () => {
  const files = [
    new URL('../netlify/functions/portal-api.mts', import.meta.url),
    new URL('../src/lib/portal/supabase.ts', import.meta.url),
    new URL('../src/lib/portal/api.ts', import.meta.url),
    new URL('../src/components/portal/auth.tsx', import.meta.url),
  ]
  for (const file of files) assert.doesNotMatch(await readFile(file, 'utf8'), /SUPABASE_SERVICE_ROLE_KEY/)
})

test('the immutable applied Netlify migration remains present', async () => {
  const migration = await readFile(legacyMigrationPath, 'utf8')
  assert.match(migration, /CREATE TABLE "profiles"/)
})
