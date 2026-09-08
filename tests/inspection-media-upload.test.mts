import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import { createInspectionHandler } from '../netlify/functions/inspection-api.mts'

const inspectionId = '10000000-0000-4000-8000-000000000001'
const otherInspectionId = '10000000-0000-4000-8000-000000000002'
const propertyId = '20000000-0000-4000-8000-000000000001'
const areaId = '30000000-0000-4000-8000-000000000001'
const otherAreaId = '30000000-0000-4000-8000-000000000002'
const itemId = '40000000-0000-4000-8000-000000000001'
const otherItemId = '40000000-0000-4000-8000-000000000002'
const generatedUuid = '50000000-0000-4000-8000-000000000001'
const fieldToken = 'field-token-that-is-long-enough-for-validation-123456'
const serviceRoleKey = 'service-role-test-value-that-must-never-be-returned'
const now = Date.UTC(2026, 8, 8, 12, 0, 0)

const session = {
  inspection: { id: inspectionId, status: 'scheduled', property_id: propertyId },
  areas: [{ id: areaId, items: [{ id: itemId }] }],
}

function request(path: string, body?: Record<string, unknown>, token = fieldToken, method?: string) {
  return new Request(`https://guardemar.com/api/inspection/${path}`, {
    method: method ?? (body ? 'POST' : 'GET'),
    headers: token ? { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) } : body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  })
}

function uploadBody(overrides: Record<string, unknown> = {}) {
  return { inspectionId, inspectionAreaId: areaId, inspectionItemId: itemId, filename: 'front-door.jpg', contentType: 'image/jpeg', ...overrides }
}

function createHarness(options: { sessionError?: unknown; registrationError?: unknown } = {}) {
  const calls: Array<{ name: string; params: Record<string, unknown> }> = []
  const signedPaths: string[] = []
  const removedPaths: string[] = []
  const handler = createInspectionHandler({
    getEnv: (name) => ({ SUPABASE_URL: 'https://ablktbpledjceddessyg.supabase.co', SUPABASE_PUBLISHABLE_KEY: 'publishable-test-key', SUPABASE_SERVICE_ROLE_KEY: serviceRoleKey }[name]),
    createFieldClient: () => ({
      rpc: async (name, params) => {
        calls.push({ name, params })
        if (name === 'get_field_inspection') return options.sessionError ? { data: null, error: options.sessionError } : { data: structuredClone(session), error: null }
        if (name === 'register_inspection_media') return options.registrationError ? { data: null, error: options.registrationError } : { data: { id: '60000000-0000-4000-8000-000000000001', ...(params.media_data as object) }, error: null }
        return { data: {}, error: null }
      },
    }),
    createMediaStorage: () => ({
      createSignedUploadUrl: async (path) => { signedPaths.push(path); return { data: { path, token: 'signed-upload-token', signedUrl: `https://ablktbpledjceddessyg.supabase.co/storage/v1/object/upload/sign/inspection-photos/${path}?token=signed-upload-token` }, error: null } },
      remove: async (paths) => { removedPaths.push(...paths); return { data: paths, error: null } },
    }),
    randomUuid: () => generatedUuid,
    now: () => now,
    logError: () => {},
  })
  return { handler, calls, signedPaths, removedPaths }
}

test('valid field token receives an exact short-lived signed upload URL for an image', async () => {
  const { handler, signedPaths } = createHarness()
  const response = await handler(request('media-upload-url', uploadBody({ filename: '../../chosen-by-client.png' })), { requestId: 'request-1' })
  const body = await response.json()

  assert.equal(response.status, 200)
  assert.equal(body.storagePath, `${propertyId}/${inspectionId}/${areaId}/${generatedUuid}.jpg`)
  assert.deepEqual(signedPaths, [body.storagePath])
  assert.equal(Date.parse(body.expiresAt) - now, 2 * 60 * 60 * 1000)
  assert.match(body.signedUrl, /\/inspection-photos\//)
  assert.doesNotMatch(JSON.stringify(body), new RegExp(serviceRoleKey))
})

test('valid field token receives a signed upload URL for a video, with the right extension', async () => {
  const { handler, signedPaths } = createHarness()
  const response = await handler(request('media-upload-url', uploadBody({ filename: 'leak.mov', contentType: 'video/quicktime' })), { requestId: 'request-1b' })
  const body = await response.json()
  assert.equal(response.status, 200)
  assert.equal(body.storagePath, `${propertyId}/${inspectionId}/${areaId}/${generatedUuid}.mov`)
  assert.deepEqual(signedPaths, [body.storagePath])
})

test('a poster upload request produces a distinct -poster.jpg path', async () => {
  const { handler, signedPaths } = createHarness()
  const response = await handler(request('media-upload-url', uploadBody({ filename: 'poster.jpg', contentType: 'image/jpeg', purpose: 'poster' })), { requestId: 'request-1c' })
  const body = await response.json()
  assert.equal(response.status, 200)
  assert.equal(body.storagePath, `${propertyId}/${inspectionId}/${areaId}/${generatedUuid}-poster.jpg`)
  assert.deepEqual(signedPaths, [body.storagePath])
})

test('an unsupported video MIME type is rejected before any signed URL is issued', async () => {
  const { handler, signedPaths } = createHarness()
  const response = await handler(request('media-upload-url', uploadBody({ filename: 'clip.avi', contentType: 'video/x-msvideo' })), { requestId: 'request-1d' })
  assert.equal(response.status, 400)
  assert.equal(signedPaths.length, 0)
})

test('an unsupported image MIME type is rejected before any signed URL is issued', async () => {
  const { handler, signedPaths } = createHarness()
  const response = await handler(request('media-upload-url', uploadBody({ contentType: 'image/gif' })), { requestId: 'request-1e' })
  assert.equal(response.status, 400)
  assert.equal(signedPaths.length, 0)
})

for (const state of ['expired', 'revoked']) {
  test(`${state} field token cannot request signed upload URL`, async () => {
    const { handler } = createHarness({ sessionError: { code: '42501', message: `token ${state}` } })
    const response = await handler(request('media-upload-url', uploadBody()), { requestId: `request-${state}` })
    assert.equal(response.status, 401)
    assert.equal((await response.json()).error.code, 'AUTHENTICATION_ERROR')
  })
}

test('token for Inspection A cannot request a path for Inspection B', async () => {
  const { handler, signedPaths } = createHarness()
  const response = await handler(request('media-upload-url', uploadBody({ inspectionId: otherInspectionId })), { requestId: 'request-2' })
  assert.equal(response.status, 403)
  assert.equal((await response.json()).error.code, 'MEDIA_AUTHORIZATION_ERROR')
  assert.equal(signedPaths.length, 0)
})

test('area from another inspection is rejected', async () => {
  const { handler } = createHarness()
  const response = await handler(request('media-upload-url', uploadBody({ inspectionAreaId: otherAreaId })), { requestId: 'request-3' })
  assert.equal(response.status, 403)
  assert.equal((await response.json()).error.code, 'MEDIA_AUTHORIZATION_ERROR')
})

test('item from another area is rejected', async () => {
  const { handler } = createHarness()
  const response = await handler(request('media-upload-url', uploadBody({ inspectionItemId: otherItemId })), { requestId: 'request-4' })
  assert.equal(response.status, 403)
  assert.equal((await response.json()).error.code, 'MEDIA_AUTHORIZATION_ERROR')
})

test('a successfully uploaded image is registered with the correct relationship', async () => {
  const { handler, calls } = createHarness()
  const storagePath = `${propertyId}/${inspectionId}/${areaId}/${generatedUuid}.webp`
  const response = await handler(request('media', { inspectionId, inspectionAreaId: areaId, inspectionItemId: itemId, storagePath, mediaType: 'image', displayOrder: 3 }), { requestId: 'request-6' })
  const registration = calls.find((call) => call.name === 'register_inspection_media')

  assert.equal(response.status, 201)
  assert.equal((registration?.params.media_data as Record<string, unknown>).inspectionId, inspectionId)
  assert.equal((registration?.params.media_data as Record<string, unknown>).inspectionAreaId, areaId)
  assert.equal((registration?.params.media_data as Record<string, unknown>).inspectionItemId, itemId)
  assert.equal((registration?.params.media_data as Record<string, unknown>).storagePath, storagePath)
  assert.equal((registration?.params.media_data as Record<string, unknown>).mediaType, 'image')
})

test('a successfully uploaded video is registered with duration and poster path', async () => {
  const { handler, calls } = createHarness()
  const storagePath = `${propertyId}/${inspectionId}/${areaId}/${generatedUuid}.mp4`
  const posterPath = `${propertyId}/${inspectionId}/${areaId}/${generatedUuid}-poster.jpg`
  const response = await handler(request('media', { inspectionId, inspectionAreaId: areaId, inspectionItemId: null, storagePath, mediaType: 'video', durationSeconds: 42, posterStoragePath: posterPath }), { requestId: 'request-6b' })
  const registration = calls.find((call) => call.name === 'register_inspection_media')
  assert.equal(response.status, 201)
  assert.equal((registration?.params.media_data as Record<string, unknown>).mediaType, 'video')
  assert.equal((registration?.params.media_data as Record<string, unknown>).durationSeconds, 42)
  assert.equal((registration?.params.media_data as Record<string, unknown>).posterStoragePath, posterPath)
})

test('a video reported over 60 seconds is rejected before it reaches the database', async () => {
  const { handler } = createHarness()
  const storagePath = `${propertyId}/${inspectionId}/${areaId}/${generatedUuid}.mp4`
  const response = await handler(request('media', { inspectionId, inspectionAreaId: areaId, storagePath, mediaType: 'video', durationSeconds: 90 }), { requestId: 'request-6c' })
  assert.equal(response.status, 400)
})

test('registration failure removes the uploaded object', async () => {
  const { handler, removedPaths } = createHarness({ registrationError: { code: '23505', status: 409 } })
  const storagePath = `${propertyId}/${inspectionId}/${areaId}/${generatedUuid}.png`
  const response = await handler(request('media', { inspectionId, inspectionAreaId: areaId, inspectionItemId: null, storagePath, mediaType: 'image' }), { requestId: 'request-7' })
  assert.equal(response.status, 502)
  assert.equal((await response.json()).error.code, 'MEDIA_REGISTER_ERROR')
  assert.deepEqual(removedPaths, [storagePath])
})

test('a sixth media item is rejected with a distinct, friendly error code', async () => {
  const { handler, removedPaths } = createHarness({ registrationError: { code: '23514', message: 'This area already has the maximum of 5 media items.' } })
  const storagePath = `${propertyId}/${inspectionId}/${areaId}/${generatedUuid}.jpg`
  const response = await handler(request('media', { inspectionId, inspectionAreaId: areaId, inspectionItemId: null, storagePath, mediaType: 'image' }), { requestId: 'request-7b' })
  assert.equal(response.status, 409)
  assert.equal((await response.json()).error.code, 'MEDIA_LIMIT_REACHED')
  assert.deepEqual(removedPaths, [storagePath])
})

test('anonymous request without field token is rejected', async () => {
  const { handler } = createHarness()
  const response = await handler(request('media-upload-url', uploadBody(), ''), { requestId: 'request-8' })
  assert.equal(response.status, 401)
  assert.equal((await response.json()).error.code, 'AUTHENTICATION_ERROR')
})

test('customer credential cannot use the field upload endpoint', async () => {
  const { handler } = createHarness({ sessionError: { code: '42501', message: 'not a field token' } })
  const response = await handler(request('media-upload-url', uploadBody(), 'customer-access-token-that-is-not-a-field-token-12345'), { requestId: 'request-9' })
  assert.equal(response.status, 401)
  assert.equal((await response.json()).error.code, 'AUTHENTICATION_ERROR')
})

test('caption/order/removal on an existing item routes to update_inspection_media, tagged with the field token', async () => {
  const { handler, calls } = createHarness()
  const mediaId = '60000000-0000-4000-8000-000000000002'
  const response = await handler(request(`media/${mediaId}`, { rejected: true }, fieldToken, 'PATCH'), { requestId: 'request-10' })
  const call = calls.find((entry) => entry.name === 'update_inspection_media')
  assert.equal(response.status, 200)
  assert.equal(call?.params.media_uuid, mediaId)
  // The handler appends the sha256 hex of the bearer token, never the raw token itself.
  const tokenHash = (call?.params.media_data as Record<string, unknown>).tokenHash
  assert.match(String(tokenHash), /^[0-9a-f]{64}$/)
  assert.notEqual(tokenHash, fieldToken)
  assert.ok((call?.params.media_data as Record<string, unknown>).rejected)
})

test('reordering media for an area calls reorder_inspection_media with the field token', async () => {
  const { handler, calls } = createHarness()
  const response = await handler(request(`areas/${areaId}/media-reorder`, { orderedIds: [generatedUuid] }), { requestId: 'request-11' })
  const call = calls.find((entry) => entry.name === 'reorder_inspection_media')
  assert.equal(response.status, 200)
  assert.equal(call?.params.area_uuid, areaId)
  assert.deepEqual(call?.params.ordered_ids, [generatedUuid])
})

// ---------------------------------------------------------------------
// Static source-pattern coverage for everything the harness above cannot
// exercise directly (the actual Postgres trigger/RLS/RPC bodies, and the
// frontend markup), matching the style used throughout this test suite.
// ---------------------------------------------------------------------

const migrationPath = new URL('../supabase/migrations/20260908150000_generalize_inspection_media.sql', import.meta.url)
const baselineMigrationPath = new URL('../supabase/migrations/20260908090000_create_baseline_condition_workflow.sql', import.meta.url)
const portalApiPath = new URL('../netlify/functions/portal-api.mts', import.meta.url)
const filesFunctionPath = new URL('../netlify/functions/inspection-files.mts', import.meta.url)
const fieldRoutePath = new URL('../src/routes/i.tsx', import.meta.url)
const typesPath = new URL('../src/lib/portal/types.ts', import.meta.url)
const subscriptionMigrationPath = new URL('../supabase/migrations/20260905120000_create_subscription_and_payment_domain.sql', import.meta.url)
const subscriptionApiPath = new URL('../netlify/functions/subscription-api.mts', import.meta.url)
const subscriptionSharedPath = new URL('../netlify/functions/_subscription-shared.mts', import.meta.url)

const source = (path: URL) => readFile(path, 'utf8')

test('existing photograph records and their storage paths are preserved, not migrated', async () => {
  const migration = await source(migrationPath)
  assert.match(migration, /alter table public\.inspection_photos rename to inspection_media/)
  assert.match(migration, /rename constraint inspection_photos_storage_path_key to inspection_media_storage_path_key/)
  assert.doesNotMatch(migration, /update public\.inspection_media set storage_path/)
  assert.doesNotMatch(migration, /drop table.*inspection_photos/i)
})

test('a maximum of 5 media items per area is enforced server-side, concurrency-safe', async () => {
  const migration = await source(migrationPath)
  const trigger = migration.slice(migration.indexOf('create function private.enforce_inspection_media_limit'), migration.indexOf('create trigger inspection_media_enforce_limit'))
  assert.match(trigger, /for update/) // row-locks the area before counting, so two concurrent inserts cannot both pass
  assert.match(trigger, /current_count >= 5/)
  assert.match(trigger, /rejected_at is null/) // a removed (rejected) item frees its slot
  assert.match(migration, /before insert on public\.inspection_media/)
})

test('any mix of images and videos counts toward the same 5-item limit', async () => {
  const migration = await source(migrationPath)
  const trigger = migration.slice(migration.indexOf('create function private.enforce_inspection_media_limit'), migration.indexOf('create trigger inspection_media_enforce_limit'))
  // The count query has no media_type filter -- photos and videos share one budget.
  assert.doesNotMatch(trigger, /media_type/)
})

test('per-type size limits: 10MB image, 100MB video', async () => {
  const migration = await source(migrationPath)
  assert.match(migration, /max_bytes := case when declared_type = 'video' then 104857600 else 10485760 end/)
  assert.match(migration, /values \('inspection-photos', 'inspection-photos', false, 104857600, array\[/)
})

test('accepted MIME types match the task-specified formats', async () => {
  const migration = await source(migrationPath)
  assert.match(migration, /array\['video\/mp4', 'video\/quicktime', 'video\/webm'\]/)
  assert.match(migration, /array\['image\/jpeg', 'image\/png', 'image\/webp'\]/)
})

test('only staff or a valid field token can register, update or reorder media -- never an unauthenticated or customer caller', async () => {
  const migration = await source(migrationPath)
  for (const fn of ['register_inspection_media', 'update_inspection_media', 'reorder_inspection_media']) {
    const start = migration.indexOf(`create function public.${fn}`)
    assert.ok(start >= 0, `expected ${fn} to be defined`)
  }
  assert.match(migration, /register_inspection_media[\s\S]{0,1400}elsif not private\.is_staff\(\) then/)
  assert.match(migration, /update_inspection_media[\s\S]{0,900}elsif not private\.is_staff\(\) then/)
  assert.match(migration, /reorder_inspection_media[\s\S]{0,700}elsif not private\.is_staff\(\) then/)
  const portalApi = await source(portalApiPath)
  assert.doesNotMatch(portalApi, /register_inspection_media/) // customers never reach the registration RPC through the customer-facing API
})

test('unauthorised area/item/property relationships are rejected before any row is written', async () => {
  const migration = await source(migrationPath)
  const register = migration.slice(migration.indexOf('create function public.register_inspection_media'), migration.indexOf('create function public.update_inspection_media'))
  assert.match(register, /not exists \(select 1 from public\.inspection_areas area where area\.id = area_uuid and area\.inspection_id = inspection_uuid\)/)
  assert.match(register, /item\.inspection_area_id = area_uuid/)
})

test('once an inspection is published, its media cannot be silently mutated or deleted', async () => {
  const migration = await source(migrationPath)
  const update = migration.slice(migration.indexOf('create function public.update_inspection_media'), migration.indexOf('create function public.reorder_inspection_media'))
  assert.match(update, /i\.status <> 'published'/)
  assert.match(update, /raise exception 'Media item is not editable'/)
  const reorder = migration.slice(migration.indexOf('create function public.reorder_inspection_media'), migration.indexOf('revoke all on function public.register_inspection_media'))
  assert.match(reorder, /i\.status <> 'published'/)
})

test('display order is a first-class, persistable field with a dedicated reorder RPC', async () => {
  const migration = await source(migrationPath)
  assert.match(migration, /create function public\.reorder_inspection_media\(area_uuid uuid, ordered_ids uuid\[\], token_hash text default null\)/)
  assert.match(migration, /update public\.inspection_media media set display_order = ordering\.position - 1/)
})

test('the customer snapshot builder includes media identity (id, type, storage path) needed for baseline/report evidence', async () => {
  const migration = await source(migrationPath)
  const snapshot = migration.slice(migration.indexOf('create or replace function private.build_client_inspection_report'))
  assert.match(snapshot, /'media', coalesce/)
  assert.match(snapshot, /'id', media\.id/)
  assert.match(snapshot, /'media_type', media\.media_type/)
  assert.match(snapshot, /'storage_path', media\.storage_path/)
  assert.match(snapshot, /'poster_storage_path', media\.poster_storage_path/)
  assert.match(snapshot, /'duration_seconds', media\.duration_seconds/)
  assert.match(snapshot, /media\.client_visible and media\.rejected_at is null/)
})

test('baseline acknowledgement hashes the same published_snapshot that now carries media identity, unchanged mechanism', async () => {
  const baseline = await source(baselineMigrationPath)
  assert.match(baseline, /inspection_record\.published_snapshot, encode\(extensions\.digest\(convert_to\(inspection_record\.published_snapshot::text, 'UTF8'\), 'sha256'\), 'hex'\)/)
})

test('cross-client access to media stays denied: RLS on the renamed table and its storage objects still gate on property access', async () => {
  const migration = await source(migrationPath)
  assert.match(migration, /inspection_storage_customer_select[\s\S]{0,650}private\.customer_has_property_access\(inspection\.property_id\)/)
  // The poster path is a second object per video row -- the customer select
  // policy must authorise it too, or a video's poster silently 404s for the client.
  assert.match(migration, /media\.storage_path = name or media\.poster_storage_path = name/)
})

test('PDF represents a video as portal-only evidence, never embeds it playable', async () => {
  const files = await source(filesFunctionPath)
  assert.match(files, /renderVideoTile/)
  assert.match(files, /Video available in the Guardemar client portal\./)
  assert.doesNotMatch(files, /import .*video/i)
})

test('the ZIP endpoint stays photo-only by design; videos are downloaded individually, never buffered together', async () => {
  const files = await source(filesFunctionPath)
  assert.match(files, /images\.entries\(\)/)
  assert.doesNotMatch(files, /media_type === 'video'[\s\S]{0,200}zip\.file/)
})

test('the mobile field UI offers distinct take-photo, record-video and library controls, and warns at the 5-item limit', async () => {
  const field = await source(fieldRoutePath)
  assert.match(field, /accept="image\/\*" capture="environment"/)
  assert.match(field, /accept="video\/\*" capture="environment"/)
  assert.match(field, /accept="image\/\*,video\/\*" multiple/)
  assert.match(field, /MAX_MEDIA_PER_AREA = 5/)
  assert.match(field, /MAX_VIDEO_SECONDS = 60/)
  assert.match(field, /of \{MAX_MEDIA_PER_AREA\} media items/)
  assert.doesNotMatch(field, /<video[^>]*autoplay/i)
})

test('the frozen shape of a report published before this migration is normalised, not broken', async () => {
  const types = await source(typesPath)
  assert.match(types, /export function mediaForArea/)
  assert.match(types, /return \(area\.photos \?\? \[\]\)\.map/)
})

test('the Stripe/subscription domain is untouched by the media migration or its API changes', async () => {
  const migration = await source(migrationPath)
  assert.doesNotMatch(migration, /\b(create|alter|drop) (table|function|policy|trigger).*(stripe|checkout_session|service_agreement_acceptances|service_subscriptions)/i)
  const subscriptionMigration = await source(subscriptionMigrationPath)
  const subscriptionApi = await source(subscriptionApiPath)
  const subscriptionShared = await source(subscriptionSharedPath)
  for (const file of [subscriptionMigration, subscriptionApi, subscriptionShared]) {
    assert.doesNotMatch(file, /inspection_media|register_inspection_media|MAX_VIDEO/)
  }
})
