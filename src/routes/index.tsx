import { createFileRoute } from '@tanstack/react-router'
import { ArrowRight, Check, ClipboardCheck, CloudRain, KeyRound, ShieldCheck } from 'lucide-react'

import { AssessmentCta, ButtonLink, PageIntro, PropertyFocusSection, ReportPreview, SectionHeading, TrustSection } from '@/components/site'
import { plans, trustPoints } from '@/config/site'
import { futureLanguageAlternates, pageHead } from '@/lib/seo'

export const Route = createFileRoute('/')({
  head: () => pageHead({ title: 'Private Property Care in the Western Algarve | Guardemar', description: 'Scheduled home watch inspections, photographic reports and trusted local coordination for holiday homes and second homes from Carvoeiro to Sagres.', path: '/', alternates: futureLanguageAlternates('/') }),
  component: HomePage,
})

function HomePage() {
  return (
    <>
      <section className="hero shell">
        <div className="hero-copy reveal">
          <p className="eyebrow">Private Property Care</p>
          <h1>Here when<br />you&apos;re away.</h1>
          <p className="hero-lede">Your home in Portugal should still be looked after when you&apos;re not here. Guardemar provides scheduled inspections, documented reports and trusted local coordination across the Western Algarve.</p>
          <div className="button-row">
            <ButtonLink to="/contact/" event="assessment_form_start">Request a Property Assessment</ButtonLink>
            <ButtonLink href="https://wa.me/351928226570" variant="text" event="whatsapp_click">WhatsApp Guardemar <ArrowRight size={16} /></ButtonLink>
          </div>
          <p className="territory-line">Western Algarve — from Carvoeiro to Sagres.</p>
        </div>
        <div className="hero-visual" role="img" aria-label="Abstract architectural view inspired by a contemporary Algarve villa">
          <div className="sun-disc" />
          <div className="villa-plane villa-plane-one" />
          <div className="villa-plane villa-plane-two" />
          <div className="pool-plane" />
          <div className="hero-caption"><span>01</span> A trusted local presence in Portugal</div>
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
          <PageIntro eyebrow="What Guardemar does" title="Actual human presence. Clearly documented." text="We inspect the property, identify problems early, document its condition and coordinate the right local professional when action is needed." light />
          <div className="feature-grid">
            <article><ClipboardCheck /><h3>Structured inspections</h3><p>A consistent, property-specific checklist rather than an informal look around.</p></article>
            <article><ShieldCheck /><h3>Early intervention</h3><p>Issues are prioritised and reported, giving owners the information needed to act.</p></article>
            <article><KeyRound /><h3>Local coordination</h3><p>Controlled access and coordination with trusted, qualified contractors where required.</p></article>
            <article><CloudRain /><h3>Weather response</h3><p>Post-weather visual checks according to plan, local conditions and availability.</p></article>
          </div>
          <ButtonLink to="/property-care/" variant="light">Explore Property Care <ArrowRight size={16} /></ButtonLink>
        </div>
      </section>

      <section className="section shell report-section">
        <div>
          <SectionHeading eyebrow="Digital reporting" title="No vague updates. A documented inspection after every visit." />
          <p className="section-text">Owners receive a clear digital record with the visit date, checklist status, observations, photographs, issues detected and recommended next steps.</p>
          <ButtonLink to="/home-watch-algarve/" variant="outline">See how Home Watch works</ButtonLink>
        </div>
        <ReportPreview />
      </section>

      <section className="section warm-section">
        <div className="shell">
          <PageIntro eyebrow="Care plans" title="Choose the right level of oversight." text="Straightforward plans, adapted after a first property assessment. No repair work is implied or included unless separately agreed." />
          <div className="plans-grid">
            {plans.map((plan) => (
              <article className={`plan-card ${plan.popular ? 'popular' : ''}`} key={plan.name}>
                {plan.popular && <span className="popular-label">Most popular</span>}
                <p className="eyebrow">{plan.name}</p>
                <div className="price">From <strong>€{plan.price}</strong><span>/month</span></div>
                <p>{plan.description}</p>
                <ul>{plan.highlights.map((item) => <li key={item}><Check size={15} />{item}</li>)}</ul>
                <ButtonLink to="/plans/" variant={plan.popular ? 'primary' : 'outline'} event="plan_cta_click">View plan details</ButtonLink>
              </article>
            ))}
          </div>
          <p className="pricing-note">Prices shown are indicative and may be subject to VAT and property-specific assessment. Custom plans are available for larger villas, estates and properties with complex requirements.</p>
        </div>
      </section>

      <section className="section shell process-preview">
        <SectionHeading eyebrow="A clear process" title="From first meeting to every visit report." />
        <ol className="steps">
          {['Property assessment', 'Property profile', 'Secure key handover', 'Scheduled inspections', 'Report & action'].map((step, index) => <li key={step}><span>0{index + 1}</span><strong>{step}</strong></li>)}
        </ol>
        <ButtonLink to="/how-it-works/" variant="text">See how it works <ArrowRight size={16} /></ButtonLink>
      </section>

      <TrustSection />
      <PropertyFocusSection />
      <AssessmentCta />
    </>
  )
}
