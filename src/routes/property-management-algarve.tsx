import { createFileRoute } from '@tanstack/react-router'
import { Check } from 'lucide-react'

import { AssessmentCta, Breadcrumbs, PageHero } from '@/components/site'
import { formatEuro, plans, vatNote } from '@/config/site'
import { pageHead } from '@/lib/seo'

export const Route = createFileRoute('/property-management-algarve')({
  head: () => pageHead({
    title: 'Property Management in Lagos & the Western Algarve | Guardemar',
    description: 'Property management for Algarve homes you use yourself, from Carvoeiro to Sagres: inspections, key holding, photo reports and coordination of your pool, garden and trades.',
    path: '/property-management-algarve/',
  }),
  component: PropertyManagementPage,
})

const schema = {
  '@context': 'https://schema.org',
  '@type': 'Service',
  name: 'Second-home management, Western Algarve',
  description: 'Non-rental property management for privately used second homes from Carvoeiro to Sagres.',
  url: 'https://guardemar.com/property-management-algarve/',
  provider: { '@id': 'https://guardemar.com/#business' },
  areaServed: { '@type': 'Place', name: 'Western Algarve, Portugal' },
}

function PropertyManagementPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
      <Breadcrumbs items={[{ label: 'Home', to: '/' }, { label: 'Second-home management' }]} />
      <PageHero
        eyebrow="Second-home management · Western Algarve"
        title="Property management in the Western Algarve, for homes you use yourself."
        text="If you searched for property management in Lagos, Luz, Alvor or Carvoeiro and then realised every company wanted to put guests in the house, this is the other service. Guardemar manages the property while you are away."
        aside="From Carvoeiro to Sagres. One local contact. A written report after every visit. No bookings."
      />
      <section className="section shell comparison">
        <div>
          <p className="eyebrow">Rental management</p>
          <h2>Built around guests.</h2>
          <ul>
            {['Listings and pricing', 'Check-in and check-out', 'Cleaning turnovers', 'A rental calendar', 'Guest messages', 'Alojamento Local'].map((item) => <li key={item}>{item}</li>)}
          </ul>
        </div>
        <div className="guardemar-column">
          <p className="eyebrow">Guardemar</p>
          <h2>Built around the house.</h2>
          <ul>
            {['Scheduled inspections', 'A photo report you can keep', 'Secure key holding', 'Pool, garden and cleaner coordination', 'Quotes sent to you before work starts', 'The house checked before you arrive'].map((item) => <li key={item}><Check size={16} />{item}</li>)}
          </ul>
        </div>
      </section>
      <section className="section warm-section">
        <div className="shell founder-story">
          <div>
            <p className="eyebrow">What management means here</p>
            <h2>Someone is responsible for the gap between your visits.</h2>
          </div>
          <div>
            <p>The inspection is how we see the house. It is not the product. On each agreed visit we check access, moisture, water, power and the outside, photograph what has changed, and tell you whether it is fine, needs attention, or should be dealt with now.</p>
            <p>Around that visit we hold the keys, meet the pool company, gardener or cleaner you already use, and pass you their quote before anything is approved. We do not do the regulated work ourselves, and we do not accept a quotation on your behalf.</p>
            <p>Bills that arrive at the house can be photographed under Mail Care, so you see them while you are abroad. Guardemar does not pay utilities or IMI, and does not act as your fiscal representative. The dated report is a record of oversight you can keep with your insurer. It is not insurance advice, and it does not decide a claim.</p>
            <p><a href="/home-watch-algarve/">See what happens on an inspection</a></p>
          </div>
        </div>
      </section>
      <section className="section shell link-panel">
        <div>
          <h2>Plans from {formatEuro(plans[0].grossPrice)} a month</h2>
          <p>CARE, CARE+ and COMPLETE set how often we come. Coordination of trades sits on top of that, and is only done with your approval. {vatNote}</p>
          <a href="/plans/">Compare the three plans</a>
        </div>
        <div>
          <h2>Just bought, or acting for a buyer?</h2>
          <p>The useful moment is the week after completion, before the owner flies home. Agents and lawyers can introduce the house without a rental conversation.</p>
          <a href="/for-agents/">For buying agents and lawyers</a>
        </div>
      </section>
      <AssessmentCta title="Tell us about the house. We will say if this is the right arrangement." />
    </>
  )
}
