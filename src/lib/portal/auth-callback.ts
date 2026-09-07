/**
 * Pure parsing of a Supabase Auth email-callback URL.
 *
 * This app only ever issues two kinds of email link: an admin invitation and a
 * self-service password recovery. Both are represented here as `SupportedOtpType`
 * ('invite' | 'recovery'). Any other/unrecognised callback shape fails closed
 * (`kind: 'unknown'`) rather than being guessed at — see AGENTS/production-auth notes.
 *
 * Three callback shapes are recognised, corresponding to what the current Supabase
 * project can actually produce for this app's two flows:
 *
 * - `token_hash` + `type`: the robust, device-independent shape produced when the
 *   Supabase email templates link directly to this app using `{{ .TokenHash }}`
 *   (see GUARDEMAR_PORTAL_IMPLEMENTATION.md for the required Dashboard template).
 *   Verified with `supabase.auth.verifyOtp({ token_hash, type })`.
 * - `code` (+ optional `sb_flow_id`): the PKCE shape produced by Supabase's default
 *   `{{ .ConfirmationURL }}` template when the *browser* that requested the link used
 *   `flowType: 'pkce'` — in this app that is only ever a self-service
 *   `resetPasswordForEmail()` recovery request. Supabase's own SDK documentation is
 *   explicit that `inviteUserByEmail` (server-issued, no browser) never produces a
 *   PKCE code: "PKCE is not supported when using inviteUserByEmail... the browser
 *   initiating the invite is often different from the browser accepting the invite".
 *   Exchanged with `supabase.auth.exchangeCodeForSession(code)`.
 * - `access_token` + `refresh_token` (+ `type`) in the hash fragment: the classic
 *   implicit-grant shape produced by Supabase's default template for a request that
 *   carried no PKCE challenge — this is exactly what an admin-issued invitation
 *   produces today. Applied with `supabase.auth.setSession({ access_token,
 *   refresh_token })`.
 *
 * An `error`/`error_code`/`error_description` present anywhere in the URL always wins
 * (Supabase itself is reporting the link as invalid/expired/already used).
 */

export type SupportedOtpType = 'invite' | 'recovery'

function isSupportedOtpType(value: string | null): value is SupportedOtpType {
  return value === 'invite' || value === 'recovery'
}

export type ParsedAuthCallback =
  | { kind: 'token_hash'; tokenHash: string; type: SupportedOtpType }
  | { kind: 'code'; code: string; flowId: string | null }
  | { kind: 'implicit'; accessToken: string; refreshToken: string; type: SupportedOtpType }
  | { kind: 'error'; code: string; description: string }
  | { kind: 'unknown'; reason: string }
  | { kind: 'missing' }

export function parseAuthCallback(href: string): ParsedAuthCallback {
  const url = new URL(href)
  const hashParams = new URLSearchParams(url.hash.replace(/^#/, ''))
  const get = (name: string) => url.searchParams.get(name) ?? hashParams.get(name)

  const errorParam = get('error') ?? get('error_code')
  if (errorParam) {
    return { kind: 'error', code: errorParam, description: get('error_description') ?? 'This link is no longer valid.' }
  }

  const tokenHash = get('token_hash')
  if (tokenHash) {
    const type = get('type')
    if (!isSupportedOtpType(type)) return { kind: 'unknown', reason: `token_hash callback with unsupported type "${type ?? 'missing'}"` }
    return { kind: 'token_hash', tokenHash, type }
  }

  const code = get('code')
  if (code) {
    return { kind: 'code', code, flowId: get('sb_flow_id') }
  }

  const accessToken = get('access_token')
  const refreshToken = get('refresh_token')
  if (accessToken && refreshToken) {
    const type = get('type')
    if (!isSupportedOtpType(type)) return { kind: 'unknown', reason: `implicit callback with unsupported type "${type ?? 'missing'}"` }
    return { kind: 'implicit', accessToken, refreshToken, type }
  }

  return { kind: 'missing' }
}
