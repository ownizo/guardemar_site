import { timingSafeEqual } from 'node:crypto'

import { createClient } from '@supabase/supabase-js'

// Temporary, bearer-token-protected, production-only, READ-ONLY diagnostic
// to confirm the baseline-condition migration (20260908090000) actually
// landed on the correct project (ablktbpledjceddessyg, verified against
// SUPABASE_URL below) before relying on it. Performs no writes and creates
// no rows. Removed after verification.

function json(body: Record<string, unknown>, status: number) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } })
}

function tokenMatches(provided: string, expected: string) {
  const expectedBytes = Buffer.from(expected, 'utf8')
  const providedBytes = Buffer.from(provided, 'utf8')
  const equalLength = providedBytes.length === expectedBytes.length
  const comparisonBytes = equalLength ? providedBytes : Buffer.alloc(expectedBytes.length)
  return timingSafeEqual(comparisonBytes, expectedBytes) && equalLength
}

function bearerToken(request: Request) {
  const authorization = request.headers.get('authorization')
  if (!authorization) return null
  const match = /^Bearer ([^\s]+)$/.exec(authorization)
  return match?.[1] ?? null
}

export default async function handler(request: Request) {
  if (request.method !== 'POST') return json({ success: false, error: 'Method not allowed.' }, 405)

  const expectedToken = process.env.GUARDEMAR_VERIFY_TOKEN?.trim()
  if (!expectedToken) return json({ success: false, error: 'Verification unavailable.' }, 503)

  const providedToken = bearerToken(request)
  if (!providedToken || !tokenMatches(providedToken, expectedToken)) return json({ success: false, error: 'Unauthorised.' }, 401)

  if (process.env.DEPLOY_CONTEXT !== 'production') return json({ success: false, error: 'Verification unavailable.' }, 403)

  const url = process.env.SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceRoleKey) return json({ success: false, error: 'Supabase configuration unavailable.' }, 503)

  const projectRef = new URL(url).hostname.split('.')[0]
  const supabase = createClient(url, serviceRoleKey, { auth: { persistSession: false } })

  const checks: Record<string, unknown> = { projectRef }

  const comments = await supabase.from('baseline_condition_comments').select('id', { count: 'exact', head: true })
  checks.baseline_condition_comments_table = comments.error ? { ok: false, error: comments.error.message, code: comments.error.code } : { ok: true, count: comments.count }

  const acks = await supabase.from('baseline_condition_acknowledgements').select('id', { count: 'exact', head: true })
  checks.baseline_condition_acknowledgements_table = acks.error ? { ok: false, error: acks.error.message, code: acks.error.code } : { ok: true, count: acks.count }

  const inspectionColumns = await supabase.from('inspections').select('id, is_baseline, baseline_state, superseded_by').limit(1)
  checks.inspections_baseline_columns = inspectionColumns.error ? { ok: false, error: inspectionColumns.error.message, code: inspectionColumns.error.code } : { ok: true }

  const propertyStatusRpc = await supabase.rpc('get_property_baseline_status', { property_uuid: '00000000-0000-0000-0000-000000000000' })
  checks.get_property_baseline_status_rpc = propertyStatusRpc.error ? { ok: false, error: propertyStatusRpc.error.message, code: propertyStatusRpc.error.code } : { ok: true, result: propertyStatusRpc.data }

  const baselineStatusRpc = await supabase.rpc('get_baseline_condition_status', { inspection_uuid: '00000000-0000-0000-0000-000000000000' })
  checks.get_baseline_condition_status_rpc = baselineStatusRpc.error ? { ok: false, error: baselineStatusRpc.error.message, code: baselineStatusRpc.error.code } : { ok: true, result: baselineStatusRpc.data }

  const listCustomerInspections = await supabase.rpc('list_customer_inspections')
  checks.list_customer_inspections_rpc = listCustomerInspections.error ? { ok: false, error: listCustomerInspections.error.message, code: listCustomerInspections.error.code } : { ok: true, sample: listCustomerInspections.data?.[0] ?? null }

  const listAdminInspections = await supabase.rpc('list_admin_inspections', { filters: {} })
  checks.list_admin_inspections_rpc = listAdminInspections.error ? { ok: false, error: listAdminInspections.error.message, code: listAdminInspections.error.code } : { ok: true, sample: listAdminInspections.data?.[0] ?? null }

  const existingBaselineInspections = await supabase.from('inspections').select('id, property_id, is_baseline, baseline_state').eq('is_baseline', true)
  checks.existing_baseline_inspections = existingBaselineInspections.error ? { ok: false, error: existingBaselineInspections.error.message } : { ok: true, rows: existingBaselineInspections.data }

  return json({ success: true, checks }, 200)
}
