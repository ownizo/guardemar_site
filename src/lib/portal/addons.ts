import { z } from 'zod'
import { optionalServices, type OptionalService } from '../../config/optional-services.ts'

const text = (max: number) => z.string().trim().max(max).refine((value) => !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value), 'Remove control characters.')
export const shoppingItemSchema = z.object({
  product: text(200).pipe(z.string().min(1)), quantity: text(80).pipe(z.string().min(1)),
  preferredBrand: text(200), alternativePolicy: z.enum(['any_suitable', 'no_substitute', 'specific']),
  alternativeProduct: text(200), notes: text(1000),
}).strict().superRefine((item, ctx) => {
  if (item.alternativePolicy === 'specific' && !item.alternativeProduct) ctx.addIssue({ code: 'custom', path: ['alternativeProduct'], message: 'Specify the alternative product.' })
  if (item.alternativePolicy !== 'specific' && item.alternativeProduct) ctx.addIssue({ code: 'custom', path: ['alternativeProduct'], message: 'Only specific alternatives can include an alternative product.' })
})
const date = z.iso.date()
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/)
const shoppingSchema = z.object({ arrivalDate: date, arrivalTime: time, specialInstructions: text(2000), items: z.array(shoppingItemSchema).min(1).max(60) }).strict()
const transferSchema = z.object({
  direction: z.enum(['airport_to_property', 'property_to_airport']), airport: text(150).pipe(z.string().min(1)),
  date, time, flightNumber: text(50), passengers: z.number().int().min(1).max(100),
  luggage: text(500), childSeats: text(500),
}).strict()
export const addonRequestSchema = z.object({
  idempotencyKey: z.string().uuid(), propertyId: z.string().uuid(), serviceCode: z.string(),
  customerNotes: text(5000), serviceDetails: z.record(z.string(), z.unknown()),
}).strict().transform((input, ctx) => {
  const service = optionalServices.find((item) => item.id === input.serviceCode) as OptionalService | undefined
  if (!service) { ctx.addIssue({ code: 'custom', path: ['serviceCode'], message: 'Unknown service.' }); return z.NEVER }
  const schema = input.serviceCode === 'pre-arrival-shopping' ? shoppingSchema : input.serviceCode === 'airport-transfer-coordination' ? transferSchema : z.object({}).strict()
  const details = schema.safeParse(input.serviceDetails)
  if (!details.success) { for (const issue of details.error.issues) ctx.addIssue({ ...issue, path: ['serviceDetails', ...issue.path] }); return z.NEVER }
  const { items, ...serviceDetails } = details.data as Record<string, unknown>
  return { ...input, serviceDetails, shoppingItems: (items ?? []) as z.infer<typeof shoppingItemSchema>[], publishedPrice: service.fee, publishedPriceNote: service.extraCost ?? '' }
})
export const addonStatusLabels = {
  requested: 'Requested', under_review: 'Under review', awaiting_customer: 'Awaiting your confirmation',
  payment_pending: 'Payment requested', paid: 'Paid', scheduled: 'Scheduled', in_progress: 'Scheduled',
  completed: 'Completed', cancelled: 'Cancelled',
} as const
export type AddonStatus = keyof typeof addonStatusLabels
export const operationalTransitions: Record<AddonStatus, readonly AddonStatus[]> = {
  requested: ['under_review', 'cancelled'], under_review: ['awaiting_customer', 'cancelled'],
  awaiting_customer: ['under_review', 'cancelled'], payment_pending: [], paid: ['scheduled', 'cancelled'],
  scheduled: ['in_progress', 'completed', 'cancelled'], in_progress: ['completed', 'cancelled'], completed: [], cancelled: [],
}
export const addonReviewSchema = z.object({ expectedStatus: z.enum(Object.keys(addonStatusLabels) as [AddonStatus, ...AddonStatus[]]), status: z.enum(Object.keys(addonStatusLabels) as [AddonStatus, ...AddonStatus[]]), internalNote: text(5000) }).strict()
export function euroMinorUnits(value: string) {
  if (!/^(?:0|[1-9]\d{0,5})(?:\.\d{1,2})?$/.test(value)) throw new Error('Enter a EUR amount with at most two decimal places.')
  const [whole, fraction = ''] = value.split('.')
  const amount = Number(whole) * 100 + Number(fraction.padEnd(2, '0'))
  if (!Number.isSafeInteger(amount) || amount < 1 || amount > 99999999) throw new Error('Enter a positive EUR amount.')
  return amount
}
export function includedVat(gross: number) {
  if (!Number.isSafeInteger(gross) || gross < 1 || gross > 99999999) throw new Error('Invalid gross amount.')
  const net = Number((BigInt(gross) * 100n + 61n) / 123n)
  return { gross, net, vat: gross - net, rate: 23 }
}
const euro = z.string().regex(/^(?:0|[1-9]\d{0,5})(?:\.\d{1,2})?$/).transform((value, ctx) => {
  try { return euroMinorUnits(value) } catch { ctx.addIssue({ code: 'custom', message: 'Enter a positive EUR amount.' }); return z.NEVER }
})
export const addonPaymentDraftSchema = z.object({
  requestId: z.string().uuid().optional(), clientId: z.string().uuid().optional(),
  serviceCode: z.string().optional(), idempotencyKey: z.string().uuid(), email: z.string().trim().toLowerCase().email().max(254),
  amountEur: euro, description: text(1000).pipe(z.string().min(1)), currency: z.literal('EUR'),
  monthly: z.boolean().default(false), serviceFeeOnlyConfirmed: z.boolean().default(false),
}).strict().superRefine((input, ctx) => {
  if (!input.requestId && input.serviceCode !== 'external-provider') ctx.addIssue({ code: 'custom', message: 'A reviewed request is required for a Guardemar service.' })
  if (input.requestId && input.clientId) ctx.addIssue({ code: 'custom', message: 'The client is resolved from the request.' })
})
export const shoppingPaymentMessage = 'Your Guardemar service fee is charged separately. The cost of your shopping will be handled through the Guardemar client account.'
export const addonPaymentStatusLabels: Record<string, string> = {
  draft: 'Draft', payment_link_created: 'Payment requested', sent: 'Sent', paid: 'Paid', expired: 'Expired', cancelled: 'Cancelled', failed: 'Failed',
  payment_requested: 'Monthly payment setup requested', checkout_open: 'Monthly payment setup requested', active: 'Active', past_due: 'Past due', ended: 'Ended',
}
export const priceDisclaimer = 'Published Guardemar service prices exclude VAT. Portuguese VAT is 23%. The price shown is the published Guardemar service price. Depending on the service and your requirements, additional costs may apply. A Guardemar agent will review your request and confirm the final amount before payment.'
export const requestConfirmation = 'Thank you. A Guardemar agent will review your request and contact you to confirm the details and final amount. Once everything is confirmed, you will receive a secure payment link.'
export type ShoppingItem = z.infer<typeof shoppingItemSchema>
export type AddonRequest = {
  id: string; request_reference: string; client_id: string; property_id: string; service_code: string; status: AddonStatus;
  published_price_snapshot: string; published_price_note_snapshot: string; customer_notes: string; service_details: Record<string, unknown>;
  addon_subscriptions?: { status: string; activated_at: string | null }[];
  created_at: string; updated_at: string; properties: { display_name: string; locality: string };
  clients?: { first_name: string; last_name: string; email: string; phone: string };
}
export type AddonPayment = {
  id: string; addon_request_id: string | null; client_id?: string | null; service_code: string;
  description: string; currency: string; amount: number; amount_net: number | null; amount_tax: number | null;
  amount_semantics: 'unapproved' | 'vat_included' | 'external_final'; payment_category: 'guardemar_service' | 'external_provider';
  payment_type: 'one_time' | 'monthly'; payment_status: string; created_at: string; paid_at: string | null;
  customer_email?: string; clients?: { first_name: string; last_name: string };
  addon_requests?: { request_reference: string; status: AddonStatus } | null;
  addon_subscriptions?: { status: string; activated_at: string | null }[];
  paymentUrl?: string | null;
}
export type AddonDetail = { request: AddonRequest; shoppingItems: { id: string; product: string; quantity: string; preferred_brand: string; alternative_policy: string; alternative_product: string; notes: string }[]; payments: AddonPayment[]; internalNotes?: { id: string; note: string; created_at: string }[]; history?: { id: string; event_type: string; created_at: string }[]; emailDelivery?: { sent_at: string | null; first_attempt_at: string | null } }
