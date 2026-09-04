import type { Config, Context } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'
import { createHash, createHmac } from 'node:crypto'
import { z } from 'zod'

const EXPECTED_SUPABASE_REF = 'ablktbpledjceddessyg'
const resultStatus = z.enum(['good', 'attention', 'urgent', 'not_checked', 'not_applicable'])
const fieldContent = z.object({ status: resultStatus.optional(), observation: z.string().max(6000).optional(), recommendation: z.string().max(6000).optional() })

function json(data: unknown, init?: ResponseInit) {
  return Response.json(data, { ...init, headers: { 'Cache-Control': 'no-store', ...init?.headers } })
}

function base64Url(value: string | Buffer) { return Buffer.from(value).toString('base64url') }

function issueStorageJwt(accessId: string, secret: string) {
  const now = Math.floor(Date.now() / 1000)
  const header = base64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const payload = base64Url(JSON.stringify({ aud: 'authenticated', role: 'authenticated', sub: accessId, inspection_access_id: accessId, iat: now, exp: now + 3600 }))
  const signature = createHmac('sha256', secret).update(`${header}.${payload}`).digest('base64url')
  return `${header}.${payload}.${signature}`
}

function getToken(req: Request) {
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim()
  return token && token.length >= 32 && token.length <= 512 ? token : null
}

export default async (req: Request, context: Context) => {
  if (!['GET', 'PATCH', 'POST'].includes(req.method)) return json({ error: { code: 'VALIDATION_ERROR', message: 'Method not allowed.' } }, { status: 405 })
  const rawToken = getToken(req)
  if (!rawToken) return json({ error: { code: 'AUTHENTICATION_ERROR', message: 'This inspection link is invalid or has expired.' } }, { status: 401 })
  const url = Netlify.env.get('SUPABASE_URL')
  const publishableKey = Netlify.env.get('SUPABASE_PUBLISHABLE_KEY')
  if (!url || !publishableKey || new URL(url).hostname.split('.')[0] !== EXPECTED_SUPABASE_REF) return json({ error: { code: 'NETWORK_ERROR', message: 'Inspection access is temporarily unavailable.' } }, { status: 503 })

  const tokenHash = createHash('sha256').update(rawToken).digest('hex')
  const supabase = createClient(url, publishableKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } })
  const pathname = new URL(req.url).pathname.replace(/^\/api\/inspection\/?/, '')
  const segments = pathname.split('/').filter(Boolean)

  try {
    if (req.method === 'GET' && pathname === 'session') {
      const { data, error } = await supabase.rpc('get_field_inspection', { token_hash_hex: tokenHash })
      if (error || !data) throw error ?? new Error('Inspection not found')
      const response = data as Record<string, unknown>
      const accessId = z.string().uuid().parse(response.access_id)
      delete response.access_id
      const jwtSecret = Netlify.env.get('SUPABASE_JWT_SECRET')
      return json({ ...response, storageToken: jwtSecret ? issueStorageJwt(accessId, jwtSecret) : null })
    }
    if (req.method === 'PATCH' && segments[0] === 'items' && segments[1]) {
      const { data, error } = await supabase.rpc('update_field_item', { token_hash_hex: tokenHash, item_uuid: z.string().uuid().parse(segments[1]), item_data: fieldContent.parse(await req.json()) })
      if (error) throw error
      return json({ item: data })
    }
    if (req.method === 'PATCH' && segments[0] === 'areas' && segments[1]) {
      const { data, error } = await supabase.rpc('update_field_area', { token_hash_hex: tokenHash, area_uuid: z.string().uuid().parse(segments[1]), area_data: fieldContent.parse(await req.json()) })
      if (error) throw error
      return json({ area: data })
    }
    if (req.method === 'POST' && pathname === 'complete') {
      const input = z.object({ allowIncomplete: z.boolean().default(false) }).parse(await req.json())
      const { data, error } = await supabase.rpc('complete_field_inspection', { token_hash_hex: tokenHash, allow_incomplete: input.allowIncomplete })
      if (error) throw error
      return json({ inspection: data })
    }
    if (req.method === 'POST' && pathname === 'photos') {
      const input = z.object({ inspectionId: z.string().uuid(), inspectionAreaId: z.string().uuid(), inspectionItemId: z.string().uuid().nullable().optional(), storagePath: z.string().min(10).max(500), caption: z.string().max(500).optional(), displayOrder: z.number().int().min(0).max(1000).default(0) }).parse(await req.json())
      const { data, error } = await supabase.rpc('register_inspection_photo', { photo_data: { ...input, tokenHash } })
      if (error) throw error
      return json({ photo: data }, { status: 201 })
    }
    return json({ error: { code: 'VALIDATION_ERROR', message: 'Not found.' } }, { status: 404 })
  } catch (error) {
    const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : ''
    const status = code === '42501' ? 401 : 400
    if (status !== 401) console.error('Inspection API request failed', { requestId: context.requestId, path: pathname, code: code || 'FIELD_REQUEST_ERROR' })
    return json({ error: { code: status === 401 ? 'AUTHENTICATION_ERROR' : 'AUTOSAVE_ERROR', message: status === 401 ? 'This inspection link is invalid or has expired.' : 'The inspection update could not be saved.' } }, { status })
  }
}

export const config: Config = { path: '/api/inspection/*' }
