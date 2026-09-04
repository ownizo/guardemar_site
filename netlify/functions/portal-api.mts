import type { Config, Context } from '@netlify/functions'
import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js'
import { z } from 'zod'

const EXPECTED_SUPABASE_REF = 'ablktbpledjceddessyg'

const clientInput = z.object({
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(254),
  phone: z.string().trim().min(3).max(50),
  taxNumber: z.string().trim().max(50).optional().or(z.literal('')),
  billingAddress: z.string().trim().max(500).optional().or(z.literal('')),
  country: z.string().trim().min(2).max(100).default('Portugal'),
  internalNotes: z.string().trim().max(4000).optional().or(z.literal('')),
})

const propertyInput = z.object({
  clientId: z.string().uuid(),
  displayName: z.string().trim().min(1).max(160),
  addressLine1: z.string().trim().min(1).max(240),
  addressLine2: z.string().trim().max(240).optional().or(z.literal('')),
  postalCode: z.string().trim().min(2).max(30),
  locality: z.string().trim().min(1).max(120),
  municipality: z.string().trim().min(1).max(120),
  country: z.string().trim().min(2).max(100).default('Portugal'),
  propertyType: z.enum(['villa', 'apartment', 'townhouse', 'other']).default('other'),
  bedrooms: z.number().int().min(0).max(100).nullable().optional(),
  bathrooms: z.number().int().min(0).max(100).nullable().optional(),
  hasPool: z.boolean().default(false),
  hasGarden: z.boolean().default(false),
  hasIrrigation: z.boolean().default(false),
  hasAlarm: z.boolean().default(false),
  accessNotesPrivate: z.string().trim().max(4000).optional().or(z.literal('')),
  internalNotes: z.string().trim().max(4000).optional().or(z.literal('')),
})

type ApplicationRole = 'customer' | 'staff' | 'admin'
type PortalProfile = { id: string; role: ApplicationRole; firstName: string | null; lastName: string | null; phone: string | null }
type AuthenticatedRequest = { user: User; supabase: SupabaseClient }
type PortalErrorCode = 'VALIDATION_ERROR' | 'AUTHENTICATION_ERROR' | 'AUTHORIZATION_ERROR' | 'CREATE_RPC_ERROR' | 'POST_CREATE_REFRESH_ERROR' | 'NAVIGATION_ERROR' | 'NETWORK_ERROR'
type SupabaseError = { message: string; code?: string; details?: string; hint?: string }
type SupabaseResult<T> = { data: T | null; error: SupabaseError | null; status?: number }

function json(data: unknown, init?: ResponseInit) {
  return Response.json(data, { ...init, headers: { 'Cache-Control': 'no-store', ...init?.headers } })
}

function publicError(status: number, message: string, code: PortalErrorCode, stage: string, diagnostics?: { details?: string; hint?: string }) {
  return json({ error: { code, message, stage, status, ...diagnostics } }, { status })
}

function requireData<T>(result: SupabaseResult<T>, code: PortalErrorCode = 'NETWORK_ERROR', stage = 'database'): T {
  if (result.error) throw new PortalRequestError(result.error.message, code, stage, result.status, result.error.code, result.error.details, result.error.hint)
  if (result.data === null) throw new PortalRequestError('The database returned no data.', code, stage, result.status)
  return result.data
}

async function authenticate(req: Request): Promise<AuthenticatedRequest | Response> {
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  const url = Netlify.env.get('SUPABASE_URL')
  const publishableKey = Netlify.env.get('SUPABASE_PUBLISHABLE_KEY')

  if (!token || !url || !publishableKey) return publicError(401, 'Your session has expired. Please sign in again.', 'AUTHENTICATION_ERROR', 'authentication')
  if (new URL(url).hostname.split('.')[0] !== EXPECTED_SUPABASE_REF) return publicError(503, 'Portal authentication configuration is unavailable.', 'NETWORK_ERROR', 'configuration')

  const supabase = createClient(url, publishableKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
  const { data, error } = await supabase.auth.getUser(token)
  if (error || !data.user || !data.user.email) return publicError(401, 'Your session has expired. Please sign in again.', 'AUTHENTICATION_ERROR', 'authentication')

  return { user: data.user, supabase }
}

async function getProfile(authenticated: AuthenticatedRequest) {
  const result = await authenticated.supabase
    .from('profiles')
    .select('id, role, first_name, last_name, phone')
    .eq('id', authenticated.user.id)
    .maybeSingle()
  const row = requireData(result)
  if (!row) return null
  return {
    id: row.id,
    role: row.role,
    firstName: row.first_name,
    lastName: row.last_name,
    phone: row.phone,
  } as PortalProfile
}

async function requireStaff(authenticated: AuthenticatedRequest) {
  const profile = await getProfile(authenticated)
  if (!profile || (profile.role !== 'staff' && profile.role !== 'admin')) throw new AccessError()
  return profile
}

async function requireAdmin(authenticated: AuthenticatedRequest) {
  const profile = await getProfile(authenticated)
  if (!profile || profile.role !== 'admin') throw new AccessError('Administrator access is required.')
  return profile
}

class AccessError extends Error {}
class PortalRequestError extends Error {
  constructor(
    message: string,
    public portalCode: PortalErrorCode,
    public stage: string,
    public status?: number,
    public supabaseCode?: string,
    public details?: string,
    public hint?: string,
  ) {
    super(message)
  }
}

async function routeRequest(req: Request, authenticated: AuthenticatedRequest) {
  const pathname = new URL(req.url).pathname.replace(/^\/api\/portal\/?/, '')
  const segments = pathname.split('/').filter(Boolean)

  if (req.method === 'POST' && pathname === 'session/initialise') {
    const profile = requireData(await authenticated.supabase.rpc('initialise_profile')) as PortalProfile
    return json({ profile })
  }

  if (req.method === 'GET' && pathname === 'session') {
    const profile = await getProfile(authenticated)
    if (!profile) return publicError(409, 'Your portal profile has not been initialised.', 'AUTHENTICATION_ERROR', 'profile')
    return json({ profile, email: authenticated.user.email?.toLowerCase() })
  }

  if (req.method === 'GET' && pathname === 'properties') {
    const rows = requireData(await authenticated.supabase
      .from('properties')
      .select('id, display_name, address_line_1, address_line_2, postal_code, locality, municipality, country, property_type')
      .order('display_name'))
    return json({ properties: rows.map((row) => ({
      id: row.id,
      displayName: row.display_name,
      addressLine1: row.address_line_1,
      addressLine2: row.address_line_2,
      postalCode: row.postal_code,
      locality: row.locality,
      municipality: row.municipality,
      country: row.country,
      propertyType: row.property_type,
    })) })
  }

  if (segments[0] === 'admin') {
    await requireStaff(authenticated)

    if (req.method === 'GET' && pathname === 'admin/dashboard') {
      const counts = requireData(await authenticated.supabase.rpc('get_admin_dashboard')) as { clients: number; properties: number }
      return json({ counts })
    }

    if (req.method === 'GET' && pathname === 'admin/clients') {
      const searchText = new URL(req.url).searchParams.get('search')?.trim() ?? ''
      const clients = requireData(await authenticated.supabase.rpc('list_admin_clients', { search_text: searchText }))
      return json({ clients })
    }

    if (req.method === 'POST' && pathname === 'admin/clients') {
      const input = clientInput.parse(await req.json())
      const client = requireData(await authenticated.supabase.rpc('create_admin_client', { client_data: input }), 'CREATE_RPC_ERROR', 'create_rpc')
      return json({ client }, { status: 201 })
    }

    if (req.method === 'POST' && pathname === 'admin/clients/bulk-delete') {
      await requireAdmin(authenticated)
      const input = z.object({ clientIds: z.array(z.string().uuid()).min(1).max(100) }).parse(await req.json())
      const result = requireData(await authenticated.supabase.rpc('delete_admin_clients', { client_uuids: input.clientIds }), 'NETWORK_ERROR', 'delete_rpc')
      return json(result)
    }

    if (req.method === 'DELETE' && segments[1] === 'clients' && segments[2]) {
      await requireAdmin(authenticated)
      const clientId = z.string().uuid().parse(segments[2])
      const result = requireData(await authenticated.supabase.rpc('delete_admin_client', { client_uuid: clientId }), 'NETWORK_ERROR', 'delete_rpc')
      return json(result)
    }

    if (req.method === 'GET' && segments[1] === 'clients' && segments[2]) {
      const client = requireData(await authenticated.supabase.rpc('get_admin_client', { client_uuid: segments[2] }))
      if (!client) return publicError(404, 'Client not found.', 'VALIDATION_ERROR', 'client_lookup')
      const record = client as Record<string, unknown> & { properties?: unknown[] }
      const properties = record.properties ?? []
      const clientRecord: Record<string, unknown> = { ...record }
      delete clientRecord.properties
      return json({ client: clientRecord, properties })
    }

    if (req.method === 'GET' && pathname === 'admin/properties') {
      const properties = requireData(await authenticated.supabase.rpc('list_admin_properties'))
      return json({ properties })
    }

    if (req.method === 'POST' && pathname === 'admin/properties') {
      const input = propertyInput.parse(await req.json())
      const property = requireData(await authenticated.supabase.rpc('create_admin_property', { property_data: input }))
      return json({ property }, { status: 201 })
    }

    if (req.method === 'GET' && segments[1] === 'properties' && segments[2]) {
      const property = requireData(await authenticated.supabase.rpc('get_admin_property', { property_uuid: segments[2] }))
      if (!property) return publicError(404, 'Property not found.', 'VALIDATION_ERROR', 'property_lookup')
      return json({ property })
    }
  }

  return publicError(404, 'Not found.', 'VALIDATION_ERROR', 'routing')
}

export default async (req: Request, context: Context) => {
  if (!['GET', 'POST', 'PATCH', 'DELETE'].includes(req.method)) return publicError(405, 'Method not allowed.', 'VALIDATION_ERROR', 'routing')
  const authenticated = await authenticate(req)
  if (authenticated instanceof Response) return authenticated

  try {
    return await routeRequest(req, authenticated)
  } catch (error) {
    if (error instanceof AccessError) {
      return publicError(403, error.message || 'You do not have permission to access this area.', 'AUTHORIZATION_ERROR', 'authorization')
    }
    if (error instanceof z.ZodError) return publicError(400, 'Please check the information provided.', 'VALIDATION_ERROR', 'validation', { details: error.issues.map((issue) => issue.path.join('.')).filter(Boolean).join(', ') })
    if (error instanceof PortalRequestError) {
      const authorizationError = error.supabaseCode === '42501'
      const status = authorizationError ? 403 : error.status && error.status >= 400 ? error.status : 400
      console.error('Portal request failed', {
        requestId: context.requestId,
        path: new URL(req.url).pathname,
        code: authorizationError ? 'AUTHORIZATION_ERROR' : error.portalCode,
        supabaseCode: error.supabaseCode,
        message: error.message,
        details: error.details,
        hint: error.hint,
        status,
        stage: error.stage,
      })
      return publicError(status, authorizationError ? 'You do not have permission to complete this request.' : 'The portal could not complete this request.', authorizationError ? 'AUTHORIZATION_ERROR' : error.portalCode, error.stage, { details: error.details, hint: error.hint })
    }
    console.error('Portal API request failed', { requestId: context.requestId, path: new URL(req.url).pathname, message: error instanceof Error ? error.message : 'Unknown error', stage: 'request' })
    return publicError(500, 'The portal is temporarily unavailable. Please try again.', 'NETWORK_ERROR', 'request')
  }
}

export const config: Config = {
  path: '/api/portal/*',
}
