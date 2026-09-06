import { timingSafeEqual } from 'node:crypto'

import { subscriptionPlans } from '../../src/config/subscriptions.ts'
import { HttpError, stripeRequest, verifyConfiguredTaxRate, verifyLivePrice } from './_subscription-shared.mts'

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

const combinations: Array<['care' | 'care_plus' | 'complete', 'month' | 'year']> = [
  ['care', 'month'],
  ['care', 'year'],
  ['care_plus', 'month'],
  ['care_plus', 'year'],
  ['complete', 'month'],
  ['complete', 'year'],
]

export default async function handler(request: Request) {
  if (request.method !== 'POST') return json({ success: false, error: 'Method not allowed.' }, 405)

  const expectedToken = process.env.GUARDEMAR_VERIFY_TOKEN?.trim()
  if (!expectedToken) return json({ success: false, error: 'Verification is unavailable.' }, 503)

  const providedToken = bearerToken(request)
  if (!providedToken || !tokenMatches(providedToken, expectedToken)) return json({ success: false, error: 'Unauthorised.' }, 401)

  if (process.env.DEPLOY_CONTEXT !== 'production') return json({ success: false, error: 'Verification is unavailable.' }, 403)

  const prices: Record<string, unknown> = {}
  let allPricesOk = true
  for (const [planCode, interval] of combinations) {
    const label = `${planCode}_${interval}`
    try {
      const canonical = await verifyLivePrice(planCode, interval)
      const expandedPrice = await stripeRequest<{ product?: { id?: string; name?: string; active?: boolean; livemode?: boolean } | string }>(`/prices/${encodeURIComponent(canonical.priceId)}?expand[]=product`)
      const product = typeof expandedPrice.product === 'object' ? expandedPrice.product : undefined
      const expectedProductName = subscriptionPlans[planCode].name
      const productOk = product?.livemode === true && product?.active === true && product?.name === expectedProductName
      if (!productOk) throw new HttpError(503, `Price is attached to product "${product?.name ?? 'unknown'}", expected LIVE active "${expectedProductName}".`, 'STRIPE_CONFIGURATION_ERROR')
      prices[label] = { ok: true, variable: canonical.variable, priceId: canonical.priceId, amount: canonical.amount, productId: product?.id, productName: product?.name }
    } catch (error) {
      allPricesOk = false
      prices[label] = { ok: false, error: error instanceof HttpError ? error.message : 'Unexpected verification error.' }
    }
  }

  let tax: Record<string, unknown>
  try {
    const configured = await verifyConfiguredTaxRate()
    tax = { ok: true, taxRateId: configured.taxRateId, percentage: configured.percentage, displayName: configured.displayName, country: configured.country }
  } catch (error) {
    tax = { ok: false, error: error instanceof HttpError ? error.message : 'Unexpected verification error.' }
  }

  const success = allPricesOk && tax.ok === true
  return json({ success, prices, tax }, success ? 200 : 503)
}
