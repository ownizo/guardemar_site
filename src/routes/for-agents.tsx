import { createFileRoute } from '@tanstack/react-router'
import { Check } from 'lucide-react'

import { AssessmentCta, Breadcrumbs, ButtonLink, PageHero } from '@/components/site'
import { pageHead } from '@/lib/seo'

export const Route = createFileRoute('/for-agents')({
  head: () => pageHead({
    title: 'For Buying Agents and Lawyers | Guardemar',
    description: 'Introduce overseas buyers to second-home management in the Western Algarve after completion. No rental pitch, no guest operation.',
    path: '/for-agents/',
  }),
  component: ForAgentsPage,
})

function ForAgentsPage() {
  return (
    <>
      <Breadcrumbs items={[{ label: 'Home', to: '/' }, { label: 'For agents' }]} />
      <PageHero
        eyebrow="For buying agents and lawyers"
        title="After completion, the house still needs someone."
        text="Most buyers you act for live in another country. The week they leave Portugal is when a leak, an empty pool or a set of unlabelled keys becomes their problem. Guardemar takes that on for homes they intend to use themselves."
        aside="We do not ask your client to list the house, and we do not run guest stays."
      />
      <section className="section shell comparison">
        <div>
          <p className="eyebrow">What we do at handover</p>
          <h2>A baseline, then a person who keeps coming back.</h2>
          <ul>
            {['Collect and code the keys', 'Photograph the visible condition', 'Record meters, access and existing contractors', 'Agree how often the house should be checked', 'Send the owner a report after every visit', 'Meet pool, garden and cleaning companies you or the owner already use'].map((item) => <li key={item}><Check size={16} />{item}</li>)}
          </ul>
        </div>
        <div className="guardemar-column">
          <p className="eyebrow">What we will not do</p>
          <h2>We are not a second sales desk.</h2>
          <ul>
            {['No request to put the home on Airbnb or Booking', 'No Alojamento Local application', 'No guest check-in and no rental calendar', 'No approach to your client about revenue', 'No interference with your agency relationship'].map((item) => <li key={item}>{item}</li>)}
          </ul>
        </div>
      </section>
      <section className="section warm-section">
        <div className="shell founder-story">
          <div>
            <p className="eyebrow">How to introduce a client</p>
            <h2>One email is enough.</h2>
          </div>
          <div>
            <p>Send the buyer this page, or introduce them to info@guardemar.com with the property address and completion date. We arrange the first visit with them directly.</p>
            <p>There is no referral fee and no obligation. If the home is going to be let full-time, say so and we will tell them they need a rental manager instead.</p>
            <div className="button-row">
              <ButtonLink to="/contact/" event="assessment_form_start">Introduce a property</ButtonLink>
              <ButtonLink to="/property-management-algarve/" variant="outline">Read the owner explanation</ButtonLink>
            </div>
          </div>
        </div>
      </section>
      <AssessmentCta title="Tell us about a home that has just completed." />
    </>
  )
}
