import { createFileRoute } from '@tanstack/react-router'
import { OptionalServicesCatalogue } from '@/components/optional-services'
import { AssessmentCta, Breadcrumbs, FAQSection, PageHero, PropertyFocusSection, TrustSection } from '@/components/site'
import { PlanCards, PrivateEstateCard } from '@/components/plan-cards'
import { documentedVisitDefinition, formatEuro, planFaqs, plans, vatNote } from '@/config/site'
import { pageHead } from '@/lib/seo'

export const Route = createFileRoute('/plans')({
  head: () => pageHead({
    title: 'Private Estate Care Plans, Algarve | Guardemar',
    description: `Care plans for villas and estates, Carvoeiro to Sagres: ${formatEuro(plans[0].grossPrice)}, ${formatEuro(plans[1].grossPrice)} or ${formatEuro(plans[2].grossPrice)} a month incl. VAT for one or two documented visits a month, or weekly. Estates by proposal.`,
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
        title="Care plans for villas and estates in the Western Algarve."
        text="Each plan has a fixed visit schedule: CARE includes one documented visit per month, CARE+ two per month and COMPLETE a minimum of one per week. Every plan includes coded key holding, a dated photo report after every visit and one accountable person who knows the house. Estates receive a Private Estate proposal."
        aside="A fixed monthly fee and a fixed visit schedule. Never a percentage of rent."
      />
      <section className="section warm-section">
        <div className="shell">
          <p className="eyebrow">Visit schedule and fees</p>
          <h2 className="plans-primary-heading">Choose how often we visit.</h2>
          <p className="section-text">{documentedVisitDefinition}</p>
        </div>
        <div className="shell">
          <PlanCards detailed />
          <PrivateEstateCard />
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
          intro="Optional services are available in addition to your Guardemar care plan. They are not included in CARE, CARE+ or COMPLETE unless the plan already includes them. Third-party costs and expenses are charged separately where indicated."
        />
      </section>
      <TrustSection />
      <PropertyFocusSection />
      <FAQSection items={planFaqs} withSchema />
      <AssessmentCta />
    </>
  )
}
