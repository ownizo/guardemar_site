import { provisionApprovedLiveVatRate, StripeVatProvisionError } from '../src/lib/server/stripe-vat-rate.ts'

async function main() {
  const result = await provisionApprovedLiveVatRate({ secretKey: process.env.STRIPE_SECRET_KEY ?? '' })
  const action = result.provisioning === 'reused' ? 'Reusing' : 'Created'
  console.log(`${action} approved LIVE Tax Rate: ${result.taxRateId}`)
}

main().catch((error: unknown) => {
  if (error instanceof StripeVatProvisionError && error.code === 'stripe_request_failed') {
    const detail = [error.status ? `HTTP ${error.status}` : '', error.stripeCode ? `code ${error.stripeCode}` : ''].filter(Boolean).join(', ')
    console.error(`${error.message}${detail ? ` (${detail})` : ''}`)
  } else {
    console.error(error instanceof Error ? error.message : 'The Stripe Tax Rate operation failed safely.')
  }
  process.exitCode = 1
})
