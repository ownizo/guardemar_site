import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import { createAdminPropertyWithRefresh, type AdminPropertyPayload } from '../src/lib/portal/property-creation.ts'
import { createStaffWithPhoto, STAFF_PHOTO_MAX_BYTES, type AdminStaffPayload, validateStaffPhoto } from '../src/lib/portal/staff-creation.ts'
import { acquireSubmissionLock } from '../src/lib/portal/submission-lock.ts'
import type { StaffProfile } from '../src/lib/portal/types.ts'

const propertyPayload: AdminPropertyPayload = {
  clientId: '10000000-0000-4000-8000-000000000001', displayName: 'Casa Azul', addressLine1: '1 Rua Azul', addressLine2: '', postalCode: '8600-000', locality: 'Lagos', municipality: 'Lagos', country: 'Portugal', propertyType: 'villa', bedrooms: 3, bathrooms: 2, hasPool: true, hasGarden: false, hasIrrigation: false, hasAlarm: true, accessNotesPrivate: '', internalNotes: '',
}

const staffPayload: AdminStaffPayload = {
  firstName: 'Ana', lastName: 'Silva', displayName: 'Ana Silva', roleTitle: 'Property inspector', email: '', phone: '', internalNotes: '', active: true, showOnClientReports: true,
}

const createdStaff: StaffProfile = {
  id: '20000000-0000-4000-8000-000000000001', user_id: null, first_name: 'Ana', last_name: 'Silva', display_name: 'Ana Silva', role_title: 'Property inspector', email: null, phone: null, active: true, show_on_client_reports: true, internal_notes: null, profile_photo_path: null,
}

const noPhotoDependencies = {
  uploadPhoto: async () => { throw new Error('unexpected upload') },
  updatePhotoPath: async () => { throw new Error('unexpected update') },
  onPhotoUpdated: () => { throw new Error('unexpected photo state') },
}

test('successful property POST remains successful when the captured form resets', async () => {
  let resetCalls = 0
  const result = await createAdminPropertyWithRefresh({
    payload: propertyPayload,
    create: async () => ({ id: '30000000-0000-4000-8000-000000000001', displayName: 'Casa Azul' }),
    onCreated: () => { resetCalls += 1 },
    refresh: async () => {},
  })
  assert.equal(resetCalls, 1)
  assert.equal(result.created.displayName, 'Casa Azul')
  assert.equal(result.stateError, null)
})

test('property refresh failure does not convert creation into failure', async () => {
  const refreshFailure = new Error('list unavailable')
  const result = await createAdminPropertyWithRefresh({
    payload: propertyPayload,
    create: async () => ({ id: '30000000-0000-4000-8000-000000000002', displayName: 'Casa Azul' }),
    onCreated: () => {},
    refresh: async () => { throw refreshFailure },
  })
  assert.equal(result.created.id, '30000000-0000-4000-8000-000000000002')
  assert.equal(result.refreshError, refreshFailure)
})

test('submission lock prevents a second property or collaborator mutation', () => {
  const lock = { current: false }
  const release = acquireSubmissionLock(lock)
  assert.ok(release)
  assert.equal(acquireSubmissionLock(lock), null)
  release()
  assert.ok(acquireSubmissionLock(lock))
})

test('double submission causes one create operation while pending', async () => {
  const lock = { current: false }
  let createCalls = 0
  let finishCreate: (() => void) | undefined
  const pendingCreate = new Promise<void>((resolve) => { finishCreate = resolve })
  const submit = async () => {
    const release = acquireSubmissionLock(lock)
    if (!release) return
    try {
      createCalls += 1
      await pendingCreate
    } finally {
      release()
    }
  }
  const first = submit()
  const second = submit()
  assert.equal(createCalls, 1)
  finishCreate?.()
  await Promise.all([first, second])
  assert.equal(createCalls, 1)
})

test('collaborator is created without an Auth user', async () => {
  let createCalls = 0
  const result = await createStaffWithPhoto({
    payload: staffPayload,
    create: async (payload) => {
      createCalls += 1
      assert.equal('userId' in payload, false)
      return createdStaff
    },
    onCreated: () => {},
    ...noPhotoDependencies,
    refresh: async () => {},
  })
  assert.equal(createCalls, 1)
  assert.equal(result.created?.user_id, null)
})

test('collaborator remains successful when photo upload fails', async () => {
  const uploadFailure = new Error('storage unavailable')
  const photo = new File(['photo'], 'ana.jpg', { type: 'image/jpeg' })
  const result = await createStaffWithPhoto({
    payload: staffPayload, photo,
    create: async () => createdStaff,
    onCreated: () => {},
    uploadPhoto: async () => { throw uploadFailure },
    updatePhotoPath: async () => { throw new Error('unexpected update') },
    onPhotoUpdated: () => {},
    refresh: async () => {},
  })
  assert.equal(result.created?.id, createdStaff.id)
  assert.equal(result.uploadError, uploadFailure)
})

test('collaborator remains successful when post-create refresh fails', async () => {
  const refreshFailure = new Error('team unavailable')
  const result = await createStaffWithPhoto({
    payload: staffPayload,
    create: async () => createdStaff,
    onCreated: () => {},
    ...noPhotoDependencies,
    refresh: async () => { throw refreshFailure },
  })
  assert.equal(result.created?.id, createdStaff.id)
  assert.equal(result.refreshError, refreshFailure)
})

test('valid photo uploads after create and profilePhotoPath updates afterwards', async () => {
  const calls: string[] = []
  const photo = new File(['photo'], 'ana.webp', { type: 'image/webp' })
  const updated = { ...createdStaff, profile_photo_path: `${createdStaff.id}/photo.webp` }
  const result = await createStaffWithPhoto({
    payload: staffPayload, photo,
    create: async () => { calls.push('create'); return createdStaff },
    onCreated: () => { calls.push('created-state') },
    uploadPhoto: async (_member, _photo, extension) => { calls.push(`upload:${extension}`); return updated.profile_photo_path! },
    updatePhotoPath: async (_member, path) => { calls.push(`patch:${path}`); return updated },
    onPhotoUpdated: () => { calls.push('photo-state') },
    refresh: async () => { calls.push('refresh') },
  })
  assert.deepEqual(calls, ['create', 'created-state', 'upload:webp', `patch:${updated.profile_photo_path}`, 'photo-state', 'refresh'])
  assert.equal(result.updated?.profile_photo_path, updated.profile_photo_path)
})

test('invalid photo type is rejected before create or upload', async () => {
  let createCalls = 0
  let uploadCalls = 0
  const result = await createStaffWithPhoto({
    payload: staffPayload,
    photo: new File(['file'], 'ana.gif', { type: 'image/gif' }),
    create: async () => { createCalls += 1; return createdStaff },
    onCreated: () => {},
    uploadPhoto: async () => { uploadCalls += 1; return 'unexpected' },
    updatePhotoPath: async () => createdStaff,
    onPhotoUpdated: () => {},
    refresh: async () => {},
  })
  assert.equal(result.created, null)
  assert.equal(createCalls, 0)
  assert.equal(uploadCalls, 0)
})

test('photo over 5 MB is rejected', () => {
  const validation = validateStaffPhoto({ name: 'large.png', type: 'image/png', size: STAFF_PHOTO_MAX_BYTES + 1 })
  assert.equal(validation.valid, false)
})

test('team API uses Phase 2 staff RPCs and does not create Auth accounts', async () => {
  const source = await readFile(new URL('../netlify/functions/portal-api.mts', import.meta.url), 'utf8')
  assert.match(source, /rpc\('create_staff_profile'/)
  assert.match(source, /rpc\('update_staff_profile'/)
  assert.match(source, /rpc\('list_admin_team'/)
  assert.doesNotMatch(source, /auth\.admin\.createUser/)
})
