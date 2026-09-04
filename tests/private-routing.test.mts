import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import { canAccessPrivateArea, getPrivateHomePath, getPrivateLoginPath, getRoleLabel } from '../src/lib/portal/access.ts'

const source = (path: string) => readFile(new URL(path, import.meta.url), 'utf8')

test('stored roles determine the authenticated landing area', () => {
  assert.equal(getPrivateHomePath('customer'), '/portal')
  assert.equal(getPrivateHomePath('staff'), '/admin')
  assert.equal(getPrivateHomePath('admin'), '/admin')
})

test('private areas enforce a closed role matrix', () => {
  assert.equal(canAccessPrivateArea('customer', 'portal'), true)
  assert.equal(canAccessPrivateArea('staff', 'portal'), false)
  assert.equal(canAccessPrivateArea('admin', 'portal'), false)
  assert.equal(canAccessPrivateArea('customer', 'admin'), false)
  assert.equal(canAccessPrivateArea('staff', 'admin'), true)
  assert.equal(canAccessPrivateArea('admin', 'admin'), true)
})

test('unauthenticated users return to the matching login area', () => {
  assert.equal(getPrivateLoginPath('portal'), '/portal/login')
  assert.equal(getPrivateLoginPath('admin'), '/admin/login')
})

test('private identity labels are presentational rather than raw roles', () => {
  assert.equal(getRoleLabel('customer'), 'Client')
  assert.equal(getRoleLabel('staff'), 'Staff member')
  assert.equal(getRoleLabel('admin'), 'Administrator')
})

test('both login surfaces redirect from the stored profile role', async () => {
  const auth = await source('../src/components/portal/auth.tsx')
  assert.match(auth, /portalApi<\{ profile: PortalProfile \}>\('session\/initialise'/)
  assert.match(auth, /getPrivateHomePath\(profile\.role\)/)
  assert.doesNotMatch(auth, /area === 'admin' \? '\/admin' : '\/portal'/)
})

test('every Phase 1 private route uses the matching shared guard', async () => {
  const adminRoutes = [
    '../src/routes/admin.index.tsx',
    '../src/routes/admin.clients.tsx',
    '../src/routes/admin.clients.$id.tsx',
    '../src/routes/admin.properties.tsx',
    '../src/routes/admin.properties.$id.tsx',
    '../src/routes/admin.inspections.tsx',
    '../src/routes/admin.inspections.$id.tsx',
    '../src/routes/admin.team.tsx',
    '../src/routes/admin.team.$id.tsx',
  ]
  const portalRoutes = [
    '../src/routes/portal.index.tsx',
    '../src/routes/portal.account.tsx',
    '../src/routes/portal.properties.tsx',
    '../src/routes/portal.inspections.tsx',
    '../src/routes/portal.inspections.$id.tsx',
  ]

  for (const route of adminRoutes) assert.match(await source(route), /<PrivateGuard area="admin">/)
  for (const route of portalRoutes) assert.match(await source(route), /<PrivateGuard area="portal">/)
})

test('admin identity and Phase 2 navigation remain operational and distinct', async () => {
  const shell = await source('../src/components/portal/shell.tsx')
  const styles = await source('../src/styles.css')
  assert.match(shell, /area === 'admin' \? 'Guardemar' : 'Guardemar client'/)
  assert.match(shell, /getRoleLabel\(profile\.role\)/)
  assert.match(shell, /label: 'Dashboard'/)
  assert.match(shell, /label: 'Clients'/)
  assert.match(shell, /label: 'Properties'/)
  assert.match(shell, /label: 'Inspections'/)
  assert.match(shell, /label: 'Team'/)
  assert.doesNotMatch(shell, /label: 'Reports'|label: 'Requests'/)
  assert.match(styles, /\.private-app-admin/)
})

test('logout clears the local session and returns to the matching login', async () => {
  const shell = await source('../src/components/portal/shell.tsx')
  assert.match(shell, /signOut\(\{ scope: 'local' \}\)/)
  assert.match(shell, /getPrivateLoginPath\(area\)/)
})
