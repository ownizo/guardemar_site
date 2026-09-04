import { createFileRoute, Link } from '@tanstack/react-router'

import { AnalyticsLink, Breadcrumbs } from '@/components/site'
import { business } from '@/config/site'
import { pageHead } from '@/lib/seo'

export const Route = createFileRoute('/contact/thank-you')({
  head: () => pageHead({ title: 'Thank You | Guardemar', description: 'Confirmation that Guardemar received a property assessment enquiry.', path: '/contact/thank-you/', noindex: true }),
  component: ThankYouPage,
})

function ThankYouPage() {
  return <><Breadcrumbs items={[{ label: 'Home', to: '/' }, { label: 'Contact', to: '/contact/' }, { label: 'Thank you' }]} /><section className="section shell confirmation-page"><p className="eyebrow">Enquiry received</p><h1>Thank you. Guardemar has received your enquiry.</h1><p>We review the location, property type and message before making contact. The next conversation confirms your priorities and whether a property assessment is the appropriate next step.</p><p>If useful, you can add the remaining property detail now or continue the conversation through WhatsApp.</p><div className="button-row"><a href="/contact/property-assessment/" className="button primary">Add property details</a><AnalyticsLink href={business.whatsapp} event="whatsapp_click" className="button outline">Continue on WhatsApp</AnalyticsLink><Link to={"/home-watch-algarve/" as any} className="button text">Review home watch</Link></div></section></>
}
