import { createFileRoute } from '@tanstack/react-router'
import { ArrowRight, Check, ClipboardCheck, CloudRain, EyeOff, KeyRound, ShieldCheck, UserRound } from 'lucide-react'

import { AssessmentCta, ButtonLink, PageIntro, PropertyFocusSection, ReportPreview, SectionHeading, TrustSection } from '@/components/site'
import { PlanCards, PrivateEstateCard } from '@/components/plan-cards'
import { documentedVisitDefinition, trustPoints, vatNote } from '@/config/site'
import { pageHead } from '@/lib/seo'

export const Route = createFileRoute('/')({
  head: () => pageHead({ title: 'Private Estate Care, Western Algarve | Guardemar', description: 'Discreet, documented care for villas and estates from Carvoeiro to Sagres while you are away: fixed visit schedules, coded key holding and one accountable person.', path: '/' }),
  component: HomePage,
})

function HomePage() {
  return (
    <>
      <section className="hero shell">
        <div className="hero-copy reveal">
          <p className="eyebrow">Private estate care · Western Algarve</p>
          <h1>Private care for exceptional homes.</h1>
          <p className="hero-lede">Discreet, documented oversight of your villa or estate while you are away, from Carvoeiro to Sagres. One accountable person who knows the house, a dated photo report after every visit, and careful coordination of the staff and contractors you already trust.</p>
          <div className="button-row">
            <ButtonLink to="/contact/" event="assessment_form_start">Request a private assessment</ButtonLink>
            <ButtonLink href="https://wa.me/351928226570" variant="text" event="whatsapp_click">Message Guardemar <ArrowRight size={16} /></ButtonLink>
          </div>
          <p className="territory-line">Western Algarve — from Carvoeiro to Sagres. A limited number of properties.</p>
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
          <p>Guardemar visits your home on a fixed schedule, inspects its condition and tells you exactly how things are. A small issue found today avoids a significant repair, and a disputed insurance claim, later.</p>
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
          <PageIntro eyebrow="Care plans" title="A fixed visit schedule, documented every time." text="Each plan sets how often we visit: once a month, twice a month or at least once a week. Repairs are carried out by your trades, and only after you have approved the quote." />
          <PlanCards linkTo="/plans/" buttonLabel="View plan details" />
          <PrivateEstateCard />
          <p className="pricing-note">{documentedVisitDefinition} {vatNote} The plan is confirmed after an initial assessment of the house.</p>
        </div>
      </section>

      <section className="section section-blue">
        <div className="shell">
          <PageIntro eyebrow="Discretion by design" title="Your home and your name stay private." text="Owners of significant homes value quiet competence over visibility. Guardemar is built around that." light />
          <div className="feature-grid">
          <article><EyeOff /><h3>No visible branding</h3><p>No signage, no branded vehicles at the gate and no mention of your home or your name in our marketing.</p></article>
          <article><KeyRound /><h3>Coded keys</h3><p>Keys are coded, never labelled with an address, and every use is recorded.</p></article>
          <article><UserRound /><h3>One accountable person</h3><p>The same person knows the house, its systems and the people who work there.</p></article>
            <article><ShieldCheck /><h3>A limited client list</h3><p>We take on a limited number of properties, so every house receives full attention.</p></article>
          </div>
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
