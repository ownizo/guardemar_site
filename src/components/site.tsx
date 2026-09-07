import { Link } from '@tanstack/react-router'
import { ArrowRight, CalendarClock, Camera, CircleAlert, ClipboardCheck, Clock3, Home, KeyRound, LockKeyhole, MessageCircle } from 'lucide-react'
import type { ReactNode } from 'react'

import { business, faqs, founder } from '@/config/site'
import { type AnalyticsEvent, trackEvent } from '@/lib/analytics'

export function AnalyticsLink({ href, event, children, className, ...props }: { href: string; event: AnalyticsEvent; children: ReactNode; className?: string; 'aria-label'?: string }) {
  return <a href={href} className={className} onClick={() => trackEvent(event)} {...props}>{children}</a>
}

export function ButtonLink({ to, href, children, variant = 'primary', event }: { to?: string; href?: string; children: ReactNode; variant?: 'primary' | 'outline' | 'text' | 'light'; event?: AnalyticsEvent }) {
  const className = `button ${variant}`
  if (href) return <AnalyticsLink href={href} className={className} event={event ?? 'whatsapp_click'}>{children}</AnalyticsLink>
  return <Link to={to ?? '/contact/'} className={className} onClick={() => event && trackEvent(event)}>{children}</Link>
}

export function SectionHeading({ eyebrow, title }: { eyebrow: string; title: string }) { return <div className="section-heading"><p className="eyebrow">{eyebrow}</p><h2>{title}</h2></div> }

export function PageIntro({ eyebrow, title, text, light = false }: { eyebrow: string; title: string; text: string; light?: boolean }) { return <div className={`page-intro ${light ? 'light' : ''}`}><p className="eyebrow">{eyebrow}</p><h2>{title}</h2><p>{text}</p></div> }

export function PageHero({ eyebrow, title, text, aside }: { eyebrow: string; title: string; text: string; aside?: string }) {
  return <section className="page-hero"><div className="shell page-hero-grid"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p>{text}</p><div className="button-row"><ButtonLink to="/contact/" event="assessment_form_start">Request an Assessment</ButtonLink><ButtonLink href={business.whatsapp} variant="text">Message Guardemar <ArrowRight size={16} /></ButtonLink></div></div>{aside && <div className="page-hero-aside"><span>GUARDEMAR</span><p>{aside}</p></div>}</div></section>
}

export function Breadcrumbs({ items }: { items: Array<{ label: string; to?: string }> }) { const schema={'@context':'https://schema.org','@type':'BreadcrumbList',itemListElement:items.map((item,index)=>({'@type':'ListItem',position:index+1,name:item.label,item:item.to?`https://guardemar.com${item.to}`:undefined}))};return <><script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(schema)}}/><nav className="breadcrumbs shell" aria-label="Breadcrumb">{items.map((item, index) => <span key={item.label}>{item.to ? <Link to={item.to}>{item.label}</Link> : item.label}{index < items.length - 1 && ' / '}</span>)}</nav></> }

export function AssessmentCta({ title = 'Know exactly how your Algarve home is.' }: { title?: string }) { return <section className="assessment-cta"><div className="shell"><p className="eyebrow">First property assessment</p><h2>{title}</h2><p>Tell us about your property and the level of care you need. We&apos;ll arrange a practical first conversation.</p><div className="button-row"><ButtonLink to="/contact/" variant="light" event="assessment_form_start">Request a Property Assessment</ButtonLink><ButtonLink href={business.whatsapp} variant="text">WhatsApp Us <ArrowRight size={16} /></ButtonLink></div></div></section> }

export function ReportPreview() { return <div className="report-card"><div className="report-top"><div><span>GUARDEMAR</span><strong>Property Visit Report</strong></div><span className="status-good">Good</span></div><div className="report-property"><div><span>Location</span><strong>Lagos · Villa</strong></div><div><span>Inspection</span><strong>04 September 2026 · 10:12</strong></div></div><div className="report-meta"><span><Clock3 size={14} /> Scheduled inspection</span><span><Camera size={14} /> 17 photographs</span></div><div className="report-row"><span>Security & access</span><strong className="status-good">Good</strong></div><div className="report-row"><span>Water & plumbing</span><strong className="status-attention">Attention</strong></div><div className="report-row"><span>Humidity</span><strong>61%</strong></div><div className="report-row"><span>Electrical</span><strong className="status-good">Good</strong></div><div className="report-row"><span>Pool</span><strong className="status-good">Good</strong></div><div className="report-row"><span>Garden</span><strong className="status-attention">Attention</strong></div><div className="report-observation"><CircleAlert size={18} /><div><strong>Observation</strong><p>Minor moisture detected beneath kitchen sink.</p><strong>Recommended action</strong><p>Owner informed. Plumbing inspection recommended.</p></div></div><div className="report-images" aria-label="Example report photographs"><span /><span /><span /></div></div> }

export function AuthorCard({ compact = false, showPhoto = false }: { compact?: boolean; showPhoto?: boolean }) { return <aside className={`author-card ${compact ? 'compact' : ''}`}>{showPhoto ? <img className="author-photo" src="/hugo-goncalves.webp" alt="Hugo Gonçalves, founder of Guardemar" width="792" height="1056" loading="lazy" /> : <div className="author-monogram" aria-hidden="true">HG</div>}<div><p className="eyebrow">Written by</p><h2>{founder.name}</h2><strong>{founder.role}</strong><p>{founder.shortBio}</p><a href="/about/hugo-goncalves/">Read about Hugo <ArrowRight size={15} /></a></div></aside> }

export function FAQSection({ limit, items = faqs }: { limit?: number; items?: ReadonlyArray<readonly [string, string]> }) { const visible = limit ? items.slice(0, limit) : items; const schema={'@context':'https://schema.org','@type':'FAQPage',mainEntity:visible.map(([question,answer])=>({'@type':'Question',name:question,acceptedAnswer:{'@type':'Answer',text:answer}}))};return <section className="section shell"><script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(schema)}}/><PageIntro eyebrow="Frequently asked questions" title="Clear answers before you hand over the keys." text="If your property or arrangements are unusual, talk to us. The service is designed around the home." /><div className="faq-list">{visible.map(([question, answer]) => <details key={question}><summary>{question}<span>+</span></summary><p>{answer}</p></details>)}</div></section> }

const trustItems = [
  { icon: ClipboardCheck, title: 'Documented property checks', text: 'Every scheduled visit is followed by a structured report, with photographs where applicable, so the recorded condition of the property is always current.' },
  { icon: KeyRound, title: 'Controlled keyholding', text: 'Keys are coded rather than labelled with a full address, stored securely and accessed only for authorised service purposes, with each use recorded.' },
  { icon: MessageCircle, title: 'Clear issue escalation', text: 'When something requiring attention is identified, the owner is informed and next steps are coordinated according to the agreed service arrangements.' },
  { icon: LockKeyhole, title: 'Data protection', text: 'Property, contact and access information is limited to the service purpose, handled under GDPR principles and shared only where authorised or legally required.' },
] as const

export function TrustSection() { return <section className="section trust-section"><div className="shell"><PageIntro eyebrow="Trust and access" title="Clear controls around your home and information." text="Property care depends on disciplined access, documented handling and clear communication whenever something needs attention." /><div className="trust-detail-grid">{trustItems.map(({ icon: Icon, title, text }) => <article key={title}><Icon size={22}/><h3>{title}</h3><p>{text}</p></article>)}</div></div></section> }

const differenceItems = [
  { icon: Home, title: 'Property-first, not booking-first', text: 'Traditional holiday-rental management is organised around guests, turnovers and reviews. Guardemar is organised around the property itself — its condition, access, maintenance needs and readiness while the owner is elsewhere.' },
  { icon: ClipboardCheck, title: 'A continuous record, not a single snapshot', text: 'Every visit adds to a documented history of the property, making a genuine change in condition easy to distinguish from how the home ordinarily looks.' },
  { icon: CalendarClock, title: 'Built for absence, not occupancy', text: 'The service is designed around the weeks or months a property stands empty between stays, not the nights it happens to be occupied.' },
] as const

export function PropertyFocusSection() { return <section className="section shell property-focus"><PageIntro eyebrow="A different starting point" title="Designed around the property, not the booking." text="Traditional property management often focuses on guests and bookings. Guardemar focuses on the property itself." /><div className="difference-grid">{differenceItems.map(({ icon: Icon, title, text }) => <article key={title}><Icon size={22}/><h3>{title}</h3><p>{text}</p></article>)}</div></section> }

export function ContentSection({ title, children }: { title: string; children: ReactNode }) { return <section className="content-block"><h2>{title}</h2>{children}</section> }
