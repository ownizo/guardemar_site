import { Link, useNavigate } from '@tanstack/react-router'
import { Building2, Home, LayoutDashboard, LogOut, Menu, UserRound, Users, X } from 'lucide-react'
import { type ReactNode, useState } from 'react'

import { getPortalSupabase } from '@/lib/portal/supabase'
import type { PortalProfile } from '@/lib/portal/types'

const portalLinks = [
  { to: '/portal' as const, label: 'Overview', icon: LayoutDashboard },
  { to: '/portal/properties' as const, label: 'Properties', icon: Home },
  { to: '/portal/account' as const, label: 'Account', icon: UserRound },
]

const adminLinks = [
  { to: '/admin' as const, label: 'Dashboard', icon: LayoutDashboard },
  { to: '/admin/clients' as const, label: 'Clients', icon: Users },
  { to: '/admin/properties' as const, label: 'Properties', icon: Building2 },
]

export function PrivateShell({ area, profile, title, eyebrow, children, action }: { area: 'portal' | 'admin'; profile: PortalProfile; title: string; eyebrow?: string; children: ReactNode; action?: ReactNode }) {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const links = area === 'admin' ? adminLinks : portalLinks
  const displayName = [profile.firstName, profile.lastName].filter(Boolean).join(' ') || (area === 'admin' ? 'Guardemar team' : 'Guardemar client')

  async function logout() {
    const supabase = await getPortalSupabase()
    await supabase.auth.signOut()
    await navigate({ to: area === 'admin' ? '/admin/login' : '/portal/login' })
  }

  return <div className="private-app">
    <aside className={open ? 'private-sidebar open' : 'private-sidebar'}>
      <div className="private-sidebar-head"><Link to="/" className="private-app-logo"><img src="/guardemar-logo.svg" alt="GUARDEMAR" /></Link><button className="private-close" onClick={() => setOpen(false)} aria-label="Close navigation"><X /></button></div>
      <div className="private-area-label">{area === 'admin' ? 'Operations' : 'Client portal'}</div>
      <nav aria-label={area === 'admin' ? 'Backoffice navigation' : 'Portal navigation'}>
        {links.map(({ to, label, icon: Icon }) => <Link key={to} to={to} onClick={() => setOpen(false)} activeProps={{ className: 'active' }}><Icon aria-hidden="true" />{label}</Link>)}
      </nav>
      <div className="private-user"><span>{displayName}</span><small>{profile.role}</small><button onClick={logout}><LogOut aria-hidden="true" />Log out</button></div>
    </aside>
    {open && <button className="private-scrim" onClick={() => setOpen(false)} aria-label="Close navigation" />}
    <div className="private-main">
      <header className="private-topbar"><button className="private-menu" onClick={() => setOpen(true)} aria-label="Open navigation"><Menu /></button><span>GUARDEMAR</span><span className="private-topbar-area">{area === 'admin' ? 'Operations' : 'Private Property Care'}</span></header>
      <main className="private-content" id="private-main">
        <div className="private-page-heading"><div>{eyebrow && <p className="private-eyebrow">{eyebrow}</p>}<h1>{title}</h1></div>{action}</div>
        {children}
      </main>
    </div>
  </div>
}

export function EmptyState({ title, children }: { title: string; children: ReactNode }) {
  return <div className="private-empty"><Home aria-hidden="true" /><h2>{title}</h2><p>{children}</p></div>
}
