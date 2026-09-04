import type { Config, Context } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'
import { createHash, randomUUID } from 'node:crypto'
import { z } from 'zod'

const EXPECTED_SUPABASE_REF = 'ablktbpledjceddessyg'
const PHOTO_BUCKET = 'inspection-photos'
const SIGNED_UPLOAD_TTL_SECONDS = 2 * 60 * 60
const allowedPhotoTypes = ['image/jpeg', 'image/png', 'image/webp'] as const
const photoType = z.enum(allowedPhotoTypes)
const resultStatus = z.enum(['good', 'attention', 'urgent', 'not_checked', 'not_applicable'])
const fieldContent = z.object({ status: resultStatus.optional(), observation: z.string().max(6000).optional(), recommendation: z.string().max(6000).optional() })
const photoRelationship = z.object({ inspectionId: z.string().uuid(), inspectionAreaId: z.string().uuid(), inspectionItemId: z.string().uuid().nullable().optional() })
const photoUploadRequest = photoRelationship.extend({ filename: z.string().trim().min(1).max(255), contentType: photoType })
const photoRegistrationRequest = photoRelationship.extend({ storagePath: z.string().min(10).max(500), caption: z.string().max(500).optional(), displayOrder: z.number().int().min(0).max(1000).default(0) })
const photoUploadEvent = photoRelationship.extend({ storagePath: z.string().min(10).max(500), code: z.enum(['PHOTO_UPLOAD_ERROR', 'NETWORK_ERROR']), status: z.number().int().min(0).max(599).optional(), storageCode: z.string().max(100).optional() })
const fieldSessionSchema = z.object({
  inspection: z.object({ id: z.string().uuid(), status: z.string(), property_id: z.string().uuid() }).passthrough(),
  areas: z.array(z.object({ id: z.string().uuid(), items: z.array(z.object({ id: z.string().uuid() }).passthrough()).default([]) }).passthrough()).default([]),
}).passthrough()

type SupabaseResult = { data: unknown; error: unknown }
type FieldClient = { rpc: (name: string, params: Record<string, unknown>) => Promise<SupabaseResult> }
type PhotoStorage = {
  createSignedUploadUrl: (path: string, options?: { upsert: boolean }) => Promise<{ data: { signedUrl: string; token: string; path: string } | null; error: unknown }>
  remove: (paths: string[]) => Promise<SupabaseResult>
}
type InspectionApiDependencies = {
  getEnv: (name: string) => string | undefined
  createFieldClient: (url: string, publishableKey: string) => FieldClient
  createPhotoStorage: (url: string, serviceRoleKey: string) => PhotoStorage
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

function validatePhotoRelationship(session: z.infer<typeof fieldSessionSchema>, input: z.infer<typeof photoRelationship>, code: string, stage: string) {
  if (session.inspection.id !== input.inspectionId) throw new InspectionApiError(403, code, 'This photograph does not belong to this inspection.', stage)
  const area = session.areas.find((entry) => entry.id === input.inspectionAreaId)
  if (!area) throw new InspectionApiError(403, code, 'This inspection area is not available for this visit.', stage)
  if (input.inspectionItemId && !area.items.some((item) => item.id === input.inspectionItemId)) throw new InspectionApiError(403, code, 'This checklist item does not belong to the selected area.', stage)
  return area
}

function photoPath(session: z.infer<typeof fieldSessionSchema>, areaId: string, uuid: string, contentType: z.infer<typeof photoType>) {
  const extension = contentType === 'image/png' ? 'png' : contentType === 'image/webp' ? 'webp' : 'jpg'
  return `${session.inspection.property_id}/${session.inspection.id}/${areaId}/${uuid}.${extension}`
}

function pathBelongsToRelationship(session: z.infer<typeof fieldSessionSchema>, areaId: string, path: string) {
  const prefix = `${session.inspection.property_id}/${session.inspection.id}/${areaId}/`
  const filename = path.slice(prefix.length)
  return path.startsWith(prefix) && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(?:jpg|png|webp)$/i.test(filename)
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
  createPhotoStorage: (url, serviceRoleKey) => createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }).storage.from(PHOTO_BUCKET) as unknown as PhotoStorage,
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
      if (req.method === 'POST' && pathname === 'complete') {
        const input = z.object({ allowIncomplete: z.boolean().default(false) }).parse(await req.json())
        const { data, error } = await supabase.rpc('complete_field_inspection', { token_hash_hex: tokenHash, allow_incomplete: input.allowIncomplete })
        if (error) throw error
        return json({ inspection: data })
      }
      if (req.method === 'POST' && pathname === 'photo-upload-url') {
        const input = photoUploadRequest.parse(await req.json())
        const session = await loadFieldSession(supabase, tokenHash)
        validatePhotoRelationship(session, input, 'PHOTO_AUTHORIZATION_ERROR', 'photo_authorization')
        const serviceRoleKey = dependencies.getEnv('SUPABASE_SERVICE_ROLE_KEY')
        if (!serviceRoleKey) throw new InspectionApiError(503, 'PHOTO_AUTHORIZATION_ERROR', 'Photo upload is temporarily unavailable.', 'photo_authorization', { reason: 'service_role_unavailable' })
        const storagePath = photoPath(session, input.inspectionAreaId, dependencies.randomUuid(), input.contentType)
        const storage = dependencies.createPhotoStorage(url, serviceRoleKey)
        const { data, error } = await storage.createSignedUploadUrl(storagePath, { upsert: false })
        if (error || !data?.signedUrl) throw new InspectionApiError(502, 'PHOTO_AUTHORIZATION_ERROR', 'Photo upload could not be authorised.', 'photo_authorization', errorDetails(error))
        return json({ storagePath, signedUrl: data.signedUrl, expiresAt: new Date(dependencies.now() + SIGNED_UPLOAD_TTL_SECONDS * 1000).toISOString() })
      }
      if (req.method === 'POST' && pathname === 'photo-upload-events') {
        const input = photoUploadEvent.parse(await req.json())
        const session = await loadFieldSession(supabase, tokenHash)
        validatePhotoRelationship(session, input, input.code, 'photo_upload')
        if (!pathBelongsToRelationship(session, input.inspectionAreaId, input.storagePath)) throw new InspectionApiError(403, input.code, 'Invalid photograph path.', 'photo_upload')
        dependencies.logError('Inspection photo upload failed', { requestId: context.requestId, path: pathname, stage: 'photo_upload', code: input.code, ...(input.status !== undefined ? { supabaseStatus: input.status } : {}), ...(input.storageCode ? { supabaseCode: input.storageCode } : {}) })
        return new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } })
      }
      if (req.method === 'POST' && pathname === 'photos') {
        const input = photoRegistrationRequest.parse(await req.json())
        const session = await loadFieldSession(supabase, tokenHash)
        validatePhotoRelationship(session, input, 'PHOTO_REGISTER_ERROR', 'photo_registration')
        if (!pathBelongsToRelationship(session, input.inspectionAreaId, input.storagePath)) throw new InspectionApiError(403, 'PHOTO_REGISTER_ERROR', 'The uploaded photograph does not belong to this inspection area.', 'photo_registration')
        const { data, error } = await supabase.rpc('register_inspection_photo', { photo_data: { ...input, tokenHash } })
        if (error) {
          const serviceRoleKey = dependencies.getEnv('SUPABASE_SERVICE_ROLE_KEY')
          if (serviceRoleKey) {
            const cleanup = await dependencies.createPhotoStorage(url, serviceRoleKey).remove([input.storagePath])
            if (cleanup.error) dependencies.logError('Inspection photo cleanup failed', { requestId: context.requestId, path: pathname, stage: 'photo_cleanup', code: 'PHOTO_CLEANUP_ERROR', ...errorDetails(cleanup.error) })
          } else {
            dependencies.logError('Inspection photo cleanup unavailable', { requestId: context.requestId, path: pathname, stage: 'photo_cleanup', code: 'PHOTO_CLEANUP_ERROR', reason: 'service_role_unavailable' })
          }
          throw new InspectionApiError(502, 'PHOTO_REGISTER_ERROR', 'The photograph could not be attached to the inspection.', 'photo_registration', errorDetails(error))
        }
        return json({ photo: data }, { status: 201 })
      }
      return json({ error: { code: 'VALIDATION_ERROR', message: 'Not found.' } }, { status: 404 })
    } catch (error) {
      if (error instanceof InspectionApiError) {
        dependencies.logError('Inspection API request failed', { requestId: context.requestId, path: pathname, stage: error.stage, code: error.code, ...error.details })
        return json({ error: { code: error.code, message: error.message } }, { status: error.status })
      }
      const code = errorCode(error)
      const status = code === '42501' ? 401 : 400
      const photoCode = pathname === 'photo-upload-url' ? 'PHOTO_AUTHORIZATION_ERROR' : pathname === 'photos' ? 'PHOTO_REGISTER_ERROR' : status === 401 ? 'AUTHENTICATION_ERROR' : 'AUTOSAVE_ERROR'
      if (status !== 401 || pathname.startsWith('photo')) dependencies.logError('Inspection API request failed', { requestId: context.requestId, path: pathname, stage: pathname.startsWith('photo') ? 'photo_validation' : 'field_request', code: code || photoCode, ...errorDetails(error) })
      return json({ error: { code: photoCode, message: status === 401 ? 'This inspection link is invalid or has expired.' : pathname.startsWith('photo') ? 'The photograph request was invalid.' : 'The inspection update could not be saved.' } }, { status })
    }
  }
}

const handler = createInspectionHandler()

export default (req: Request, context: Context) => handler(req, context)

export const config: Config = { path: '/api/inspection/*' }
