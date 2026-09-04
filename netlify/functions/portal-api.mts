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

function json(data: unknown, init?: ResponseInit) {
  return Response.json(data, { ...init, headers: { 'Cache-Control': 'no-store', ...init?.headers } })
}

function publicError(status: number, message: string) {
  return json({ error: message }, { status })
}

function requireData<T>(result: { data: T | null; error: { message: string; code?: string } | null }): T {
  if (result.error) throw new SupabaseQueryError(result.error.message, result.error.code)
  if (result.data === null) throw new SupabaseQueryError('The database returned no data.')
  return result.data
}

async function authenticate(req: Request): Promise<AuthenticatedRequest | Response> {
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  const url = Netlify.env.get('SUPABASE_URL')
  const publishableKey = Netlify.env.get('SUPABASE_PUBLISHABLE_KEY')

  if (!token || !url || !publishableKey) return publicError(401, 'Your session has expired. Please sign in again.')
  if (new URL(url).hostname.split('.')[0] !== EXPECTED_SUPABASE_REF) return publicError(503, 'Portal authentication configuration is unavailable.')

  const supabase = createClient(url, publishableKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
  const { data, error } = await supabase.auth.getUser(token)
  if (error || !data.user || !data.user.email) return publicError(401, 'Your session has expired. Please sign in again.')

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

class AccessError extends Error {}
class SupabaseQueryError extends Error {
  constructor(message: string, public code?: string) {
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
    if (!profile) return publicError(409, 'Your portal profile has not been initialised.')
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
      const client = requireData(await authenticated.supabase.rpc('create_admin_client', { client_data: input }))
      return json({ client }, { status: 201 })
    }

    if (req.method === 'GET' && segments[1] === 'clients' && segments[2]) {
      const client = requireData(await authenticated.supabase.rpc('get_admin_client', { client_uuid: segments[2] }))
      if (!client) return publicError(404, 'Client not found.')
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
      if (!property) return publicError(404, 'Property not found.')
      return json({ property })
    }
  }

  return publicError(404, 'Not found.')
}

export default async (req: Request, context: Context) => {
  if (!['GET', 'POST', 'PATCH'].includes(req.method)) return publicError(405, 'Method not allowed.')
  const authenticated = await authenticate(req)
  if (authenticated instanceof Response) return authenticated

  try {
    return await routeRequest(req, authenticated)
  } catch (error) {
    if (error instanceof AccessError || (error instanceof SupabaseQueryError && error.code === '42501')) {
      return publicError(403, 'You do not have permission to access this area.')
    }
    if (error instanceof z.ZodError) return publicError(400, 'Please check the information provided.')
    console.error('Portal API request failed', { requestId: context.requestId, path: new URL(req.url).pathname })
    return publicError(500, 'The portal is temporarily unavailable. Please try again.')
  }
}

export const config: Config = {
  path: '/api/portal/*',
}
