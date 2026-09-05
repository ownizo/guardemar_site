export const subscriptionTerms = {
  version: '2.5',
  effectiveDate: '2026-09-05',
  effectiveDateLabel: '5 September 2026',
  title: 'GUARDEMAR — General Terms and Conditions of Service',
  sha256: '7bdf2ed911c1c6f312e20a985c8e40ddc09af5b7e401925a9c3ffd49d6bf76fd',
  canonicalPath: 'legal/guardemar-general-terms-v2.5.md',
} as const

export const feeSchedule = {
  effectiveDate: '2026-09-05',
  effectiveDateLabel: '5 September 2026',
  title: 'GUARDEMAR — Fee Schedule',
  sha256: '0f41a94e894cb6a60af6bd87a433688107a6ae774bf83d420dfc1f0c179a483b',
  canonicalPath: 'legal/guardemar-fee-schedule-2026-09-05.md',
} as const

export const subscriptionPlans = {
  care: {
    code: 'care',
    name: 'GUARDEMAR CARE',
    monthlyAmount: 7_900,
    annualListAmount: 94_800,
    yearlyAmount: 85_320,
    annualDiscountAmount: 9_480,
    frequency: 'One scheduled inspection per month',
    scope: ['Secure key holding', 'Interior and exterior visual inspection', 'Doors and windows check', 'Signs of forced entry or visible damage', 'Visible water leak and plumbing checks', 'Electricity status', 'Humidity, damp and mould indicators', 'Ceiling and wall inspection', 'Bathrooms and toilets', 'Mail collection and check', 'Inspection photographs', 'Digital visit report', 'Notification of detected issues'],
  },
  care_plus: {
    code: 'care_plus',
    name: 'GUARDEMAR CARE+',
    monthlyAmount: 12_900,
    annualListAmount: 154_800,
    yearlyAmount: 139_320,
    annualDiscountAmount: 15_480,
    frequency: 'Two scheduled inspections per month',
    scope: ['Everything included in CARE', 'Property ventilation where appropriate', 'Running taps and flushing toilets', 'Drain checks', 'Air-conditioning visual or function check where agreed', 'Garden irrigation visual check', 'Pool condition visual check', 'Gate and exterior access check', 'Appliance visual check', 'Enhanced photo reporting', 'Contractor access coordination', 'Pre-arrival basic property check', 'Priority issue reporting', 'One post-severe-weather visual inspection where operationally applicable'],
  },
  complete: {
    code: 'complete',
    name: 'GUARDEMAR COMPLETE',
    monthlyAmount: 18_900,
    annualListAmount: 226_800,
    yearlyAmount: 204_120,
    annualDiscountAmount: 22_680,
    frequency: 'Weekly scheduled inspections',
    scope: ['Everything included in CARE+', 'Priority response', 'Enhanced maintenance oversight', 'Contractor coordination', 'Delivery or access assistance by arrangement', 'Mail management', 'Arrival preparation coordination', 'Preventive maintenance reminders', 'Monthly property condition summary', 'Priority post-weather inspection', 'Higher service priority'],
  },
} as const

export type SubscriptionPlanCode = keyof typeof subscriptionPlans
export type SubscriptionBillingInterval = 'month' | 'year'

export const annualDiscountPercent = 10
export const subscriptionCurrency = 'EUR'

export const billingCopy = {
  month: '12-month service agreement billed monthly in advance.',
  year: '12-month service agreement billed annually in advance. Save 10% compared with twelve monthly payments.',
} as const

export const annexCAcknowledgementKeys = [
  'scope',
  'propertyResponsibility',
  'accessMeans',
  'contractors',
  'insurance',
  'baselineCondition',
  'conditionsPrecedent',
  'contractTerm',
  'recurringAuthority',
  'annualDiscount',
  'nonPayment',
  'earlyTermination',
  'liability',
] as const

export type AnnexCAcknowledgementKey = typeof annexCAcknowledgementKeys[number]

export function parseAnnexCAcknowledgements(documentText: string) {
  const annex = documentText.split('## Annex C — Client acknowledgements')[1]?.split('\n---')[0]
  const lines = annex?.split('\n').filter((line) => line.startsWith('- **')) ?? []
  if (lines.length !== annexCAcknowledgementKeys.length) return []
  return lines.map((line, index) => ({
    key: annexCAcknowledgementKeys[index],
    text: line.slice(2).trim(),
    displayText: line.slice(2).trim().replaceAll('**', ''),
  }))
}

export function extractClause(documentText: string, clauseNumber: string) {
  return documentText.split('\n').find((line) => line.startsWith(`${clauseNumber}. `)) ?? ''
}

export function extractFeeScheduleTaxStatement(documentText: string) {
  return documentText.split('\n').find((line) => line.startsWith('All amounts are exclusive of VAT')) ?? ''
}


export function formatEuro(cents: number) {
  return new Intl.NumberFormat('en-IE', { style: 'currency', currency: subscriptionCurrency }).format(cents / 100)
}

export function selectedAmount(planCode: SubscriptionPlanCode, billingInterval: SubscriptionBillingInterval) {
  const plan = subscriptionPlans[planCode]
  return billingInterval === 'month' ? plan.monthlyAmount : plan.yearlyAmount
}

export function calculateTaxAmount(netAmount: number, percentage: number) {
  const scaledPercentage = Math.round(percentage * 10_000)
  return Math.round((netAmount * scaledPercentage) / 1_000_000)
}
