import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import { clampInspectionAreaIndex, inspectionSetupIsComplete } from '../src/lib/portal/field-inspection-state.ts'

const migrationPath = new URL('../supabase/migrations/20260904160000_prevent_zero_area_inspections.sql', import.meta.url)
const adminRoutePath = new URL('../src/routes/admin.inspections.tsx', import.meta.url)
const fieldRoutePath = new URL('../src/routes/i.tsx', import.meta.url)
const fieldApiPath = new URL('../netlify/functions/inspection-api.mts', import.meta.url)

test('create inspection rejects a property with zero active areas', async () => {
  const migration = await readFile(migrationPath, 'utf8')
  assert.match(migration, /where area\.property_id = property_uuid and area\.active/)
  assert.match(migration, /raise exception 'This property has no inspection areas configured\.'/)
})

test('create inspection snapshots configured property areas and template items', async () => {
  const migration = await readFile(migrationPath, 'utf8')
  assert.match(migration, /insert into public\.inspection_areas/)
  assert.match(migration, /from public\.property_areas area[\s\S]*area\.active/)
  assert.match(migration, /if not exists \(select 1 from public\.inspection_areas area where area\.inspection_id = created\.id\)/)
  assert.match(migration, /insert into public\.inspection_items/)
  assert.match(migration, /item\.template_id = created\.template_id[\s\S]*lower\(item\.area_type\) = lower\(area_snapshot\.area_type\)/)
})

test('admin scheduling blocks properties without active areas', async () => {
  const route = await readFile(adminRoutePath, 'utf8')
  assert.match(route, /activeAreaCount > 0/)
  assert.match(route, /This property has no inspection areas configured\./)
  assert.match(route, /Add inspection areas before scheduling an inspection\./)
  assert.match(route, /disabled=\{pending \|\| !propertyHasAreas\}/)
  assert.match(route, /to="\/admin\/properties\/\$id"/)
})

test('mobile empty sessions are marked incomplete and render an operational message', async () => {
  assert.equal(inspectionSetupIsComplete(0), false)
  const route = await readFile(fieldRoutePath, 'utf8')
  assert.match(route, /Inspection setup incomplete/)
  assert.match(route, /This inspection does not contain any configured inspection areas\. Please contact Guardemar before starting the visit\./)
})

test('mobile valid sessions render the first area', () => {
  assert.equal(inspectionSetupIsComplete(1, true), true)
  assert.equal(clampInspectionAreaIndex(0, 1), 0)
})

test('invalid mobile area indexes are clamped safely', () => {
  assert.equal(clampInspectionAreaIndex(-1, 3), 0)
  assert.equal(clampInspectionAreaIndex(3, 3), 2)
  assert.equal(clampInspectionAreaIndex(99, 3), 2)
  assert.equal(clampInspectionAreaIndex(4, 0), 0)
})

test('field session API exposes setup completeness defensively', async () => {
  const [migration, api] = await Promise.all([readFile(migrationPath, 'utf8'), readFile(fieldApiPath, 'utf8')])
  assert.match(migration, /'inspection_setup_complete', exists/)
  assert.match(api, /response\.inspection_setup_complete = response\.inspection_setup_complete !== false && areas\.length > 0/)
})
