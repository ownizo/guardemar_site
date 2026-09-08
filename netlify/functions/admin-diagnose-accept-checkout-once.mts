import { timingSafeEqual } from 'node:crypto'

import { serviceDatabase } from './_subscription-shared.mts'

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

export default async function handler(request: Request) {
  if (request.method !== 'POST') return json({ success: false, error: 'Method not allowed.' }, 405)

  const expectedToken = process.env.GUARDEMAR_VERIFY_TOKEN?.trim()
  if (!expectedToken) return json({ success: false, error: 'Diagnostics unavailable.' }, 503)

  const providedToken = bearerToken(request)
  if (!providedToken || !tokenMatches(providedToken, expectedToken)) return json({ success: false, error: 'Unauthorised.' }, 401)

  if (process.env.DEPLOY_CONTEXT !== 'production') return json({ success: false, error: 'Diagnostics unavailable.' }, 403)

  const database = serviceDatabase()

  const properties = await database.from('properties').select('id, client_id, display_name, active').eq('display_name', 'Casa do Teste')
  if (properties.error) return json({ success: false, error: 'properties query failed', detail: properties.error.message }, 500)
  const propertyIds = (properties.data ?? []).map((p) => p.id)

  const propertyUsers = propertyIds.length
    ? await database.from('property_users').select('id, property_id, user_id, created_at').in('property_id', propertyIds)
    : { data: [], error: null }

  const subscriptions = propertyIds.length
    ? await database.from('service_subscriptions').select('id, client_id, property_id, plan_code, billing_interval, local_status, payment_status, agreement_acceptance_id, checkout_idempotency_key, acceptance_idempotency_key, stripe_price_id, stripe_tax_rate_id, stripe_customer_id, stripe_checkout_session_id, stripe_subscription_id, selected_net_amount, tax_amount, gross_amount, created_by, created_at').in('property_id', propertyIds).order('created_at', { ascending: true })
    : { data: [], error: null }

  const acceptances = propertyIds.length
    ? await database.from('service_agreement_acceptances').select('id, subscription_id, client_id, property_id, plan_code, billing_interval, accepted_at, stripe_price_id, stripe_tax_rate_id, selected_amount, tax_amount, gross_amount, user_id').in('property_id', propertyIds).order('accepted_at', { ascending: true })
    : { data: [], error: null }

  if (propertyUsers.error) return json({ success: false, error: 'property_users query failed', detail: propertyUsers.error.message }, 500)
  if (subscriptions.error) return json({ success: false, error: 'service_subscriptions query failed', detail: subscriptions.error.message }, 500)
  if (acceptances.error) return json({ success: false, error: 'service_agreement_acceptances query failed', detail: acceptances.error.message }, 500)

  const subscriptionIds = new Set((subscriptions.data ?? []).map((s) => s.id))
  const acceptanceIds = new Set((acceptances.data ?? []).map((a) => a.id))

  const crossCheck = (acceptances.data ?? []).map((a) => ({
    acceptanceId: a.id,
    subscriptionIdOnAcceptance: a.subscription_id,
    subscriptionExists: subscriptionIds.has(a.subscription_id),
  }))

  const subscriptionCrossCheck = (subscriptions.data ?? []).map((s) => ({
    subscriptionId: s.id,
    agreementAcceptanceId: s.agreement_acceptance_id,
    acceptanceExists: s.agreement_acceptance_id ? acceptanceIds.has(s.agreement_acceptance_id) : null,
  }))

  return json({
    success: true,
    properties: properties.data,
    propertyUsers: propertyUsers.data,
    subscriptions: subscriptions.data,
    acceptances: acceptances.data,
    crossCheck,
    subscriptionCrossCheck,
  }, 200)
}
