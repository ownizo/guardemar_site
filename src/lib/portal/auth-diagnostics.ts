/**
 * Structured, safe diagnostics for the invitation / password-recovery callback flow.
 *
 * These codes let production logs distinguish exactly which stage of the flow failed
 * without ever leaking a credential. `logAuthDiagnostic` accepts only an `Error` (or an
 * `AuthError`-shaped object) and reads its `message` — never the raw callback params,
 * which may contain a `token_hash`, `code`, `access_token` or `refresh_token`.
 */
export type AuthDiagnosticCode =
  // Callback processing (/auth/callback) — see src/lib/portal/auth-callback.ts.
  | 'CALLBACK_MISSING'
  | 'UNKNOWN_CALLBACK_TYPE'
  | 'PKCE_EXCHANGE_FAILED'
  | 'OTP_VERIFY_FAILED'
  | 'CALLBACK_EXPIRED'
  // Choosing/updating a password once a session (recovery or invite) is established.
  | 'PASSWORD_UPDATE_FAILED'
  | 'PROFILE_INITIALISATION_FAILED'
  | 'ROLE_ACCESS_FAILED'
  // Normal email/password sign-in (AuthCard) and shared route-guard failures.
  | 'AUTH_CREDENTIAL_ERROR'
  | 'PROFILE_INITIALISATION_ERROR'
  | 'PORTAL_ACCESS_ERROR'
  | 'NAVIGATION_ERROR'

export function logAuthDiagnostic(code: AuthDiagnosticCode, error: unknown, stage: string) {
  console.error('Guardemar auth diagnostic', {
    code,
    stage,
    message: error instanceof Error ? error.message : typeof error === 'string' ? error : 'Unknown error',
  })
}
