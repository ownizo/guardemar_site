import type { Config, Context } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'

const EXPECTED_SUPABASE_REF = 'ablktbpledjceddessyg'
const INVITATION_REDIRECT_URL = 'https://guardemar.com/auth/callback'

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

function isAuthStatusError(error: unknown): error is { status: number } {
  return typeof error === 'object' && error !== null && 'status' in error && typeof (error as { status: unknown }).status === 'number'
}

function authErrorCode(error: unknown): string | undefined {
  return typeof error === 'object' && error !== null && 'code' in error && typeof (error as { code: unknown }).code === 'string'
    ? (error as { code: string }).code
    : undefined
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
    // A 401/403 here means the Admin API itself rejected the request (for example an
    // invalid or rotated SUPABASE_SERVICE_ROLE_KEY), not that this particular email is
    // already registered. Surfacing the generic "already has an account" message for a
    // broken credential misleads staff into chasing the wrong cause, so it is reported
    // as a configuration problem instead. No invitation is created in either case.
    const status = isAuthStatusError(error) ? error.status : undefined
    if (status === 401 || status === 403) {
      return errorResponse(503, 'Customer invitations are not configured correctly. Contact a Guardemar system administrator before inviting clients.', 'AUTH_INVITE_ERROR', 'auth_invite_configuration')
    }
    // Supabase reports a known, specific code when this email already has an Auth
    // identity, whether it was invited-but-never-activated or is already active. Both
    // sub-cases are correctly resolved the same way — a password-reset email lets the
    // holder (re)set their password and reach the portal — so staff are pointed at that
    // single, always-correct action instead of a vague "maybe it already has an account".
    const code = authErrorCode(error)
    if (code === 'email_exists' || code === 'user_already_exists') {
      return errorResponse(409, 'This email already has a Guardemar account. Send a password reset instead of a new invitation.', 'AUTH_INVITE_ERROR', 'auth_invite_email_exists')
    }
    return errorResponse(400, 'The invitation could not be sent. Please check the email address and try again.', 'AUTH_INVITE_ERROR', 'auth_invite')
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
