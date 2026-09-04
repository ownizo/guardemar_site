import { HeadContent, Link, Outlet, Scripts, createRootRoute, useRouterState } from '@tanstack/react-router'
import { Menu, MessageCircle, X } from 'lucide-react'
import { useState } from 'react'

import { AnalyticsLink } from '@/components/site'
import { CookieConsent } from '@/components/cookie-consent'
import { business, legalEntity, navigation } from '@/config/site'
import { openCookieSettings } from '@/lib/consent'
import '../styles.css'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'GUARDEMAR | Private Property Care' },
      { name: 'theme-color', content: '#06275A' },
      { name: 'robots', content: 'index, follow, max-image-preview:large' },
      { property: 'og:site_name', content: 'GUARDEMAR' },
      { property: 'og:type', content: 'website' },
      { property: 'og:locale', content: 'en_GB' },
      { property: 'og:title', content: 'GUARDEMAR | Private Property Care' },
      { property: 'og:description', content: 'Home watch and private property care across the Western Algarve — from Carvoeiro to Sagres.' },
      { property: 'og:url', content: 'https://guardemar.com/' },
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:title', content: 'GUARDEMAR | Private Property Care' },
      { name: 'twitter:description', content: 'Here when you are away. Documented property inspections and trusted local coordination.' },
    ],
    links: [
      { rel: 'icon', href: '/favicon.ico', type: 'image/x-icon' },
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
          <img src="/guardemar-logo.svg" alt="GUARDEMAR — Private Property Care" width="180" height="42" />
        </Link>
        <nav className={open ? 'main-nav open' : 'main-nav'} aria-label="Primary navigation">
          {navigation.map((item) => <a key={item.href} href={item.href} onClick={() => setOpen(false)}>{item.label}</a>)}
          <Link to="/portal/login" className="client-login-link" onClick={() => setOpen(false)}>Client Login</Link>
          <Link to="/contact" className="nav-cta" onClick={() => setOpen(false)}>Request an Assessment</Link>
        </nav>
        <div className="mobile-actions">
          <AnalyticsLink href={business.whatsapp} event="whatsapp_click" aria-label="Message Guardemar on WhatsApp"><MessageCircle size={20} /></AnalyticsLink>
          <button className="menu-button" onClick={() => setOpen(!open)} aria-expanded={open} aria-label="Toggle menu">{open ? <X /> : <Menu />}</button>
        </div>
      </div>
    </header>
  )
}

function Footer() {
  return (
    <footer className="site-footer">
      <div className="shell footer-grid">
        <div><p className="footer-mark">GUARDEMAR</p><p>Private Property Care</p><p className="footer-tagline">Here when you&apos;re away.</p></div>
        <div><h2>Explore</h2>{navigation.slice(0, 7).map((item) => <a key={item.href} href={item.href}>{item.label}</a>)}<Link to="/portal/login">Client Login</Link></div>
        <div><h2>Service area</h2><p>Western Algarve<br />from Carvoeiro to Sagres.</p><Link to="/areas">View all areas</Link></div>
        <div><h2>Contact</h2><AnalyticsLink href={business.phoneHref} event="phone_click">{business.phone}</AnalyticsLink><AnalyticsLink href={business.emailHref} event="email_click">{business.email}</AnalyticsLink><p>{business.addressLines.join(', ')}</p></div>
      </div>
      <div className="shell footer-identity">GUARDEMAR is a commercial brand of {legalEntity.legalName} · NIPC {legalEntity.taxId}</div>
      <div className="shell footer-bottom"><span>© {new Date().getFullYear()} Guardemar</span><div><Link to="/privacy-policy">Privacy Policy</Link><Link to="/terms">Terms &amp; Conditions</Link><Link to="/cookie-policy">Cookie Policy</Link><button type="button" className="footer-cookie-button" onClick={openCookieSettings}>Cookie Settings</button></div></div>
    </footer>
  )
}

function RootDocument({ children }: { children: React.ReactNode }) {
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const isPrivateArea = pathname.startsWith('/portal') || pathname.startsWith('/admin') || pathname.startsWith('/reset-password')
  return <html lang="en-GB"><head><HeadContent /></head><body>{isPrivateArea ? <main id="main">{children}</main> : <><a className="skip-link" href="#main">Skip to content</a><Header /><main id="main">{children}</main><Footer /><CookieConsent /></>}<Scripts /></body></html>
}

function NotFound() {
  return <div className="not-found shell"><p className="eyebrow">404</p><h1>This page is away.</h1><p>The property care information you need may have moved.</p><Link to="/" className="button primary">Return home</Link></div>
}
