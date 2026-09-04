import { Link, useNavigate } from '@tanstack/react-router'
import { ArrowRight, KeyRound, LoaderCircle, ShieldCheck } from 'lucide-react'
import { type FormEvent, type ReactNode, useEffect, useState } from 'react'

import { portalApi, PortalApiError } from '@/lib/portal/api'
import { canAccessPrivateArea, getPrivateHomePath, getPrivateLoginPath, type PrivateArea } from '@/lib/portal/access'
import { getPortalSupabase } from '@/lib/portal/supabase'
import type { PortalProfile } from '@/lib/portal/types'

type AuthDiagnosticCode = 'AUTH_CREDENTIAL_ERROR' | 'PROFILE_INITIALISATION_ERROR' | 'PORTAL_ACCESS_ERROR' | 'NAVIGATION_ERROR'

const portalOpenError = 'Your sign-in was successful, but your Guardemar portal access could not be opened. Please contact Guardemar.'

function logAuthDiagnostic(code: AuthDiagnosticCode, error: unknown, stage: string) {
  console.error('Portal sign-in failed', {
    code,
    stage,
    message: error instanceof Error ? error.message : 'Unknown error',
  })
}

const authCallbackParameters = [
  'access_token',
  'code',
  'error',
  'error_code',
  'error_description',
  'expires_at',
  'expires_in',
  'flow_id',
  'provider_token',
  'refresh_token',
  'token_type',
  'type',
]

function readAuthCallback() {
  const url = new URL(window.location.href)
  const hashParameters = new URLSearchParams(url.hash.replace(/^#/, ''))
  const getParameter = (name: string) => url.searchParams.get(name) ?? hashParameters.get(name)
  const error = getParameter('error') ?? getParameter('error_code') ?? getParameter('error_description')
  const hasCallback = Boolean(error || getParameter('code') || getParameter('access_token') || getParameter('type'))
  return { error, hasCallback }
}

function clearAuthCallbackParameters() {
  const url = new URL(window.location.href)
  for (const parameter of authCallbackParameters) url.searchParams.delete(parameter)
  const hashParameters = new URLSearchParams(url.hash.replace(/^#/, ''))
  const hasAuthHash = authCallbackParameters.some((parameter) => hashParameters.has(parameter))
  if (hasAuthHash) url.hash = ''
  window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`)
}

export function AuthCard({ area }: { area: PrivateArea }) {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let active = true
    async function continueAuthCallback() {
      const callback = readAuthCallback()
      if (callback.error) {
        clearAuthCallbackParameters()
        if (active) setError(area === 'admin'
          ? 'This invitation or sign-in link is invalid or has expired. Please contact Guardemar for a new invitation.'
          : 'This sign-in link is invalid or has expired. Please request a new password reset link.')
        return
      }
      try {
        const supabase = await getPortalSupabase()
        const { data, error: sessionError } = await supabase.auth.getSession()
        if (!active) return
        if (sessionError || !data.session) {
          if (callback.hasCallback) {
            clearAuthCallbackParameters()
            setError(area === 'admin'
              ? 'This invitation or sign-in link is invalid or has expired. Please contact Guardemar for a new invitation.'
              : 'This sign-in link is invalid or has expired. Please request a new password reset link.')
          }
          return
        }
        if (callback.hasCallback) clearAuthCallbackParameters()
        const { profile } = await portalApi<{ profile: PortalProfile }>('session/initialise', { method: 'POST' })
        await navigate({ to: getPrivateHomePath(profile.role), replace: true })
      } catch {
        if (callback.hasCallback && active) {
          clearAuthCallbackParameters()
          setError('This secure sign-in link could not be completed. Please try signing in again.')
        }
      }
    }
    void continueAuthCallback()
    return () => { active = false }
  }, [area, navigate])

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
      await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${origin}/reset-password` })
      setMessage('If an account exists for that address, a secure reset link has been sent.')
    } finally {
      setBusy(false)
    }
  }

  return <PrivatePageFrame><section className="auth-card"><p className="private-eyebrow">Secure account recovery</p><h1>Reset your password</h1><p>Enter the email address used for your Guardemar portal invitation.</p><form className="private-form" onSubmit={submit}><label>Email address<input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>{message && <p className="form-success" role="status">{message}</p>}<button className="private-primary" disabled={busy}>{busy ? 'Sending…' : 'Send reset link'}</button></form><Link className="quiet-link" to="/portal/login">Return to sign in</Link></section></PrivatePageFrame>
}

export function ResetPasswordCard() {
  const [password, setPassword] = useState('')
  const [recoveryState, setRecoveryState] = useState<'checking' | 'ready' | 'invalid' | 'complete'>('checking')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let active = true
    let unsubscribe: (() => void) | undefined

    async function initialiseRecovery() {
      const callback = readAuthCallback()
      if (callback.error || !callback.hasCallback) {
        if (callback.error) clearAuthCallbackParameters()
        if (active) setRecoveryState('invalid')
        return
      }

      try {
        const supabase = await getPortalSupabase()
        const { data: listener } = supabase.auth.onAuthStateChange((event) => {
          if (event === 'PASSWORD_RECOVERY' && active) {
            clearAuthCallbackParameters()
            setRecoveryState('ready')
          }
        })
        unsubscribe = () => listener.subscription.unsubscribe()

        const { data, error: sessionError } = await supabase.auth.getSession()
        if (!active) return
        if (sessionError || !data.session) {
          clearAuthCallbackParameters()
          setRecoveryState('invalid')
          return
        }
        clearAuthCallbackParameters()
        setRecoveryState('ready')
      } catch {
        if (active) {
          clearAuthCallbackParameters()
          setRecoveryState('invalid')
        }
      }
    }

    void initialiseRecovery()
    return () => {
      active = false
      unsubscribe?.()
    }
  }, [])

  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      const supabase = await getPortalSupabase()
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error
      await supabase.auth.signOut({ scope: 'local' })
      setPassword('')
      setRecoveryState('complete')
    } catch {
      setError('Your password could not be updated. The reset link may have expired; please request a new one.')
    } finally {
      setBusy(false)
    }
  }

  if (recoveryState === 'checking') return <PrivatePageFrame><div className="private-loading"><LoaderCircle className="spin" /><span>Checking your secure reset link…</span></div></PrivatePageFrame>

  if (recoveryState === 'invalid') return <PrivatePageFrame><section className="auth-card"><p className="private-eyebrow">Secure account recovery</p><h1>This reset link is no longer valid</h1><p>The link may have expired or already been used. Request a new secure link to continue.</p><Link className="private-primary inline-action" to="/portal/forgot-password">Request a new reset link</Link><Link className="quiet-link" to="/portal/login">Return to sign in</Link></section></PrivatePageFrame>

  if (recoveryState === 'complete') return <PrivatePageFrame><section className="auth-card"><p className="private-eyebrow">Password updated</p><h1>Your new password is ready</h1><p>Your recovery session has been closed. Sign in again with your new password.</p><Link className="private-primary inline-action" to="/portal/login">Client sign in</Link><Link className="quiet-link" to="/admin/login">Team sign in</Link></section></PrivatePageFrame>

  return <PrivatePageFrame><section className="auth-card"><p className="private-eyebrow">Secure account recovery</p><h1>Choose a new password</h1><form className="private-form" onSubmit={submit}><label>New password<input type="password" minLength={10} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>{error && <p className="form-error" role="alert">{error}</p>}<button className="private-primary" disabled={busy}>{busy ? 'Updating…' : 'Update password'}</button></form><Link className="quiet-link" to="/portal/login">Return to sign in</Link></section></PrivatePageFrame>
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
