import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import { optionalServiceGroups, optionalServices, optionalServicesInGroup } from '../src/config/optional-services.ts'

const source = (path: string) => readFile(new URL(path, import.meta.url), 'utf8')

const expectedFees = [
  ['Mail Care', '€15/month + VAT', undefined],
  ['Pre-Arrival Shopping', '€80 + VAT', 'shopping expenses additional'],
  ['Airport Transfer Coordination', '€25 + VAT', 'transfer cost additional'],
  ['Property Deep Clean Coordination', '€35 + VAT', 'provider cost additional'],
  ['Laundry & Linen Service', '€25 + VAT', 'provider cost additional'],
  ['Maintenance Visit & Contractor Access', '€50 + VAT', undefined],
  ['Delivery & Installation Attendance', '€40 + VAT', undefined],
  ['Vehicle Care', '€25/month + VAT', undefined],
  ['Pool & Garden Contractor Check', '€30 + VAT', undefined],
  ['Key Handover', '€40 + VAT', undefined],
  ['Emergency Call-Out', '€75 + VAT', undefined],
  ['Storm Check', '€60 + VAT', undefined],
] as const

test('optional catalogue contains exactly twelve named services with authoritative fees', () => {
  assert.equal(optionalServices.length, 12)
  assert.deepEqual(optionalServices.map((service) => service.name), expectedFees.map(([name]) => name))
  for (const [name, fee, extraCost] of expectedFees) {
    const service = optionalServices.find((item) => item.name === name)
    assert.ok(service, name)
    assert.equal(service.fee, fee)
    assert.equal(service.extraCost, extraCost)
    assert.doesNotMatch(service.fee, /[–—]| to |range/i)
    assert.doesNotMatch(service.fee, /\d+\s*-\s*\d+/)
  }
})

test('optional service groups cover each service once', () => {
  const grouped = optionalServiceGroups.flatMap((group) => optionalServicesInGroup(group).map((service) => service.id))
  assert.equal(grouped.length, 12)
  assert.deepEqual([...grouped].sort(), [...optionalServices.map((service) => service.id)].sort())
})

test('Services presents the catalogue without prices or transactional controls', async () => {
  const page = await source('../src/routes/services.tsx')
  const component = await source('../src/components/optional-services.tsx')
  assert.match(page, /showPrice=\{false\}/)
  assert.match(page, /OptionalServicesCatalogue/)
  assert.doesNotMatch(page, /€\d+/)
  assert.doesNotMatch(page, /\bVAT\b/)
  assert.doesNotMatch(component, /\b(Buy now|Subscribe|Activate|Add to cart|Book now|Request service|Checkout|Pay now)\b/i)
  assert.doesNotMatch(component, /<button/)
})

test('Plans presents the catalogue with prices after the core care plans', async () => {
  const page = await source('../src/routes/plans.tsx')
  assert.match(page, /plans\.map/)
  assert.match(page, /Request an assessment/)
  assert.match(page, /OptionalServicesCatalogue/)
  assert.match(page, /showPrice/)
  assert.match(page, /Optional services are available in addition to your Guardemar care plan/)
  const optionalSection = page.indexOf('optional-services-section')
  const careGrid = page.indexOf('detailed-plans')
  assert.ok(careGrid >= 0 && optionalSection > careGrid)
})

test('presentation files do not add purchasing, Stripe or data-store behaviour', async () => {
  const files = await Promise.all([
    source('../src/config/optional-services.ts'),
    source('../src/components/optional-services.tsx'),
    source('../src/routes/services.tsx'),
    source('../src/routes/plans.tsx'),
  ])
  for (const content of files) {
    assert.doesNotMatch(content, /stripe/i)
    assert.doesNotMatch(content, /supabase/i)
    assert.doesNotMatch(content, /createCheckout|PaymentLink|Price\.create|checkout session/i)
  }
})
