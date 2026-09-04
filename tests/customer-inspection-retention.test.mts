import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import { customerInspectionAvailableUntil, isCustomerInspectionAvailable } from '../src/lib/portal/inspection-retention.ts'

const migrationPath = new URL('../supabase/migrations/20260904150000_add_customer_inspection_retention.sql', import.meta.url)
const filesFunctionPath = new URL('../netlify/functions/inspection-files.mts', import.meta.url)
const reportComponentPath = new URL('../src/components/portal/inspection-report.tsx', import.meta.url)

test('customer availability is exactly 180 elapsed UTC days', () => {
  const publishedAt = '2026-09-04T12:30:00.000Z'
  assert.equal(customerInspectionAvailableUntil(publishedAt).toISOString(), '2027-03-03T12:30:00.000Z')
  assert.equal(isCustomerInspectionAvailable(publishedAt, '2026-09-05T12:30:00.000Z'), true)
  assert.equal(isCustomerInspectionAvailable(publishedAt, '2027-03-02T12:30:00.000Z'), true)
  assert.equal(isCustomerInspectionAvailable(publishedAt, '2027-03-03T12:29:59.999Z'), true)
  assert.equal(isCustomerInspectionAvailable(publishedAt, '2027-03-03T12:30:00.000Z'), false)
  assert.equal(isCustomerInspectionAvailable(publishedAt, '2027-03-03T12:30:00.001Z'), false)
})

test('database policies enforce expiry for reports, rows and storage', async () => {
  const migration = await readFile(migrationPath, 'utf8')
  assert.match(migration, /now\(\) < published_at \+ interval '4320 hours'/)
  assert.match(migration, /inspections_customer_available_select[\s\S]*customer_inspection_is_available\(published_at\)/)
  assert.match(migration, /inspection_areas_customer_available_select[\s\S]*customer_inspection_is_available\(inspection\.published_at\)/)
  assert.match(migration, /inspection_items_customer_available_select[\s\S]*customer_inspection_is_available\(inspection\.published_at\)/)
  assert.match(migration, /inspection_photos_customer_available_select[\s\S]*photo\.client_visible[\s\S]*rejected_at is null/)
  assert.match(migration, /inspection_storage_customer_select[\s\S]*customer_inspection_is_available\(inspection\.published_at\)/)
  assert.match(migration, /staff_storage_customer_select[\s\S]*customer_inspection_is_available\(inspection\.published_at\)/)
  assert.match(migration, /list_customer_inspections[\s\S]*is_available boolean[\s\S]*published_snapshot/)
  assert.match(migration, /get_customer_inspection[\s\S]*status = 'published'[\s\S]*customer_inspection_is_available/)
})

test('published snapshot contains client fields and omits internal fields', async () => {
  const migration = await readFile(migrationPath, 'utf8')
  const snapshotStart = migration.indexOf('create or replace function private.build_client_inspection_report')
  const snapshotEnd = migration.indexOf('drop function if exists public.list_customer_inspections', snapshotStart)
  const snapshot = migration.slice(snapshotStart, snapshotEnd)
  for (const clientField of ['published_at', 'display_name', 'custom_label', 'inspection_item_id', 'client_summary', 'profile_photo_path']) assert.match(snapshot, new RegExp(clientField))
  for (const internalField of ['internal_review_notes', 'internal_notes', 'token_hash', 'access_token', 'auth_id', 'published_by']) assert.doesNotMatch(snapshot, new RegExp(internalField))
  assert.match(snapshot, /observation_client_visible/)
  assert.match(snapshot, /recommendation_client_visible/)
  assert.match(snapshot, /photo\.client_visible and photo\.rejected_at is null/)
})

test('PDF, photo and ZIP routes share server-side customer authorisation', async () => {
  const source = await readFile(filesFunctionPath, 'utf8')
  assert.match(source, /profile\.role !== 'customer'/)
  assert.match(source, /rpc\('get_customer_inspection'/)
  assert.match(source, /segments\[1\] === 'pdf'/)
  assert.match(source, /segments\[2\] === 'zip'/)
  assert.match(source, /findPhoto\(authorised\.report, photoId\)/)
  assert.match(source, /photo\.inspection_item_id/)
  assert.doesNotMatch(source, /SUPABASE_SERVICE_ROLE_KEY/)
  assert.doesNotMatch(source, /internal_review_notes|token_hash|mobile_access|auth_id/)
  assert.match(source, /Cache-Control': 'private, no-store'/)
})

test('PDF uses the published snapshot and report-resolution approved images', async () => {
  const source = await readFile(filesFunctionPath, 'utf8')
  assert.match(source, /const \{ report, supabase \} = authorised/)
  assert.match(source, /report\.property\.display_name/)
  assert.match(source, /report\.areas/)
  assert.match(source, /report\.client_summary/)
  assert.match(source, /renderImage\(source\.buffer, 'pdf'\)/)
  assert.match(source, /width: 1200, height: 900, quality: 78/)
  assert.match(source, /Property Inspection Report/)
  assert.match(source, /Page \$\{pageIndex \+ 1\} of \$\{pageRange\.count\}/)
  assert.match(source, /not a structural survey, engineering inspection or technical certification/)
})

test('gallery uses authorised optimised images and accessible controls', async () => {
  const source = await readFile(reportComponentPath, 'utf8')
  assert.match(source, /role="dialog"/)
  assert.match(source, /aria-modal="true"/)
  assert.match(source, /ArrowLeft/)
  assert.match(source, /ArrowRight/)
  assert.match(source, /Escape/)
  assert.match(source, /\/thumbnail/)
  assert.match(source, /\/display/)
  assert.match(source, /\/download/)
  assert.match(source, /Photo \{selectedIndex \+ 1\} of \{photos\.length\}/)
  assert.doesNotMatch(source, /createSignedUrl/)
})
