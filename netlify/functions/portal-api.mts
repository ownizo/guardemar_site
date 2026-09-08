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

const staffInput = z.object({
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  displayName: z.string().trim().min(1).max(160),
  roleTitle: z.string().trim().min(1).max(160),
  email: z.string().trim().email().max(254).optional().or(z.literal('')),
  phone: z.string().trim().max(50).optional().or(z.literal('')),
  active: z.boolean().default(true),
  showOnClientReports: z.boolean().default(true),
  internalNotes: z.string().trim().max(4000).optional().or(z.literal('')),
  profilePhotoPath: z.string().trim().max(500).optional().or(z.literal('')),
})
const staffPatchInput = staffInput.partial().extend({ active: z.boolean().optional(), showOnClientReports: z.boolean().optional() })

const areaInput = z.object({
  id: z.string().uuid().optional(), propertyId: z.string().uuid(), areaType: z.string().trim().min(1).max(80),
  customLabel: z.string().trim().min(1).max(160), displayOrder: z.number().int().min(0).max(1000).default(0),
  active: z.boolean().optional(), internalNotes: z.string().trim().max(4000).optional().or(z.literal('')),
})

const inspectionInput = z.object({
  propertyId: z.string().uuid(), templateId: z.string().uuid(), inspectorStaffId: z.string().uuid(),
  scheduledFor: z.string().datetime(), idempotencyKey: z.string().uuid(),
  // Marks this as the property's Initial Property Condition Report (internal
  // concept: baseline condition record) at creation time -- see
  // create_inspection / General Terms v2.5 Clause 8.
  isBaseline: z.boolean().optional(),
})

const baselineCommentInput = z.object({
  inspectionAreaId: z.string().uuid().optional().or(z.literal('')),
  commentText: z.string().trim().min(1).max(4000),
})

const baselineCommentResponseInput = z.object({
  responseText: z.string().trim().min(1).max(4000),
})

const resultStatus = z.enum(['good', 'attention', 'urgent', 'not_checked', 'not_applicable'])
const reviewContent = z.object({
  status: resultStatus.optional(), observation: z.string().max(6000).optional(), recommendation: z.string().max(6000).optional(),
  observationClientVisible: z.boolean().optional(), recommendationClientVisible: z.boolean().optional(),
})

type ApplicationRole = 'customer' | 'staff' | 'admin'
type PortalProfile = { id: string; role: ApplicationRole; firstName: string | null; lastName: string | null; phone: string | null }
type AuthenticatedRequest = { user: User; supabase: SupabaseClient }
type PortalErrorCode = 'VALIDATION_ERROR' | 'AUTHENTICATION_ERROR' | 'AUTHORIZATION_ERROR' | 'AUTH_INVITE_ERROR' | 'CLIENT_LINK_ERROR' | 'PROPERTY_ACCESS_ERROR' | 'DATABASE_ERROR' | 'STORAGE_ERROR' | 'UPLOAD_ERROR' | 'AUTOSAVE_ERROR' | 'CREATE_RPC_ERROR' | 'POST_CREATE_REFRESH_ERROR' | 'POST_SAVE_REFRESH_ERROR' | 'NAVIGATION_ERROR' | 'NETWORK_ERROR'
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

function recordValue(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) if (record[key] !== undefined && record[key] !== null) return record[key]
  return undefined
}

function stringValue(record: Record<string, unknown>, keys: string[]) {
  const value = recordValue(record, keys)
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function normalisePropertyIds(value: unknown) {
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    if (typeof item === 'string') return [item]
    if (!item || typeof item !== 'object') return []
    const record = item as Record<string, unknown>
    const id = stringValue(record, ['id', 'property_id', 'propertyId', 'property_uuid', 'propertyUuid'])
    return id ? [id] : []
  })
}

function normalisePortalAccess(value: unknown) {
  const root = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
  const candidateUsers = Array.isArray(value)
    ? value
    : recordValue(root ?? {}, ['portalUsers', 'portal_users', 'users', 'linkedUsers', 'linked_users'])
  const rawUsers = Array.isArray(candidateUsers) ? candidateUsers : root && stringValue(root, ['user_id', 'userId', 'auth_user_id', 'authUserId']) ? [root] : []

  return {
    users: rawUsers.flatMap((item) => {
      if (!item || typeof item !== 'object') return []
      const record = item as Record<string, unknown>
      const authRecord = recordValue(record, ['authUser', 'auth_user', 'user'])
      const authUser = authRecord && typeof authRecord === 'object' && !Array.isArray(authRecord) ? authRecord as Record<string, unknown> : {}
      const metadataValue = recordValue(authUser, ['user_metadata']) ?? recordValue(record, ['user_metadata', 'metadata'])
      const metadata = metadataValue && typeof metadataValue === 'object' && !Array.isArray(metadataValue) ? metadataValue as Record<string, unknown> : {}
      const merged = { ...metadata, ...authUser, ...record }
      const userId = stringValue(merged, ['user_id', 'userId', 'auth_user_id', 'authUserId', 'id'])
      if (!userId) return []
      const firstName = stringValue(merged, ['first_name', 'firstName'])
      const lastName = stringValue(merged, ['last_name', 'lastName'])
      const displayName = stringValue(merged, ['display_name', 'displayName', 'full_name', 'fullName', 'name']) ?? ([firstName, lastName].filter(Boolean).join(' ') || null)
      const rawStatus = stringValue(merged, ['status', 'invite_status', 'inviteStatus'])?.toLowerCase()
      const active = Boolean(stringValue(merged, ['last_sign_in_at', 'lastSignInAt', 'email_confirmed_at', 'emailConfirmedAt', 'confirmed_at', 'confirmedAt']))
      const pending = Boolean(stringValue(merged, ['invited_at', 'invitedAt', 'confirmation_sent_at', 'confirmationSentAt']))
      const status = rawStatus === 'active' || active ? 'active' : rawStatus?.includes('pending') || pending ? 'invitation_pending' : 'not_activated'
      const propertyValue = recordValue(merged, ['property_ids', 'propertyIds', 'property_uuids', 'propertyUuids', 'properties', 'property_access', 'propertyAccess'])
      return [{
        userId,
        email: stringValue(merged, ['email']) ?? '',
        displayName,
        relationshipLabel: stringValue(merged, ['relationship_label', 'relationshipLabel']),
        status,
        propertyIds: normalisePropertyIds(propertyValue),
      }]
    }),
  }
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

  if (req.method === 'GET' && pathname === 'inspections') {
    const inspections = requireData(await authenticated.supabase.rpc('list_customer_inspections'))
    return json({ inspections })
  }

  if (req.method === 'GET' && segments[0] === 'inspections' && segments[1]) {
    const result = await authenticated.supabase.rpc('get_customer_inspection', { inspection_uuid: z.string().uuid().parse(segments[1]) })
    if (result.error) requireData(result)
    if (!result.data) return publicError(404, 'Inspection report not found.', 'VALIDATION_ERROR', 'inspection_lookup')
    return json({ inspection: result.data })
  }

  // Initial Property Condition Report (baseline) review/acknowledgement --
  // customer-facing. Non-baseline or unpublished inspections simply return
  // isBaseline: false / null status, since get_baseline_condition_status is
  // scoped to published inspections the caller already has property access to.
  if (req.method === 'GET' && segments[0] === 'inspections' && segments[1] && segments[2] === 'baseline' && segments.length === 3) {
    const status = requireData(await authenticated.supabase.rpc('get_baseline_condition_status', { inspection_uuid: z.string().uuid().parse(segments[1]) }), 'DATABASE_ERROR', 'baseline_status_lookup')
    return json({ baseline: status })
  }

  if (req.method === 'POST' && segments[0] === 'inspections' && segments[1] && segments[2] === 'baseline-comments' && segments.length === 3) {
    const input = baselineCommentInput.parse(await req.json())
    const comment = requireData(await authenticated.supabase.rpc('submit_baseline_condition_comment', {
      inspection_uuid: z.string().uuid().parse(segments[1]),
      area_uuid: input.inspectionAreaId || null,
      comment_body: input.commentText,
    }), 'DATABASE_ERROR', 'baseline_comment_submit')
    return json({ comment }, { status: 201 })
  }

  if (req.method === 'POST' && segments[0] === 'inspections' && segments[1] && segments[2] === 'baseline-acknowledge' && segments.length === 3) {
    const acknowledgement = requireData(await authenticated.supabase.rpc('acknowledge_baseline_condition', { inspection_uuid: z.string().uuid().parse(segments[1]) }), 'DATABASE_ERROR', 'baseline_acknowledge')
    return json({ acknowledgement })
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

    if (req.method === 'DELETE' && segments[1] === 'clients' && segments[2] && segments.length === 3) {
      await requireAdmin(authenticated)
      const clientId = z.string().uuid().parse(segments[2])
      const result = requireData(await authenticated.supabase.rpc('delete_admin_client', { client_uuid: clientId }), 'NETWORK_ERROR', 'delete_rpc')
      return json(result)
    }

    if (segments[1] === 'clients' && segments[2] && segments[3] === 'portal-access' && segments.length === 4 && req.method === 'GET') {
      await requireAdmin(authenticated)
      const clientId = z.string().uuid().parse(segments[2])
      const result = await authenticated.supabase.rpc('get_admin_client_portal_access', { client_uuid: clientId })
      if (result.error) throw new PortalRequestError(result.error.message, 'POST_SAVE_REFRESH_ERROR', 'portal_access_lookup', result.status, result.error.code, result.error.details, result.error.hint)
      return json({ portalAccess: normalisePortalAccess(result.data) })
    }

    if (segments[1] === 'clients' && segments[2] && segments[3] === 'portal-users' && segments[4] === 'link' && req.method === 'POST') {
      await requireAdmin(authenticated)
      const clientId = z.string().uuid().parse(segments[2])
      const input = z.object({ userId: z.string().uuid(), relationshipLabel: z.string().trim().max(120).optional().or(z.literal('')) }).parse(await req.json())
      const linkedUser = requireData(await authenticated.supabase.rpc('link_client_portal_user', {
        client_uuid: clientId,
        user_uuid: input.userId,
        relationship_label: input.relationshipLabel || null,
      }), 'CLIENT_LINK_ERROR', 'client_link')
      return json({ linkedUser })
    }

    if (segments[1] === 'clients' && segments[2] && segments[3] === 'portal-users' && segments[4] && segments[5] === 'properties' && req.method === 'PUT') {
      await requireAdmin(authenticated)
      const clientId = z.string().uuid().parse(segments[2])
      const userId = z.string().uuid().parse(segments[4])
      const input = z.object({ propertyIds: z.array(z.string().uuid()).max(250) }).parse(await req.json())
      const client = requireData(await authenticated.supabase.rpc('get_admin_client', { client_uuid: clientId }), 'PROPERTY_ACCESS_ERROR', 'property_scope_lookup') as Record<string, unknown>
      const allowedPropertyIds = new Set(normalisePropertyIds(recordValue(client, ['properties'])))
      if (input.propertyIds.some((propertyId) => !allowedPropertyIds.has(propertyId))) {
        return publicError(400, 'Property access can only be assigned from this client’s property list.', 'PROPERTY_ACCESS_ERROR', 'property_scope_validation')
      }
      const propertyAccess = requireData(await authenticated.supabase.rpc('set_client_portal_property_access', {
        client_uuid: clientId,
        user_uuid: userId,
        property_uuids: input.propertyIds,
      }), 'PROPERTY_ACCESS_ERROR', 'property_access_save')
      return json({ propertyAccess })
    }

    if (segments[1] === 'clients' && segments[2] && segments[3] === 'portal-users' && segments[4] && segments.length === 5 && req.method === 'DELETE') {
      await requireAdmin(authenticated)
      const clientId = z.string().uuid().parse(segments[2])
      const userId = z.string().uuid().parse(segments[4])
      const revoked = requireData(await authenticated.supabase.rpc('revoke_client_portal_access', { client_uuid: clientId, user_uuid: userId }), 'PROPERTY_ACCESS_ERROR', 'portal_access_revoke')
      return json({ revoked })
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

    if (req.method === 'GET' && segments[1] === 'properties' && segments[2] && segments[3] === 'baseline' && segments.length === 4) {
      const status = requireData(await authenticated.supabase.rpc('get_property_baseline_status', { property_uuid: z.string().uuid().parse(segments[2]) }), 'DATABASE_ERROR', 'baseline_status_lookup')
      return json({ baseline: status })
    }

    if (req.method === 'GET' && segments[1] === 'properties' && segments[2] && segments[3] === 'operations') {
      const operations = requireData(await authenticated.supabase.rpc('get_property_inspection_operations', { property_uuid: z.string().uuid().parse(segments[2]) }))
      return json(operations)
    }

    if (req.method === 'POST' && segments[1] === 'properties' && segments[2] && segments[3] === 'areas') {
      await requireAdmin(authenticated)
      const input = areaInput.parse({ ...(await req.json()), propertyId: segments[2] })
      const area = requireData(await authenticated.supabase.rpc('save_property_area', { area_data: input }), 'DATABASE_ERROR', 'property_area_create')
      return json({ area }, { status: 201 })
    }

    if (req.method === 'PATCH' && segments[1] === 'properties' && segments[2] && segments[3] === 'areas' && segments[4]) {
      await requireAdmin(authenticated)
      const input = areaInput.parse({ ...(await req.json()), id: segments[4], propertyId: segments[2] })
      const area = requireData(await authenticated.supabase.rpc('save_property_area', { area_data: input }), 'DATABASE_ERROR', 'property_area_update')
      return json({ area })
    }

    if (req.method === 'POST' && segments[1] === 'properties' && segments[2] && segments[3] === 'areas-reorder') {
      await requireAdmin(authenticated)
      const input = z.object({ areaIds: z.array(z.string().uuid()).max(200) }).parse(await req.json())
      requireData(await authenticated.supabase.rpc('reorder_property_areas', { property_uuid: segments[2], ordered_ids: input.areaIds }))
      return json({ reordered: true })
    }

    if (req.method === 'GET' && pathname === 'admin/team') {
      const team = requireData(await authenticated.supabase.rpc('list_admin_team'))
      return json({ team })
    }

    if (req.method === 'POST' && pathname === 'admin/team') {
      await requireAdmin(authenticated)
      const member = requireData(await authenticated.supabase.rpc('create_staff_profile', { staff_data: staffInput.parse(await req.json()) }), 'DATABASE_ERROR', 'staff_create')
      return json({ member }, { status: 201 })
    }

    if (req.method === 'GET' && segments[1] === 'team' && segments[2]) {
      const member = requireData(await authenticated.supabase.rpc('get_admin_team_member', { staff_uuid: z.string().uuid().parse(segments[2]) }))
      if (!member) return publicError(404, 'Team member not found.', 'VALIDATION_ERROR', 'staff_lookup')
      return json({ member })
    }

    if (req.method === 'PATCH' && segments[1] === 'team' && segments[2]) {
      await requireAdmin(authenticated)
      const member = requireData(await authenticated.supabase.rpc('update_staff_profile', { staff_uuid: z.string().uuid().parse(segments[2]), staff_data: staffPatchInput.parse(await req.json()) }), 'DATABASE_ERROR', 'staff_update')
      return json({ member })
    }

    if (req.method === 'GET' && pathname === 'admin/inspection-options') {
      const [templates, team, properties] = await Promise.all([
        authenticated.supabase.rpc('list_inspection_templates'), authenticated.supabase.rpc('list_admin_team'), authenticated.supabase.rpc('list_admin_properties'),
      ])
      return json({ templates: requireData(templates), team: requireData(team), properties: requireData(properties) })
    }

    if (req.method === 'GET' && pathname === 'admin/inspections') {
      const url = new URL(req.url)
      const filters = Object.fromEntries(['status', 'propertyId', 'inspectorStaffId', 'dateFrom', 'dateTo'].map((key) => [key, url.searchParams.get(key) ?? '']))
      const inspections = requireData(await authenticated.supabase.rpc('list_admin_inspections', { filters }))
      return json({ inspections })
    }

    if (req.method === 'POST' && pathname === 'admin/inspections') {
      const result = await authenticated.supabase.rpc('create_inspection', { inspection_data: inspectionInput.parse(await req.json()) })
      if (result.error?.message === 'This property has no inspection areas configured.') {
        return publicError(409, result.error.message, 'VALIDATION_ERROR', 'inspection_create')
      }
      const inspection = requireData(result, 'DATABASE_ERROR', 'inspection_create')
      return json({ inspection }, { status: 201 })
    }

    if (req.method === 'GET' && segments[1] === 'inspections' && segments[2] && segments.length === 3) {
      const inspection = requireData(await authenticated.supabase.rpc('get_admin_inspection', { inspection_uuid: z.string().uuid().parse(segments[2]) }))
      if (!inspection) return publicError(404, 'Inspection not found.', 'VALIDATION_ERROR', 'inspection_lookup')
      return json(inspection)
    }

    if (req.method === 'POST' && segments[1] === 'inspections' && segments[2] && segments[3] === 'link') {
      await requireAdmin(authenticated)
      const input = z.object({ tokenHash: z.string().regex(/^[a-f0-9]{64}$/), expiresAt: z.string().datetime() }).parse(await req.json())
      const tokenId = requireData(await authenticated.supabase.rpc('generate_inspection_access', { inspection_uuid: segments[2], token_hash_hex: input.tokenHash, expiry: input.expiresAt }), 'DATABASE_ERROR', 'token_create')
      return json({ tokenId }, { status: 201 })
    }

    if (req.method === 'DELETE' && segments[1] === 'inspections' && segments[2] && segments[3] === 'link') {
      await requireAdmin(authenticated)
      requireData(await authenticated.supabase.rpc('revoke_inspection_access', { inspection_uuid: segments[2] }))
      return json({ revoked: true })
    }

    if (req.method === 'PATCH' && segments[1] === 'inspections' && segments[2] && segments[3] === 'areas' && segments[4]) {
      const area = requireData(await authenticated.supabase.rpc('update_admin_inspection_area', { area_uuid: segments[4], area_data: reviewContent.parse(await req.json()) }), 'DATABASE_ERROR', 'review_area')
      return json({ area })
    }

    if (req.method === 'PATCH' && segments[1] === 'inspections' && segments[2] && segments[3] === 'items' && segments[4]) {
      const item = requireData(await authenticated.supabase.rpc('update_admin_inspection_item', { item_uuid: segments[4], item_data: reviewContent.parse(await req.json()) }), 'DATABASE_ERROR', 'review_item')
      return json({ item })
    }

    if (req.method === 'PATCH' && segments[1] === 'inspections' && segments[2] && segments[3] === 'photos' && segments[4]) {
      const input = z.object({ caption: z.string().max(500).optional(), displayOrder: z.number().int().min(0).max(1000).optional(), clientVisible: z.boolean().optional(), rejected: z.boolean().optional() }).parse(await req.json())
      const photo = requireData(await authenticated.supabase.rpc('update_inspection_photo', { photo_uuid: segments[4], photo_data: input }), 'DATABASE_ERROR', 'review_photo')
      return json({ photo })
    }

    if (req.method === 'PATCH' && segments[1] === 'inspections' && segments[2] && segments[3] === 'review') {
      const input = z.object({ finalCondition: z.enum(['good', 'attention', 'urgent']).optional(), clientSummary: z.string().max(10000).optional(), internalReviewNotes: z.string().max(10000).optional() }).parse(await req.json())
      const inspection = requireData(await authenticated.supabase.rpc('update_admin_inspection_review', { inspection_uuid: segments[2], review_data: input }), 'DATABASE_ERROR', 'review_save')
      return json({ inspection })
    }

    if (req.method === 'GET' && segments[1] === 'inspections' && segments[2] && segments[3] === 'preview') {
      const inspection = requireData(await authenticated.supabase.rpc('preview_admin_inspection', { inspection_uuid: segments[2] }))
      return json({ inspection })
    }

    if (req.method === 'POST' && segments[1] === 'inspections' && segments[2] && segments[3] === 'publish') {
      await requireAdmin(authenticated)
      const inspection = requireData(await authenticated.supabase.rpc('publish_admin_inspection', { inspection_uuid: segments[2] }), 'DATABASE_ERROR', 'inspection_publish')
      return json({ inspection })
    }

    if (req.method === 'GET' && segments[1] === 'inspections' && segments[2] && segments[3] === 'baseline' && segments.length === 4) {
      const rows = requireData(await authenticated.supabase
        .from('baseline_condition_comments')
        .select('id, inspection_area_id, comment_text, created_at, staff_response_text, staff_responded_at')
        .eq('inspection_id', z.string().uuid().parse(segments[2]))
        .order('created_at'), 'DATABASE_ERROR', 'baseline_comments_lookup')
      return json({ baseline: { comments: rows.map((row) => ({
        id: row.id, inspectionAreaId: row.inspection_area_id, commentText: row.comment_text,
        createdAt: row.created_at, staffResponseText: row.staff_response_text, staffRespondedAt: row.staff_responded_at,
      })) } })
    }

    if (req.method === 'POST' && segments[1] === 'inspections' && segments[2] && segments[3] === 'baseline-comments' && segments[4] && segments[5] === 'respond') {
      const input = baselineCommentResponseInput.parse(await req.json())
      const comment = requireData(await authenticated.supabase.rpc('respond_to_baseline_condition_comment', {
        comment_uuid: z.string().uuid().parse(segments[4]),
        response_body: input.responseText,
      }), 'DATABASE_ERROR', 'baseline_comment_respond')
      return json({ comment })
    }

    if (req.method === 'GET' && segments[1] === 'properties' && segments[2] && segments.length === 3) {
      const property = requireData(await authenticated.supabase.rpc('get_admin_property', { property_uuid: segments[2] }))
      if (!property) return publicError(404, 'Property not found.', 'VALIDATION_ERROR', 'property_lookup')
      return json({ property })
    }
  }

  return publicError(404, 'Not found.', 'VALIDATION_ERROR', 'routing')
}

export default async (req: Request, context: Context) => {
  if (!['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return publicError(405, 'Method not allowed.', 'VALIDATION_ERROR', 'routing')
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
