export type StandardPage = {
  eyebrow: string
  title: string
  description: string
  aside: string
  sections: Array<{ title: string; paragraphs?: string[]; bullets?: string[] }>
}

export const standardPages: Record<string, StandardPage> = {
  'property-care': {
    eyebrow: 'Property Care', title: 'The wider care framework around a regularly inspected home.',
    description: 'Property care combines the core home watch inspection with authorised access, issue coordination and practical support before, during and after an owner’s absence.',
    aside: 'Start with Home Watch Algarve for the primary inspection service, then add support that fits the property.',
    sections: [
      { title: 'The core service is home watch', paragraphs: ['Scheduled inspections provide the recurring record of visible property condition. The Home Watch Algarve page explains the inspection method, reporting and escalation process in detail.'] },
      { title: 'Property care adds practical continuity', paragraphs: ['Around that inspection routine, Guardemar can hold keys, coordinate approved contractor access, check the home before an arrival and record visible follow-up after agreed work.'], bullets: ['Secure key handling', 'Authorised property access', 'Arrival and departure support', 'Issue and contractor coordination', 'Property-specific records', 'Owner communication'] },
      { title: 'A supporting role, not technical replacement', paragraphs: ['Guardemar provides visual oversight and coordination. Cleaning, gardening, pool maintenance and regulated or technical work remain the responsibility of suitable third-party professionals.'] },
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
    eyebrow: 'Service Directory', title: 'Specific support around the core home watch routine.',
    description: 'Use this directory to review key holding, contractor access, arrival preparation, property handover and post-weather visual checks.',
    aside: 'Home Watch Algarve remains the primary commercial service. These guides explain individual supporting tasks.',
    sections: [
      { title: 'Begin with the inspection service', paragraphs: ['The recurring relationship is defined on the Home Watch Algarve page. This directory avoids repeating that full explanation and instead sets out the scope of additional services.'] },
      { title: 'Support when something needs to happen', paragraphs: ['Owners can review a focused guide for a delivery, trade appointment, meter reading, post-departure check, handover or weather-related concern. Availability and fees are confirmed before attendance.'] },
      { title: 'Qualified work stays with qualified people', paragraphs: ['Guardemar coordinates cleaning, gardening, pool maintenance, air-conditioning service, plumbing, electrical work, pest control, painting and other services. Regulated or technical work is assigned to appropriately qualified third parties.'] },
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
    eyebrow: 'Holiday Home Care Algarve', title: 'Your holiday home should be ready for holidays — not surprises.',
    description: 'Guardemar provides holiday home care across the Western Algarve for owners who use their Portuguese property personally rather than operating it as a full-time rental.',
    aside: 'Scheduled care for a home that may sit empty between owner visits.',
    sections: [
      { title: 'What changes while a holiday home is empty', paragraphs: ['Water systems sit unused. Humidity can build. A shutter can loosen, a fridge can fail or irrigation can stop. Mail gathers and small signs of damage remain unseen. Regular checks put a person back into that gap.'] },
      { title: 'Before you arrive', paragraphs: ['A pre-arrival visit can confirm the property is accessible and visually in order. Water, power, hot water and air conditioning can be checked as agreed, with cleaning or specialist follow-up coordinated in advance.'] },
      { title: 'After you leave', paragraphs: ['A post-departure check can confirm doors, windows and agreed systems are left as intended, making the next period of vacancy easier to manage.'] },
    ],
  },
  'second-home-care-algarve': {
    eyebrow: 'Second Home Care Portugal', title: 'Stay connected to your Algarve home from another country.',
    description: 'Owning a second home abroad should not depend on informal favours. Guardemar provides consistent property inspections and a reliable local point of contact.',
    aside: 'For international owners spending weeks or months away from Portugal.',
    sections: [
      { title: 'Continuity matters', paragraphs: ['The value of second-home care is not only a single inspection. It is the continuity of a person who knows the property, recognises changes and keeps a useful history of observations and action.'] },
      { title: 'Designed for overseas ownership', paragraphs: ['Reports are concise, photographic and easy to review remotely. Contractor visits can be coordinated and arrival preparation arranged, reducing the number of separate contacts an owner must manage.'] },
      { title: 'Apartments, townhouses and villas', paragraphs: ['Service scope reflects the property. An apartment may need mail, internal moisture and building-access checks. A villa may add gates, terraces, irrigation, pool condition and a larger exterior.'] },
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
    aside: 'A modern property care service grounded in human presence and clear documentation.',
    sections: [
      { title: 'Why Guardemar exists', paragraphs: ['Property owners abroad should not have to rely on neighbours, informal contacts or fragmented contractors to know whether their home is okay. Guardemar provides one accountable local point of contact.'] },
      { title: 'How trust is earned', paragraphs: ['Trust is not created by invented customer counts or vague promises. It comes from turning up, following the agreed process, documenting what was found, communicating clearly and respecting the boundary between inspection and specialist work.'], bullets: ['Accountability', 'Documentation', 'Preventive care', 'Clear communication', 'Local knowledge', 'A trusted professional network', 'Human presence'] },
      { title: 'Built to develop with owners', paragraphs: ['The service begins with property care and home watch. Its structured property profiles and inspection history also create a sound basis for future owner dashboards, documents, sensors and smart home monitoring.'] },
    ],
  },
}
