# GUARDEMAR production subscriptions setup

The application is ready for final review but is not ready to accept payments until the external LIVE Stripe, VAT, Netlify, and Supabase steps below are completed. No migration or Stripe object was created automatically.

## Canonical contractual documents

The repository contains the final approved documents exactly as supplied:

- General Terms: `legal/guardemar-general-terms-v2.5.md`
  - Version: `2.5`
  - Effective date: `2026-09-05`
  - SHA-256: `7bdf2ed911c1c6f312e20a985c8e40ddc09af5b7e401925a9c3ffd49d6bf76fd`
- Fee Schedule: `legal/guardemar-fee-schedule-2026-09-05.md`
  - Applicable date: `2026-09-05`
  - SHA-256: `0f41a94e894cb6a60af6bd87a433688107a6ae774bf83d420dfc1f0c179a483b`

The unapplied migration seeds those exact UTF-8 documents into immutable database rows and verifies both hashes. Run `npm run legal:hash` to verify the canonical Terms file before deployment. Do not edit either document without creating a new contractual version and preserving historical records.

## LIVE Stripe products and prices

In Stripe Dashboard, switch **Test mode** off. Open **Product catalogue**, create each product once, then add the two recurring Prices listed beneath it. Every Price must use currency `EUR`, must be active, and must have **Tax behaviour = Exclusive**.

### GUARDEMAR CARE

- Product name: `GUARDEMAR CARE`
- €79.00 EUR, recurring every month → `STRIPE_PRICE_CARE_MONTHLY`
- €853.20 EUR, recurring every year → `STRIPE_PRICE_CARE_YEARLY`

### GUARDEMAR CARE+

- Product name: `GUARDEMAR CARE+`
- €129.00 EUR, recurring every month → `STRIPE_PRICE_CARE_PLUS_MONTHLY`
- €1,393.20 EUR, recurring every year → `STRIPE_PRICE_CARE_PLUS_YEARLY`

### GUARDEMAR COMPLETE

- Product name: `GUARDEMAR COMPLETE`
- €189.00 EUR, recurring every month → `STRIPE_PRICE_COMPLETE_MONTHLY`
- €2,041.20 EUR, recurring every year → `STRIPE_PRICE_COMPLETE_YEARLY`

Copy each resulting live identifier beginning `price_` into the matching Netlify variable. Do not use test Price IDs. The server retrieves every Price and refuses Checkout unless live mode, active state, amount, EUR currency, recurring interval, and exclusive tax behaviour all match.

## VAT and Stripe Tax Rate prerequisite

The approved Fee Schedule states: “All amounts are exclusive of VAT, which is added at the rate required by law.” The repository does not assume a VAT percentage.

Before payment is enabled, Guardemar’s accountant must confirm:

- the legally applicable VAT percentage;
- the customer-facing tax display name;
- any country or jurisdiction setting required for the Tax Rate;
- whether one Tax Rate applies to every subscription covered by this release.

After written accounting confirmation, create a manual Tax Rate in Stripe live mode:

- **Display name**: the accountant-approved customer-facing label;
- **Percentage**: the accountant-approved rate;
- **Inclusive**: `No` / exclusive;
- **Country or jurisdiction**: the accountant-approved value, if required;
- **Active**: `Yes`.

Copy the resulting live identifier beginning `txr_` into `STRIPE_TAX_RATE_ID`. The application retrieves this Tax Rate before acceptance, calculates the exact tax and gross amount in integer cents, stores them in the immutable Service Order, applies the same Tax Rate to Checkout, and rejects webhook activation if Stripe’s paid tax or gross amount differs.

Do not enable Stripe Automatic Tax for this implementation. Do not create the Tax Rate until accounting has approved the treatment.

## LIVE Stripe API credential

In Stripe Dashboard open **Developers → API keys → Restricted keys → Create restricted key**. Name it `Guardemar Netlify production subscriptions`.

Grant the minimum operations used by the application:

- Customers: **Write**
- Checkout Sessions: **Write**
- Prices: **Read**
- Subscriptions: **Read**
- Tax Rates: **Read**
- Billing Portal Sessions / Customer Portal: **Write**

Copy the resulting `rk_live_…` credential into `STRIPE_SECRET_KEY`. If Stripe’s current restricted-key editor cannot grant every required operation, use an `sk_live_…` secret only as a documented fallback. Never use a publishable key, a test key, or any key in browser code.

## Customer portal configuration

In Stripe Dashboard open **Settings → Billing → Customer portal** and create a dedicated live configuration named `Guardemar payment method management`.

Set:

- Payment methods: **On**
- Billing information: **On**
- Invoice history: **On**
- Subscription cancellation: **Off**
- Subscription plan switching: **Off**
- Subscription quantity changes: **Off**
- Promotion codes: **Off** unless Guardemar later approves a written promotion policy

Copy the resulting identifier beginning `bpc_` into `STRIPE_BILLING_PORTAL_CONFIGURATION`. The application refuses to open the generic portal without this dedicated configuration.

## LIVE webhook

In Stripe Dashboard, with test mode off, open **Developers / Workbench → Webhooks → Add endpoint**.

- Endpoint URL: `https://guardemar.com/api/stripe/webhook`
- Description: `Guardemar production subscriptions`
- Event source: Guardemar account events, not Connect events
- Required events:
  - `checkout.session.completed`
  - `checkout.session.expired`
  - `customer.subscription.created`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `invoice.paid`
  - `invoice.payment_failed`
  - `invoice.payment_action_required`
  - `payment_method.attached`
  - `payment_method.detached`
  - `customer.updated`

After saving, reveal the endpoint signing secret and place its live `whsec_…` value in `STRIPE_WEBHOOK_SECRET`.

Verify that an invalid signature returns HTTP `400`, a correctly signed live fixture is accepted, and redelivery of the same event ID creates no duplicate payment, email, audit, or activation side effects. The Checkout return page must remain pending until a verified `invoice.paid` event confirms the accepted Price, Tax Rate, tax amount, gross amount, customer, and subscription.

## Netlify Production variables

Add these under **Netlify → Guardemar → Project configuration → Environment variables**, scoped to **Production** only:

- `STRIPE_SECRET_KEY` = restricted `rk_live_…` credential, or documented `sk_live_…` fallback
- `STRIPE_WEBHOOK_SECRET` = live webhook signing secret beginning `whsec_`
- `STRIPE_PRICE_CARE_MONTHLY` = live €79 monthly Price ID
- `STRIPE_PRICE_CARE_YEARLY` = live €853.20 yearly Price ID
- `STRIPE_PRICE_CARE_PLUS_MONTHLY` = live €129 monthly Price ID
- `STRIPE_PRICE_CARE_PLUS_YEARLY` = live €1,393.20 yearly Price ID
- `STRIPE_PRICE_COMPLETE_MONTHLY` = live €189 monthly Price ID
- `STRIPE_PRICE_COMPLETE_YEARLY` = live €2,041.20 yearly Price ID
- `STRIPE_TAX_RATE_ID` = accountant-approved live exclusive Tax Rate ID
- `STRIPE_BILLING_PORTAL_CONFIGURATION` = payment-method-only portal configuration ID

Keep the existing production `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and `RESEND_API_KEY` values unchanged. `SUPABASE_URL` must resolve to Guardemar project `ablktbpledjceddessyg`. Never expose or log secret values.

## Supabase migration review

Migration: `supabase/migrations/20260905120000_create_subscription_and_payment_domain.sql`

It:

- adds `clients.stripe_customer_id` for one Stripe Customer per existing Guardemar client;
- creates immutable `legal_terms_versions` and `fee_schedule_versions` tables and seeds the exact approved documents;
- creates `service_subscriptions`, `service_agreement_acceptances`, `subscription_payment_events`, and `stripe_webhook_events`;
- creates plan, billing interval, local subscription status, and payment status enums;
- creates `public.create_service_agreement_acceptance`, executable only by `service_role`, with property authorisation, canonical document/hash validation, all thirteen Annex C acknowledgements, Clause 5.4 handling, exact tax calculation, immutable Service Order generation, and idempotency;
- adds property-scoped customer SELECT policies, stored-role staff/admin policies, safe column-level grants, one-open-subscription protection, and Stripe/audit deduplication indexes;
- blocks UPDATE and DELETE on contractual documents, agreement acceptances, and payment history.

Do not modify earlier applied migrations. After final review, apply this migration only to Supabase project `ablktbpledjceddessyg`. Never apply it to `uqjxjymvhuvtwbqtesbr`.

## Conservative live verification

Before exposing **New subscription** publicly:

1. Run `npm run legal:hash` and confirm the Version 2.5 SHA-256 shown above.
2. Confirm all six Stripe Prices are live, active, EUR, recurring at the correct interval, and tax-exclusive.
3. Confirm the live Tax Rate is active, exclusive, and exactly matches written accounting instruction.
4. Set all production variables, then run `npm run stripe:verify-live`; this performs read-only Stripe retrieval and creates no charge.
5. Apply the reviewed migration only to `ablktbpledjceddessyg` and verify both canonical document hashes in the inserted rows.
6. Verify every legal control starts unchecked and all thirteen Annex C items match the canonical Terms exactly.
7. Verify a consumer requesting a start date during the fourteen-day period cannot continue without the separate Clause 5.4 request.
8. Verify the same acceptance and Checkout idempotency keys cannot create duplicate records or Sessions.
9. Test property-level RLS with at least two customer accounts and confirm neither can access the other customer’s records.
10. Confirm customers cannot directly insert, update, or delete subscriptions, acceptances, document versions, payment records, prices, tax values, or Stripe identifiers.
11. Confirm the Checkout return remains `pending_payment` until a verified `invoice.paid` webhook arrives.
12. Confirm mismatched Price, Tax Rate, currency, tax amount, gross amount, customer, or subscription prevents activation.
13. Confirm repeated and out-of-order webhook fixtures do not duplicate payment history, audit events, emails, or state transitions.
14. Confirm the customer portal permits payment-method updates and invoice history but no cancellation or plan switching.
15. Confirm Resend activation, payment-failed, and payment-action-required messages with controlled fixtures.

Do not complete a real card charge solely to test the interface. The first live payment must be an explicitly authorised production subscription after every check above passes.
