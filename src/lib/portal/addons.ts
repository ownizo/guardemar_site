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
export const addonPaymentDraftSchema = z.object({
  requestId: z.string().uuid(), idempotencyKey: z.string().uuid(), email: z.string().trim().email().max(254),
  amountEur: z.string().regex(/^(?:0|[1-9]\d{0,5})(?:\.\d{1,2})?$/).transform((value) => Math.round(Number(value) * 100)).pipe(z.number().int().min(1).max(99999999)),
  description: text(1000).pipe(z.string().min(1)), currency: z.literal('EUR'),
}).strict()
export const priceDisclaimer = 'The price shown is the published Guardemar service price. Depending on the service and your requirements, additional costs may apply. A Guardemar agent will review your request and confirm the final amount before payment.'
export const requestConfirmation = 'Thank you. A Guardemar agent will review your request and contact you to confirm the details and final amount. Once everything is confirmed, you will receive a secure payment link.'
export type ShoppingItem = z.infer<typeof shoppingItemSchema>
export type AddonRequest = {
  id: string; request_reference: string; client_id: string; property_id: string; service_code: string; status: AddonStatus;
  published_price_snapshot: string; published_price_note_snapshot: string; customer_notes: string; service_details: Record<string, unknown>;
  created_at: string; updated_at: string; properties: { display_name: string; locality: string };
  clients?: { first_name: string; last_name: string; email: string; phone: string };
}
export type AddonPayment = { id: string; addon_request_id: string; description: string; currency: string; amount: number; amount_semantics: 'unapproved'; payment_status: string; created_at: string; paid_at: string | null }
export type AddonDetail = { request: AddonRequest; shoppingItems: { id: string; product: string; quantity: string; preferred_brand: string; alternative_policy: string; alternative_product: string; notes: string }[]; payments: AddonPayment[]; internalNotes?: { id: string; note: string; created_at: string }[]; history?: { id: string; event_type: string; created_at: string }[]; emailDelivery?: { sent_at: string | null; first_attempt_at: string | null } }
