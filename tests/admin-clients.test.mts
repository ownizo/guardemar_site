import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import { createAdminClientWithRefresh, type AdminClientPayload } from '../src/lib/portal/client-creation.ts'

const originalPayload: AdminClientPayload = {
  firstName: 'Rita',
  lastName: 'Quintino',
  email: 'rita.m.quintino@gmail.com',
  phone: '916361288',
  taxNumber: '205845410',
  billingAddress: 'Varandas de São João Lote 4 2ºE 8600-324 Lagos',
  country: 'Portugal',
  internalNotes: 'Cliente Teste',
}

test('one creation flow sends the original payload once and retains the created ID', async () => {
  let createCalls = 0
  let retainedId = ''
  const result = await createAdminClientWithRefresh({
    payload: originalPayload,
    create: async (payload) => {
      createCalls += 1
      assert.deepEqual(payload, originalPayload)
      return { id: '10000000-0000-4000-8000-000000000099', firstName: payload.firstName, lastName: payload.lastName, email: payload.email, phone: payload.phone }
    },
    onCreated: (client) => { retainedId = client.id },
    refresh: async () => {},
  })

  assert.equal(createCalls, 1)
  assert.equal(retainedId, result.created.id)
  assert.equal(result.stateError, null)
  assert.equal(result.refreshError, null)
})

test('post-create refresh failure preserves successful creation', async () => {
  let createdBeforeRefresh = false
  const refreshFailure = new Error('list unavailable')
  const result = await createAdminClientWithRefresh({
    payload: originalPayload,
    create: async (payload) => ({ id: '10000000-0000-4000-8000-000000000098', firstName: payload.firstName, lastName: payload.lastName, email: payload.email, phone: payload.phone }),
    onCreated: () => { createdBeforeRefresh = true },
    refresh: async () => {
      assert.equal(createdBeforeRefresh, true)
      throw refreshFailure
    },
  })

  assert.equal(result.created.id, '10000000-0000-4000-8000-000000000098')
  assert.equal(result.refreshError, refreshFailure)
})

test('post-create state failure still retains successful creation', async () => {
  const stateFailure = new Error('form reset failed')
  const result = await createAdminClientWithRefresh({
    payload: originalPayload,
    create: async (payload) => ({ id: '10000000-0000-4000-8000-000000000097', firstName: payload.firstName, lastName: payload.lastName, email: payload.email, phone: payload.phone }),
    onCreated: () => { throw stateFailure },
    refresh: async () => {},
  })

  assert.equal(result.created.id, '10000000-0000-4000-8000-000000000097')
  assert.equal(result.stateError, stateFailure)
  assert.equal(result.refreshError, null)
})

test('create failure does not run refresh or report a created client', async () => {
  let created = false
  let refreshed = false
  await assert.rejects(createAdminClientWithRefresh({
    payload: originalPayload,
    create: async () => { throw new Error('RPC failed') },
    onCreated: () => { created = true },
    refresh: async () => { refreshed = true },
  }), /RPC failed/)
  assert.equal(created, false)
  assert.equal(refreshed, false)
})

test('client form locks synchronously and does not use an awaited event currentTarget', async () => {
  const route = await readFile(new URL('../src/routes/admin.clients.tsx', import.meta.url), 'utf8')
  assert.match(route, /if \(submittingRef\.current\) return/)
  assert.match(route, /const formElement = event\.currentTarget/)
  assert.match(route, /submittingRef\.current = true/)
  assert.match(route, /disabled=\{submitting\}/)
  assert.doesNotMatch(route, /await portalApi[\s\S]{0,400}event\.currentTarget\.reset/)
})

test('portal API exposes structured creation and deletion stages', async () => {
  const api = await readFile(new URL('../netlify/functions/portal-api.mts', import.meta.url), 'utf8')
  const foundation = await readFile(new URL('../supabase/migrations/20260904074341_create_guardemar_portal_foundation.sql', import.meta.url), 'utf8')
  assert.match(api, /'CREATE_RPC_ERROR', 'create_rpc'/)
  assert.match(api, /code: authorizationError \? 'AUTHORIZATION_ERROR'/)
  assert.match(api, /details: error\.details/)
  assert.match(api, /hint: error\.hint/)
  assert.match(api, /status,/)
  assert.match(api, /stage: error\.stage/)
  assert.doesNotMatch(api, /SUPABASE_SERVICE_ROLE_KEY/)
  assert.match(foundation, /'client_created', 'client', created\.id/)
})

test('delete migration enforces admin-only dependency-aware individual and bulk deletion', async () => {
  const migration = await readFile(new URL('../supabase/migrations/20260904113000_add_admin_client_deletion.sql', import.meta.url), 'utf8')
  assert.match(migration, /create function private\.require_admin\(\)[\s\S]*private\.is_admin\(\)/i)
  assert.match(migration, /create function public\.delete_admin_client\(client_uuid uuid\)[\s\S]*perform private\.require_admin\(\)/i)
  assert.match(migration, /create function public\.delete_admin_clients\(client_uuids uuid\[\]\)[\s\S]*perform private\.require_admin\(\)/i)
  assert.match(migration, /from public\.properties[\s\S]*reason', 'linked_properties'/i)
  assert.match(migration, /from public\.client_users[\s\S]*reason', 'linked_portal_users'/i)
  assert.match(migration, /'client_deleted'/)
  assert.match(migration, /revoke all on function public\.delete_admin_client\(uuid\) from public, anon;/i)
  assert.match(migration, /revoke all on function public\.delete_admin_clients\(uuid\[\]\) from public, anon;/i)
  assert.doesNotMatch(migration, /on delete cascade|service_role/i)
})
