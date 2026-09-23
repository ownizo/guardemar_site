export type StandardPage = {
  eyebrow: string
  title: string
  description: string
  aside: string
  sections: Array<{ title: string; paragraphs?: string[]; bullets?: string[] }>
}

export const standardPages: Record<string, StandardPage> = {
  'property-care': {
    eyebrow: 'Second-home management', title: 'This page has moved.',
    description: 'Property care is the old name. The service is second-home management for privately used homes in the Western Algarve: inspections, keys, reports and coordination. Not a rental operation.',
    aside: 'The current explanation is on the second-home management page.',
    sections: [
      { title: 'Same work, the name owners actually search', paragraphs: ['Guardemar still visits the house, writes the report and coordinates the people you already use. We do not take bookings or guests.', 'Start with the management page. The inspection itself is explained separately.'] },
    ],
  },
  'home-watch': {
    eyebrow: 'Home Watch', title: 'A real person checks the home. A clear report shows what they found.',
    description: 'Home watch is a scheduled visual inspection for an unoccupied or intermittently occupied property. It is structured, repeatable and documented after every visit.',
    aside: 'No wondering. No vague WhatsApp messages. A documented inspection after every visit.',
    sections: [
      { title: 'What happens during an inspection', paragraphs: ['We follow an agreed checklist covering access, visible security concerns, water, moisture, electricity, ventilation, kitchens, bathrooms and relevant exterior areas. Pool and garden condition can also be observed without replacing professional maintenance.'], bullets: ['Check agreed access points', 'Look for visible leaks and moisture', 'Review obvious electrical status', 'Check ventilation and agreed systems', 'Observe exterior, pool and garden condition', 'Photograph and report findings'] },
      { title: 'Report and action', paragraphs: ['Each scheduled visit creates a digital report with date, status, observations, photographs and recommended next actions. If attention is needed, the owner is contacted and Guardemar can coordinate the appropriate local professional with authorisation.'] },
      { title: 'Post-weather checks', paragraphs: ['After significant local weather, subscribed properties can be inspected according to plan, safe access and operational availability. This provides photographic confirmation without making an unrealistic promise to monitor every weather event.'] },
      { title: 'Professional boundaries', paragraphs: ['A Guardemar inspection is non-invasive and visual. It does not replace a technical survey and cannot guarantee detection of hidden defects. It is not structural, electrical, plumbing, pool or engineering certification.'] },
    ],
  },
  services: {
    eyebrow: 'What we can arrange', title: 'Services around the management of a second home.',
    description: 'Key holding, contractor access, arrival preparation, handover and post-weather checks. Optional services sit outside the monthly plans.',
    aside: 'The management relationship is the plan. These pages explain a single job inside it.',
    sections: [
      { title: 'Start with the house, not a booking', paragraphs: ['Second-home management is the service. An inspection is how we see the property. The guides below are for one specific need: keys, a trade visit, an arrival, a handover or weather.'] },
      { title: 'Qualified work stays with qualified people', paragraphs: ['Guardemar coordinates cleaning, gardening, pool maintenance and regulated trades. We pass you the quote. We do not approve it unless you have said so, and we do not certify the work.'] },
    ],
  },
  'how-it-works': {
    eyebrow: 'How It Works', title: 'A clear relationship from the first property assessment.',
    description: 'We begin by understanding the property, its systems and your priorities. From there, every visit follows agreed instructions and produces a documented outcome.',
    aside: 'One accountable local contact, with the property profile ready when action is needed.',
    sections: [
      { title: '01 — Property assessment', paragraphs: ['We meet at the property to understand the home, its access, systems, occupancy pattern and the owner’s main concerns. This allows an appropriate scope and price to be proposed.'] },
      { title: '02 — Property profile', paragraphs: ['Access instructions, important systems, contacts, existing contractors and service requirements are documented in a working property profile.'] },
      { title: '03 — Secure key handover', paragraphs: ['Keys are catalogued, coded rather than labelled with a full property address, stored securely and accessed only for authorised purposes.'] },
      { title: '04 — Scheduled inspections', paragraphs: ['Guardemar visits according to the selected plan and follows the property-specific checklist, adding agreed seasonal or property-specific tasks.'] },
      { title: '05 — Report and action', paragraphs: ['The owner receives the digital report. If an issue is found, we explain the priority and coordinate the agreed next action.'] },
    ],
  },
  'holiday-home-care': {
    eyebrow: 'Second-home management', title: 'A holiday home you use yourself is still a house that needs managing.',
    description: 'Guardemar manages privately used holiday homes across the Western Algarve. Inspections, keys and coordination. No guest operation.',
    aside: 'If the house is mainly let, this is the wrong company.',
    sections: [
      { title: 'What changes while the house is empty', paragraphs: ['Water sits unused. Humidity builds. A shutter loosens or irrigation stops. The management is a person in that gap, on a schedule, with a report.'] },
      { title: 'Read the current service', paragraphs: ['The full explanation is the second-home management page. Plan frequency is on the plans page.'] },
    ],
  },
  'second-home-care-algarve': {
    eyebrow: 'Second-home management', title: 'Second-home care is the same service, under the name people search.',
    description: 'Guardemar manages second homes in the Western Algarve for owners who live abroad. Not rental management.',
    aside: 'Use the management page as the reference.',
    sections: [
      { title: 'One relationship', paragraphs: ['Inspections, keys, reports and coordination of your existing pool, garden and cleaning companies. The current page for that offer is second-home management.'] },
    ],
  },
  'property-management-algarve': {
    eyebrow: 'Property Management Algarve', title: 'Looking for property management — but not holiday rental management?',
    description: 'Many overseas owners search for property management in the Algarve when what they really need is property care: someone checking the home itself while they are away.',
    aside: 'Traditional property management often focuses on guests and bookings. Guardemar focuses on the property itself.',
    sections: [
      { title: 'The distinction', paragraphs: ['Rental management is commonly organised around marketing, bookings, guest communication, changeovers and revenue. Property care is organised around condition, preventive checks, documentation and owner communication.'] },
      { title: 'When Guardemar is the better fit', bullets: ['The home is primarily for private use', 'The property is vacant for meaningful periods', 'You already have a cleaner, gardener or pool company', 'You want independent visual checks and reports', 'You need one local contact to coordinate access and action'] },
      { title: 'Property maintenance coordination', paragraphs: ['Guardemar is not a cheap maintenance company or a substitute for licensed trades. We identify visible concerns, keep the owner informed and coordinate suitable professionals where requested.'] },
    ],
  },
  'property-handover': {
    eyebrow: 'Guardemar Property Handover', title: 'Start your ownership with a documented property baseline.',
    description: 'A practical handover service for owners who have recently completed a purchase and need an organised record of the home before spending time abroad.',
    aside: 'Scope and pricing are confirmed after reviewing the property, access and required records.',
    sections: [
      { title: 'A useful starting record', paragraphs: ['The handover creates a clear visual reference and gathers practical information that can otherwise remain scattered between agents, sellers and contractors.'], bullets: ['Property condition photography', 'Key inventory', 'Utility meter readings', 'Visible equipment inventory', 'Alarm and Wi-Fi details where provided', 'Air-conditioning, pool and irrigation overview', 'Visible defects', 'Important contractor and contact details', 'Basic owner property file'] },
      { title: 'Continue with monthly care', paragraphs: ['The documented baseline naturally supports ongoing Guardemar Care. Future visits can be compared against the established property profile and owner instructions.'] },
    ],
  },
  'arrival-preparation': {
    eyebrow: 'Arrival Preparation', title: 'Arrive at your home — not a list of problems.',
    description: 'A pre-arrival visit helps overseas owners know the property is accessible and visually ready before travelling to Portugal.',
    aside: 'Tasks are agreed in advance and adapted to the property.',
    sections: [
      { title: 'Before your journey', bullets: ['Property inspection before arrival', 'Ventilation', 'Water and electricity check', 'Hot-water check', 'Air-conditioning check where agreed', 'Fridge status', 'Garden and pool visual check', 'Contractor follow-up', 'Cleaning coordination'] },
      { title: 'What this service does not imply', paragraphs: ['Arrival preparation is a practical visual and operational check, not a guarantee that every appliance or concealed system is defect-free. Specialist repairs remain the work of qualified providers.'] },
    ],
  },
  about: {
    eyebrow: 'About Guardemar', title: 'Someone local. Someone accountable.',
    description: 'Guardemar was created around a simple idea: if you own a home in Portugal, you should always know how it is — even when you are thousands of kilometres away.',
    aside: 'A modern second-home management service: a person on site, and a record of what they found.',
    sections: [
      { title: 'Why Guardemar exists', paragraphs: ['Property owners abroad should not have to rely on neighbours, informal contacts or fragmented contractors to know whether their home is okay. Guardemar provides one accountable local point of contact.'] },
      { title: 'How trust is earned', paragraphs: ['Trust is not created by invented customer counts or vague promises. It comes from turning up, following the agreed process, documenting what was found, communicating clearly and respecting the boundary between inspection and specialist work.'], bullets: ['Accountability', 'Documentation', 'Preventive care', 'Clear communication', 'Local knowledge', 'A trusted professional network', 'Human presence'] },
      { title: 'Built to develop with owners', paragraphs: ['The service begins with property care and home watch. Its structured property profiles and inspection history also create a sound basis for future owner dashboards, documents, sensors and smart home monitoring.'] },
    ],
  },
}
