import { timingSafeEqual } from 'node:crypto'

import { HttpError, stripeRequest } from './_subscription-shared.mts'

function json(body: Record<string, unknown>, status: number) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } })
}

function tokenMatches(provided: string, expected: string) {
  const expectedBytes = Buffer.from(expected, 'utf8')
  const providedBytes = Buffer.from(provided, 'utf8')
  const equalLength = providedBytes.length === expectedBytes.length
  const comparisonBytes = equalLength ? providedBytes : Buffer.alloc(expectedBytes.length)
  return timingSafeEqual(comparisonBytes, expectedBytes) && equalLength
}

function bearerToken(request: Request) {
  const authorization = request.headers.get('authorization')
  if (!authorization) return null
  const match = /^Bearer ([^\s]+)$/.exec(authorization)
  return match?.[1] ?? null
}

type PortalConfiguration = {
  id: string
  livemode: boolean
  active: boolean
  is_default?: boolean
  features: {
    customer_update?: { enabled: boolean; allowed_updates: string[] }
    invoice_history?: { enabled: boolean }
    payment_method_update?: { enabled: boolean }
    subscription_cancel?: { enabled: boolean }
    subscription_pause?: { enabled: boolean }
    subscription_update?: { enabled: boolean }
  }
}

function matchesRequirements(config: PortalConfiguration) {
  const f = config.features
  return config.livemode === true
    && config.active === true
    && f.payment_method_update?.enabled === true
    && f.invoice_history?.enabled === true
    && f.customer_update?.enabled === true
    && Array.isArray(f.customer_update.allowed_updates)
    && f.customer_update.allowed_updates.includes('address')
    && f.customer_update.allowed_updates.includes('tax_id')
    && !f.customer_update.allowed_updates.includes('email')
    && f.subscription_cancel?.enabled === false
    && f.subscription_update?.enabled === false
    && f.subscription_pause?.enabled === false
}

export default async function handler(request: Request) {
  if (request.method !== 'POST') return json({ success: false, error: 'Method not allowed.' }, 405)

  const expectedToken = process.env.GUARDEMAR_VERIFY_TOKEN?.trim()
  if (!expectedToken) return json({ success: false, error: 'Provisioning is unavailable.' }, 503)

  const providedToken = bearerToken(request)
  if (!providedToken || !tokenMatches(providedToken, expectedToken)) return json({ success: false, error: 'Unauthorised.' }, 401)

  if (process.env.DEPLOY_CONTEXT !== 'production') return json({ success: false, error: 'Provisioning is unavailable.' }, 403)

  try {
    const list = await stripeRequest<{ data: PortalConfiguration[] }>('/billing_portal/configurations?limit=100&active=true')
    const reusable = list.data.find(matchesRequirements)
    if (reusable) {
      return json({ success: true, action: 'reused', configurationId: reusable.id, features: reusable.features }, 200)
    }

    const body = new URLSearchParams({
      'business_profile[privacy_policy_url]': 'https://guardemar.com/privacy-policy',
      'business_profile[terms_of_service_url]': 'https://guardemar.com/terms',
      'features[customer_update][enabled]': 'true',
      'features[customer_update][allowed_updates][0]': 'address',
      'features[customer_update][allowed_updates][1]': 'tax_id',
      'features[invoice_history][enabled]': 'true',
      'features[payment_method_update][enabled]': 'true',
      'features[subscription_cancel][enabled]': 'false',
      'features[subscription_pause][enabled]': 'false',
      'features[subscription_update][enabled]': 'false',
    })
    const created = await stripeRequest<PortalConfiguration>('/billing_portal/configurations', {
      method: 'POST',
      body,
      idempotencyKey: 'guardemar-live-billing-portal-conservative-v1',
    })
    if (!created.livemode) throw new HttpError(503, 'Stripe returned a non-live Billing Portal configuration.', 'STRIPE_CONFIGURATION_ERROR')
    if (!matchesRequirements(created)) throw new HttpError(502, 'The created Billing Portal configuration does not match the approved GUARDEMAR restrictions.', 'STRIPE_CONFIGURATION_ERROR')
    return json({ success: true, action: 'created', configurationId: created.id, features: created.features }, 200)
  } catch (error) {
    const details = error instanceof HttpError ? { code: error.code, status: error.status, message: error.message } : { code: 'unexpected_error' }
    console.error('billing_portal_provision_failed', details)
    return json({ success: false, error: 'Provisioning failed safely.' }, 502)
  }
}
