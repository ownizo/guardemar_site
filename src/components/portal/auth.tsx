import { Link, useNavigate } from '@tanstack/react-router'
import { ArrowRight, KeyRound, LoaderCircle, ShieldCheck } from 'lucide-react'
import { type FormEvent, type ReactNode, useEffect, useState } from 'react'

import { portalApi, PortalApiError } from '@/lib/portal/api'
import { getPortalSupabase } from '@/lib/portal/supabase'
import type { ApplicationRole, PortalProfile } from '@/lib/portal/types'

export function AuthCard({ area }: { area: 'portal' | 'admin' }) {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      const supabase = await getPortalSupabase()
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password })
      if (authError) throw authError
      await portalApi('session/initialise', { method: 'POST' })
      await navigate({ to: area === 'admin' ? '/admin' : '/portal' })
    } catch {
      setError('The email or password was not recognised.')
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
      await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` })
      setMessage('If an account exists for that address, a secure reset link has been sent.')
    } finally {
      setBusy(false)
    }
  }

  return <PrivatePageFrame><section className="auth-card"><p className="private-eyebrow">Secure account recovery</p><h1>Reset your password</h1><p>Enter the email address used for your Guardemar portal invitation.</p><form className="private-form" onSubmit={submit}><label>Email address<input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>{message && <p className="form-success" role="status">{message}</p>}<button className="private-primary" disabled={busy}>{busy ? 'Sending…' : 'Send reset link'}</button></form><Link className="quiet-link" to="/portal/login">Return to sign in</Link></section></PrivatePageFrame>
}

export function ResetPasswordCard() {
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    try {
      const supabase = await getPortalSupabase()
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error
      setMessage('Your password has been updated. You can now sign in.')
    } catch {
      setMessage('The reset link is invalid or has expired. Please request a new one.')
    } finally {
      setBusy(false)
    }
  }

  return <PrivatePageFrame><section className="auth-card"><p className="private-eyebrow">Secure account recovery</p><h1>Choose a new password</h1><form className="private-form" onSubmit={submit}><label>New password<input type="password" minLength={10} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>{message && <p className="form-success" role="status">{message}</p>}<button className="private-primary" disabled={busy}>{busy ? 'Updating…' : 'Update password'}</button></form><Link className="quiet-link" to="/portal/login">Return to sign in</Link></section></PrivatePageFrame>
}

export function PrivateGuard({ roles, loginPath, children }: { roles: ApplicationRole[]; loginPath: '/portal/login' | '/admin/login'; children: (profile: PortalProfile) => ReactNode }) {
  const navigate = useNavigate()
  const [profile, setProfile] = useState<PortalProfile | null>(null)
  const [error, setError] = useState('')

  const roleKey = roles.join(',')
  useEffect(() => {
    let active = true
    async function load() {
      try {
        const supabase = await getPortalSupabase()
        const { data } = await supabase.auth.getSession()
        if (!data.session) {
          await navigate({ to: loginPath })
          return
        }
        await portalApi('session/initialise', { method: 'POST' })
        const result = await portalApi<{ profile: PortalProfile }>('session')
        if (!roleKey.split(',').includes(result.profile.role)) {
          setError('You do not have permission to access this area.')
          return
        }
        if (active) setProfile(result.profile)
      } catch (loadError) {
        if (loadError instanceof PortalApiError && loadError.status === 401) await navigate({ to: loginPath })
        else if (active) setError('The portal is temporarily unavailable. Please try again.')
      }
    }
    void load()
    return () => { active = false }
  }, [loginPath, navigate, roleKey])

  if (error) return <PrivatePageFrame><section className="auth-card"><p className="private-eyebrow">Access restricted</p><h1>Unable to open this area</h1><p>{error}</p><Link className="private-primary inline-action" to="/portal">Return to the client portal</Link></section></PrivatePageFrame>
  if (!profile) return <PrivatePageFrame><div className="private-loading"><LoaderCircle className="spin" /><span>Opening your secure portal…</span></div></PrivatePageFrame>
  return children(profile)
}

export function PrivatePageFrame({ children }: { children: ReactNode }) {
  return <div className="private-auth-page"><Link to="/" className="private-logo" aria-label="Guardemar home"><img src="/guardemar-logo.svg" alt="GUARDEMAR — Private Property Care" /></Link>{children}</div>
}
