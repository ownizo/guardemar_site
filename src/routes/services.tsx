import { createFileRoute } from '@tanstack/react-router'
import { OptionalServicesCatalogue } from '@/components/optional-services'
import { StandardPageView } from '@/components/standard-page'
import { servicePages } from '@/config/services'
import { pageHead } from '@/lib/seo'

export const Route = createFileRoute('/services')({
  head: () => pageHead({
    title: 'Property Care Service Directory | Guardemar',
    description: 'Home watch supporting guides and optional additional services for holiday homes and second homes in the Western Algarve.',
    path: '/services/',
  }),
  component: Services,
})

function Services() {
  return (
    <>
      <StandardPageView pageKey="services" />
      <section className="section shell">
        <p className="eyebrow">Detailed service guides</p>
        <h2 className="list-title">Understand the scope before you hand over access.</h2>
        <div className="service-guide-grid">
          {Object.values(servicePages).map((service) => (
            <a href={`/${service.slug}/`} key={service.slug}>
              <span>{service.eyebrow}</span>
              <h3>{service.title}</h3>
              <p>{service.description}</p>
            </a>
          ))}
        </div>
      </section>
      <section className="section warm-section" aria-labelledby="additional-services-heading">
        <div className="shell">
          <OptionalServicesCatalogue
            showPrice={false}
            headingId="additional-services-heading"
            eyebrow="Additional services"
            title="More ways to look after your home while you are away."
            intro="These optional services sit outside the CARE, CARE+ and COMPLETE plans. They can be arranged when a particular need arises, in addition to the scheduled property-care routine."
          />
        </div>
      </section>
    </>
  )
}
