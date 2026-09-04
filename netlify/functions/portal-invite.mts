import type { Config, Context } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'

const EXPECTED_SUPABASE_REF = 'ablktbpledjceddessyg'
const INVITATION_REDIRECT_URL = 'https://guardemar.com/reset-password'

const invitationInput = z.object({
  email: z.string().trim().email().max(254),
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
})

function json(data: unknown, init?: ResponseInit) {
  return Response.json(data, { ...init, headers: { 'Cache-Control': 'no-store', ...init?.headers } })
}

function errorResponse(status: number, message: string, code: 'VALIDATION_ERROR' | 'AUTHENTICATION_ERROR' | 'AUTHORIZATION_ERROR' | 'AUTH_INVITE_ERROR', stage: string) {
  return json({ error: { status, message, code, stage } }, { status })
}

export default async function handler(req: Request, context: Context) {
  if (req.method !== 'POST') return errorResponse(405, 'Method not allowed.', 'VALIDATION_ERROR', 'method')

  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  const url = Netlify.env.get('SUPABASE_URL')
  const publishableKey = Netlify.env.get('SUPABASE_PUBLISHABLE_KEY')
  const serviceRoleKey = Netlify.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!token || !url || !publishableKey) return errorResponse(401, 'Your session has expired. Please sign in again.', 'AUTHENTICATION_ERROR', 'authentication')
  if (new URL(url).hostname.split('.')[0] !== EXPECTED_SUPABASE_REF) return errorResponse(503, 'Portal authentication configuration is unavailable.', 'AUTH_INVITE_ERROR', 'configuration')
  if (!serviceRoleKey) return errorResponse(503, 'Customer invitations are not configured.', 'AUTH_INVITE_ERROR', 'configuration')

  try {
    const authenticatedSupabase = createClient(url, publishableKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    })
    const { data: authData, error: authError } = await authenticatedSupabase.auth.getUser(token)
    if (authError || !authData.user) return errorResponse(401, 'Your session has expired. Please sign in again.', 'AUTHENTICATION_ERROR', 'authentication')

    const { data: profile, error: profileError } = await authenticatedSupabase.from('profiles').select('role').eq('id', authData.user.id).maybeSingle()
    if (profileError) throw profileError
    if (profile?.role !== 'admin') return errorResponse(403, 'Administrator access is required.', 'AUTHORIZATION_ERROR', 'authorization')

    const input = invitationInput.parse(await req.json())
    const adminSupabase = createClient(url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    })
    const { data, error } = await adminSupabase.auth.admin.inviteUserByEmail(input.email, {
      redirectTo: INVITATION_REDIRECT_URL,
      data: {
        first_name: input.firstName,
        last_name: input.lastName,
        full_name: `${input.firstName} ${input.lastName}`,
      },
    })
    if (error || !data.user?.id) throw error ?? new Error('The invitation did not return an Auth user.')

    return json({
      invitedUser: {
        userId: data.user.id,
        email: data.user.email ?? input.email.toLowerCase(),
        displayName: `${input.firstName} ${input.lastName}`,
        status: 'invitation_pending',
        invitedAt: data.user.invited_at ?? new Date().toISOString(),
      },
      redirectUrl: INVITATION_REDIRECT_URL,
    }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) return errorResponse(400, 'Check the invitation details and try again.', 'VALIDATION_ERROR', 'validation')
    console.error('Portal invitation failed', {
      requestId: context.requestId,
      code: 'AUTH_INVITE_ERROR',
      stage: 'auth_invite',
      message: error instanceof Error ? error.message : 'Unknown invitation error',
    })
    return errorResponse(400, 'The invitation could not be sent. Check whether this email already has an account.', 'AUTH_INVITE_ERROR', 'auth_invite')
  }
}

export const config: Config = {
  path: '/api/portal-invite',
  method: 'POST',
  rateLimit: {
    action: 'rate_limit',
    aggregateBy: ['ip'],
    windowLimit: 20,
    windowSize: 60,
  },
}
