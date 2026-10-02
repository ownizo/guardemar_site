import { createFileRoute } from '@tanstack/react-router'
import { ArrowRight, Check, ClipboardCheck, CloudRain, KeyRound, ShieldCheck } from 'lucide-react'

import { AssessmentCta, ButtonLink, PageIntro, PropertyFocusSection, ReportPreview, SectionHeading, TrustSection } from '@/components/site'
import { formatEuro, plans, trustPoints, vatNote } from '@/config/site'
import { pageHead } from '@/lib/seo'

export const Route = createFileRoute('/')({
  head: () => pageHead({ title: 'Second Home Care & Key Holding, Western Algarve | Guardemar', description: 'Guardemar looks after second homes from Carvoeiro to Sagres while you are away: scheduled home watch visits, key holding and a photo report after every visit.', path: '/' }),
  component: HomePage,
})

function HomePage() {
  return (
    <>
      <section className="hero shell">
        <div className="hero-copy reveal">
          <p className="eyebrow">Second-home care · Western Algarve</p>
          <h1>Your Algarve home, looked after while you&apos;re away.</h1>
          <p className="hero-lede">Scheduled home watch visits, secure key holding and a photo report after every visit, from Carvoeiro to Sagres. One local contact who knows the house, and who coordinates the pool, garden and cleaning companies you already use.</p>
          <div className="button-row">
            <ButtonLink to="/contact/" event="assessment_form_start">Request a Property Assessment</ButtonLink>
            <ButtonLink href="https://wa.me/351928226570" variant="text" event="whatsapp_click">WhatsApp Guardemar <ArrowRight size={16} /></ButtonLink>
          </div>
          <p className="territory-line">Western Algarve — from Carvoeiro to Sagres.</p>
        </div>
        <div className="hero-visual">
          <picture>
            <source
              type="image/avif"
              srcSet="/images/guardemar-coastal-villa-hero-720.avif 720w, /images/guardemar-coastal-villa-hero-1200.avif 1200w, /images/guardemar-coastal-villa-hero-1844.avif 1844w"
              sizes="(max-width: 640px) 100vw, (max-width: 980px) calc(100vw - 40px), (min-width: 1220px) 578px, 49vw"
            />
            <source
              type="image/webp"
              srcSet="/images/guardemar-coastal-villa-hero-720.webp 720w, /images/guardemar-coastal-villa-hero-1200.webp 1200w, /images/guardemar-coastal-villa-hero-1844.webp 1844w"
              sizes="(max-width: 640px) 100vw, (max-width: 980px) calc(100vw - 40px), (min-width: 1220px) 578px, 49vw"
            />
            <img
              className="hero-image"
              src="/images/guardemar-coastal-villa-hero-1200.webp"
              alt="Luxury coastal villa overlooking the Atlantic in the Algarve"
              width="1844"
              height="853"
              loading="eager"
              fetchPriority="high"
              decoding="async"
            />
          </picture>
        </div>
      </section>

      <section className="trust-strip" aria-label="Core services">
        <div className="shell trust-grid">
          {trustPoints.map((point) => <span key={point}><Check size={15} />{point}</span>)}
        </div>
      </section>

      <section className="section shell split-section">
        <SectionHeading eyebrow="The reason we exist" title="Your home doesn’t stop needing attention when you leave Portugal." />
        <div className="editorial-copy">
          <p className="large-copy">A leaking pipe, failed irrigation system or patch of damp can go unnoticed for weeks in an empty property.</p>
          <p>Guardemar visits your home on a scheduled basis, checks its condition and lets you know exactly how things are. A small issue detected today can avoid a significant repair later.</p>
          <div className="plain-list"><span>No assumptions.</span><span>No informal arrangements.</span><span>No wondering from another country.</span></div>
        </div>
      </section>

      <section className="section section-blue">
        <div className="shell">
          <PageIntro eyebrow="What Guardemar does" title="One person responsible for the house. A record after every visit." text="We inspect the property, tell you what has changed, and coordinate the right local professional when you approve the next step." light />
          <div className="feature-grid">
            <article><ClipboardCheck /><h3>Structured inspections</h3><p>A consistent, property-specific checklist rather than an informal look around.</p></article>
            <article><ShieldCheck /><h3>Early intervention</h3><p>Issues are prioritised and reported, giving owners the information needed to act.</p></article>
            <article><KeyRound /><h3>Local coordination</h3><p>Controlled access and coordination with trusted, qualified contractors where required.</p></article>
            <article><CloudRain /><h3>Weather response</h3><p>Post-weather visual checks according to plan, local conditions and availability.</p></article>
          </div>
          <ButtonLink to="/property-management-algarve/" variant="light">See how management works <ArrowRight size={16} /></ButtonLink>
        </div>
      </section>

      <section className="section shell report-section">
        <div>
          <SectionHeading eyebrow="Digital reporting" title="No vague updates. A documented inspection after every visit." />
          <p className="section-text">Owners receive a clear digital record with the visit date, checklist status, observations, photographs, issues detected and recommended next steps.</p>
          <ButtonLink to="/home-watch-algarve/" variant="outline">See what an inspection includes</ButtonLink>
        </div>
        <ReportPreview />
      </section>

      <section className="section warm-section">
        <div className="shell">
          <PageIntro eyebrow="Management plans" title="Choose how often we come." text="Monthly, twice a month or weekly, confirmed after we have seen the house. Repairs are carried out by your trades, and only after you have approved the quote." />
          <div className="plans-grid">
            {plans.map((plan) => (
              <article className={`plan-card ${plan.popular ? 'popular' : ''}`} key={plan.name}>
                {plan.popular && <span className="popular-label">Most popular</span>}
                <p className="eyebrow">{plan.name}</p>
                <div className="price">From <strong>{formatEuro(plan.grossPrice)}</strong><span>/month incl. VAT</span></div>
                <p>{plan.description}</p>
                <ul>{plan.highlights.map((item) => <li key={item}><Check size={15} />{item}</li>)}</ul>
                <ButtonLink to="/plans/" variant={plan.popular ? 'primary' : 'outline'} event="plan_cta_click">View plan details</ButtonLink>
              </article>
            ))}
          </div>
          <p className="pricing-note">{vatNote} The plan is confirmed after we have seen the property. Custom plans are available for larger villas, estates and properties with complex requirements.</p>
        </div>
      </section>

      <section className="section shell process-preview">
        <SectionHeading eyebrow="A clear process" title="From first meeting to every visit report." />
        <ol className="steps">
          {['Property assessment', 'Property profile', 'Secure key handover', 'Scheduled inspections', 'Report & action'].map((step, index) => <li key={step}><span>0{index + 1}</span><strong>{step}</strong></li>)}
        </ol>
        <ButtonLink to="/how-it-works/" variant="text">See how it works <ArrowRight size={16} /></ButtonLink>
      </section>

      <section className="section warm-section">
        <div className="shell founder-story">
          <div>
            <p className="eyebrow">Buying agents and lawyers</p>
            <h2>The useful moment is the week after completion.</h2>
          </div>
          <div>
            <p>If you have just sold a house to someone who lives abroad, and they do not want guests in it, introduce them here. We will not ask them to list it.</p>
            <ButtonLink to="/for-agents/" variant="outline">For agents and lawyers</ButtonLink>
          </div>
        </div>
      </section>

      <TrustSection />
      <PropertyFocusSection />
      <AssessmentCta />
    </>
  )
}
