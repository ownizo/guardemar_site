import { HeadContent, Link, Outlet, Scripts, createRootRoute, useRouterState } from '@tanstack/react-router'
import { Menu, X } from 'lucide-react'
import { useState } from 'react'

import { AnalyticsLink } from '@/components/site'
import { CookieConsent } from '@/components/cookie-consent'
import { GoogleAnalytics } from '@/components/google-analytics'
import { SiteVisitCounter } from '@/components/site-visit-counter'
import { WhatsAppButton } from '@/components/whatsapp-button'
import { business, footerLinks, legalEntity, navigation, socialProfiles } from '@/config/site'
import { openCookieSettings } from '@/lib/consent'
import '../styles.css'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'Guardemar | Second-home care, Western Algarve' },
      { name: 'theme-color', content: '#18252A' },
      { property: 'og:site_name', content: 'GUARDEMAR' },
      { property: 'og:locale', content: 'en_GB' },
    ],
    links: [
      { rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml' },
      { rel: 'icon', href: '/favicon.ico', sizes: '32x32' },
      { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
      { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossOrigin: 'anonymous' },
      { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=Manrope:wght@400;500;600;700&display=swap' },
    ],
    scripts: [{ type: 'application/ld+json', children: JSON.stringify(business.schema) }],
  }),
  notFoundComponent: NotFound,
  shellComponent: RootDocument,
  component: () => <Outlet />,
})

function Header() {
  const [open, setOpen] = useState(false)
  return (
    <header className="site-header">
      <div className="shell header-inner">
        <Link to="/" className="wordmark" aria-label="Guardemar home">
          <img src="/guardemar-wordmark-light.svg" alt="GUARDEMAR — second-home management, Western Algarve" width="200" height="21" />
        </Link>
        <nav className={open ? 'main-nav open' : 'main-nav'} aria-label="Primary navigation">
          {navigation.map((item) => <a key={item.href} href={item.href} onClick={() => setOpen(false)}>{item.label}</a>)}
          <Link to="/portal/login" className="client-login-link" onClick={() => setOpen(false)}>Client Login</Link>
          <a href="/contact/" className="nav-cta" onClick={() => setOpen(false)}>Request an Assessment</a>
        </nav>
        <div className="mobile-actions">
          <button className="menu-button" onClick={() => setOpen(!open)} aria-expanded={open} aria-label="Toggle menu">{open ? <X /> : <Menu />}</button>
        </div>
      </div>
    </header>
  )
}

const socialIcons: Record<string, React.ReactNode> = {
  facebook: <path d="M14 8.5V6.8c0-.8.5-1.3 1.4-1.3H17V2.3c-.3 0-1.4-.1-2.6-.1-2.6 0-4.3 1.6-4.3 4.4v1.9H7.3v3.4h2.8V22H14V11.9h2.8l.4-3.4H14Z" fill="currentColor" />,
  instagram: <><rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="currentColor" strokeWidth="1.8" /><circle cx="12" cy="12" r="4.2" fill="none" stroke="currentColor" strokeWidth="1.8" /><circle cx="17.4" cy="6.6" r="1.2" fill="currentColor" /></>,
  linkedin: <path d="M4.6 8.6h3.6V20H4.6V8.6ZM6.4 3a2.1 2.1 0 1 1 0 4.2 2.1 2.1 0 0 1 0-4.2Zm4 5.6h3.4v1.6h.1c.5-.9 1.6-1.9 3.4-1.9 3.6 0 4.3 2.4 4.3 5.5V20h-3.6v-5.6c0-1.3 0-3-1.9-3s-2.1 1.4-2.1 2.9V20h-3.6V8.6Z" fill="currentColor" />,
}

function SocialLinks() {
  return (
    <div className="footer-social" aria-label="Guardemar on social media">
      {socialProfiles.map((profile) => (
        <a key={profile.network} href={profile.href} target="_blank" rel="noopener noreferrer" aria-label={`Guardemar on ${profile.label}`} title={profile.label}>
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">{socialIcons[profile.network]}</svg>
        </a>
      ))}
    </div>
  )
}

function Footer() {
  return (
    <footer className="site-footer">
      <div className="shell footer-grid">
        <div><img className="footer-logo" src="/guardemar-logo-light.svg" alt="GUARDEMAR — Private Property Care" width="240" height="38" /><p>Second-home management</p><p className="footer-tagline">Here when you&apos;re away.</p><p>Western Algarve, Carvoeiro to Sagres.</p><SocialLinks /></div>
        <div><h2>Explore</h2>{footerLinks.map((item) => <a key={item.href} href={item.href}>{item.label}</a>)}<Link to="/portal/login">Client Login</Link></div>
        <div><h2>Service area</h2><p>Western Algarve<br />from Carvoeiro to Sagres.</p><a href="/areas/">View all areas</a></div>
        <div><h2>Contact</h2><AnalyticsLink href={business.phoneHref} event="phone_click">{business.phone}</AnalyticsLink><AnalyticsLink href={business.emailHref} event="email_click">{business.email}</AnalyticsLink><p>{business.addressLines.join(', ')}</p></div>
      </div>
      <div className="shell footer-identity">GUARDEMAR is a commercial brand of {legalEntity.legalName} · NIPC {legalEntity.taxId}</div>
      <div className="shell footer-bottom"><span>© {new Date().getFullYear()} Guardemar</span><div><a href="/privacy-policy/">Privacy Policy</a><a href="/terms/">Terms &amp; Conditions</a><a href="/cookie-policy/">Cookie Policy</a><button type="button" className="footer-cookie-button" onClick={openCookieSettings}>Cookie Settings</button></div></div>
    </footer>
  )
}

function RootDocument({ children }: { children: React.ReactNode }) {
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const isPrivateArea = pathname.startsWith('/portal') || pathname.startsWith('/admin') || pathname.startsWith('/reset-password')
  return <html lang="en-GB"><head><HeadContent /></head><body>{isPrivateArea ? <main id="main">{children}</main> : <><a className="skip-link" href="#main">Skip to content</a><Header /><main id="main">{children}</main><Footer /><CookieConsent /><WhatsAppButton /><GoogleAnalytics /><SiteVisitCounter /></>}<Scripts /></body></html>
}

function NotFound() {
  return <div className="not-found shell"><p className="eyebrow">404</p><h1>This page is away.</h1><p>The page you need may have moved.</p><Link to="/" className="button primary">Return home</Link></div>
}
