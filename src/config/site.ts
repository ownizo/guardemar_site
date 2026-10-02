export const legalEntity = {
  legalName: 'Ownizo Unipessoal Lda',
  tradingName: 'GUARDEMAR',
  taxId: '517169029',
  registeredAddress: {
    street: 'Avenida do Atlântico 16',
    unit: 'Escritório 5.07',
    postalCode: '1990-019',
    city: 'Lisboa',
    country: 'Portugal',
    addressLines: ['Avenida do Atlântico 16', 'Escritório 5.07', '1990-019 Lisboa', 'Portugal'],
  },
  contactEmail: 'info@guardemar.com',
  phone: '+351 928 226 570',
} as const

export const operationalContact = {
  name: 'GUARDEMAR',
  descriptor: 'Second-home management',
  // Base locality only. Guardemar holds client keys, so no street address
  // for the operational base is ever published on the site or in schema.
  address: {
    city: 'Lagos',
    region: 'Algarve',
    country: 'Portugal',
    addressLines: ['Lagos, Algarve', 'Portugal'],
  },
} as const

// Consumer prices must be shown inclusive of VAT. Net amounts stay the
// commercial source of truth (Stripe, fee schedule); public pages display
// the gross figure with the net amount alongside.
export const vatRate = 0.23
export const withVat = (net: number) => Math.round(net * (1 + vatRate) * 100) / 100
export const formatEuro = (amount: number) => `€${amount.toLocaleString('en-IE', { minimumFractionDigits: Number.isInteger(amount) ? 0 : 2, maximumFractionDigits: 2 })}`
export const vatNote = 'Prices include VAT at 23%.'

export const legalLastUpdated = '13 September 2026'

export const business = {
  name: 'GUARDEMAR',
  descriptor: operationalContact.descriptor,
  tagline: "Here when you're away.",
  phone: legalEntity.phone,
  phoneHref: `tel:${legalEntity.phone.replace(/\s/g, '')}`,
  email: legalEntity.contactEmail,
  emailHref: `mailto:${legalEntity.contactEmail}`,
  whatsapp: `https://wa.me/${legalEntity.phone.replace(/\D/g, '')}`,
  addressLines: operationalContact.address.addressLines,
  territory: 'Western Algarve — from Carvoeiro to Sagres.',
  schema: { '@context': 'https://schema.org', '@graph': [
    { '@type': ['ProfessionalService', 'LocalBusiness', 'Organization'], '@id': 'https://guardemar.com/#business', name: 'GUARDEMAR', legalName: legalEntity.legalName, taxID: legalEntity.taxId, brand: { '@type': 'Brand', name: legalEntity.tradingName }, description: 'Second-home management for privately used holiday homes in the Western Algarve, Portugal. Inspections, key holding and contractor coordination. Not a rental manager.', url: 'https://guardemar.com/', logo: 'https://guardemar.com/guardemar-logo.svg', image: 'https://guardemar.com/guardemar-og.png', priceRange: '€97–€232 per month incl. VAT', telephone: legalEntity.phone, email: legalEntity.contactEmail, address: { '@type': 'PostalAddress', addressLocality: operationalContact.address.city, addressRegion: 'Faro', addressCountry: 'PT' }, founder: { '@id': 'https://guardemar.com/about/hugo-goncalves/#person' }, sameAs: [] as string[], areaServed: ['Carvoeiro', 'Ferragudo', 'Portimão', 'Alvor', 'Lagos', 'Praia da Luz', 'Burgau', 'Salema', 'Vila do Bispo', 'Sagres'].map((name) => ({ '@type': 'Place', name })) },
    { '@type': 'WebSite', '@id': 'https://guardemar.com/#website', url: 'https://guardemar.com', name: 'GUARDEMAR', publisher: { '@id': 'https://guardemar.com/#business' }, inLanguage: 'en-GB' },
  ] },
}

export const founder = {
  name: 'Hugo Gonçalves',
  role: 'Founder, Guardemar',
  profileUrl: 'https://guardemar.com/about/hugo-goncalves/',
  shortBio: 'Entrepreneur and founder of Guardemar. Hugo has a background in international business, travel technology and risk management, including almost two decades in global travel technology and the founding of Adler & Rochefort in Portugal.',
  schema: {
    '@context': 'https://schema.org',
    '@type': 'Person',
    '@id': 'https://guardemar.com/about/hugo-goncalves/#person',
    name: 'Hugo Gonçalves',
    url: 'https://guardemar.com/about/hugo-goncalves/',
    jobTitle: 'Founder',
    worksFor: { '@id': 'https://guardemar.com/#business' },
    alumniOf: { '@type': 'CollegeOrUniversity', name: 'University of Hertfordshire' },
    knowsAbout: ['Second-home management', 'Risk management', 'International business', 'Travel technology'],
  },
} as const

export const navigation = [
  { label: 'Management', href: '/property-management-algarve/' },
  { label: 'Inspections', href: '/home-watch-algarve/' },
  { label: 'Plans', href: '/plans/' },
  { label: 'Areas', href: '/areas/' },
  { label: 'For agents', href: '/for-agents/' },
  { label: 'How it works', href: '/how-it-works/' },
] as const

export const footerLinks = [
  ...navigation,
  { label: 'Insights', href: '/blog/' },
  { label: 'Services', href: '/services/' },
  { label: 'About', href: '/about/' },
  { label: 'Contact', href: '/contact/' },
] as const

export const trustPoints = ['Scheduled inspections', 'Photo reports', 'Key holding', 'Pool, garden and cleaning coordination', 'Quotes sent to you first', 'Arrival preparation']

export const plans = [
  { name: subscriptionPlans.care.name, price: subscriptionPlans.care.monthlyAmount / 100, annualPrice: subscriptionPlans.care.yearlyAmount / 100, annualSaving: subscriptionPlans.care.annualDiscountAmount / 100, grossPrice: withVat(subscriptionPlans.care.monthlyAmount / 100), grossAnnualPrice: withVat(subscriptionPlans.care.yearlyAmount / 100), grossAnnualSaving: withVat(subscriptionPlans.care.annualDiscountAmount / 100), description: 'For owners who want a reliable monthly check.', popular: false, highlights: ['1 scheduled inspection per month', 'Secure key holding', 'Interior and exterior visual checks', 'Inspection photographs', 'Digital visit report', 'Issue notification'], items: subscriptionPlans.care.scope },
  { name: subscriptionPlans.care_plus.name, price: subscriptionPlans.care_plus.monthlyAmount / 100, annualPrice: subscriptionPlans.care_plus.yearlyAmount / 100, annualSaving: subscriptionPlans.care_plus.annualDiscountAmount / 100, grossPrice: withVat(subscriptionPlans.care_plus.monthlyAmount / 100), grossAnnualPrice: withVat(subscriptionPlans.care_plus.yearlyAmount / 100), grossAnnualSaving: withVat(subscriptionPlans.care_plus.annualDiscountAmount / 100), description: 'For more regular oversight and practical coordination.', popular: true, highlights: ['2 scheduled inspections per month', 'Everything in CARE', 'Ventilation and water circulation', 'Pool and irrigation visual checks', 'Contractor access coordination', 'Pre-arrival basic check'], items: subscriptionPlans.care_plus.scope },
  { name: subscriptionPlans.complete.name, price: subscriptionPlans.complete.monthlyAmount / 100, annualPrice: subscriptionPlans.complete.yearlyAmount / 100, annualSaving: subscriptionPlans.complete.annualDiscountAmount / 100, grossPrice: withVat(subscriptionPlans.complete.monthlyAmount / 100), grossAnnualPrice: withVat(subscriptionPlans.complete.yearlyAmount / 100), grossAnnualSaving: withVat(subscriptionPlans.complete.annualDiscountAmount / 100), description: 'Frequent oversight for homes with more moving parts.', popular: false, highlights: ['Weekly scheduled inspections', 'Everything in CARE+', 'Enhanced maintenance oversight', 'Monthly condition summary', 'Arrival preparation coordination', 'Higher service priority'], items: subscriptionPlans.complete.scope },
] as const

export const services = [
  'Additional property visit', 'Emergency call-out', 'Contractor access', 'Waiting for tradespeople', 'Delivery attendance', 'Pre-arrival preparation', 'Post-departure check', 'Storm inspection', 'Key holding', 'Mail handling', 'Meter readings', 'Property handover inspection', 'Inventory photography', 'Cleaning coordination', 'Gardening coordination', 'Pool maintenance coordination', 'Air-conditioning servicing coordination', 'Plumbing coordination', 'Electrical contractor coordination', 'Pest-control coordination', 'Painting coordination', 'Pressure washing coordination', 'Solar-panel cleaning coordination',
]

export const faqs = [
  ['Is Guardemar a property management company?', 'Yes — for second homes you use yourself. We look after the house while you are away: scheduled inspections, key holding, a written photo report after every visit, and coordination of the pool, garden or cleaning companies you already use. Holiday lets are a different business, and we leave them to rental managers.'],
  ['What is a home watch visit?', 'It is the scheduled inspection at the heart of every plan: a walk-through of the property, photographs and a written status of good, attention or urgent for each area.'],
  ['How often should my property be checked?', 'It depends on the home, the season and how long it stands empty. Monthly, twice-monthly and weekly plans are available, and we recommend a frequency after seeing the property.'],
  ['What happens if you find a leak?', 'We photograph it, tell you straight away, take the reasonable first steps you have agreed to limit the damage and, with your approval, bring in a qualified plumber.'],
  ['Can you arrange a plumber or electrician?', 'Yes. We coordinate licensed, qualified tradespeople — or the ones you already trust — and send you their quote before any work starts. The technical work itself is always done by them.'],
  ['Can you let contractors into my property?', 'Yes, with your prior authorisation. We open up, record who attended and can check and photograph the property afterwards.'],
  ['How do you hold keys?', 'Keys are coded rather than labelled with an address, stored securely and used only for purposes you have authorised. Every use is recorded.'],
  ['Do you check pools and gardens?', 'Yes, visually: water condition, equipment, irrigation and obvious problems. Pool maintenance and gardening stay with your providers, and we coordinate them.'],
  ['Can you prepare the house before we arrive?', 'Yes. A pre-arrival check covers ventilation, water, power, hot water, air conditioning, pool and garden, so any problem is raised while there is still time to fix it.'],
  ['Do you check the house after a storm?', 'Yes. CARE+ includes a visual check after severe weather, and COMPLETE gives those checks priority. We go as soon as access is safe; for CARE, a storm check can be added as an optional service.'],
  ['What does the report look like?', 'A digital report for every visit: date and time, the status of each area, photographs, observations and a recommended next step. You can see past reports in the client portal at any time.'],
  ['Which areas do you cover?', 'The Western Algarve, from Carvoeiro to Sagres, including Ferragudo, Portimão, Alvor, Lagos, Praia da Luz, Burgau, Salema and Vila do Bispo.'],
  ['Do you look after apartments as well as villas?', 'Yes. We look after apartments, townhouses, villas and larger estates, with or without pools and gardens.'],
  ['Can you work with my existing gardener or pool company?', 'Yes, and we encourage it. We coordinate access and communication with the people who already know the house.'],
  ['What happens in an emergency?', 'We attend to see what is happening, contact you and call the right emergency or specialist service with your authorisation. We are a small local team, so emergency attendance depends on availability rather than a 24/7 guarantee.'],
  ['Is there a minimum contract term?', 'Yes. Plans run on a 12-month service agreement. You can pay monthly, or annually in advance with a 10% discount. Renewal and ending terms are set out in the Service Order and General Terms.'],
  ['Do you manage holiday rentals?', 'No. If the home is mainly let to guests, a rental manager is the better fit. Guardemar is for homes in private use.'],
] as const

export const planFaqs = [
  ...faqs,
  ['Who actually enters my property?', 'Guardemar and anyone you have specifically authorised — for example a contractor you approved. Nobody else.'],
  ['What happens if you are ill or away?', 'Visits are planned in advance. If one has to move, we tell you and agree a new date, so the house is never left unchecked without you knowing.'],
  ['Are you insured?', 'Ask us and we will confirm Guardemar’s current liability cover in writing. Our reports do not replace your own home insurance, and Guardemar does not sell insurance or give insurance advice.'],
  ['What happens if something is damaged during a visit?', 'We document it, tell you immediately and review what happened. Any repair or claim then follows the service terms and the relevant insurance policy.'],
] as const

export const areas = {
  carvoeiro: { name: 'Carvoeiro', profile: 'Clifftop villas, established residential developments and apartments used seasonally by international owners.', propertyTypes: 'Detached villas with pools and landscaped gardens are common around Carvoeiro, alongside apartments and townhouses in managed developments. Each creates a different access and oversight routine.', risks: 'Pool and irrigation faults, coastal humidity, vacant-period plumbing issues and exterior wear can develop quietly between visits.', absence: 'Many homes are occupied intensively during holiday periods and then stand quiet for several weeks or months, making a documented baseline particularly useful.', nearby: 'Ferragudo, Lagoa, Portimão and surrounding coastal communities.', guide: { slug: 'looking-after-second-home-carvoeiro', title: 'Looking After a Second Home in Carvoeiro' } },
  ferragudo: { name: 'Ferragudo', profile: 'Village homes, riverside apartments and villas on the slopes above the Arade, many used as seasonal second homes.', propertyTypes: 'Traditional village properties can have compact access and shared walls, whilst hillside villas add gates, terraces, pools and gardens. Riverside apartments may also depend on condominium access arrangements.', risks: 'Marine air, shutters, external metalwork, visible drainage and longer vacant periods are practical inspection priorities.', absence: 'Properties may be busy during summer and quiet for extended periods outside peak visits, when a scheduled local check provides a current visual record.', nearby: 'Carvoeiro, Lagoa, Portimão and surrounding Arade communities.', guide: { slug: 'ferragudo-riverside-hillside-villas', title: 'Ferragudo Riverside and Hillside Villas' } },
  portimao: { name: 'Portimão', profile: 'A varied mix of city apartments, riverside homes and properties around Praia da Rocha, often with shared building systems.', propertyTypes: 'City apartments may depend on condominium access and shared services, whilst riverside and coastal homes add balconies, shutters and marine exposure.', risks: 'Mail accumulation, water leaks, ventilation and coordination with condominium or building management are common priorities.', absence: 'Owners may use these homes for shorter visits throughout the year, so access instructions and a current property record help between stays.', nearby: 'Alvor, Ferragudo, Carvoeiro and Lagos.', guide: { slug: 'empty-apartments-portimao-praia-da-rocha', title: 'Empty Apartments in Portimão and Praia da Rocha' } },
  alvor: { name: 'Alvor', profile: 'Modern apartments, resort properties and villas close to the estuary and coast, many occupied only during part of the year.', propertyTypes: 'The local mix includes apartments in shared developments, townhouses and villas with pools or gardens. Exterior responsibilities should be clear where a condominium or resort operator is involved.', risks: 'Marine air, humidity, balconies, shutters and seasonal vacancy all benefit from structured visual checks.', absence: 'Seasonal ownership often creates long quiet periods outside summer and shorter gaps between winter visits.', nearby: 'Portimão, Mexilhoeira Grande, Lagos and surrounding communities.', guide: { slug: 'caring-for-second-home-alvor', title: 'Caring for a Second Home in Alvor' } },
  lagos: { name: 'Lagos', profile: 'Historic-centre apartments, marina properties and contemporary villas across Porto de Mós, Boavista and nearby residential areas.', propertyTypes: 'Apartments in the historic centre and Lagos Marina have different access and shared-building considerations from townhouses and villas in Porto de Mós, Boavista, Meia Praia, Odiáxere or Bensafrim.', risks: 'Different property types bring different needs: condominium access, coastal exposure, pool systems, gardens and longer vacant periods.', absence: 'International owners often combine several longer stays with months abroad. A repeatable inspection record helps distinguish a new issue from the property’s normal condition.', nearby: 'Porto de Mós, Meia Praia, Praia da Luz, Alvor, Odiáxere, Bensafrim and Burgau.', guide: { slug: 'second-home-lagos-maintenance-guide', title: 'Owning a Second Home in Lagos: A Practical Maintenance Guide' } },
  'praia-da-luz': { name: 'Praia da Luz', profile: 'An established international second-home community with coastal villas, townhouses and apartments, many with pools or gardens.', propertyTypes: 'Homes range from lock-up-and-leave apartments to detached villas with irrigation, external gates and pool equipment. The inspection scope should match those moving parts.', risks: 'Coastal humidity, Atlantic weather, seasonal vacancy, irrigation and pool condition are particularly relevant for absentee owners.', absence: 'Properties can be occupied regularly in summer yet remain closed for long stretches outside holiday periods, when airflow, visible moisture and exterior condition need attention.', nearby: 'Lagos, Porto de Mós, Burgau and Espiche.', guide: { slug: 'property-care-praia-da-luz-guide', title: 'Property Care in Praia da Luz: A Guide for Overseas Owners' } },
  burgau: { name: 'Burgau', profile: 'Village properties, hillside villas and modern homes in a smaller coastal setting popular with overseas owners.', propertyTypes: 'Compact village homes may have constrained access, whilst hillside villas add terraces, pools, gardens and more exposed external areas.', risks: 'Salt-laden air, access coordination, shutter condition and longer quiet-season vacancies merit a reliable local presence.', absence: 'A smaller village environment can feel reassuring, but a second home may still remain unopened outside holiday periods without a structured check.', nearby: 'Praia da Luz, Salema, Barão de São Miguel and Lagos.', guide: { slug: 'home-watch-burgau-salema', title: 'Home Watch in Burgau and Salema' } },
  salema: { name: 'Salema', profile: 'Coastal apartments and villas, including elevated properties that may be unoccupied outside holiday visits.', propertyTypes: 'Apartments near the village and elevated villas face different access, drainage and exterior responsibilities, particularly where pools or terraced gardens are present.', risks: 'Atlantic exposure, salt, wind-driven rain, exterior drainage and the practical distance from an owner abroad can make early reporting valuable.', absence: 'Seasonal use can leave homes quiet through unsettled winter periods, when remote owners benefit from dated photographs and clear issue priority.', nearby: 'Burgau, Figueira, Vila do Bispo and Praia da Luz.', guide: { slug: 'home-watch-burgau-salema', title: 'Home Watch in Burgau and Salema' } },
  'vila-do-bispo': { name: 'Vila do Bispo', profile: 'Village homes, rural properties and coastal second homes spread across a broad, less densely developed municipality.', propertyTypes: 'The area includes traditional village properties, detached rural homes and coastal villas, sometimes with longer drives, external land or multiple access points.', risks: 'Distance between properties, wind, weather exposure, gardens and longer vacancy periods increase the value of planned inspections.', absence: 'Owners living abroad may have fewer informal eyes nearby, making agreed access, contractor attendance and documented follow-up more important.', nearby: 'Salema, Raposeira, Sagres and the surrounding west coast.', guide: { slug: 'rural-village-homes-vila-do-bispo', title: 'Rural and Village Homes in Vila do Bispo' } },
  sagres: { name: 'Sagres', profile: 'Apartments, townhouses and detached homes in one of the Algarve’s most Atlantic-exposed locations.', propertyTypes: 'Properties range from village apartments to detached homes with gardens and exposed external areas. Shutters, gates, terraces and drainage deserve a consistent visual record.', risks: 'Strong wind, salt, driving rain and seasonal vacancy make exterior condition, shutters, drainage and post-weather checks especially relevant.', absence: 'Remote ownership and winter weather can coincide with long periods when nobody would otherwise enter the home.', nearby: 'Vila do Bispo, Raposeira, Salema and west-coast communities by assessment.', guide: { slug: 'property-care-sagres-west-coast', title: 'Property Care in Sagres and the West Coast' } },
} as const
import { subscriptionPlans } from './subscriptions.ts'
