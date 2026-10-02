import { createFileRoute } from '@tanstack/react-router'
import { Check } from 'lucide-react'
import { OptionalServicesCatalogue } from '@/components/optional-services'
import { AssessmentCta, Breadcrumbs, ButtonLink, FAQSection, PageHero, PropertyFocusSection, TrustSection } from '@/components/site'
import { formatEuro, planFaqs, plans, vatNote } from '@/config/site'
import { pageHead } from '@/lib/seo'

export const Route = createFileRoute('/plans')({
  head: () => pageHead({
    title: 'Property Management Prices Algarve | Guardemar Plans',
    description: `Second-home management plans from ${formatEuro(plans[0].grossPrice)} a month incl. VAT, Carvoeiro to Sagres: inspections, key holding, photo reports and optional extras.`,
    path: '/plans/',
  }),
  component: PlansPage,
})

function PlansPage() {
  return (
    <>
      <Breadcrumbs items={[{ label: 'Home', to: '/' }, { label: 'Plans' }]} />
      <PageHero
        eyebrow="Plans and prices"
        title="Property management prices in the Western Algarve."
        text="Three plans, set by how often we visit: monthly, twice a month or weekly. Each includes key holding, a photo report after every visit and a local contact who knows the house. Your pool, garden and repair companies stay yours, and we coordinate them once you approve the quote."
        aside="A fixed monthly fee, published in full. Never a percentage of rent."
      />
      <section className="section warm-section">
        <div className="shell">
          <p className="eyebrow">The monthly relationship</p>
          <h2 className="plans-primary-heading">Choose how often we visit.</h2>
        </div>
        <div className="shell plans-grid detailed-plans">
          {plans.map((plan) => (
            <article className={`plan-card ${plan.popular ? 'popular' : ''}`} key={plan.name}>
              {plan.popular && <span className="popular-label">Most popular</span>}
              <p className="eyebrow">{plan.name}</p>
              <div className="price"><strong>{formatEuro(plan.grossPrice)}</strong><span>/month incl. VAT</span></div>
              <p className="annual-plan-price"><strong>{formatEuro(plan.grossAnnualPrice)}/year incl. VAT</strong><span>Save {formatEuro(plan.grossAnnualSaving)} · 10% · {formatEuro(plan.price)}/month + VAT</span></p>
              <p>{plan.description}</p>
              <ul>{plan.items.map((item) => <li key={item}><Check size={15} />{item}</li>)}</ul>
              <ButtonLink to="/contact/" event="plan_cta_click">Request an assessment</ButtonLink>
            </article>
          ))}
        </div>
        <div className="shell plan-clarity">
          <p>Pool maintenance, gardening and regulated professional repairs are not included, but appropriate third-party work can be coordinated with advance approval.</p>
          <p>Monthly Billing is a 12-month service agreement billed monthly in advance. Annual Billing is a 12-month service agreement billed annually in advance and includes a 10% discount compared with twelve monthly payments.</p>
          <p><strong>VAT:</strong> {vatNote} The net fee is shown alongside each price.</p>
          <p><a href="/property-management-algarve/">Read what second-home management includes</a>, <a href="/home-watch-algarve/">see the inspection itself</a>, or read <a href="/blog/property-management-cost-algarve/">how property management is priced in the Algarve</a>.</p>
        </div>
      </section>
      <section className="section shell optional-services-section" aria-labelledby="optional-services-heading">
        <OptionalServicesCatalogue
          showPrice
          headingId="optional-services-heading"
          eyebrow="Optional services"
          title="Additional help when you need it."
          intro="Optional services are available in addition to your Guardemar care plan. They are not included in CARE, CARE+ or COMPLETE unless an existing plan already says otherwise. Third-party costs and expenses are charged separately where indicated."
        />
      </section>
      <TrustSection />
      <PropertyFocusSection />
      <FAQSection items={planFaqs} withSchema />
      <AssessmentCta />
    </>
  )
}
