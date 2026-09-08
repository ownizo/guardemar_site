import type { Config, Context } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'
import { createHash, randomUUID } from 'node:crypto'
import { z } from 'zod'

const EXPECTED_SUPABASE_REF = 'ablktbpledjceddessyg'
const MEDIA_BUCKET = 'inspection-photos'
const SIGNED_UPLOAD_TTL_SECONDS = 2 * 60 * 60
const allowedImageTypes = ['image/jpeg', 'image/png', 'image/webp'] as const
const allowedVideoTypes = ['video/mp4', 'video/quicktime', 'video/webm'] as const
const mediaType = z.enum(['image', 'video'])
const imageContentType = z.enum(allowedImageTypes)
const videoContentType = z.enum(allowedVideoTypes)
const resultStatus = z.enum(['good', 'attention', 'urgent', 'not_checked', 'not_applicable'])
const fieldContent = z.object({ status: resultStatus.optional(), observation: z.string().max(6000).optional(), recommendation: z.string().max(6000).optional() })
const mediaRelationship = z.object({ inspectionId: z.string().uuid(), inspectionAreaId: z.string().uuid(), inspectionItemId: z.string().uuid().nullable().optional() })
// A poster is a small companion JPEG for a video, never its own inspection_media row --
// it is validated and attached as part of the video's own registration below.
const mediaUploadRequest = mediaRelationship.extend({
  filename: z.string().trim().min(1).max(255),
  purpose: z.enum(['media', 'poster']).default('media'),
  contentType: z.union([imageContentType, videoContentType]),
})
const mediaRegistrationRequest = mediaRelationship.extend({
  storagePath: z.string().min(10).max(500),
  mediaType,
  originalFilename: z.string().max(255).optional(),
  durationSeconds: z.number().int().min(1).max(60).optional(),
  posterStoragePath: z.string().min(10).max(500).optional(),
  caption: z.string().max(500).optional(),
  displayOrder: z.number().int().min(0).max(1000).default(0),
})
const mediaUpdateRequest = z.object({ caption: z.string().max(500).optional(), displayOrder: z.number().int().min(0).max(1000).optional(), rejected: z.boolean().optional() })
const mediaReorderRequest = z.object({ orderedIds: z.array(z.string().uuid()).min(1).max(5) })
const mediaUploadEvent = mediaRelationship.extend({ storagePath: z.string().min(10).max(500), code: z.enum(['MEDIA_UPLOAD_ERROR', 'NETWORK_ERROR']), status: z.number().int().min(0).max(599).optional(), storageCode: z.string().max(100).optional() })
const fieldSessionSchema = z.object({
  inspection: z.object({ id: z.string().uuid(), status: z.string(), property_id: z.string().uuid() }).passthrough(),
  areas: z.array(z.object({ id: z.string().uuid(), items: z.array(z.object({ id: z.string().uuid() }).passthrough()).default([]) }).passthrough()).default([]),
}).passthrough()

type SupabaseResult = { data: unknown; error: unknown }
type FieldClient = { rpc: (name: string, params: Record<string, unknown>) => Promise<SupabaseResult> }
type MediaStorage = {
  createSignedUploadUrl: (path: string, options?: { upsert: boolean }) => Promise<{ data: { signedUrl: string; token: string; path: string } | null; error: unknown }>
  remove: (paths: string[]) => Promise<SupabaseResult>
}
type InspectionApiDependencies = {
  getEnv: (name: string) => string | undefined
  createFieldClient: (url: string, publishableKey: string) => FieldClient
  createMediaStorage: (url: string, serviceRoleKey: string) => MediaStorage
  now: () => number
  randomUuid: () => string
  logError: (message: string, details: Record<string, unknown>) => void
}

class InspectionApiError extends Error {
  status: number
  code: string
  stage: string
  details: Record<string, unknown>

  constructor(status: number, code: string, message: string, stage: string, details: Record<string, unknown> = {}) {
    super(message)
    this.status = status
    this.code = code
    this.stage = stage
    this.details = details
  }
}

function json(data: unknown, init?: ResponseInit) {
  return Response.json(data, { ...init, headers: { 'Cache-Control': 'no-store', ...init?.headers } })
}

function getToken(req: Request) {
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim()
  return token && token.length >= 32 && token.length <= 512 ? token : null
}

function errorDetails(error: unknown) {
  if (!error || typeof error !== 'object') return {}
  const value = error as Record<string, unknown>
  return {
    ...(value.code ? { supabaseCode: String(value.code) } : {}),
    ...(value.status ? { supabaseStatus: String(value.status) } : {}),
    ...(value.statusCode ? { supabaseStatusCode: String(value.statusCode) } : {}),
  }
}

function errorCode(error: unknown) {
  return error && typeof error === 'object' && 'code' in error ? String(error.code) : ''
}

function validateMediaRelationship(session: z.infer<typeof fieldSessionSchema>, input: z.infer<typeof mediaRelationship>, code: string, stage: string) {
  if (session.inspection.id !== input.inspectionId) throw new InspectionApiError(403, code, 'This item does not belong to this inspection.', stage)
  const area = session.areas.find((entry) => entry.id === input.inspectionAreaId)
  if (!area) throw new InspectionApiError(403, code, 'This inspection area is not available for this visit.', stage)
  if (input.inspectionItemId && !area.items.some((item) => item.id === input.inspectionItemId)) throw new InspectionApiError(403, code, 'This checklist item does not belong to the selected area.', stage)
  return area
}

function mediaExtension(contentType: string) {
  if (contentType === 'image/png') return 'png'
  if (contentType === 'image/webp') return 'webp'
  if (contentType === 'video/quicktime') return 'mov'
  if (contentType === 'video/webm') return 'webm'
  if (contentType === 'video/mp4') return 'mp4'
  return 'jpg'
}

function mediaPath(session: z.infer<typeof fieldSessionSchema>, areaId: string, uuid: string, contentType: string, purpose: 'media' | 'poster') {
  const base = `${session.inspection.property_id}/${session.inspection.id}/${areaId}/${uuid}`
  return purpose === 'poster' ? `${base}-poster.jpg` : `${base}.${mediaExtension(contentType)}`
}

function pathBelongsToRelationship(session: z.infer<typeof fieldSessionSchema>, areaId: string, path: string) {
  const prefix = `${session.inspection.property_id}/${session.inspection.id}/${areaId}/`
  const filename = path.slice(prefix.length)
  return path.startsWith(prefix) && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}(?:-poster)?\.(?:jpg|png|webp|mp4|mov|webm)$/i.test(filename)
}

async function loadFieldSession(client: FieldClient, tokenHash: string) {
  const { data, error } = await client.rpc('get_field_inspection', { token_hash_hex: tokenHash })
  if (error || !data) {
    if (errorCode(error) === '42501' || !data) throw new InspectionApiError(401, 'AUTHENTICATION_ERROR', 'This inspection link is invalid or has expired.', 'authentication', errorDetails(error))
    throw new InspectionApiError(503, 'NETWORK_ERROR', 'Inspection access is temporarily unavailable.', 'field_session', errorDetails(error))
  }
  const session = fieldSessionSchema.parse(data)
  if (!['scheduled', 'in_progress'].includes(session.inspection.status)) throw new InspectionApiError(403, 'AUTHENTICATION_ERROR', 'This inspection is not open for field work.', 'authentication')
  return session
}

const defaultDependencies: InspectionApiDependencies = {
  getEnv: (name) => Netlify.env.get(name),
  createFieldClient: (url, publishableKey) => createClient(url, publishableKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }) as unknown as FieldClient,
  createMediaStorage: (url, serviceRoleKey) => createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }).storage.from(MEDIA_BUCKET) as unknown as MediaStorage,
  now: () => Date.now(),
  randomUuid: () => randomUUID(),
  logError: (message, details) => console.error(message, details),
}

export function createInspectionHandler(overrides: Partial<InspectionApiDependencies> = {}) {
  const dependencies = { ...defaultDependencies, ...overrides }

  return async (req: Request, context: Pick<Context, 'requestId'>) => {
    const pathname = new URL(req.url).pathname.replace(/^\/api\/inspection\/?/, '')
    if (!['GET', 'PATCH', 'POST'].includes(req.method)) return json({ error: { code: 'VALIDATION_ERROR', message: 'Method not allowed.' } }, { status: 405 })
    const rawToken = getToken(req)
    if (!rawToken) return json({ error: { code: 'AUTHENTICATION_ERROR', message: 'This inspection link is invalid or has expired.' } }, { status: 401 })
    const url = dependencies.getEnv('SUPABASE_URL')
    const publishableKey = dependencies.getEnv('SUPABASE_PUBLISHABLE_KEY')
    if (!url || !publishableKey || new URL(url).hostname.split('.')[0] !== EXPECTED_SUPABASE_REF) return json({ error: { code: 'NETWORK_ERROR', message: 'Inspection access is temporarily unavailable.' } }, { status: 503 })

    const tokenHash = createHash('sha256').update(rawToken).digest('hex')
    const supabase = dependencies.createFieldClient(url, publishableKey)
    const segments = pathname.split('/').filter(Boolean)

    try {
      if (req.method === 'GET' && pathname === 'session') {
        const { data, error } = await supabase.rpc('get_field_inspection', { token_hash_hex: tokenHash })
        if (error || !data) throw error ?? new Error('Inspection not found')
        const response = data as Record<string, unknown>
        delete response.access_id
        const areas = Array.isArray(response.areas) ? response.areas : []
        response.areas = areas
        response.inspection_setup_complete = response.inspection_setup_complete !== false && areas.length > 0
        return json(response)
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
      if (req.method === 'POST' && segments[0] === 'areas' && segments[1] && segments[2] === 'media-reorder') {
        const input = mediaReorderRequest.parse(await req.json())
        const { data, error } = await supabase.rpc('reorder_inspection_media', { area_uuid: z.string().uuid().parse(segments[1]), ordered_ids: input.orderedIds, token_hash: tokenHash })
        if (error) throw error
        return json({ reordered: Boolean(data) })
      }
      if (req.method === 'POST' && pathname === 'complete') {
        const input = z.object({ allowIncomplete: z.boolean().default(false) }).parse(await req.json())
        const { data, error } = await supabase.rpc('complete_field_inspection', { token_hash_hex: tokenHash, allow_incomplete: input.allowIncomplete })
        if (error) throw error
        return json({ inspection: data })
      }
      if (req.method === 'POST' && pathname === 'media-upload-url') {
        const input = mediaUploadRequest.parse(await req.json())
        const session = await loadFieldSession(supabase, tokenHash)
        validateMediaRelationship(session, input, 'MEDIA_AUTHORIZATION_ERROR', 'media_authorization')
        const serviceRoleKey = dependencies.getEnv('SUPABASE_SERVICE_ROLE_KEY')
        if (!serviceRoleKey) throw new InspectionApiError(503, 'MEDIA_AUTHORIZATION_ERROR', 'Media upload is temporarily unavailable.', 'media_authorization', { reason: 'service_role_unavailable' })
        const storagePath = mediaPath(session, input.inspectionAreaId, dependencies.randomUuid(), input.contentType, input.purpose)
        const storage = dependencies.createMediaStorage(url, serviceRoleKey)
        const { data, error } = await storage.createSignedUploadUrl(storagePath, { upsert: false })
        if (error || !data?.signedUrl) throw new InspectionApiError(502, 'MEDIA_AUTHORIZATION_ERROR', 'Media upload could not be authorised.', 'media_authorization', errorDetails(error))
        return json({ storagePath, signedUrl: data.signedUrl, expiresAt: new Date(dependencies.now() + SIGNED_UPLOAD_TTL_SECONDS * 1000).toISOString() })
      }
      if (req.method === 'POST' && pathname === 'media-upload-events') {
        const input = mediaUploadEvent.parse(await req.json())
        const session = await loadFieldSession(supabase, tokenHash)
        validateMediaRelationship(session, input, input.code, 'media_upload')
        if (!pathBelongsToRelationship(session, input.inspectionAreaId, input.storagePath)) throw new InspectionApiError(403, input.code, 'Invalid media path.', 'media_upload')
        dependencies.logError('Inspection media upload failed', { requestId: context.requestId, path: pathname, stage: 'media_upload', code: input.code, ...(input.status !== undefined ? { supabaseStatus: input.status } : {}), ...(input.storageCode ? { supabaseCode: input.storageCode } : {}) })
        return new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } })
      }
      if (req.method === 'POST' && pathname === 'media') {
        const input = mediaRegistrationRequest.parse(await req.json())
        const session = await loadFieldSession(supabase, tokenHash)
        validateMediaRelationship(session, input, 'MEDIA_REGISTER_ERROR', 'media_registration')
        if (!pathBelongsToRelationship(session, input.inspectionAreaId, input.storagePath)) throw new InspectionApiError(403, 'MEDIA_REGISTER_ERROR', 'The uploaded file does not belong to this inspection area.', 'media_registration')
        if (input.posterStoragePath && !pathBelongsToRelationship(session, input.inspectionAreaId, input.posterStoragePath)) throw new InspectionApiError(403, 'MEDIA_REGISTER_ERROR', 'The poster image does not belong to this inspection area.', 'media_registration')
        const { data, error } = await supabase.rpc('register_inspection_media', { media_data: { ...input, tokenHash } })
        if (error) {
          const serviceRoleKey = dependencies.getEnv('SUPABASE_SERVICE_ROLE_KEY')
          const pathsToRemove = [input.storagePath, ...(input.posterStoragePath ? [input.posterStoragePath] : [])]
          if (serviceRoleKey) {
            const cleanup = await dependencies.createMediaStorage(url, serviceRoleKey).remove(pathsToRemove)
            if (cleanup.error) dependencies.logError('Inspection media cleanup failed', { requestId: context.requestId, path: pathname, stage: 'media_cleanup', code: 'MEDIA_CLEANUP_ERROR', ...errorDetails(cleanup.error) })
          } else {
            dependencies.logError('Inspection media cleanup unavailable', { requestId: context.requestId, path: pathname, stage: 'media_cleanup', code: 'MEDIA_CLEANUP_ERROR', reason: 'service_role_unavailable' })
          }
          const code = errorCode(error)
          const limitReached = code === '23514'
          throw new InspectionApiError(limitReached ? 409 : 502, limitReached ? 'MEDIA_LIMIT_REACHED' : 'MEDIA_REGISTER_ERROR', limitReached ? 'This area already has the maximum of 5 media items.' : 'The file could not be attached to the inspection.', 'media_registration', errorDetails(error))
        }
        return json({ media: data }, { status: 201 })
      }
      if (req.method === 'PATCH' && segments[0] === 'media' && segments[1]) {
        const input = mediaUpdateRequest.parse(await req.json())
        const { data, error } = await supabase.rpc('update_inspection_media', { media_uuid: z.string().uuid().parse(segments[1]), media_data: { ...input, tokenHash } })
        if (error) throw error
        return json({ media: data })
      }
      return json({ error: { code: 'VALIDATION_ERROR', message: 'Not found.' } }, { status: 404 })
    } catch (error) {
      if (error instanceof InspectionApiError) {
        dependencies.logError('Inspection API request failed', { requestId: context.requestId, path: pathname, stage: error.stage, code: error.code, ...error.details })
        return json({ error: { code: error.code, message: error.message } }, { status: error.status })
      }
      const code = errorCode(error)
      const status = code === '42501' ? 401 : 400
      const isMedia = pathname.startsWith('media')
      const mediaCode = pathname === 'media-upload-url' ? 'MEDIA_AUTHORIZATION_ERROR' : pathname === 'media' ? 'MEDIA_REGISTER_ERROR' : status === 401 ? 'AUTHENTICATION_ERROR' : 'AUTOSAVE_ERROR'
      if (status !== 401 || isMedia) dependencies.logError('Inspection API request failed', { requestId: context.requestId, path: pathname, stage: isMedia ? 'media_validation' : 'field_request', code: code || mediaCode, ...errorDetails(error) })
      return json({ error: { code: mediaCode, message: status === 401 ? 'This inspection link is invalid or has expired.' : isMedia ? 'The media request was invalid.' : 'The inspection update could not be saved.' } }, { status })
    }
  }
}

const handler = createInspectionHandler()

export default (req: Request, context: Context) => handler(req, context)

export const config: Config = { path: '/api/inspection/*' }
