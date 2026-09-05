import { createHmac, timingSafeEqual } from 'node:crypto'

import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js'

import { calculateTaxAmount, selectedAmount, subscriptionPlans, type SubscriptionBillingInterval, type SubscriptionPlanCode } from '../../src/config/subscriptions.ts'

export const EXPECTED_SUPABASE_REF = 'ablktbpledjceddessyg'

export type AuthContext = { user: User; database: SupabaseClient; role: 'customer' | 'staff' | 'admin' }

export class HttpError extends Error {
  status: number
  code: string
  constructor(status: number, message: string, code = 'REQUEST_ERROR') {
    super(message)
    this.status = status
    this.code = code
  }
}

export function json(data: unknown, init: ResponseInit = {}) {
  return Response.json(data, { ...init, headers: { 'Cache-Control': 'no-store', ...init.headers } })
}

export function environment(name: string) {
  return Netlify.env.get(name)?.trim() || ''
}

export function serviceDatabase() {
  const url = environment('SUPABASE_URL')
  const key = environment('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !key || new URL(url).hostname.split('.')[0] !== EXPECTED_SUPABASE_REF) throw new HttpError(503, 'The Guardemar production database is not configured safely.', 'CONFIGURATION_ERROR')
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } })
}

export async function authenticate(req: Request): Promise<AuthContext> {
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  const url = environment('SUPABASE_URL')
  const publishableKey = environment('SUPABASE_PUBLISHABLE_KEY')
  if (!token || !url || !publishableKey || new URL(url).hostname.split('.')[0] !== EXPECTED_SUPABASE_REF) throw new HttpError(401, 'Your session has expired. Please sign in again.', 'AUTHENTICATION_ERROR')
  const authClient = createClient(url, publishableKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } })
  const { data, error } = await authClient.auth.getUser(token)
  if (error || !data.user) throw new HttpError(401, 'Your session has expired. Please sign in again.', 'AUTHENTICATION_ERROR')
  const database = serviceDatabase()
  const profile = await database.from('profiles').select('role').eq('id', data.user.id).maybeSingle()
  if (profile.error || !profile.data) throw new HttpError(403, 'Your Guardemar profile is unavailable.', 'AUTHORIZATION_ERROR')
  return { user: data.user, database, role: profile.data.role }
}

export async function requirePropertyAccess(auth: AuthContext, propertyId: string) {
  if (auth.role === 'staff' || auth.role === 'admin') return
  const access = await auth.database.from('property_users').select('id').eq('property_id', propertyId).eq('user_id', auth.user.id).maybeSingle()
  if (access.error || !access.data) throw new HttpError(403, 'You do not have access to this property.', 'AUTHORIZATION_ERROR')
}

export async function requireSubscriptionAccess(auth: AuthContext, subscriptionId: string) {
  const result = await auth.database.from('service_subscriptions').select('id, property_id').eq('id', subscriptionId).maybeSingle()
  if (result.error || !result.data) throw new HttpError(404, 'Subscription not found.', 'NOT_FOUND')
  await requirePropertyAccess(auth, result.data.property_id)
  return result.data
}

export function canonicalPrice(planCode: SubscriptionPlanCode, billingInterval: SubscriptionBillingInterval) {
  const suffix = planCode === 'care_plus' ? 'CARE_PLUS' : planCode.toUpperCase()
  const interval = billingInterval === 'month' ? 'MONTHLY' : 'YEARLY'
  const variable = `STRIPE_PRICE_${suffix}_${interval}`
  const priceId = environment(variable)
  if (!priceId || !priceId.startsWith('price_')) throw new HttpError(503, `Live Stripe pricing is incomplete. ${variable} must contain a live price ID.`, 'STRIPE_CONFIGURATION_ERROR')
  return { priceId, variable, amount: selectedAmount(planCode, billingInterval), plan: subscriptionPlans[planCode] }
}

export async function stripeRequest<T>(path: string, options: { method?: string; body?: URLSearchParams; idempotencyKey?: string } = {}) {
  const key = environment('STRIPE_SECRET_KEY')
  if (!key || (!key.startsWith('sk_live_') && !key.startsWith('rk_live_'))) throw new HttpError(503, 'Stripe LIVE credentials are not configured.', 'STRIPE_CONFIGURATION_ERROR')
  const response = await fetch(`https://api.stripe.com/v1${path}`, {
    method: options.method ?? 'GET',
    headers: {
      Authorization: `Bearer ${key}`,
      ...(options.body ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
      ...(options.idempotencyKey ? { 'Idempotency-Key': options.idempotencyKey } : {}),
    },
    body: options.body,
  })
  const payload = await response.json() as T & { error?: { message?: string } }
  if (!response.ok) throw new HttpError(response.status >= 500 ? 502 : 400, payload.error?.message || 'Stripe rejected the request.', 'STRIPE_ERROR')
  return payload
}

export async function verifyLivePrice(planCode: SubscriptionPlanCode, billingInterval: SubscriptionBillingInterval) {
  const canonical = canonicalPrice(planCode, billingInterval)
  await verifyStripePrice(canonical.priceId, canonical.amount, billingInterval, canonical.variable)
  return canonical
}

export async function verifyStripePrice(priceId: string, amount: number, billingInterval: SubscriptionBillingInterval, label = 'Accepted Stripe Price', requireActive = true) {
  if (!priceId?.startsWith('price_')) throw new HttpError(503, `${label} is missing.`, 'STRIPE_CONFIGURATION_ERROR')
  const price = await stripeRequest<{ id: string; active: boolean; livemode: boolean; currency: string; unit_amount: number; recurring?: { interval?: string }; tax_behavior?: string; type: string }>(`/prices/${encodeURIComponent(priceId)}`)
  if (!price.livemode || (requireActive && !price.active) || price.type !== 'recurring' || price.currency.toUpperCase() !== 'EUR' || price.unit_amount !== amount || price.recurring?.interval !== billingInterval || price.tax_behavior !== 'exclusive') {
    throw new HttpError(503, `${label} does not match the approved Guardemar LIVE amount, currency, recurring interval, or exclusive tax treatment.`, 'STRIPE_CONFIGURATION_ERROR')
  }
  return price
}

export async function verifyStripeTaxRate(taxRateId: string, expectedPercentage?: number, requireActive = true) {
  if (!taxRateId.startsWith('txr_')) throw new HttpError(503, 'The approved Stripe Tax Rate is missing.', 'STRIPE_CONFIGURATION_ERROR')
  const taxRate = await stripeRequest<{ id: string; active: boolean; livemode: boolean; inclusive: boolean; percentage: number; display_name: string; country?: string | null; jurisdiction?: string | null }>(`/tax_rates/${encodeURIComponent(taxRateId)}`)
  if (!taxRate.livemode || (requireActive && !taxRate.active) || taxRate.inclusive || !Number.isFinite(taxRate.percentage) || taxRate.percentage < 0 || !taxRate.display_name || (expectedPercentage !== undefined && taxRate.percentage !== expectedPercentage)) {
    throw new HttpError(503, 'The configured Stripe Tax Rate must be live, active, exclusive, and match the accepted percentage.', 'STRIPE_CONFIGURATION_ERROR')
  }
  return taxRate
}

export async function verifyConfiguredTaxRate(netAmount?: number) {
  const taxRateId = environment('STRIPE_TAX_RATE_ID')
  if (!taxRateId.startsWith('txr_')) throw new HttpError(503, 'STRIPE_TAX_RATE_ID must contain the approved live exclusive VAT Tax Rate.', 'STRIPE_CONFIGURATION_ERROR')
  const taxRate = await verifyStripeTaxRate(taxRateId)
  const taxAmount = netAmount === undefined ? null : calculateTaxAmount(netAmount, taxRate.percentage)
  return {
    taxRateId: taxRate.id,
    percentage: taxRate.percentage,
    displayName: taxRate.display_name,
    country: taxRate.country ?? null,
    jurisdiction: taxRate.jurisdiction ?? null,
    taxAmount,
    grossAmount: taxAmount === null || netAmount === undefined ? null : netAmount + taxAmount,
  }
}

export function verifyStripeSignature(rawBody: string, signatureHeader: string, secret: string, now = Math.floor(Date.now() / 1000)) {
  const parts = signatureHeader.split(',').map((part) => part.trim().split('='))
  const timestamp = Number(parts.find(([key]) => key === 't')?.[1])
  const signatures = parts.filter(([key]) => key === 'v1').map(([, value]) => value)
  if (!Number.isFinite(timestamp) || Math.abs(now - timestamp) > 300 || signatures.length === 0) return false
  const expected = createHmac('sha256', secret).update(`${timestamp}.${rawBody}`, 'utf8').digest('hex')
  const expectedBuffer = Buffer.from(expected, 'hex')
  return signatures.some((signature) => {
    if (!/^[a-f0-9]{64}$/i.test(signature)) return false
    const supplied = Buffer.from(signature, 'hex')
    return supplied.length === expectedBuffer.length && timingSafeEqual(supplied, expectedBuffer)
  })
}

export function requestIp(req: Request) {
  return req.headers.get('x-nf-client-connection-ip') || null
}
