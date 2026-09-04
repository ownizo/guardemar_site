import { createFileRoute } from '@tanstack/react-router'

import { AssessmentForm } from '@/components/assessment-form'
import { AnalyticsLink, Breadcrumbs, PageHero } from '@/components/site'
import { business, legalEntity, operationalContact } from '@/config/site'

export const Route = createFileRoute('/contact')({
  head: () => ({
    meta: [
      { title: 'Request a Property Assessment | Guardemar' },
      { name: 'description', content: 'Tell Guardemar about your Western Algarve property and request a practical first property care assessment.' },
    ],
    links: [{ rel: 'canonical', href: 'https://guardemar.com/contact/' }],
  }),
  component: ContactPage,
})

function ContactPage() {
  return <>
    <Breadcrumbs items={[{ label: 'Home', to: '/' }, { label: 'Contact' }]} />
    <PageHero eyebrow="Talk to Guardemar" title="Tell us about your home in Portugal." text="A useful proposal starts with the property. Share the location, type of home and the level of oversight you have in mind." aside="Your information is used to respond to this enquiry and handled according to our Privacy Policy." />
    <section className="section shell contact-layout">
      <div>
        <p className="eyebrow">First property assessment</p>
        <h2>Request an assessment</h2>
        <p>Fields marked by your browser as required must be completed. There is no obligation created by sending an enquiry.</p>
        <AssessmentForm />
      </div>
      <aside className="contact-card">
        <div>
          <p className="eyebrow">Operational contact</p>
          <h2>{operationalContact.name}</h2>
          <p>{business.descriptor}<br />{business.territory}</p>
          <AnalyticsLink href={business.phoneHref} event="phone_click">{business.phone}</AnalyticsLink>
          <AnalyticsLink href={business.emailHref} event="email_click">{business.email}</AnalyticsLink>
          <AnalyticsLink href={business.whatsapp} event="whatsapp_click">Message on WhatsApp</AnalyticsLink>
          <address>{operationalContact.address.addressLines.map((line) => <span key={line}>{line}</span>)}</address>
        </div>
        <div className="contact-legal-card">
          <h3>Legal entity / Registered office</h3>
          <p>{legalEntity.legalName}<br />{legalEntity.registeredAddress.addressLines.map((line) => <span key={line}>{line}<br /></span>)}NIPC {legalEntity.taxId}</p>
        </div>
      </aside>
    </section>
  </>
}
