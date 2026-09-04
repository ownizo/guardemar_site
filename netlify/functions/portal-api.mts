import type { Config, Context } from '@netlify/functions'
import { getDatabase } from '@netlify/database'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'

const INITIAL_ADMIN_EMAIL = 'info@guardemar.com'
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

type AuthenticatedUser = { id: string; email: string }
type QueryClient = Awaited<ReturnType<ReturnType<typeof getDatabase>['pool']['connect']>>

function json(data: unknown, init?: ResponseInit) {
  return Response.json(data, { ...init, headers: { 'Cache-Control': 'no-store', ...init?.headers } })
}

function publicError(status: number, message: string) {
  return json({ error: message }, { status })
}

async function authenticate(req: Request): Promise<AuthenticatedUser | Response> {
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  const url = Netlify.env.get('SUPABASE_URL')
  const publishableKey = Netlify.env.get('SUPABASE_PUBLISHABLE_KEY')

  if (!token || !url || !publishableKey) return publicError(401, 'Your session has expired. Please sign in again.')
  if (new URL(url).hostname.split('.')[0] !== EXPECTED_SUPABASE_REF) return publicError(503, 'Portal authentication configuration is unavailable.')

  const supabase = createClient(url, publishableKey, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data, error } = await supabase.auth.getUser(token)
  const email = data.user?.email?.toLowerCase()
  if (error || !data.user || !email) return publicError(401, 'Your session has expired. Please sign in again.')

  return { id: data.user.id, email }
}

async function withUserDatabase<T>(user: AuthenticatedUser, operation: (client: QueryClient) => Promise<T>) {
  const database = getDatabase()
  const client = await database.pool.connect()
  try {
    await client.query('BEGIN')
    await client.query("SELECT set_config('app.user_id', $1, true), set_config('app.user_email', $2, true)", [user.id, user.email])
    const result = await operation(client)
    await client.query('COMMIT')
    return result
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

async function getProfile(client: QueryClient, userId: string) {
  const result = await client.query(
    'SELECT id, role, first_name AS "firstName", last_name AS "lastName", phone FROM profiles WHERE id = $1 LIMIT 1',
    [userId],
  )
  return result.rows[0] as { id: string; role: 'customer' | 'staff' | 'admin'; firstName: string | null; lastName: string | null; phone: string | null } | undefined
}

async function requireStaff(client: QueryClient, userId: string) {
  const profile = await getProfile(client, userId)
  if (!profile || (profile.role !== 'staff' && profile.role !== 'admin')) throw new AccessError()
  return profile
}

class AccessError extends Error {}

async function handleInitialise(client: QueryClient, user: AuthenticatedUser) {
  const existing = await getProfile(client, user.id)
  if (existing) return existing

  const bootstrapCheck = await client.query('SELECT public.can_bootstrap_guardemar_admin() AS allowed')
  const requestedRole = user.email === INITIAL_ADMIN_EMAIL && bootstrapCheck.rows[0]?.allowed === true ? 'admin' : 'customer'
  const result = await client.query(
    `INSERT INTO profiles (id, role)
     VALUES ($1, $2::application_role)
     ON CONFLICT (id) DO NOTHING
     RETURNING id, role, first_name AS "firstName", last_name AS "lastName", phone`,
    [user.id, requestedRole],
  )
  if (result.rows[0]) {
    await client.query(
      `INSERT INTO audit_events (actor_user_id, event_type, entity_type, entity_id, metadata)
       VALUES ($1, $2, 'profile', $1, $3)`,
      [user.id, requestedRole === 'admin' ? 'initial_admin_bootstrapped' : 'profile_created', JSON.stringify({ source: 'authenticated_initialisation' })],
    )
  }

  return getProfile(client, user.id)
}

async function routeRequest(req: Request, context: Context, user: AuthenticatedUser) {
  const pathname = new URL(req.url).pathname.replace(/^\/api\/portal\/?/, '')
  const segments = pathname.split('/').filter(Boolean)

  return withUserDatabase(user, async (client) => {
    if (req.method === 'POST' && pathname === 'session/initialise') {
      return json({ profile: await handleInitialise(client, user) })
    }

    if (req.method === 'GET' && pathname === 'session') {
      const profile = await getProfile(client, user.id)
      if (!profile) return publicError(409, 'Your portal profile has not been initialised.')
      return json({ profile, email: user.email })
    }

    if (req.method === 'GET' && pathname === 'properties') {
      const result = await client.query(
        `SELECT p.id, p.display_name AS "displayName", p.address_line_1 AS "addressLine1",
                p.address_line_2 AS "addressLine2", p.postal_code AS "postalCode",
                p.locality, p.municipality, p.country, p.property_type AS "propertyType"
         FROM properties p
         ORDER BY p.display_name`,
      )
      return json({ properties: result.rows })
    }

    if (segments[0] === 'admin') {
      await requireStaff(client, user.id)

      if (req.method === 'GET' && pathname === 'admin/dashboard') {
        const [clients, properties] = await Promise.all([
          client.query('SELECT count(*)::int AS count FROM clients WHERE active = true'),
          client.query('SELECT count(*)::int AS count FROM properties WHERE active = true'),
        ])
        return json({ counts: { clients: clients.rows[0]?.count ?? 0, properties: properties.rows[0]?.count ?? 0 } })
      }

      if (req.method === 'GET' && pathname === 'admin/clients') {
        const search = new URL(req.url).searchParams.get('search')?.trim() ?? ''
        const result = await client.query(
          `SELECT c.id, c.first_name AS "firstName", c.last_name AS "lastName", c.email, c.phone,
                  c.tax_number AS "taxNumber", c.active, count(p.id)::int AS "propertyCount"
           FROM clients c
           LEFT JOIN properties p ON p.client_id = c.id AND p.active = true
           WHERE $1 = '' OR concat_ws(' ', c.first_name, c.last_name, c.email, c.phone, c.tax_number, p.address_line_1, p.locality) ILIKE '%' || $1 || '%'
           GROUP BY c.id
           ORDER BY c.last_name, c.first_name`,
          [search],
        )
        return json({ clients: result.rows })
      }

      if (req.method === 'POST' && pathname === 'admin/clients') {
        const input = clientInput.parse(await req.json())
        const result = await client.query(
          `INSERT INTO clients (first_name, last_name, email, phone, tax_number, billing_address, country, internal_notes)
           VALUES ($1, $2, $3, $4, NULLIF($5, ''), NULLIF($6, ''), $7, NULLIF($8, ''))
           RETURNING id, first_name AS "firstName", last_name AS "lastName", email, phone`,
          [input.firstName, input.lastName, input.email, input.phone, input.taxNumber ?? '', input.billingAddress ?? '', input.country, input.internalNotes ?? ''],
        )
        const created = result.rows[0]
        await client.query(
          `INSERT INTO audit_events (actor_user_id, event_type, entity_type, entity_id, metadata)
           VALUES ($1, 'client_created', 'client', $2, '{}')`,
          [user.id, created.id],
        )
        return json({ client: created }, { status: 201 })
      }

      if (req.method === 'GET' && segments[1] === 'clients' && segments[2]) {
        const result = await client.query(
          `SELECT c.id, c.first_name AS "firstName", c.last_name AS "lastName", c.email, c.phone,
                  c.tax_number AS "taxNumber", c.billing_address AS "billingAddress", c.country,
                  c.internal_notes AS "internalNotes", c.active, c.created_at AS "createdAt"
           FROM clients c WHERE c.id = $1 LIMIT 1`,
          [segments[2]],
        )
        if (!result.rows[0]) return publicError(404, 'Client not found.')
        const propertyResult = await client.query(
          `SELECT id, display_name AS "displayName", address_line_1 AS "addressLine1", locality, municipality, active
           FROM properties WHERE client_id = $1 ORDER BY display_name`,
          [segments[2]],
        )
        return json({ client: result.rows[0], properties: propertyResult.rows })
      }

      if (req.method === 'GET' && pathname === 'admin/properties') {
        const result = await client.query(
          `SELECT p.id, p.display_name AS "displayName", p.address_line_1 AS "addressLine1", p.locality,
                  p.municipality, p.property_type AS "propertyType", p.active,
                  c.id AS "clientId", concat_ws(' ', c.first_name, c.last_name) AS "clientName"
           FROM properties p JOIN clients c ON c.id = p.client_id
           ORDER BY p.display_name`,
        )
        return json({ properties: result.rows })
      }

      if (req.method === 'POST' && pathname === 'admin/properties') {
        const input = propertyInput.parse(await req.json())
        const result = await client.query(
          `INSERT INTO properties (
             client_id, display_name, address_line_1, address_line_2, postal_code, locality, municipality,
             country, property_type, bedrooms, bathrooms, has_pool, has_garden, has_irrigation, has_alarm,
             access_notes_private, internal_notes
           ) VALUES ($1,$2,$3,NULLIF($4,''),$5,$6,$7,$8,$9::property_type,$10,$11,$12,$13,$14,$15,NULLIF($16,''),NULLIF($17,''))
           RETURNING id, display_name AS "displayName"`,
          [input.clientId, input.displayName, input.addressLine1, input.addressLine2 ?? '', input.postalCode, input.locality,
            input.municipality, input.country, input.propertyType, input.bedrooms ?? null, input.bathrooms ?? null,
            input.hasPool, input.hasGarden, input.hasIrrigation, input.hasAlarm, input.accessNotesPrivate ?? '', input.internalNotes ?? ''],
        )
        const created = result.rows[0]
        await client.query(
          `INSERT INTO audit_events (actor_user_id, event_type, entity_type, entity_id, metadata)
           VALUES ($1, 'property_created', 'property', $2, $3)`,
          [user.id, created.id, JSON.stringify({ clientId: input.clientId })],
        )
        return json({ property: created }, { status: 201 })
      }

      if (req.method === 'GET' && segments[1] === 'properties' && segments[2]) {
        const result = await client.query(
          `SELECT p.*, concat_ws(' ', c.first_name, c.last_name) AS client_name
           FROM properties p JOIN clients c ON c.id = p.client_id WHERE p.id = $1 LIMIT 1`,
          [segments[2]],
        )
        if (!result.rows[0]) return publicError(404, 'Property not found.')
        return json({ property: result.rows[0] })
      }
    }

    return publicError(404, 'Not found.')
  })
}

export default async (req: Request, context: Context) => {
  if (!['GET', 'POST', 'PATCH'].includes(req.method)) return publicError(405, 'Method not allowed.')
  const authenticated = await authenticate(req)
  if (authenticated instanceof Response) return authenticated

  try {
    return await routeRequest(req, context, authenticated)
  } catch (error) {
    if (error instanceof AccessError) return publicError(403, 'You do not have permission to access this area.')
    if (error instanceof z.ZodError) return publicError(400, 'Please check the information provided.')
    console.error('Portal API request failed', { requestId: context.requestId, path: new URL(req.url).pathname })
    return publicError(500, 'The portal is temporarily unavailable. Please try again.')
  }
}

export const config: Config = {
  path: '/api/portal/*',
}
