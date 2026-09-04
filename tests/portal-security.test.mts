import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const migrationPath = new URL('../supabase/migrations/20260904074341_create_guardemar_portal_foundation.sql', import.meta.url)
const legacyMigrationPath = new URL('../netlify/database/migrations/20260904070446_create_portal_foundation/migration.sql', import.meta.url)
const sensitiveTables = ['profiles', 'clients', 'client_users', 'properties', 'property_users', 'staff_profiles', 'audit_events']
const privilegedRpcs = [
  'get_admin_dashboard()',
  'list_admin_clients(text)',
  'get_admin_client(uuid)',
  'list_admin_properties()',
  'get_admin_property(uuid)',
  'create_admin_client(jsonb)',
  'create_admin_property(jsonb)',
]

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

test('privileged RPCs fail closed through the stored staff role', async () => {
  const migration = await readFile(migrationPath, 'utf8')
  for (const signature of privilegedRpcs) {
    const name = signature.slice(0, signature.indexOf('('))
    const start = migration.indexOf(`create function public.${name}`)
    const end = migration.indexOf('\n$$;', start) + 4
    const definition = migration.slice(start, end)
    assert.notEqual(start, -1, `${name} definition is missing`)
    assert.match(definition, /security definer[\s\S]*set search_path = ''/i)
    assert.match(definition, /perform private\.require_staff\(\)/i)
  }
})

test('RPC execution grants exclude anonymous users', async () => {
  const migration = await readFile(migrationPath, 'utf8')
  for (const signature of ['initialise_profile()', ...privilegedRpcs]) {
    const escaped = signature.replace(/[()]/g, '\\$&')
    assert.match(migration, new RegExp(`revoke all on function public\\.${escaped} from public, anon;`, 'i'))
    assert.match(migration, new RegExp(`grant execute on function public\\.${escaped} to authenticated;`, 'i'))
  }
})

test('initial profile bootstrap cannot accept a caller-selected role', async () => {
  const migration = await readFile(migrationPath, 'utf8')
  const start = migration.indexOf('create function public.initialise_profile()')
  const end = migration.indexOf('\n$$;', start) + 4
  const definition = migration.slice(start, end)
  assert.match(definition, /current_user_id uuid := auth\.uid\(\)/)
  assert.match(definition, /current_email text := lower\(coalesce\(auth\.jwt\(\) ->> 'email', ''\)\)/)
  assert.match(definition, /current_email = 'info@guardemar\.com'[\s\S]*not exists \(select 1 from public\.profiles where role = 'admin'\)/)
  assert.match(definition, /requested_role public\.application_role := 'customer'/)
  assert.doesNotMatch(definition, /requested_role\s*:=\s*\([^)]*->>/i)
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

test('browser auth redirects use the active origin and the dedicated reset route', async () => {
  const auth = await readFile(new URL('../src/components/portal/auth.tsx', import.meta.url), 'utf8')
  assert.match(auth, /const origin = window\.location\.origin/)
  assert.match(auth, /resetPasswordForEmail\(email, \{ redirectTo: `\$\{origin\}\/reset-password` \}\)/)
  assert.doesNotMatch(auth, /localhost(?::\d+)?/i)
})

test('password recovery validates the callback and removes auth parameters', async () => {
  const auth = await readFile(new URL('../src/components/portal/auth.tsx', import.meta.url), 'utf8')
  assert.match(auth, /event === 'PASSWORD_RECOVERY'/)
  assert.match(auth, /setRecoveryState\('invalid'\)/)
  assert.match(auth, /clearAuthCallbackParameters\(\)/)
  assert.match(auth, /to="\/portal\/forgot-password">Request a new reset link/)
})

test('invitation-only authentication exposes no public signup flow', async () => {
  const auth = await readFile(new URL('../src/components/portal/auth.tsx', import.meta.url), 'utf8')
  assert.doesNotMatch(auth, /\.auth\.signUp|signInWithOtp/)
  assert.match(auth, /Access is by invitation only\./)
})

test('the immutable applied Netlify migration remains present', async () => {
  const migration = await readFile(legacyMigrationPath, 'utf8')
  assert.match(migration, /CREATE TABLE "profiles"/)
})
