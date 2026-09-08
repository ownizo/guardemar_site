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

export default async function handler(request: Request) {
  if (request.method !== 'POST') return json({ success: false, error: 'Method not allowed.' }, 405)

  const expectedToken = process.env.GUARDEMAR_VERIFY_TOKEN?.trim()
  if (!expectedToken) return json({ success: false, error: 'Verification unavailable.' }, 503)

  const providedToken = bearerToken(request)
  if (!providedToken || !tokenMatches(providedToken, expectedToken)) return json({ success: false, error: 'Unauthorised.' }, 401)

  if (process.env.DEPLOY_CONTEXT !== 'production') return json({ success: false, error: 'Verification unavailable.' }, 403)

  const body = await request.json().catch(() => null) as { sessionId?: string } | null
  const sessionId = body?.sessionId
  if (!sessionId || !/^cs_live_[A-Za-z0-9]+$/.test(sessionId)) return json({ success: false, error: 'Invalid session id.' }, 400)

  try {
    const session = await stripeRequest<Record<string, any>>(`/checkout/sessions/${encodeURIComponent(sessionId)}?expand[]=line_items&expand[]=line_items.data.price&expand[]=total_details.breakdown`)
    return json({
      success: true,
      id: session.id,
      livemode: session.livemode,
      mode: session.mode,
      status: session.status,
      payment_status: session.payment_status,
      currency: session.currency,
      customer: session.customer,
      client_reference_id: session.client_reference_id,
      metadata: session.metadata,
      amount_subtotal: session.amount_subtotal,
      amount_total: session.amount_total,
      total_details: session.total_details,
      line_items: (session.line_items?.data ?? []).map((item: Record<string, any>) => ({
        quantity: item.quantity,
        priceId: item.price?.id,
        unit_amount: item.price?.unit_amount,
        currency: item.price?.currency,
        recurring_interval: item.price?.recurring?.interval,
        tax_behavior: item.price?.tax_behavior,
        amount_subtotal: item.amount_subtotal,
        amount_tax: item.amount_tax,
        amount_total: item.amount_total,
      })),
    }, 200)
  } catch (error) {
    return json({ success: false, error: error instanceof Error ? error.message : 'unexpected_error' }, 502)
  }
}
