import { Link, useNavigate } from '@tanstack/react-router'
import { ArrowRight, KeyRound, LoaderCircle, ShieldCheck } from 'lucide-react'
import { type FormEvent, type ReactNode, useEffect, useState } from 'react'

import { logAuthDiagnostic } from '@/lib/portal/auth-diagnostics'
import { portalApi, PortalApiError } from '@/lib/portal/api'
import { canAccessPrivateArea, getPrivateHomePath, getPrivateLoginPath, type PrivateArea } from '@/lib/portal/access'
import { getPortalSupabase } from '@/lib/portal/supabase'
import type { PortalProfile } from '@/lib/portal/types'

const portalOpenError = 'Your sign-in was successful, but your Guardemar portal access could not be opened. Please contact Guardemar.'

export function AuthCard({ area }: { area: PrivateArea }) {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError('')

    let supabase: Awaited<ReturnType<typeof getPortalSupabase>>
    try {
      supabase = await getPortalSupabase()
    } catch (configurationError) {
      logAuthDiagnostic('PORTAL_ACCESS_ERROR', configurationError, 'auth_client')
      setError('The Guardemar portal is temporarily unavailable. Please try again.')
      setBusy(false)
      return
    }

    try {
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password })
      if (authError) {
        logAuthDiagnostic('AUTH_CREDENTIAL_ERROR', authError, 'credentials')
        setError('The email or password was not recognised.')
        setBusy(false)
        return
      }
    } catch (authError) {
      logAuthDiagnostic('AUTH_CREDENTIAL_ERROR', authError, 'credentials')
      setError('The email or password was not recognised.')
      setBusy(false)
      return
    }

    let profile: PortalProfile
    try {
      const result = await portalApi<{ profile: PortalProfile }>('session/initialise', { method: 'POST' })
      profile = result.profile
    } catch (initialisationError) {
      logAuthDiagnostic('PROFILE_INITIALISATION_ERROR', initialisationError, 'session_initialise')
      setError(portalOpenError)
      setBusy(false)
      return
    }

    if (!canAccessPrivateArea(profile.role, area)) {
      logAuthDiagnostic('PORTAL_ACCESS_ERROR', new Error(`Role ${profile.role} cannot access ${area}`), 'portal_access')
      setError(portalOpenError)
      setBusy(false)
      return
    }

    try {
      await navigate({ to: getPrivateHomePath(profile.role), replace: true })
    } catch (navigationError) {
      logAuthDiagnostic('NAVIGATION_ERROR', navigationError, 'navigation')
      setError(portalOpenError)
    } finally {
      setBusy(false)
    }
  }

  return <PrivatePageFrame>
    <section className="auth-card" aria-labelledby="login-title">
      <div className="auth-emblem"><ShieldCheck aria-hidden="true" /></div>
      <p className="private-eyebrow">GUARDEMAR · Private Property Care</p>
      <h1 id="login-title">{area === 'admin' ? 'Team sign in' : 'Client sign in'}</h1>
      <p>Secure access to private property information and Guardemar services.</p>
      <form onSubmit={submit} className="private-form">
        <label>Email address<input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
        <label>Password<input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="private-primary" disabled={busy}>{busy ? <><LoaderCircle className="spin" /> Signing in…</> : <>Sign in <ArrowRight /></>}</button>
      </form>
      <Link className="quiet-link" to="/portal/forgot-password">Forgotten your password?</Link>
      <p className="auth-footnote"><KeyRound aria-hidden="true" /> Access is by invitation only.</p>
    </section>
  </PrivatePageFrame>
}

export function ForgotPasswordCard() {
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    try {
      const supabase = await getPortalSupabase()
      const origin = window.location.origin
      await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${origin}/auth/callback` })
      setMessage('If an account exists for that address, a secure reset link has been sent.')
    } finally {
      setBusy(false)
    }
  }

  return <PrivatePageFrame><section className="auth-card"><p className="private-eyebrow">Secure account recovery</p><h1>Reset your password</h1><p>Enter the email address used for your Guardemar portal invitation.</p><form className="private-form" onSubmit={submit}><label>Email address<input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>{message && <p className="form-success" role="status">{message}</p>}<button className="private-primary" disabled={busy}>{busy ? 'Sending…' : 'Send reset link'}</button></form><Link className="quiet-link" to="/portal/login">Return to sign in</Link></section></PrivatePageFrame>
}

/**
 * Renders once /auth/callback has already established a session (invitation or
 * recovery) and redirected here. This component never interprets a Supabase callback
 * itself — it only ever checks whether a session already exists (which /auth/callback
 * guarantees before it navigates here) and, for `flow=invite`, completes portal
 * onboarding after the password is set. See src/routes/auth.callback.tsx.
 */
export function ResetPasswordCard() {
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [recoveryState, setRecoveryState] = useState<'checking' | 'ready' | 'invalid' | 'complete'>('checking')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const flow: 'invite' | 'recovery' = new URLSearchParams(window.location.search).get('flow') === 'invite' ? 'invite' : 'recovery'

  useEffect(() => {
    let active = true
    async function checkSession() {
      try {
        const supabase = await getPortalSupabase()
        const { data, error: sessionError } = await supabase.auth.getSession()
        if (!active) return
        setRecoveryState(sessionError || !data.session ? 'invalid' : 'ready')
      } catch {
        if (active) setRecoveryState('invalid')
      }
    }
    void checkSession()
    return () => { active = false }
  }, [])

  async function submit(event: FormEvent) {
    event.preventDefault()
    setError('')
    if (password !== confirmPassword) {
      setError('The passwords do not match.')
      return
    }
    setBusy(true)
    try {
      const supabase = await getPortalSupabase()
      const { error: updateError } = await supabase.auth.updateUser({ password })
      if (updateError) {
        logAuthDiagnostic('PASSWORD_UPDATE_FAILED', updateError, 'update_user')
        setError('Your password could not be updated. The link may have expired; please request a new one.')
        setBusy(false)
        return
      }

      if (flow === 'invite') {
        let profile: PortalProfile
        try {
          const result = await portalApi<{ profile: PortalProfile }>('session/initialise', { method: 'POST' })
          profile = result.profile
        } catch (initialisationError) {
          logAuthDiagnostic('PROFILE_INITIALISATION_FAILED', initialisationError, 'session_initialise')
          setError('Your password was set, but your Guardemar portal access could not be opened. Please contact Guardemar.')
          setBusy(false)
          return
        }
        if (!canAccessPrivateArea(profile.role, 'portal')) {
          logAuthDiagnostic('ROLE_ACCESS_FAILED', new Error(`Role ${profile.role} cannot access portal`), 'role_access')
          setError('Your password was set, but your Guardemar portal access could not be opened. Please contact Guardemar.')
          setBusy(false)
          return
        }
        try {
          await navigate({ to: getPrivateHomePath(profile.role), replace: true })
        } catch (navigationError) {
          logAuthDiagnostic('NAVIGATION_ERROR', navigationError, 'navigation')
          setError('Your password was set. Please sign in to continue.')
        } finally {
          setBusy(false)
        }
        return
      }

      await supabase.auth.signOut({ scope: 'local' })
      setPassword('')
      setConfirmPassword('')
      setRecoveryState('complete')
      setBusy(false)
    } catch (updateError) {
      logAuthDiagnostic('PASSWORD_UPDATE_FAILED', updateError, 'update_user')
      setError('Your password could not be updated. The link may have expired; please request a new one.')
      setBusy(false)
    }
  }

  if (recoveryState === 'checking') return <PrivatePageFrame><div className="private-loading"><LoaderCircle className="spin" /><span>Checking your secure link…</span></div></PrivatePageFrame>

  if (recoveryState === 'invalid') return <PrivatePageFrame><section className="auth-card"><p className="private-eyebrow">Secure account recovery</p><h1>This link is no longer valid</h1><p>The link may have expired or already been used. Request a new secure link to continue.</p><Link className="private-primary inline-action" to="/portal/forgot-password">Request a new reset link</Link><Link className="quiet-link" to="/portal/login">Return to sign in</Link></section></PrivatePageFrame>

  if (recoveryState === 'complete') return <PrivatePageFrame><section className="auth-card"><p className="private-eyebrow">Password updated</p><h1>Your new password is ready</h1><p>Your recovery session has been closed. Sign in again with your new password.</p><Link className="private-primary inline-action" to="/portal/login">Client sign in</Link><Link className="quiet-link" to="/admin/login">Team sign in</Link></section></PrivatePageFrame>

  const eyebrow = flow === 'invite' ? 'Activate your Guardemar access' : 'Secure account recovery'
  const title = flow === 'invite' ? 'Set up your Guardemar access' : 'Choose a new password'
  const intro = flow === 'invite' ? 'Choose a password to finish setting up your Guardemar client portal account.' : 'Choose a new password for your Guardemar client portal account.'
  const submitLabel = flow === 'invite' ? 'Set up access' : 'Update password'
  const busyLabel = flow === 'invite' ? 'Setting up access…' : 'Updating…'

  return <PrivatePageFrame><section className="auth-card"><p className="private-eyebrow">{eyebrow}</p><h1>{title}</h1><p>{intro}</p><form className="private-form" onSubmit={submit}><label>New password<input type="password" minLength={10} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label><label>Confirm new password<input type="password" minLength={10} autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required /></label>{error && <p className="form-error" role="alert">{error}</p>}<button className="private-primary" disabled={busy}>{busy ? busyLabel : submitLabel}</button></form><Link className="quiet-link" to="/portal/login">Return to sign in</Link></section></PrivatePageFrame>
}

export function PrivateGuard({ area, children }: { area: PrivateArea; children: (profile: PortalProfile) => ReactNode }) {
  const navigate = useNavigate()
  const [profile, setProfile] = useState<PortalProfile | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    async function load() {
      try {
        const supabase = await getPortalSupabase()
        const { data } = await supabase.auth.getSession()
        if (!data.session) {
          await navigate({ to: getPrivateLoginPath(area), replace: true })
          return
        }
        await portalApi('session/initialise', { method: 'POST' })
        const result = await portalApi<{ profile: PortalProfile }>('session')
        if (!canAccessPrivateArea(result.profile.role, area)) {
          await navigate({ to: getPrivateHomePath(result.profile.role), replace: true })
          return
        }
        if (active) setProfile(result.profile)
      } catch (loadError) {
        if (loadError instanceof PortalApiError && loadError.status === 401) await navigate({ to: getPrivateLoginPath(area), replace: true })
        else if (active) setError('The portal is temporarily unavailable. Please try again.')
      }
    }
    void load()
    return () => { active = false }
  }, [area, navigate])

  if (error) return <PrivatePageFrame><section className="auth-card"><p className="private-eyebrow">Private access</p><h1>Unable to open this area</h1><p>{error}</p><Link className="private-primary inline-action" to={getPrivateLoginPath(area)}>Return to sign in</Link></section></PrivatePageFrame>
  if (!profile) return <PrivatePageFrame><div className="private-loading"><LoaderCircle className="spin" /><span>Opening your secure portal…</span></div></PrivatePageFrame>
  return children(profile)
}

export function PrivatePageFrame({ children }: { children: ReactNode }) {
  return <div className="private-auth-page"><Link to="/" className="private-logo" aria-label="Guardemar home"><img src="/guardemar-logo.svg" alt="GUARDEMAR — Private Property Care" /></Link>{children}</div>
}
