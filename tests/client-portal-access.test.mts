import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const invitationFunctionPath = new URL('../netlify/functions/portal-invite.mts', import.meta.url)
const portalApiPath = new URL('../netlify/functions/portal-api.mts', import.meta.url)
const apiClientPath = new URL('../src/lib/portal/api.ts', import.meta.url)
const componentPath = new URL('../src/components/portal/client-portal-access.tsx', import.meta.url)
const clientRoutePath = new URL('../src/routes/admin.clients_.$id.tsx', import.meta.url)
const phase2MigrationPath = new URL('../supabase/migrations/20260904120000_create_phase2_inspection_operations.sql', import.meta.url)
const retentionMigrationPath = new URL('../supabase/migrations/20260904150000_add_customer_inspection_retention.sql', import.meta.url)

test('customer invitations use the server-only Supabase Auth Admin API', async () => {
  const source = await readFile(invitationFunctionPath, 'utf8')
  const adminCheck = source.indexOf("profile?.role !== 'admin'")
  const invitation = source.indexOf('auth.admin.inviteUserByEmail')
  assert.notEqual(adminCheck, -1)
  assert.ok(invitation > adminCheck)
  assert.match(source, /Netlify\.env\.get\('SUPABASE_SERVICE_ROLE_KEY'\)/)
  assert.match(source, /redirectTo: INVITATION_REDIRECT_URL/)
  assert.match(source, /https:\/\/guardemar\.com\/reset-password/)
  assert.doesNotMatch(source, /auth\.admin\.createUser|localhost(?::\d+)?/i)
})

test('the service role remains isolated from normal portal data operations', async () => {
  const normalOperations = await Promise.all([
    readFile(portalApiPath, 'utf8'),
    readFile(apiClientPath, 'utf8'),
    readFile(componentPath, 'utf8'),
  ])
  assert.doesNotMatch(normalOperations.join('\n'), /SUPABASE_SERVICE_ROLE_KEY/)
})

test('admin portal access routes call the production RPC contract', async () => {
  const source = await readFile(portalApiPath, 'utf8')
  for (const rpc of [
    'get_admin_client_portal_access',
    'link_client_portal_user',
    'set_client_portal_property_access',
    'revoke_client_portal_access',
  ]) assert.match(source, new RegExp(`rpc\\('${rpc}'`))
  assert.match(source, /await requireAdmin\(authenticated\)[\s\S]*get_admin_client_portal_access/)
  assert.match(source, /property_scope_validation/)
  assert.match(source, /input\.propertyIds\.some\(\(propertyId\) => !allowedPropertyIds\.has\(propertyId\)\)/)
  assert.match(source, /segments\.length === 3[\s\S]*delete_admin_client/)
})

test('PUT property access is accepted and reaches the existing property-access handler', async () => {
  const source = await readFile(portalApiPath, 'utf8')
  const whitelist = source.indexOf("['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)")
  const propertyAccessRoute = source.indexOf("segments[5] === 'properties' && req.method === 'PUT'")
  const propertyAccessRpc = source.indexOf("rpc('set_client_portal_property_access'", propertyAccessRoute)

  assert.notEqual(whitelist, -1)
  assert.notEqual(propertyAccessRoute, -1)
  assert.ok(propertyAccessRpc > propertyAccessRoute)
})

test('client detail supports multiple users, property selection, and confirmed revocation', async () => {
  const [component, route] = await Promise.all([readFile(componentPath, 'utf8'), readFile(clientRoutePath, 'utf8')])
  assert.match(route, /profile\.role === 'admin'[\s\S]*<ClientPortalAccess/)
  assert.match(component, /access\.users\.map/)
  assert.match(component, /type="checkbox"/)
  assert.match(component, /properties\.some\(\(property\) => property\.id === propertyId\)/)
  assert.match(component, /<ConfirmDialog[\s\S]*Revoke portal access/)
  assert.match(component, /The Supabase Auth account remains in place and is not deleted\./)
  assert.doesNotMatch(component, /deleteUser|auth\.users/)
})

test('invite, link, property, and refresh failures remain distinct and recoverable', async () => {
  const component = await readFile(componentPath, 'utf8')
  for (const code of ['AUTH_INVITE_ERROR', 'CLIENT_LINK_ERROR', 'PROPERTY_ACCESS_ERROR', 'POST_SAVE_REFRESH_ERROR']) assert.match(component, new RegExp(code))
  assert.match(component, /The invitation was sent[\s\S]*Retry the link without sending another invitation/)
  assert.match(component, /saved access is preserved[\s\S]*latest list could not be refreshed/i)
  assert.match(component, /void retryLink\(\)/)
})

test('customer inspection visibility remains RLS-backed, published-only, and limited to 180 days', async () => {
  const [phase2, retention] = await Promise.all([readFile(phase2MigrationPath, 'utf8'), readFile(retentionMigrationPath, 'utf8')])
  assert.match(phase2, /property_users pu[\s\S]*pu\.user_id = auth\.uid\(\)/)
  assert.match(retention, /create function public\.list_customer_inspections\(\)/)
  assert.match(retention, /create or replace function public\.get_customer_inspection\(inspection_uuid uuid\)/)
  assert.match(retention, /inspection\.status = 'published'/)
  assert.match(retention, /published_at \+ interval '4320 hours'/)
})

test('portal access integration does not recreate the already-applied production RPCs', async () => {
  const migrationFiles = await Promise.all([
    readFile(new URL('../supabase/migrations/20260904074341_create_guardemar_portal_foundation.sql', import.meta.url), 'utf8'),
    readFile(phase2MigrationPath, 'utf8'),
    readFile(retentionMigrationPath, 'utf8'),
  ])
  for (const rpc of ['get_admin_client_portal_access', 'link_client_portal_user', 'set_client_portal_property_access', 'revoke_client_portal_access']) {
    assert.doesNotMatch(migrationFiles.join('\n'), new RegExp(`create(?: or replace)? function public\\.${rpc}`, 'i'))
  }
})
