import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const migrationPath = new URL('../netlify/database/migrations/20260904070446_create_portal_foundation/migration.sql', import.meta.url)
const sensitiveTables = ['profiles', 'clients', 'client_users', 'properties', 'property_users', 'staff_profiles', 'audit_events']

test('all Phase 1 sensitive tables force row-level security', async () => {
  const migration = await readFile(migrationPath, 'utf8')
  for (const table of sensitiveTables) {
    assert.match(migration, new RegExp(`ALTER TABLE public\\.${table} ENABLE ROW LEVEL SECURITY`, 'i'))
    assert.match(migration, new RegExp(`ALTER TABLE public\\.${table} FORCE ROW LEVEL SECURITY`, 'i'))
  }
})

test('customer property access is based on property_users', async () => {
  const migration = await readFile(migrationPath, 'utf8')
  assert.match(migration, /pu\.property_id = properties\.id AND pu\.user_id = public\.current_app_user_id\(\)/)
})

test('role changes require the database-backed admin role', async () => {
  const migration = await readFile(migrationPath, 'utf8')
  assert.match(migration, /NEW\.role IS DISTINCT FROM OLD\.role AND public\.current_app_role\(\) IS DISTINCT FROM 'admin'/)
})

test('client code never references the service-role secret', async () => {
  const files = [
    new URL('../src/lib/portal/supabase.ts', import.meta.url),
    new URL('../src/lib/portal/api.ts', import.meta.url),
    new URL('../src/components/portal/auth.tsx', import.meta.url),
  ]
  for (const file of files) assert.doesNotMatch(await readFile(file, 'utf8'), /SUPABASE_SERVICE_ROLE_KEY/)
})

test('customer property API omits private and internal columns', async () => {
  const api = await readFile(new URL('../netlify/functions/portal-api.mts', import.meta.url), 'utf8')
  const customerQuery = api.slice(api.indexOf("pathname === 'properties'"), api.indexOf("segments[0] === 'admin'"))
  assert.doesNotMatch(customerQuery, /access_notes_private|internal_notes|has_alarm/)
})
