import { Link } from '@tanstack/react-router'

import { Breadcrumbs, PageHero } from '@/components/site'

export const supportedFutureLocales = ['de', 'nl', 'fr'] as const

export function isFutureLocale(value: string): value is typeof supportedFutureLocales[number] {
  return supportedFutureLocales.includes(value as typeof supportedFutureLocales[number])
}

export function FutureLocalePage({ locale, page }: { locale: string; page: 'home' | 'home-watch' | 'plans' }) {
  const content = {
    home: { eyebrow: 'Private Property Care', title: 'Here when you are away.', text: 'Scheduled home watch inspections, photographic reports and local coordination for homes in the Western Algarve.', link: '/', label: 'View the English homepage' },
    'home-watch': { eyebrow: 'Home Watch Algarve', title: 'Scheduled visual inspections while you are away.', text: 'Guardemar visits, inspects, photographs and reports on agreed areas of an unoccupied or intermittently occupied property.', link: '/home-watch-algarve/', label: 'View the English home watch page' },
    plans: { eyebrow: 'Care Plans', title: 'Monthly, twice-monthly and weekly inspection options.', text: 'The published plan prices and features remain available on the English plans page while translated content is prepared.', link: '/plans/', label: 'View the English plans page' },
  }[page]

  return <>{/* TODO: OWNER TO SUPPLY PROFESSIONAL GERMAN, DUTCH AND FRENCH TRANSLATIONS */}<Breadcrumbs items={[{ label: 'Home', to: '/' }, { label: locale.toUpperCase() }, { label: content.eyebrow }]} /><div className="translation-notice"><div className="shell"><strong>Translation preparation</strong><p>This route is reserved for a future professional translation. The temporary content remains in English and is excluded from indexing.</p></div></div><PageHero eyebrow={content.eyebrow} title={content.title} text={content.text} aside="No machine translation has been used."/><section className="section shell content-wrap"><div className="content-block"><h2>English source page</h2><p>The final version should retain the service scope, legal distinctions, pricing and factual tone of the English source.</p><Link to={content.link}>{content.label}</Link></div></section></>
}
