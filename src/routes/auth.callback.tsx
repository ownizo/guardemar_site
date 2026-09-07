import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { LoaderCircle } from 'lucide-react'
import { useEffect, useState } from 'react'

import { PrivatePageFrame } from '@/components/portal/auth'
import { parseAuthCallback } from '@/lib/portal/auth-callback'
import { logAuthDiagnostic } from '@/lib/portal/auth-diagnostics'
import { getPortalSupabase } from '@/lib/portal/supabase'

export const Route = createFileRoute('/auth/callback')({
  head: () => ({ meta: [{ title: 'Verifying your secure link | GUARDEMAR' }, { name: 'robots', content: 'noindex, nofollow' }] }),
  component: AuthCallbackPage,
})

/**
 * The single place that interprets a Supabase Auth email callback. It never guesses:
 * a session is only ever considered established once Supabase has explicitly confirmed
 * it (verifyOtp / exchangeCodeForSession / setSession all succeeded), and a link is only
 * ever declared invalid once Supabase has explicitly rejected it or the URL genuinely
 * carries no recognised callback. See src/lib/portal/auth-callback.ts for the shapes
 * this supports and why.
 */
function AuthCallbackPage() {
  const navigate = useNavigate()
  const [invalid, setInvalid] = useState(false)

  useEffect(() => {
    let active = true

    async function run() {
      const parsed = parseAuthCallback(window.location.href)

      if (parsed.kind === 'missing') {
        logAuthDiagnostic('CALLBACK_MISSING', new Error('No callback parameters were present on /auth/callback'), 'callback_parse')
        if (active) setInvalid(true)
        return
      }

      if (parsed.kind === 'unknown') {
        logAuthDiagnostic('UNKNOWN_CALLBACK_TYPE', new Error(parsed.reason), 'callback_parse')
        if (active) setInvalid(true)
        return
      }

      if (parsed.kind === 'error') {
        logAuthDiagnostic('CALLBACK_EXPIRED', new Error(`${parsed.code}: ${parsed.description}`), 'callback_error_param')
        if (active) setInvalid(true)
        return
      }

      try {
        const supabase = await getPortalSupabase()
        let type: 'invite' | 'recovery'

        if (parsed.kind === 'token_hash') {
          const { error } = await supabase.auth.verifyOtp({ token_hash: parsed.tokenHash, type: parsed.type })
          if (error) {
            logAuthDiagnostic('OTP_VERIFY_FAILED', error, 'verify_otp')
            if (active) setInvalid(true)
            return
          }
          type = parsed.type
        } else if (parsed.kind === 'code') {
          // A bare ?code= callback only occurs here for recovery: invitations are issued
          // server-side (no browser, no PKCE challenge) and never carry a code — see
          // auth-callback.ts for the SDK documentation confirming this.
          const { error } = await supabase.auth.exchangeCodeForSession(parsed.code)
          if (error) {
            logAuthDiagnostic('PKCE_EXCHANGE_FAILED', error, 'exchange_code')
            if (active) setInvalid(true)
            return
          }
          type = 'recovery'
        } else {
          const { error } = await supabase.auth.setSession({ access_token: parsed.accessToken, refresh_token: parsed.refreshToken })
          if (error) {
            logAuthDiagnostic('PKCE_EXCHANGE_FAILED', error, 'set_session')
            if (active) setInvalid(true)
            return
          }
          type = parsed.type
        }

        if (!active) return
        await navigate({ to: '/reset-password', search: { flow: type }, replace: true })
      } catch (error) {
        logAuthDiagnostic('OTP_VERIFY_FAILED', error, 'callback_unexpected')
        if (active) setInvalid(true)
      }
    }

    void run()
    return () => { active = false }
  }, [navigate])

  if (invalid) {
    return <PrivatePageFrame>
      <section className="auth-card" aria-labelledby="callback-invalid-title">
        <p className="private-eyebrow">Secure link verification</p>
        <h1 id="callback-invalid-title">This link is no longer valid</h1>
        <p>The link may have expired or already been used. Request a new secure link to continue.</p>
        <Link className="private-primary inline-action" to="/portal/forgot-password">Request a new reset link</Link>
        <Link className="quiet-link" to="/portal/login">Return to sign in</Link>
      </section>
    </PrivatePageFrame>
  }

  return <PrivatePageFrame>
    <div className="private-loading"><LoaderCircle className="spin" /><span>Verifying your secure link…</span></div>
  </PrivatePageFrame>
}
