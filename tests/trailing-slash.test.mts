import assert from 'node:assert/strict'
import test from 'node:test'

import { canonicalTrailingSlashPath } from '../src/lib/trailing-slash.ts'

test('public pages without a trailing slash redirect to the canonical form', () => {
  assert.equal(canonicalTrailingSlashPath('/plans'), '/plans/')
  assert.equal(canonicalTrailingSlashPath('/blog/small-water-leaks-vacant-homes'), '/blog/small-water-leaks-vacant-homes/')
  assert.equal(canonicalTrailingSlashPath('/areas/praia-da-luz'), '/areas/praia-da-luz/')
})

test('canonical, private, API and static paths are left alone', () => {
  for (const path of ['/', '/plans/', '/portal', '/portal/login', '/admin/clients', '/auth/callback', '/reset-password', '/i', '/api/contact', '/_serverFn/abc', '/.netlify/functions/x', '/sitemap.xml', '/favicon.svg']) {
    assert.equal(canonicalTrailingSlashPath(path), null, path)
  }
})

test('paths that merely start like a private prefix still redirect', () => {
  assert.equal(canonicalTrailingSlashPath('/inspection-checklist'), '/inspection-checklist/')
  assert.equal(canonicalTrailingSlashPath('/about'), '/about/')
})
