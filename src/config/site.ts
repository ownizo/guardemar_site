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
  descriptor: 'Private Property Care',
  address: {
    street: 'Varandas de São João',
    unit: 'Lote 4, 2º E',
    city: 'Lagos',
    country: 'Portugal',
    addressLines: ['Varandas de São João', 'Lote 4, 2º E', 'Lagos', 'Portugal'],
  },
} as const

export const legalLastUpdated = '4 September 2026'

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
    { '@type': ['ProfessionalService', 'LocalBusiness', 'Organization'], '@id': 'https://guardemar.com/#business', name: 'GUARDEMAR', legalName: legalEntity.legalName, taxID: legalEntity.taxId, brand: { '@type': 'Brand', name: legalEntity.tradingName }, description: 'Private property care and home watch services for holiday homes and second homes in the Western Algarve, Portugal.', url: 'https://guardemar.com/', logo: 'https://guardemar.com/guardemar-logo.svg', priceRange: '€69–€179 per month', telephone: legalEntity.phone, email: legalEntity.contactEmail, address: { '@type': 'PostalAddress', streetAddress: `${operationalContact.address.street}, ${operationalContact.address.unit}`, addressLocality: operationalContact.address.city, addressCountry: 'PT' }, areaServed: ['Carvoeiro', 'Ferragudo', 'Portimão', 'Alvor', 'Lagos', 'Praia da Luz', 'Burgau', 'Salema', 'Vila do Bispo', 'Sagres'].map((name) => ({ '@type': 'Place', name })) },
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
    knowsAbout: ['Private property care', 'Risk management', 'International business', 'Travel technology'],
  },
} as const

export const navigation = [
  { label: 'Home Watch', href: '/home-watch-algarve/' }, { label: 'Property Care', href: '/property-care/' }, { label: 'Services', href: '/services/' },
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

export const planFaqs = [
  ...faqs,
  ['Who actually enters my property?', 'Access is limited to Guardemar and any person specifically authorised under the agreed service arrangements. [CONFIRM: named staff and substitute-access procedure].'],
  ['What happens if you are ill or away?', '[CONFIRM: service-continuity arrangement]. Any approved cover must use the property instructions, access controls and reporting process agreed with the owner.'],
  ['Are you insured?', '[CONFIRM: insurer, policy type and cover level]. Guardemar does not sell insurance or provide insurance advice.'],
  ['How are my keys stored and who can authorise access?', 'Keys are coded rather than labelled with a full property address and stored securely. Access is limited to authorised purposes; the owner defines who may be admitted and under what circumstances.'],
  ['What happens if something is damaged during a visit?', 'The condition is documented, the owner is informed and the circumstances are reviewed promptly. Any responsibility, repair or insurance process depends on the facts and the applicable service and policy terms.'],
  ['Is there a minimum contract term?', '[CONFIRM: minimum contract term and cancellation notice]. These terms must be stated in the quotation and service agreement before an owner commits.'],
] as const

export const areas = {
  carvoeiro: { name: 'Carvoeiro', profile: 'Clifftop villas, established residential developments and apartments used seasonally by international owners.', propertyTypes: 'Detached villas with pools and landscaped gardens are common around Carvoeiro, alongside apartments and townhouses in managed developments. Each creates a different access and oversight routine.', risks: 'Pool and irrigation faults, coastal humidity, vacant-period plumbing issues and exterior wear can develop quietly between visits.', absence: 'Many homes are occupied intensively during holiday periods and then stand quiet for several weeks or months, making a documented baseline particularly useful.', nearby: 'Ferragudo, Lagoa, Portimão and surrounding coastal communities.' },
  ferragudo: { name: 'Ferragudo', profile: 'Village homes, riverside apartments and villas on the slopes above the Arade, many used as seasonal second homes.', propertyTypes: 'Traditional village properties can have compact access and shared walls, whilst hillside villas add gates, terraces, pools and gardens. Riverside apartments may also depend on condominium access arrangements.', risks: 'Marine air, shutters, external metalwork, visible drainage and longer vacant periods are practical inspection priorities.', absence: 'Properties may be busy during summer and quiet for extended periods outside peak visits, when a scheduled local check provides a current visual record.', nearby: 'Carvoeiro, Lagoa, Portimão and surrounding Arade communities.' },
  portimao: { name: 'Portimão', profile: 'A varied mix of city apartments, riverside homes and properties around Praia da Rocha, often with shared building systems.', propertyTypes: 'City apartments may depend on condominium access and shared services, whilst riverside and coastal homes add balconies, shutters and marine exposure.', risks: 'Mail accumulation, water leaks, ventilation and coordination with condominium or building management are common priorities.', absence: 'Owners may use these homes for shorter visits throughout the year, so access instructions and a current property record help between stays.', nearby: 'Alvor, Ferragudo, Carvoeiro and Lagos.' },
  alvor: { name: 'Alvor', profile: 'Modern apartments, resort properties and villas close to the estuary and coast, many occupied only during part of the year.', propertyTypes: 'The local mix includes apartments in shared developments, townhouses and villas with pools or gardens. Exterior responsibilities should be clear where a condominium or resort operator is involved.', risks: 'Marine air, humidity, balconies, shutters and seasonal vacancy all benefit from structured visual checks.', absence: 'Seasonal ownership often creates long quiet periods outside summer and shorter gaps between winter visits.', nearby: 'Portimão, Mexilhoeira Grande, Lagos and surrounding communities.' },
  lagos: { name: 'Lagos', profile: 'Historic-centre apartments, marina properties and contemporary villas across Porto de Mós, Boavista and nearby residential areas.', propertyTypes: 'Apartments in the historic centre and Lagos Marina have different access and shared-building considerations from townhouses and villas in Porto de Mós, Boavista, Meia Praia, Odiáxere or Bensafrim.', risks: 'Different property types bring different needs: condominium access, coastal exposure, pool systems, gardens and longer vacant periods.', absence: 'International owners often combine several longer stays with months abroad. A repeatable inspection record helps distinguish a new issue from the property’s normal condition.', nearby: 'Porto de Mós, Meia Praia, Praia da Luz, Alvor, Odiáxere, Bensafrim and Burgau.' },
  'praia-da-luz': { name: 'Praia da Luz', profile: 'An established international second-home community with coastal villas, townhouses and apartments, many with pools or gardens.', propertyTypes: 'Homes range from lock-up-and-leave apartments to detached villas with irrigation, external gates and pool equipment. The inspection scope should match those moving parts.', risks: 'Coastal humidity, Atlantic weather, seasonal vacancy, irrigation and pool condition are particularly relevant for absentee owners.', absence: 'Properties can be occupied regularly in summer yet remain closed for long stretches outside holiday periods, when airflow, visible moisture and exterior condition need attention.', nearby: 'Lagos, Porto de Mós, Burgau and Espiche.' },
  burgau: { name: 'Burgau', profile: 'Village properties, hillside villas and modern homes in a smaller coastal setting popular with overseas owners.', propertyTypes: 'Compact village homes may have constrained access, whilst hillside villas add terraces, pools, gardens and more exposed external areas.', risks: 'Salt-laden air, access coordination, shutter condition and longer quiet-season vacancies merit a reliable local presence.', absence: 'A smaller village environment can feel reassuring, but a second home may still remain unopened outside holiday periods without a structured check.', nearby: 'Praia da Luz, Salema, Barão de São Miguel and Lagos.' },
  salema: { name: 'Salema', profile: 'Coastal apartments and villas, including elevated properties that may be unoccupied outside holiday visits.', propertyTypes: 'Apartments near the village and elevated villas face different access, drainage and exterior responsibilities, particularly where pools or terraced gardens are present.', risks: 'Atlantic exposure, salt, wind-driven rain, exterior drainage and the practical distance from an owner abroad can make early reporting valuable.', absence: 'Seasonal use can leave homes quiet through unsettled winter periods, when remote owners benefit from dated photographs and clear issue priority.', nearby: 'Burgau, Figueira, Vila do Bispo and Praia da Luz.' },
  'vila-do-bispo': { name: 'Vila do Bispo', profile: 'Village homes, rural properties and coastal second homes spread across a broad, less densely developed municipality.', propertyTypes: 'The area includes traditional village properties, detached rural homes and coastal villas, sometimes with longer drives, external land or multiple access points.', risks: 'Distance between properties, wind, weather exposure, gardens and longer vacancy periods increase the value of planned inspections.', absence: 'Owners living abroad may have fewer informal eyes nearby, making agreed access, contractor attendance and documented follow-up more important.', nearby: 'Salema, Raposeira, Sagres and the surrounding west coast.' },
  sagres: { name: 'Sagres', profile: 'Apartments, townhouses and detached homes in one of the Algarve’s most Atlantic-exposed locations.', propertyTypes: 'Properties range from village apartments to detached homes with gardens and exposed external areas. Shutters, gates, terraces and drainage deserve a consistent visual record.', risks: 'Strong wind, salt, driving rain and seasonal vacancy make exterior condition, shutters, drainage and post-weather checks especially relevant.', absence: 'Remote ownership and winter weather can coincide with long periods when nobody would otherwise enter the home.', nearby: 'Vila do Bispo, Raposeira, Salema and west-coast communities by assessment.' },
} as const
