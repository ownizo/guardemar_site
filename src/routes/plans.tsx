import { createFileRoute } from '@tanstack/react-router'
import { Check } from 'lucide-react'
import { OptionalServicesCatalogue } from '@/components/optional-services'
import { AssessmentCta, Breadcrumbs, ButtonLink, FAQSection, PageHero, PropertyFocusSection, TrustSection } from '@/components/site'
import { planFaqs, plans } from '@/config/site'
import { futureLanguageAlternates, pageHead } from '@/lib/seo'

export const Route = createFileRoute('/plans')({
  head: () => pageHead({
    title: 'Second-Home Management Plans and Pricing | Guardemar',
    description: 'Guardemar management plans from €79 per month for privately used second homes in the Western Algarve. Optional services are listed separately. Not a rental service.',
    path: '/plans/',
    alternates: futureLanguageAlternates('/plans/'),
  }),
  component: PlansPage,
})

function PlansPage() {
  return (
    <>
      <Breadcrumbs items={[{ label: 'Home', to: '/' }, { label: 'Plans' }]} />
      <PageHero
        eyebrow="Management plans"
        title="Choose how often we visit. The rest is confirmed on the house."
        text="CARE, CARE+ and COMPLETE are the management plans. They set the inspection frequency and what is included. Pool, garden and repair companies stay yours. We coordinate them after you approve the quote."
        aside="This is not a holiday-let fee and not a percentage of rent."
      />
      <section className="section warm-section">
        <div className="shell">
          <p className="eyebrow">The monthly relationship</p>
          <h2 className="plans-primary-heading">Same three plans. A clearer name for what they are.</h2>
        </div>
        <div className="shell plans-grid detailed-plans">
          {plans.map((plan) => (
            <article className={`plan-card ${plan.popular ? 'popular' : ''}`} key={plan.name}>
              {plan.popular && <span className="popular-label">Most popular</span>}
              <p className="eyebrow">{plan.name}</p>
              <div className="price"><strong>€{plan.price}</strong><span>/month</span></div>
              <p className="annual-plan-price"><strong>€{plan.annualPrice.toLocaleString('en-IE', { minimumFractionDigits: 2 })}/year</strong><span>Save €{plan.annualSaving.toFixed(2)} · 10%</span></p>
              <p>{plan.description}</p>
              <ul>{plan.items.map((item) => <li key={item}><Check size={15} />{item}</li>)}</ul>
              <ButtonLink to="/contact/" event="plan_cta_click">Request an assessment</ButtonLink>
            </article>
          ))}
        </div>
        <div className="shell plan-clarity">
          <p>Pool maintenance, gardening and regulated professional repairs are not included, but appropriate third-party work can be coordinated with advance approval.</p>
          <p>Monthly Billing is a 12-month service agreement billed monthly in advance. Annual Billing is a 12-month service agreement billed annually in advance and includes a 10% discount compared with twelve monthly payments.</p>
          <p><strong>Tax:</strong> Plan fees are shown exclusive of VAT and other applicable taxes unless expressly stated otherwise. The applicable tax treatment is confirmed before charging.</p>
          <p><a href="/property-management-algarve/">Read what second-home management includes</a>, or <a href="/home-watch-algarve/">see the inspection itself</a>, before comparing frequencies.</p>
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
      <FAQSection items={planFaqs} />
      <AssessmentCta />
    </>
  )
}
