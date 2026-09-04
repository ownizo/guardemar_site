import { AssessmentCta, Breadcrumbs, ContentSection, FAQSection, PageHero, TrustSection } from '@/components/site'
import { legalPages } from '@/config/legal'
import { standardPages } from '@/config/pages'

export function StandardPageView({ pageKey, legal = false }: { pageKey: string; legal?: boolean }) {
  const page = (legal ? legalPages : standardPages)[pageKey]
  const serviceSchema = {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: page.eyebrow,
    description: page.description,
    provider: { '@id': 'https://guardemar.com/#business' },
    areaServed: { '@type': 'Place', name: 'Western Algarve, Portugal' },
  }
  return <>{!legal&&<script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(serviceSchema)}}/>}<Breadcrumbs items={[{ label: 'Home', to: '/' }, { label: page.title }]} /><PageHero eyebrow={page.eyebrow} title={page.title} text={page.description} aside={page.aside} /><div className={`section shell content-wrap${legal ? ' legal-content' : ''}`}>{page.sections.map((section) => <ContentSection title={section.title} key={section.title}>{section.paragraphs?.map((p) => <p key={p}>{p}</p>)}{section.bullets && <ul>{section.bullets.map((item) => <li key={item}>{item}</li>)}</ul>}</ContentSection>)}</div>{pageKey==='property-care'&&<><TrustSection/><FAQSection/></>}{!legal && <AssessmentCta />}</>
}
