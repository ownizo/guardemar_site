export type OptionalServiceIcon =
  | 'mail'
  | 'shopping'
  | 'plane'
  | 'sparkles'
  | 'shirt'
  | 'wrench'
  | 'package'
  | 'car'
  | 'trees'
  | 'key'
  | 'phone'
  | 'storm'

export type OptionalService = {
  id: string
  name: string
  icon: OptionalServiceIcon
  description: string
  adminOnly?: boolean
  fee: string
  extraCost?: string
}

export type OptionalServiceGroup = {
  id: string
  heading: string
  text: string
  serviceIds: readonly string[]
}

export const addonServiceCatalogue = [
  {
    id: 'mail-care',
    name: 'Mail Care',
    icon: 'mail',
    description: 'Stay on top of important correspondence while you are away. During scheduled Guardemar visits, mail received at the property can be collected and, where requested, securely photographed or scanned for remote review. Originals can be retained, and forwarding can be arranged on request. Correspondence is not opened as a matter of routine, and collection takes place with scheduled attendance unless otherwise agreed.',
    fee: '€15/month + VAT',
  },
  {
    id: 'pre-arrival-shopping',
    name: 'Pre-Arrival Shopping',
    icon: 'shopping',
    description: 'Send Guardemar a shopping list before you travel and the essentials can be waiting when you arrive. Quantities, preferred brands, acceptable alternatives and special instructions can be included. The Guardemar service fee is charged separately. The cost of your shopping will be handled through the Guardemar client account.',
    fee: '€80 + VAT',
    extraCost: 'shopping expenses additional',
  },
  {
    id: 'airport-transfer-coordination',
    name: 'Airport Transfer Coordination',
    icon: 'plane',
    description: 'Guardemar can arrange an airport transfer with an independent transport provider, between the airport and your property or from the property back to the airport. Guardemar coordinates the booking; it is not the transport operator. The fare is charged separately from the Guardemar fee.',
    fee: '€25 + VAT',
    extraCost: 'transfer cost additional',
  },
  {
    id: 'property-deep-clean-coordination',
    name: 'Property Deep Clean Coordination',
    icon: 'sparkles',
    description: 'Guardemar can arrange an extraordinary professional deep clean — before an arrival, after a stay, or when the property needs additional attention. The cleaning is carried out by an external provider coordinated by Guardemar.',
    fee: '€35 + VAT',
    extraCost: 'provider cost additional',
  },
  {
    id: 'laundry-linen-service',
    name: 'Laundry & Linen Service',
    icon: 'shirt',
    description: 'Collection, professional laundering and return of bed linen and towels through an external laundry provider, so they can be ready when you return. The laundry provider’s charge is separate from the Guardemar fee.',
    fee: '€25 + VAT',
    extraCost: 'provider cost additional',
  },
  {
    id: 'maintenance-visit-contractor-access',
    name: 'Maintenance Visit & Contractor Access',
    icon: 'wrench',
    description: 'When a technician or contractor needs access while you are away, Guardemar can attend, provide authorised access and remain present during the agreed visit. This is attendance and access coordination, not technical supervision, certification or a guarantee of the contractor’s work.',
    fee: '€50 + VAT',
  },
  {
    id: 'delivery-installation-attendance',
    name: 'Delivery & Installation Attendance',
    icon: 'package',
    description: 'Guardemar can attend the property to receive an agreed delivery and provide access for installation where required, so you do not need to travel simply to meet a delivery or installation team. Guardemar does not certify installation quality or assume technical responsibility for the supplier’s work.',
    fee: '€40 + VAT',
  },
  {
    id: 'vehicle-care',
    name: 'Vehicle Care',
    icon: 'car',
    description: 'Agreed visual checks of a vehicle left at the property and, where specifically agreed and legally and operationally permitted, basic measures intended to help keep it ready for your return. This does not include mechanical maintenance, repairs, roadworthiness, a guaranteed battery condition, or moving the vehicle unless separately and expressly approved.',
    fee: '€25/month + VAT',
  },
  {
    id: 'pool-garden-contractor-check',
    name: 'Pool & Garden Contractor Check',
    icon: 'trees',
    description: 'At your request, Guardemar can make an additional visit after a pool, garden or similar contractor has attended, and provide a visual update on the apparent condition of the property and the area concerned. This is a visual follow-up, not a technical inspection, certification or guarantee of workmanship.',
    fee: '€30 + VAT',
  },
  {
    id: 'key-handover',
    name: 'Key Handover',
    icon: 'key',
    description: 'Guardemar can arrange an extraordinary key handover or collection for a person specifically authorised by the property owner, when access needs to be provided or recovered and you are not in Portugal.',
    fee: '€40 + VAT',
  },
  {
    id: 'emergency-call-out',
    name: 'Emergency Call-Out',
    icon: 'phone',
    description: 'When something at the property cannot reasonably wait for the next scheduled visit, Guardemar may provide an extraordinary call-out, subject to availability and the nature of the situation. This is not 24-hour cover, an emergency-services response, guaranteed attendance or a technical repair.',
    fee: '€75 + VAT',
  },
  {
    id: 'storm-check',
    name: 'Storm Check',
    icon: 'storm',
    description: 'An extraordinary visual property check after a significant storm, heavy rainfall or other relevant weather event, with an update on visible conditions. This can be useful when the next scheduled inspection is still some time away. It is not a structural survey, engineering assessment or a guarantee that concealed damage will be identified.',
    fee: '€60 + VAT',
  },
  {
    id: 'external-provider', name: 'External Provider Service', icon: 'wrench', adminOnly: true,
    description: 'An individually described external provider payment arranged by Guardemar.',
    fee: 'Individually agreed',
  },
] as const satisfies readonly OptionalService[]

// Marketing and customer requests retain the twelve publicly offered services.
export const optionalServices: readonly OptionalService[] = addonServiceCatalogue.filter((service) => !('adminOnly' in service && service.adminOnly))

export const optionalServiceGroups = [
  {
    id: 'home-property',
    heading: 'Home & property',
    text: 'Cleaning, access, outdoor follow-up and weather checks arranged when the home needs more than the scheduled visit.',
    serviceIds: [
      'property-deep-clean-coordination',
      'laundry-linen-service',
      'maintenance-visit-contractor-access',
      'delivery-installation-attendance',
      'pool-garden-contractor-check',
      'storm-check',
    ],
  },
  {
    id: 'while-away',
    heading: 'While you are away',
    text: 'Practical extra help between visits, from correspondence and keys to an extraordinary call-out.',
    serviceIds: ['mail-care', 'vehicle-care', 'key-handover', 'emergency-call-out'],
  },
  {
    id: 'arrival-travel',
    heading: 'Arrival & travel',
    text: 'Arrangements that make the journey and the first hours in the house more straightforward.',
    serviceIds: ['pre-arrival-shopping', 'airport-transfer-coordination'],
  },
] as const satisfies readonly OptionalServiceGroup[]

export function optionalServicesInGroup(group: OptionalServiceGroup) {
  return group.serviceIds.map((id) => {
    const service = optionalServices.find((item) => item.id === id)
    if (!service) throw new Error(`Unknown optional service: ${id}`)
    return service
  })
}
