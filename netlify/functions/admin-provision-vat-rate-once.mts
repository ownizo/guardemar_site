import { timingSafeEqual } from 'node:crypto'
import {
  provisionApprovedLiveVatRate,
  StripeVatProvisionError,
  type VatProvisionResult,
} from '../../src/lib/server/stripe-vat-rate.ts'

type ProvisionDependencies = {
  getEnv: (name: string) => string | undefined
  provision: (input: { secretKey: string }) => Promise<VatProvisionResult>
  logError: (message: string, details: Record<string, unknown>) => void
}

const defaultDependencies: ProvisionDependencies = {
  getEnv: (name) => process.env[name],
  provision: ({ secretKey }) => provisionApprovedLiveVatRate({ secretKey }),
  logError: (message, details) => console.error(message, details),
}

function json(body: Record<string, unknown>, status: number, extraHeaders: HeadersInit = {}) {
  return Response.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      ...Object.fromEntries(new Headers(extraHeaders)),
    },
  })
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

export function createVatProvisionHandler(overrides: Partial<ProvisionDependencies> = {}) {
  const dependencies = { ...defaultDependencies, ...overrides }

  return async function handler(request: Request) {
    if (request.method !== 'POST') {
      return json({ success: false, error: 'Method not allowed.' }, 405, { Allow: 'POST' })
    }

    const expectedToken = dependencies.getEnv('GUARDEMAR_VAT_PROVISION_TOKEN')?.trim()
    if (!expectedToken) {
      return json({ success: false, error: 'Provisioning is unavailable.' }, 503)
    }

    const providedToken = bearerToken(request)
    if (!providedToken || !tokenMatches(providedToken, expectedToken)) {
      return json({ success: false, error: 'Unauthorised.' }, 401)
    }

    // Note: Netlify's built-in CONTEXT variable is build-time only and is not
    // injected into Functions at runtime (only URL/SITE_NAME/SITE_ID are), and
    // its name is reserved so it cannot be set as a custom env var either.
    // DEPLOY_CONTEXT is a custom env var we set per deploy context instead.
    if (dependencies.getEnv('DEPLOY_CONTEXT') !== 'production') {
      return json({ success: false, error: 'Provisioning is unavailable.' }, 403)
    }

    const requestUrl = new URL(request.url)
    if (requestUrl.search || (await request.text()).length > 0) {
      return json({ success: false, error: 'Request parameters are not accepted.' }, 400)
    }

    const secretKey = dependencies.getEnv('STRIPE_SECRET_KEY')
    if (!secretKey?.trim()) {
      return json({ success: false, error: 'Provisioning is unavailable.' }, 503)
    }

    try {
      const result = await dependencies.provision({ secretKey })
      return json({
        success: true,
        tax_rate_id: result.taxRateId,
        provisioning: result.provisioning,
        percentage: result.percentage,
        country: result.country,
        inclusive: result.inclusive,
        tax_type: result.taxType,
        livemode: result.livemode,
      }, 200)
    } catch (error) {
      const details = error instanceof StripeVatProvisionError
        ? { code: error.code, ...(error.status ? { stripeStatus: error.status } : {}), ...(error.stripeCode ? { stripeCode: error.stripeCode } : {}) }
        : { code: 'unexpected_error' }
      dependencies.logError('vat_rate_provision_failed', details)
      return json({ success: false, error: 'Provisioning failed safely.' }, 502)
    }
  }
}

export default createVatProvisionHandler()
