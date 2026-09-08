import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const source = (path: string) => readFile(new URL(path, import.meta.url), 'utf8')

// Regression coverage for the wizard visual redesign: the previous markup used
// class names (.property-choice, .plan-choice-grid, .plan-choice) that had no
// matching CSS rules at all, which is why Steps 1-2 rendered as bare unstyled
// radio/text chains in production. These tests pin the corrected class names
// to their CSS rules and to the underlying data model, and confirm the legal
// content of Step 4/5 was preserved -- only its presentation changed.

test('property selection renders as styled cards, not the unstyled legacy class names', async () => {
  const wizard = await source('../src/routes/portal.subscriptions_.new.tsx')
  const css = await source('../src/styles.css')
  assert.match(wizard, /property-select-grid/)
  assert.match(wizard, /property-select-card/)
  assert.doesNotMatch(wizard, /property-choice/)
  assert.match(css, /\.property-select-grid\{[^}]*display:grid/)
  assert.match(css, /\.property-select-card\{/)
  assert.match(css, /\.property-select-card\.selected\{/)
})

test('property cards use existing property fields only, including property_type where available', async () => {
  const wizard = await source('../src/routes/portal.subscriptions_.new.tsx')
  const api = await source('../netlify/functions/subscription-api.mts')
  assert.match(wizard, /property\.display_name/)
  assert.match(wizard, /property\.address_line_1/)
  assert.match(wizard, /property\.locality/)
  assert.match(wizard, /property\.municipality/)
  assert.match(wizard, /property\.property_type/)
  // the field must actually be selected server-side for the card to be able to show it
  assert.match(api, /properties\([^)]*property_type[^)]*\)/)
})

test('care plans render as three separated comparison cards sourced from subscriptionPlans, not a run-together list', async () => {
  const wizard = await source('../src/routes/portal.subscriptions_.new.tsx')
  const css = await source('../src/styles.css')
  assert.match(wizard, /plan-select-grid/)
  assert.match(wizard, /plan-select-card/)
  assert.doesNotMatch(wizard, /plan-choice/)
  assert.match(wizard, /Object\.values\(subscriptionPlans\)/)
  assert.match(wizard, /plan\.scope\.slice\(0, 4\)/)
  assert.match(css, /\.plan-select-grid\{[^}]*grid-template-columns:repeat\(auto-fit/)
  assert.match(css, /\.plan-select-card\.selected\{/)
  // "Recommended" mirrors the existing Annual-billing convention already used
  // in this file; no fabricated claim like "most popular" is introduced.
  assert.match(wizard, /Recommended/)
  assert.doesNotMatch(wizard, /most popular/i)
})

test('the Service Order step is grouped into labelled sections without dropping any field', async () => {
  const wizard = await source('../src/routes/portal.subscriptions_.new.tsx')
  for (const heading of ['Property', 'Client', 'Service', 'Billing', 'Contract']) {
    assert.match(wizard, new RegExp(`<h3>${heading}</h3>`))
  }
  // every field the pre-redesign flat service order preview showed must still
  // be present somewhere in the grouped sections
  for (const field of ['propertyAddress', 'clientName', 'plan.frequency', 'plan.scope.join', 'netAmount', 'grossAmount', 'termsSha256', 'startDate']) {
    assert.ok(wizard.includes(field), `expected the Service Order step to still reference ${field}`)
  }
  assert.match(wizard, /service-order-acceptance/)
})

test('Annex C acknowledgements remain 13 separate, unmerged checkboxes with an added visual heading only', async () => {
  const wizard = await source('../src/routes/portal.subscriptions_.new.tsx')
  assert.match(wizard, /options!\.acknowledgements\.every\(\(item\) => checks\[item\.key\] === true\)/)
  assert.match(wizard, /options\?\.acknowledgements\.map\(\(item\) => .*acknowledgement-card/)
  assert.match(wizard, /humanizeAcknowledgementKey\(item\.key\)/)
  assert.match(wizard, /\{item\.displayText\}/)
  const headingMap = wizard.match(/const acknowledgementHeadings: Record<string, string> = \{([\s\S]*?)\}/)
  assert.ok(headingMap)
  const keyCount = (headingMap[1].match(/^\s*\w+:/gm) ?? []).length
  assert.equal(keyCount, 13, 'expected exactly the 13 known Annex C keys to have a heading mapped')
})

test('General Terms Version 2.5 text and hash are untouched by the redesign', async () => {
  const wizard = await source('../src/routes/portal.subscriptions_.new.tsx')
  assert.match(wizard, /options\.terms\.document_text/)
  assert.match(wizard, /disabled=\{!termsOpened\}/)
  assert.doesNotMatch(wizard, /subscriptionTerms\.sha256\s*=/)
})

test('the Payment step keeps the financial summary and server-side amounts untouched', async () => {
  const wizard = await source('../src/routes/portal.subscriptions_.new.tsx')
  assert.match(wizard, /formatEuro\(netAmount\)\} net/)
  assert.match(wizard, /formatEuro\(taxAmount\)/)
  assert.match(wizard, /payment-summary-total/)
  assert.doesNotMatch(wizard, /netAmount\s*=\s*\d/)
})
