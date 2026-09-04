import { Link } from '@tanstack/react-router'
import { ArrowRight, Camera, CircleAlert, Clock3 } from 'lucide-react'
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

export function AuthorCard({ compact = false }: { compact?: boolean }) { return <aside className={`author-card ${compact ? 'compact' : ''}`}><div className="author-monogram" aria-hidden="true">HG</div><div><p className="eyebrow">Written by</p><h2>{founder.name}</h2><strong>{founder.role}</strong><p>{founder.shortBio}</p><Link to="/about/hugo-goncalves">Read about Hugo <ArrowRight size={15} /></Link></div></aside> }

export function FAQSection({ limit }: { limit?: number }) { const visible = limit ? faqs.slice(0, limit) : faqs; const schema={'@context':'https://schema.org','@type':'FAQPage',mainEntity:visible.map(([question,answer])=>({'@type':'Question',name:question,acceptedAnswer:{'@type':'Answer',text:answer}}))};return <section className="section shell"><script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(schema)}}/><PageIntro eyebrow="Frequently asked questions" title="Clear answers before you hand over the keys." text="If your property or arrangements are unusual, talk to us. The service is designed around the home." /><div className="faq-list">{visible.map(([question, answer]) => <details key={question}><summary>{question}<span>+</span></summary><p>{answer}</p></details>)}</div></section> }

export function ContentSection({ title, children }: { title: string; children: ReactNode }) { return <section className="content-block"><h2>{title}</h2>{children}</section> }
