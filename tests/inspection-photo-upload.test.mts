import assert from 'node:assert/strict'
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
const now = Date.UTC(2026, 8, 4, 12, 0, 0)

const session = {
  inspection: { id: inspectionId, status: 'scheduled', property_id: propertyId },
  areas: [{ id: areaId, items: [{ id: itemId }] }],
}

function request(path: string, body?: Record<string, unknown>, token = fieldToken) {
  return new Request(`https://guardemar.com/api/inspection/${path}`, {
    method: body ? 'POST' : 'GET',
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
        if (name === 'register_inspection_photo') return options.registrationError ? { data: null, error: options.registrationError } : { data: { id: '60000000-0000-4000-8000-000000000001', ...(params.photo_data as object) }, error: null }
        return { data: {}, error: null }
      },
    }),
    createPhotoStorage: () => ({
      createSignedUploadUrl: async (path) => { signedPaths.push(path); return { data: { path, token: 'signed-upload-token', signedUrl: `https://ablktbpledjceddessyg.supabase.co/storage/v1/object/upload/sign/inspection-photos/${path}?token=signed-upload-token` }, error: null } },
      remove: async (paths) => { removedPaths.push(...paths); return { data: paths, error: null } },
    }),
    randomUuid: () => generatedUuid,
    now: () => now,
    logError: () => {},
  })
  return { handler, calls, signedPaths, removedPaths }
}

test('valid field token receives an exact short-lived signed upload URL', async () => {
  const { handler, signedPaths } = createHarness()
  const response = await handler(request('photo-upload-url', uploadBody({ filename: '../../chosen-by-client.png' })), { requestId: 'request-1' })
  const body = await response.json()

  assert.equal(response.status, 200)
  assert.equal(body.storagePath, `${propertyId}/${inspectionId}/${areaId}/${generatedUuid}.jpg`)
  assert.deepEqual(signedPaths, [body.storagePath])
  assert.equal(Date.parse(body.expiresAt) - now, 2 * 60 * 60 * 1000)
  assert.match(body.signedUrl, /\/inspection-photos\//)
  assert.doesNotMatch(JSON.stringify(body), new RegExp(serviceRoleKey))
})

for (const state of ['expired', 'revoked']) {
  test(`${state} field token cannot request signed upload URL`, async () => {
    const { handler } = createHarness({ sessionError: { code: '42501', message: `token ${state}` } })
    const response = await handler(request('photo-upload-url', uploadBody()), { requestId: `request-${state}` })
    assert.equal(response.status, 401)
    assert.equal((await response.json()).error.code, 'AUTHENTICATION_ERROR')
  })
}

test('token for Inspection A cannot request a path for Inspection B', async () => {
  const { handler, signedPaths } = createHarness()
  const response = await handler(request('photo-upload-url', uploadBody({ inspectionId: otherInspectionId })), { requestId: 'request-2' })
  assert.equal(response.status, 403)
  assert.equal((await response.json()).error.code, 'PHOTO_AUTHORIZATION_ERROR')
  assert.equal(signedPaths.length, 0)
})

test('area from another inspection is rejected', async () => {
  const { handler } = createHarness()
  const response = await handler(request('photo-upload-url', uploadBody({ inspectionAreaId: otherAreaId })), { requestId: 'request-3' })
  assert.equal(response.status, 403)
  assert.equal((await response.json()).error.code, 'PHOTO_AUTHORIZATION_ERROR')
})

test('item from another area is rejected', async () => {
  const { handler } = createHarness()
  const response = await handler(request('photo-upload-url', uploadBody({ inspectionItemId: otherItemId })), { requestId: 'request-4' })
  assert.equal(response.status, 403)
  assert.equal((await response.json()).error.code, 'PHOTO_AUTHORIZATION_ERROR')
})

test('invalid photo MIME type is rejected', async () => {
  const { handler } = createHarness()
  const response = await handler(request('photo-upload-url', uploadBody({ contentType: 'image/gif' })), { requestId: 'request-5' })
  assert.equal(response.status, 400)
  assert.equal((await response.json()).error.code, 'PHOTO_AUTHORIZATION_ERROR')
})

test('successful uploaded path is registered with the correct relationship', async () => {
  const { handler, calls } = createHarness()
  const storagePath = `${propertyId}/${inspectionId}/${areaId}/${generatedUuid}.webp`
  const response = await handler(request('photos', { inspectionId, inspectionAreaId: areaId, inspectionItemId: itemId, storagePath, displayOrder: 3 }), { requestId: 'request-6' })
  const registration = calls.find((call) => call.name === 'register_inspection_photo')

  assert.equal(response.status, 201)
  assert.equal((registration?.params.photo_data as Record<string, unknown>).inspectionId, inspectionId)
  assert.equal((registration?.params.photo_data as Record<string, unknown>).inspectionAreaId, areaId)
  assert.equal((registration?.params.photo_data as Record<string, unknown>).inspectionItemId, itemId)
  assert.equal((registration?.params.photo_data as Record<string, unknown>).storagePath, storagePath)
})

test('registration failure removes the uploaded object', async () => {
  const { handler, removedPaths } = createHarness({ registrationError: { code: '23505', status: 409 } })
  const storagePath = `${propertyId}/${inspectionId}/${areaId}/${generatedUuid}.png`
  const response = await handler(request('photos', { inspectionId, inspectionAreaId: areaId, inspectionItemId: null, storagePath }), { requestId: 'request-7' })
  assert.equal(response.status, 502)
  assert.equal((await response.json()).error.code, 'PHOTO_REGISTER_ERROR')
  assert.deepEqual(removedPaths, [storagePath])
})

test('anonymous request without field token is rejected', async () => {
  const { handler } = createHarness()
  const response = await handler(request('photo-upload-url', uploadBody(), ''), { requestId: 'request-8' })
  assert.equal(response.status, 401)
  assert.equal((await response.json()).error.code, 'AUTHENTICATION_ERROR')
})

test('customer credential cannot use the field upload endpoint', async () => {
  const { handler } = createHarness({ sessionError: { code: '42501', message: 'not a field token' } })
  const response = await handler(request('photo-upload-url', uploadBody(), 'customer-access-token-that-is-not-a-field-token-12345'), { requestId: 'request-9' })
  assert.equal(response.status, 401)
  assert.equal((await response.json()).error.code, 'AUTHENTICATION_ERROR')
})
