import { timingSafeEqual } from 'node:crypto'

import { stripeRequest } from './_subscription-shared.mts'

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

async function probe(label: string, path: string) {
  try {
    const result = await stripeRequest<{ data?: Array<Record<string, unknown>> }>(path)
    return { label, ok: true, count: result.data?.length ?? null }
  } catch (error) {
    return { label, ok: false, error: error instanceof Error ? error.message : 'unexpected_error' }
  }
}

export default async function handler(request: Request) {
  if (request.method !== 'POST') return json({ success: false, error: 'Method not allowed.' }, 405)

  const expectedToken = process.env.GUARDEMAR_VERIFY_TOKEN?.trim()
  if (!expectedToken) return json({ success: false, error: 'Diagnostics unavailable.' }, 503)

  const providedToken = bearerToken(request)
  if (!providedToken || !tokenMatches(providedToken, expectedToken)) return json({ success: false, error: 'Unauthorised.' }, 401)

  if (process.env.DEPLOY_CONTEXT !== 'production') return json({ success: false, error: 'Diagnostics unavailable.' }, 403)

  const results = await Promise.all([
    probe('subscriptions_read', '/subscriptions?limit=1'),
    probe('checkout_sessions_read', '/checkout/sessions?limit=1'),
    probe('webhook_endpoints_read', '/webhook_endpoints?limit=100'),
  ])

  let existingEndpoints: Array<Record<string, unknown>> = []
  try {
    const list = await stripeRequest<{ data: Array<{ id: string; url: string; status: string; livemode: boolean; enabled_events: string[] }> }>('/webhook_endpoints?limit=100')
    existingEndpoints = list.data.map((endpoint) => ({ id: endpoint.id, url: endpoint.url, status: endpoint.status, livemode: endpoint.livemode, enabled_events: endpoint.enabled_events }))
  } catch {
    existingEndpoints = []
  }

  return json({ success: true, permissionProbes: results, existingWebhookEndpoints: existingEndpoints }, 200)
}
