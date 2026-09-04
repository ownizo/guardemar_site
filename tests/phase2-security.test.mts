import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const migrationPath = new URL('../supabase/migrations/20260904120000_create_phase2_inspection_operations.sql', import.meta.url)
const photoHardeningMigrationPath = new URL('../supabase/migrations/20260904170000_harden_field_photo_registration.sql', import.meta.url)
const fieldApiPath = new URL('../netlify/functions/inspection-api.mts', import.meta.url)
const adminRoutePath = new URL('../src/routes/admin.inspections_.$id.tsx', import.meta.url)

test('Phase 2 creates relational inspection snapshots with RLS', async () => {
  const migration = await readFile(migrationPath, 'utf8')
  for (const table of ['property_areas', 'inspection_templates', 'inspection_template_items', 'inspections', 'inspection_areas', 'inspection_items', 'inspection_photos', 'inspection_access_tokens']) {
    assert.match(migration, new RegExp(`create table public\\.${table}`, 'i'))
    assert.match(migration, new RegExp(`alter table public\\.${table} enable row level security`, 'i'))
  }
  assert.match(migration, /source_property_area_id/)
  assert.match(migration, /source_template_item_id/)
  assert.doesNotMatch(migration, /unique\s*\(property_id,\s*area_type\)/i)
})

test('customer inspection access requires publication and property_users', async () => {
  const migration = await readFile(migrationPath, 'utf8')
  assert.match(migration, /status = 'published' and private\.customer_has_property_access\(property_id\)/)
  assert.match(migration, /property_users pu[\s\S]*pu\.property_id = property_uuid and pu\.user_id = auth\.uid\(\)/)
  assert.match(migration, /photo\.client_visible[\s\S]*inspection\.status = 'published'/)
})

test('field credentials are hashed, scoped, expiring and revocable', async () => {
  const migration = await readFile(migrationPath, 'utf8')
  const fieldApi = await readFile(fieldApiPath, 'utf8')
  assert.match(migration, /token_hash bytea not null unique/)
  assert.match(migration, /token\.revoked_at is null[\s\S]*token\.expires_at > now\(\)/)
  assert.match(migration, /inspection\.status in \('scheduled', 'in_progress'\)/)
  assert.match(fieldApi, /createHash\('sha256'\)\.update\(rawToken\)\.digest\('hex'\)/)
  assert.doesNotMatch(fieldApi, /console\.(log|error)\([^\n]*rawToken/)
})

test('mobile links keep plaintext tokens out of request paths', async () => {
  const route = await readFile(adminRoutePath, 'utf8')
  assert.match(route, /\/i#\$\{token\}/)
  assert.doesNotMatch(route, /\/i\/\$\{token\}/)
})

test('field completion never publishes and publication is admin-only', async () => {
  const migration = await readFile(migrationPath, 'utf8')
  const completeStart = migration.indexOf('create function public.complete_field_inspection')
  const completeEnd = migration.indexOf('\n$$;', completeStart)
  const completion = migration.slice(completeStart, completeEnd)
  assert.match(completion, /status = 'awaiting_review'/)
  assert.doesNotMatch(completion, /status = 'published'/)
  const publishStart = migration.indexOf('create function public.publish_admin_inspection')
  const publishEnd = migration.indexOf('\n$$;', publishStart)
  const publication = migration.slice(publishStart, publishEnd)
  assert.match(publication, /private\.is_admin\(\)/)
  assert.match(publication, /published_snapshot = snapshot/)
  assert.match(publication, /inspection_published/)
})

test('private buckets and storage policies protect unpublished content', async () => {
  const migration = await readFile(migrationPath, 'utf8')
  assert.match(migration, /values \('inspection-photos', 'inspection-photos', false/)
  assert.match(migration, /values \('staff-photos', 'staff-photos', false/)
  assert.match(migration, /inspection_storage_customer_select[\s\S]*photo\.client_visible[\s\S]*inspection\.status = 'published'/)
  assert.match(migration, /inspection_storage_field_insert[\s\S]*field_access_allows/)
})

test('service-role use is isolated to signed field upload authorisation and cleanup', async () => {
  const fieldApi = await readFile(fieldApiPath, 'utf8')
  const normalOperations = await Promise.all([
    readFile(new URL('../netlify/functions/portal-api.mts', import.meta.url), 'utf8'),
    readFile(new URL('../src/lib/portal/supabase.ts', import.meta.url), 'utf8'),
  ])
  assert.match(fieldApi, /createSignedUploadUrl\(storagePath, \{ upsert: false \}\)/)
  assert.match(fieldApi, /SUPABASE_SERVICE_ROLE_KEY/)
  assert.doesNotMatch(normalOperations.join('\n'), /SUPABASE_SERVICE_ROLE_KEY/)
  assert.doesNotMatch(fieldApi, /SUPABASE_JWT_SECRET|issueStorageJwt|storageToken/)
})

test('photo registration requires the uploaded object and exact area-item relationship', async () => {
  const migration = await readFile(photoHardeningMigrationPath, 'utf8')
  assert.match(migration, /item\.inspection_area_id = area_uuid/)
  assert.match(migration, /object\.bucket_id = 'inspection-photos' and object\.name = storage_path/)
  assert.match(migration, /property_uuid::text \|\| '\/' \|\| inspection_uuid::text \|\| '\/' \|\| area_uuid::text/)
  assert.match(migration, /\(jpg\|png\|webp\)/)
})
