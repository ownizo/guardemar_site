import assert from 'node:assert/strict'
import test from 'node:test'

import { formatPersonName } from '../src/lib/portal/client-display.ts'

test('a normal first and last name are joined as-is', () => {
  assert.equal(formatPersonName('Ana', 'Silva', 'ana@example.com'), 'Ana Silva')
})

test('a missing last name still shows the first name, not "undefined"', () => {
  assert.equal(formatPersonName('Ana', undefined, 'ana@example.com'), 'Ana')
  assert.equal(formatPersonName('Ana', null, 'ana@example.com'), 'Ana')
})

test('a missing first name still shows the last name, not "undefined"', () => {
  assert.equal(formatPersonName(undefined, 'Silva', 'ana@example.com'), 'Silva')
})

test('both names missing falls back to the given fallback (typically email), never renders "undefined undefined"', () => {
  assert.equal(formatPersonName(undefined, undefined, 'ana@example.com'), 'ana@example.com')
  assert.equal(formatPersonName(null, null, 'ana@example.com'), 'ana@example.com')
  const result = formatPersonName(undefined, undefined, 'ana@example.com')
  assert.doesNotMatch(result, /undefined/)
})

test('blank/whitespace-only names are treated as missing', () => {
  assert.equal(formatPersonName('  ', '  ', 'ana@example.com'), 'ana@example.com')
  assert.equal(formatPersonName('Ana', '  ', 'ana@example.com'), 'Ana')
})

test('an unusable fallback never renders "undefined" or "null" literally', () => {
  assert.equal(formatPersonName(undefined, undefined, undefined), 'Unknown')
  assert.equal(formatPersonName(undefined, undefined, null), 'Unknown')
  assert.equal(formatPersonName(undefined, undefined, ''), 'Unknown')
  assert.equal(formatPersonName(null, null, null), 'Unknown')
})
