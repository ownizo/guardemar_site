import { timingSafeEqual } from 'node:crypto'

import { createClient } from '@supabase/supabase-js'

// Temporary, bearer-token-protected, production-only, READ-ONLY diagnostic
// to confirm the mixed-media migration (20260908150000) landed on the
// correct project (ablktbpledjceddessyg, verified against SUPABASE_URL
// below) before relying on it. Performs no writes and creates no rows.
// Removed after verification.

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

  const media = await supabase.from('inspection_media').select('id, media_type, original_filename, mime_type, file_size, duration_seconds, poster_storage_path, storage_path', { count: 'exact', head: true })
  checks.inspection_media_table = media.error ? { ok: false, error: media.error.message, code: media.error.code } : { ok: true, count: media.count }

  const oldTable = await supabase.from('inspection_photos').select('id', { count: 'exact', head: true })
  checks.inspection_photos_table_gone = { ok: oldTable.error?.code === 'PGRST205' || !!oldTable.error, error: oldTable.error?.message }

  const bucket = await supabase.storage.getBucket('inspection-photos')
  checks.bucket_config = bucket.error
    ? { ok: false, error: bucket.error.message }
    : { ok: true, fileSizeLimit: bucket.data.file_size_limit, allowedMimeTypes: bucket.data.allowed_mime_types }

  for (const rpc of ['register_inspection_media', 'update_inspection_media', 'reorder_inspection_media']) {
    // Called with an obviously-fake uuid: under service role (auth.uid() is
    // null) every one of these RPCs reaches its "Staff access required" or
    // "not found" branch and returns a clean error -- if it errors with
    // "function ... does not exist" instead, the migration did not apply.
    let result
    if (rpc === 'register_inspection_media') result = await supabase.rpc(rpc, { media_data: { inspectionId: '00000000-0000-0000-0000-000000000000', inspectionAreaId: '00000000-0000-0000-0000-000000000000', mediaType: 'image', storagePath: 'x/x/x/x.jpg' } })
    else if (rpc === 'update_inspection_media') result = await supabase.rpc(rpc, { media_uuid: '00000000-0000-0000-0000-000000000000', media_data: {} })
    else result = await supabase.rpc(rpc, { area_uuid: '00000000-0000-0000-0000-000000000000', ordered_ids: [] })
    const missingFunction = typeof result.error?.message === 'string' && result.error.message.includes('Could not find the function')
    checks[`${rpc}_rpc`] = { ok: !missingFunction, error: result.error?.message, code: result.error?.code }
  }

  const existingMediaSample = await supabase.from('inspection_media').select('id, media_type, storage_path').limit(3)
  checks.existing_media_sample = existingMediaSample.error ? { ok: false, error: existingMediaSample.error.message } : { ok: true, rows: existingMediaSample.data, allImages: (existingMediaSample.data ?? []).every((row) => row.media_type === 'image') }

  return json({ success: true, checks }, 200)
}
