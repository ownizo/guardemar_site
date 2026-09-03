export const business = {
  name: 'GUARDEMAR',
  descriptor: 'Private Property Care',
  tagline: "Here when you're away.",
  phone: '+351 928 226 570',
  phoneHref: 'tel:+351928226570',
  email: 'info@guardemar.com',
  emailHref: 'mailto:info@guardemar.com',
  whatsapp: 'https://wa.me/351928226570',
  addressLines: ['Varandas de São João', 'Lote 4, 2º E', 'Lagos', 'Portugal'],
  territory: 'Western Algarve — from Carvoeiro to Sagres.',
  schema: { '@context': 'https://schema.org', '@graph': [
    { '@type': ['LocalBusiness', 'Organization'], '@id': 'https://guardemar.com/#business', name: 'GUARDEMAR', description: 'Private property care and home watch services for holiday homes and second homes in the Western Algarve, Portugal.', url: 'https://guardemar.com', telephone: '+351928226570', email: 'info@guardemar.com', address: { '@type': 'PostalAddress', streetAddress: 'Varandas de São João, Lote 4, 2º E', addressLocality: 'Lagos', addressCountry: 'PT' }, areaServed: ['Carvoeiro', 'Ferragudo', 'Portimão', 'Alvor', 'Lagos', 'Praia da Luz', 'Burgau', 'Salema', 'Vila do Bispo', 'Sagres', 'Western Algarve', 'Portugal'].map((name) => ({ '@type': 'Place', name })) },
    { '@type': 'WebSite', '@id': 'https://guardemar.com/#website', url: 'https://guardemar.com', name: 'GUARDEMAR', publisher: { '@id': 'https://guardemar.com/#business' }, inLanguage: 'en-GB' },
  ] },
}

export const navigation = [
  { label: 'Property Care', href: '/property-care/' }, { label: 'Services', href: '/services/' },
  { label: 'Plans', href: '/plans/' }, { label: 'Areas', href: '/areas/' },
  { label: 'How It Works', href: '/how-it-works/' }, { label: 'Insights', href: '/blog/' },
  { label: 'About', href: '/about/' }, { label: 'Contact', href: '/contact/' },
] as const

export const trustPoints = ['Regular inspections', 'Photo reports', 'Local issue response', 'Contractor coordination', 'Secure key holding', 'Arrival preparation']

export const plans = [
  { name: 'GUARDEMAR CARE', price: 69, description: 'For owners who want a reliable monthly check.', popular: false, highlights: ['1 scheduled inspection per month', 'Secure key holding', 'Interior and exterior visual checks', 'Inspection photographs', 'Digital visit report', 'Issue notification'], items: ['1 scheduled property inspection per month', 'secure key holding', 'interior visual inspection', 'doors and windows check', 'signs of forced entry or damage', 'water leak and visible plumbing checks', 'electricity status', 'humidity, damp and mould indicators', 'ceiling and wall inspection', 'bathrooms and toilets', 'mail collection/check', 'basic exterior inspection', 'inspection photographs', 'digital visit report', 'notification of detected issues'] },
  { name: 'GUARDEMAR CARE+', price: 119, description: 'For more regular oversight and practical coordination.', popular: true, highlights: ['2 scheduled inspections per month', 'Everything in CARE', 'Ventilation and water circulation', 'Pool and irrigation visual checks', 'Contractor access coordination', 'Pre-arrival basic check'], items: ['2 scheduled inspections per month', 'everything in CARE', 'property ventilation where appropriate', 'running taps and flushing toilets', 'drain checks', 'air-conditioning visual/function check where agreed', 'garden irrigation visual check', 'pool condition visual check', 'gate and exterior access check', 'appliance visual check', 'enhanced photo reporting', 'contractor access coordination', 'pre-arrival basic property check', 'priority issue reporting', 'one post-severe-weather visual inspection where operationally applicable'] },
  { name: 'GUARDEMAR COMPLETE', price: 179, description: 'Frequent oversight for homes with more moving parts.', popular: false, highlights: ['Weekly scheduled inspections', 'Everything in CARE+', 'Enhanced maintenance oversight', 'Monthly condition summary', 'Arrival preparation coordination', 'Higher service priority'], items: ['weekly scheduled property inspections', 'everything in CARE+', 'priority response', 'enhanced maintenance oversight', 'contractor coordination', 'delivery/access assistance by arrangement', 'mail management', 'arrival preparation coordination', 'preventive maintenance reminders', 'monthly property condition summary', 'priority post-weather inspection', 'higher service priority'] },
] as const

export const services = [
  'Additional property visit', 'Emergency call-out', 'Contractor access', 'Waiting for tradespeople', 'Delivery attendance', 'Pre-arrival preparation', 'Post-departure check', 'Storm inspection', 'Key holding', 'Mail handling', 'Meter readings', 'Property handover inspection', 'Inventory photography', 'Cleaning coordination', 'Gardening coordination', 'Pool maintenance coordination', 'Air-conditioning servicing coordination', 'Plumbing coordination', 'Electrical contractor coordination', 'Pest-control coordination', 'Painting coordination', 'Pressure washing coordination', 'Solar-panel cleaning coordination',
]

export const faqs = [
  ['What is a home watch service?', 'A scheduled, visual inspection of an unoccupied or intermittently occupied home. Guardemar checks agreed areas, documents the condition and reports anything requiring attention.'],
  ['Is Guardemar the same as a property management company?', 'Not in the holiday-rental sense. Traditional property management often focuses on guests and bookings. Guardemar focuses on the property itself.'],
  ['Do you manage holiday rentals?', 'Guardemar is not primarily a rental manager or booking operator. We care for privately owned holiday homes and second homes while their owners are away.'],
  ['How often should my property be checked?', 'That depends on the home, season, systems and risk profile. Monthly, fortnightly and weekly options are available, with a recommendation made after assessment.'],
  ['What happens if you find a leak?', 'We document the issue, contact the owner, take reasonable agreed steps to limit further damage and coordinate a suitable qualified professional where authorised.'],
  ['Can you arrange a plumber or electrician?', 'Yes. Guardemar can coordinate licensed or qualified third-party professionals. Specialist work is not performed by Guardemar unless explicitly stated and appropriately qualified.'],
  ['Can you let contractors into my property?', 'Yes, by prior owner authorisation. Access can be logged and the property checked after the visit if arranged.'],
  ['Do you hold keys?', 'Yes. Keys are coded, securely stored and managed with controlled access rather than labelled with a complete property address.'],
  ['Do you inspect swimming pools and gardens?', 'We can visually check their general condition and obvious warning signs. Professional pool maintenance and gardening are separate services that can be coordinated.'],
  ['Can you prepare the property before we arrive?', 'Yes. Arrival preparation can include a pre-arrival inspection, ventilation and checks of water, power, hot water, air conditioning, pool and garden condition.'],
  ['Can you inspect after a storm?', 'Post-weather checks are available according to the selected plan, local conditions, safe access and operational availability. We do not guarantee monitoring of every weather event.'],
  ['Do you provide reports?', 'Yes. Scheduled inspections include a digital report with status, observations, photographs, issues and recommended next actions.'],
  ['Which areas do you cover?', 'The Western Algarve, from Carvoeiro to Sagres, including Portimão, Alvor, Lagos, Praia da Luz, Burgau, Salema and Vila do Bispo.'],
  ['Can you look after apartments as well as villas?', 'Yes. Plans are adapted for apartments, townhouses, villas and larger properties, with or without pools and gardens.'],
  ['Can you work with my existing gardener or pool company?', 'Yes. Guardemar can coordinate access and communication with existing providers, subject to clear owner instructions and authorisation.'],
  ['What happens in an emergency?', 'We assess what can safely be observed, contact the owner and coordinate the appropriate emergency or specialist service where authorised. Response depends on availability and is not represented as 24/7 cover.'],
  ['Do I have to sign a long-term contract?', 'Commercial terms are confirmed with each proposal. Ask us about the current options during your property assessment.'],
] as const

export const areas = {
  carvoeiro: { name: 'Carvoeiro', profile: 'Clifftop villas, established residential developments and apartments used seasonally by international owners.', risks: 'Pool and irrigation faults, coastal humidity, vacant-period plumbing issues and exterior wear can develop quietly between visits.', nearby: 'Ferragudo, Lagoa, Portimão and surrounding coastal communities.' },
  portimao: { name: 'Portimão', profile: 'A varied mix of city apartments, riverside homes and properties around Praia da Rocha, often with shared building systems.', risks: 'Mail accumulation, water leaks, ventilation and coordination with condominium or building management are common priorities.', nearby: 'Alvor, Ferragudo, Carvoeiro and Lagos.' },
  alvor: { name: 'Alvor', profile: 'Modern apartments, resort properties and villas close to the estuary and coast, many occupied only during part of the year.', risks: 'Marine air, humidity, balconies, shutters and seasonal vacancy all benefit from structured visual checks.', nearby: 'Portimão, Mexilhoeira Grande, Lagos and surrounding communities.' },
  lagos: { name: 'Lagos', profile: 'Historic-centre apartments, marina properties and contemporary villas across Porto de Mós and nearby residential areas.', risks: 'Different property types bring different needs: condominium access, coastal exposure, pool systems, gardens and longer vacant periods.', nearby: 'Porto de Mós, Praia da Luz, Alvor and Burgau.' },
  'praia-da-luz': { name: 'Praia da Luz', profile: 'An established international second-home market with villas, townhouses and apartments, many with pools or gardens.', risks: 'Coastal humidity, seasonal vacancy, storm exposure, irrigation and pool condition are particularly relevant for absentee owners.', nearby: 'Lagos, Porto de Mós, Burgau and Espiche.' },
  burgau: { name: 'Burgau', profile: 'Village properties, hillside villas and modern homes in a smaller coastal setting popular with overseas owners.', risks: 'Salt-laden air, access coordination, shutter condition and longer quiet-season vacancies merit a reliable local presence.', nearby: 'Praia da Luz, Salema, Barão de São Miguel and Lagos.' },
  salema: { name: 'Salema', profile: 'Coastal apartments and villas, including elevated properties that may be unoccupied outside holiday visits.', risks: 'Atlantic exposure, wind-driven rain, exterior drainage and the practical distance from an owner abroad can make early reporting valuable.', nearby: 'Burgau, Figueira, Vila do Bispo and Praia da Luz.' },
  'vila-do-bispo': { name: 'Vila do Bispo', profile: 'Village homes, rural properties and coastal second homes spread across a broad, less densely developed municipality.', risks: 'Distance between properties, wind, weather exposure, gardens and longer vacancy periods increase the value of planned inspections.', nearby: 'Salema, Raposeira, Sagres and the surrounding west coast.' },
  sagres: { name: 'Sagres', profile: 'Apartments, townhouses and detached homes in one of the Algarve’s most Atlantic-exposed locations.', risks: 'Strong wind, salt exposure, storm conditions, remote ownership and seasonal vacancy can accelerate visible exterior deterioration.', nearby: 'Vila do Bispo, Raposeira, Salema and west-coast communities by assessment.' },
} as const
