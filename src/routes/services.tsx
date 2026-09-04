import { createFileRoute } from '@tanstack/react-router'
import { StandardPageView } from '@/components/standard-page'
import { services } from '@/config/site'
import { servicePages } from '@/config/services'

export const Route = createFileRoute('/services')({ head: () => ({ meta: [{ title: 'Property Care Services | Guardemar Western Algarve' }, { name: 'description', content: 'Home inspections, key holding, arrival preparation, contractor coordination and on-demand property support.' }], links: [{ rel: 'canonical', href: 'https://guardemar.com/services/' }] }), component: Services })
function Services() { return <><StandardPageView pageKey="services" /><section className="section shell"><p className="eyebrow">Detailed service guides</p><h2 className="list-title">Understand the scope before you hand over access.</h2><div className="service-guide-grid">{Object.values(servicePages).map(service => <a href={`/${service.slug}/`} key={service.slug}><span>{service.eyebrow}</span><h3>{service.title}</h3><p>{service.description}</p></a>)}</div></section><section className="section warm-section"><div className="shell"><p className="eyebrow">On-demand services</p><h2 className="list-title">Practical help, arranged when needed.</h2><ul className="service-list">{services.map(service => <li key={service}>{service}</li>)}</ul></div></section></> }
