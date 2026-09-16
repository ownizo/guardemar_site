# GUARDEMAR Add-on Services — payment implementation handover

Continuation starting commit: `aa7c4acbcdaa3e32e74386ce51219741a66091d3`.
Audited current main: `2c8b03d5980d2a647b37063eac8a6245b0ed4f99`.
Branch: `feat/addon-service-requests`.

## Existing architecture reused

The existing twelve customer services, authenticated request routes, shopping items, transfer details, property cards, staff notes, audit-backed alerts and request-email delivery markers remain in place. `src/config/optional-services.ts` is the only maintained catalogue. External Provider is the thirteenth canonical category, marked admin-only and filtered out of public and customer catalogue views.

Authentication continues through `_subscription-shared.mts`: Supabase validates the caller, `profiles.role` controls permissions, and a server-only service-role database client is restricted to project `ablktbpledjceddessyg`. Request creation resolves the property's client server-side and checks both `client_users` and `property_users`. No parallel auth, generic notification service or webhook was introduced.

The canonical Stripe Customer remains `clients.stripe_customer_id`. Payment creation verifies and reuses it. For an authorised client without a Customer, production runtime uses the core flow's identical Customer parameters and `guardemar-client-{client_id}` idempotency key, with a compare-and-swap canonical linkage check. No Customer was created during implementation/testing. Email-only External Provider Checkout uses `customer_email`; subscription Checkout creates its Customer only if the recipient subsequently completes Checkout. An email alone never grants portal access.

## Applied database migrations

Target Supabase is `ACTIVE_HEALTHY`. The previously pending request migration and payment continuation plus draft-visibility hardening were applied only to GUARDEMAR:

- `supabase/migrations/20260915204504_addon_service_requests.sql`
- `supabase/migrations/20260915210341_addon_payment_and_monthly_billing.sql`
- `supabase/migrations/20260915211050_addon_billing_visibility_hardening.sql`

The original request migration content is unchanged; its filename and the continuation filename match the versions allocated by Supabase's migration ledger. This prevents future CLI migration replay.

Existing `addon_requests`, `addon_shopping_items`, `addon_internal_notes`, `addon_payments` and request-email markers are reused. Payments add explicit category, one-time/monthly type, server-resolved property/service, final gross/net/VAT evidence and approved Stripe configuration IDs. Existing unapproved drafts retain their original semantics and must be replaced through an unused-draft cancellation/review workflow.

New tables:

- `addon_subscriptions`: one per monthly payment invitation, independent of `service_subscriptions`; gross monthly amount, category/client/property/service, lifecycle and reconciliation IDs.
- `addon_checkout_attempts`: persisted generation, Stripe idempotency key, lease, immutable session binding, expiry and URL.
- `addon_subscription_payment_events`: monthly paid-invoice evidence.
- `addon_email_deliveries`: immutable rendered Resend envelope, claim, provider ID and durable sent marker.

A partial unique index prevents concurrent unresolved or active equivalent monthly subscriptions. Standard services use property/service scope. External Provider uses client/email plus normalised description; descriptions must accurately identify the same arranged service rather than be changed to evade duplicate protection.

Server-only transactional RPCs create drafts, lease/create/reconcile attempts, record Checkout, apply verified Stripe state, record email delivery and cancel unused drafts. Payment and subscription activation cannot be set through Admin or customer APIs.

## RLS and security

All Add-on tables retain RLS. Browser mutation and privileged RPC execution are revoked. Customer reads require client membership and, whenever a property is linked, property membership; drafts and cancelled unused drafts are hidden. Private email/Stripe fields have no customer column grants. Staff notes stay staff-only. Checkout attempts, invoice evidence and delivery envelopes have no browser grants or policies and are intentionally service-only.

The actual database transactional assertions passed and all fixtures were rolled back. Customer property-access revocation immediately hides linked payments/subscriptions. Email-only external records have no customer portal ownership. The security advisor's four RLS-without-policy informational findings refer to intentionally server-only Add-on tables; unrelated existing inspection/auth advisories were not modified.

Core `service_subscriptions` count/digest before and after migration/tests were identical: 1 record, digest `b514b28fd2db0f0cbfeddaea8e854604`. Core Checkout, approved Products/Prices, exclusive VAT Rate, Billing Portal, agreement evidence and legal documents were not changed.

## Commercial and VAT behaviour

Published Guardemar fees exclude Portuguese VAT at 23%. Admin always enters the final gross amount, explicitly labelled **FINAL AMOUNT (VAT INCLUDED)**, or **Final monthly amount (VAT included)**. Decimal EUR input becomes integer cents server-side. Informational included VAT uses safely rounded `gross * 100 / 123`; VAT is the remainder. €98.40 becomes gross 9840, net 8000, VAT 1840 cents. Stripe receives 9840, never 9840 plus VAT.

Pre-Arrival Shopping Stripe payment contains only the agreed Guardemar service fee. Shopping items remain request data and never influence the amount. Admin must confirm that groceries, shopping expenditure and client purchase funds are excluded. Customer request/payment/email copy says: “Your Guardemar service fee is charged separately. The cost of your shopping will be handled through the Guardemar client account.”

External Provider has `payment_category=external_provider`, final-charge semantics and no inferred VAT rate/net/VAT split. Its separate LIVE enable flag stays off until accounting approves collection, invoicing and provider responsibility. Standard Guardemar payments are non-refundable once paid; no refund API, automatic refund or customer refund button exists.

## Admin and portal

Admin Add-on Payments offers service, reviewed request or external optional client, email, description and final amount. Monthly recurring checkbox defaults unchecked and works for any catalogue service. “Review payment” only creates a local draft. A separate server-derived summary shows recipient, service, description, type, exact amount and VAT breakdown before “SEND PAYMENT LINK” / “SEND SUBSCRIPTION LINK” can create Stripe Checkout.

Unused draft editing cancels that local draft and creates a fresh reviewed draft; it never mutates a payable Checkout. Lists filter category/type/status and show date/customer/service/description/amount/status. Resend and expiry replacement each require another confirmation summary.

Portal Services retains requests/history and shows payment status/amount/date where applicable. Monthly setup requested, Active, Past due and Cancelled are displayed from the separate subscription domain. Known-client external arrangements without a standard request appear under Services; email-only arrangements stay in the recipient's payment email. Payment links are resolved only after server-side ownership and current Stripe state checks. Return pages cannot confirm payment or complete a service.

## Stripe architecture and configuration

Both flows use server-created Stripe-hosted Checkout Sessions. One-time uses `mode=payment`; monthly uses `mode=subscription` with inline `price_data.recurring.interval=month`. One approved shared Add-on Product per service/category is referenced; no per-request Product or reusable public Payment Link is created. Inline Checkout Prices are the supported dynamic-price strategy, including recurring amounts, and are non-reusable and effectively archived. No core Product/Price is reused or modified.

Standard Guardemar lines use inclusive price behaviour plus a **separate inclusive** PT VAT Tax Rate at 23%, with automatic tax and adaptive currency pricing disabled. A VAT-exempt canonical Customer fails closed because inclusive exemption handling could reduce the exact agreed gross amount. Monthly Customer credits/balances or discounts also require reconciliation before Checkout because the recurring charge must equal the agreed gross amount. External Provider attaches no tax rate and claims no 23% breakdown. Unexpected discounts, automatic tax, wrong currency, multiple recurring lines or changed amount/ownership are rejected.

Required function configuration, intentionally absent/off in production:

- `STRIPE_ADDON_LIVE_ENABLED=true` only after controlled testing is approved.
- `STRIPE_ADDON_EXTERNAL_PROVIDER_ENABLED=true` only after that category's accounting activation approval.
- `STRIPE_ADDON_VAT_INCLUSIVE_TAX_RATE_ID`: LIVE active inclusive PT VAT 23% rate, separate from core.
- `STRIPE_ADDON_PRODUCT_{SERVICE_CODE_IN_UPPER_SNAKE_CASE}`: approved shared LIVE active Product with metadata `payment_domain=addon`, `service_code` matching the canonical category.

Existing Stripe/Resend/Supabase configuration is present. Stripe secrets are redacted in the Netlify audit, so restricted-key permissions and actual webhook event subscription configuration could not be verified. Before activation, check least-privilege Checkout write/read, Customer read/write when needed, Product/Price and Tax Rate reads/inline-price capabilities, PaymentIntent reads, Subscription reads and Invoice reads. Code does not call Product/Price/Tax Rate creation endpoints. Do not silently broaden the existing key.

Official documentation reviewed: [Checkout inline prices](https://docs.stripe.com/products-prices/manage-prices), [Checkout Session create reference](https://docs.stripe.com/api/checkout/sessions/create), [manual inclusive Tax Rates](https://docs.stripe.com/tax/tax-rates), [subscription webhooks](https://docs.stripe.com/billing/subscriptions/webhooks).

## Webhook, retries and alerts

The existing signed LIVE webhook and `stripe_webhook_events` processing/retry ledger remain authoritative. A small dispatcher routes Add-on metadata and bound Add-on subscription IDs before the unchanged core handler; first invoice classification can retrieve the Stripe Subscription before local Checkout binding. Contradictory core metadata cannot route Add-on events into CARE processing. The only other core-file edits are TypeScript non-null assertions for existing successful email lookups, erased at runtime.

One-time confirmation uses `checkout.session.completed` or `checkout.session.async_payment_succeeded`, current Session `payment_status=paid`, and a matching LIVE succeeded PaymentIntent with exact received amount, currency, customer and metadata. Monthly Checkout completion binds IDs only; a verified current paid `invoice.paid` activates the separate Add-on subscription. Subscription created/updated/deleted and invoice payment-failed events reconcile current Stripe lifecycle; historical events never override current authoritative paid/cancelled state. Checkout expiry is recorded separately. Ensure these events are enabled on the existing endpoint before LIVE activation.

The database applies paid/active/past-due/cancelled transitions only within a verified processing webhook ledger row. Paid updates never complete the operational request. Persisted attempt leases and keys cover concurrency and network retries; an ambiguous creation older than 23 hours requires manual Stripe reconciliation. Replacement requires an expired current Session, no completed subscription/payment, and no pending/succeeded PaymentIntent. Paid or ever-activated subscriptions cannot create/resend another invitation.

Resend reuses current valid Checkout. Email retries reuse stable Resend keys and durable sent markers, capped within 23 hours of the first attempt. Admin gets audit-backed new-request, one-time-paid, monthly-activated and monthly-past-due alerts, linking to the request or payment list. Customer email covers payment/setup links, confirmed one-time payment and first monthly activation, with explicit monthly acceptance copy and no internal Stripe IDs.

Audits: `ADDON_REQUEST_CREATED`, controlled request review/note/completion/cancellation actions, `ADDON_PAYMENT_CREATED`, `EXTERNAL_PROVIDER_PAYMENT_CREATED`, `ADDON_PAYMENT_LINK_SENT`, `ADDON_PAYMENT_LINK_RESENT`, `ADDON_PAYMENT_CONFIRMED`, `ADDON_PAYMENT_EXPIRED`, unused-draft cancellation, `ADDON_SUBSCRIPTION_CREATED`, `ADDON_SUBSCRIPTION_LINK_SENT`, link resent, `ADDON_SUBSCRIPTION_ACTIVATED`, `ADDON_SUBSCRIPTION_PAST_DUE`, `ADDON_SUBSCRIPTION_CANCELLED`.

## Validation and remaining activation work

All required validation passed: `npm run typecheck`, `npm test`, `npm run build`, `npm run lint`, `npm run legal:hash`, `git diff --check`. Typecheck/lint now also cover the Add-on server functions and imported webhook. `node scripts/verify-addon-schema.mjs` uses pinned PGlite 0.5.8 in `/tmp`, checks both migrations and request/payment/monthly/VAT/RLS assertions locally. The continuation assertions also passed transactionally against the correct deployed project. No dependency or lockfile change is required.

Twenty-six focused payment tests cover exact gross/VAT, fee-only shopping, all-service recurrence, external email-only flow, Stripe metadata/customer/tax reconciliation, verified activation, core dispatch isolation across CARE/CARE+/COMPLETE, leases, resend/replacement, durable email markers, confirmation and access denial. Existing request and core regression tests pass. Function bundling through the installed Netlify CLI passes too.

Interactive browser checks could not run: the browser runtime returned an empty list of available browsers. Implementation/migration/mock checks do not constitute a successful LIVE financial test. This continuation has not deployed the UI/functions to production. Production activation remains disabled until configuration and controlled tests are approved.

## Protected legal wording recommended, not edited

Future reviewed documents should cover prices excluding VAT and 23% VAT, final VAT-inclusive payment quotes, non-refundable paid Add-ons and exceptional manual handling, recurring monthly Add-ons/Stripe acceptance, recurring cancellation timing, shopping purchases through the client account, External Provider invoicing/collection and third-party responsibility. Recurring cancellation notice/effective date and External Provider accounting remain policy/configuration decisions; no new policy was invented.

General Terms 2.5 SHA-256: `7bdf2ed911c1c6f312e20a985c8e40ddc09af5b7e401925a9c3ffd49d6bf76fd`.
Fee Schedule SHA-256: `0f41a94e894cb6a60af6bd87a433688107a6ae774bf83d420dfc1f0c179a483b`.

## Proposed controlled LIVE checks — approval required

Customer/property must be explicitly designated by the operator; no production customer was selected or created for testing. Prefer an existing authorised test client with a canonical LIVE Stripe Customer. Neither proposal charges or completes Checkout:

1. **One-time:** reviewed Pre-Arrival Shopping request; description “Controlled verification — Pre-Arrival Shopping service fee”; final gross **€98.40**, net €80.00, VAT €18.40. Create one local payment/attempt and one LIVE `mode=payment` Checkout Session with inline one-time Price against the approved shared Product and inclusive VAT Rate. Email its secure link to the designated test recipient; inspect displayed amount/property/one-time/service-fee-only/non-refundable copy. Shopping expenditure is absent. Do not pay; allow the Session to expire. This verifies LIVE configuration, hosted presentation and email without a charge.
2. **Monthly:** reviewed Mail Care request; description “Controlled verification — Mail Care monthly”; final gross **€18.45/month**, net €15.00, VAT €3.45. Monthly checkbox explicitly selected. Create one local monthly invitation/attempt and one LIVE `mode=subscription` Checkout Session with inline monthly Price against the approved shared Product and inclusive VAT Rate. Email the setup link and inspect recurring acceptance and exact monthly amount. Do not complete Checkout; no Subscription, Invoice or Charge is proposed in this check. Allow expiry. Actual paid activation/lifecycle verification would require separately approved completion and financial test scope.

Shared Product and inclusive Tax Rate configuration must be approved/provisioned beforehand; no such Stripe objects were created in this task. Email-only External Provider LIVE testing is outside these proposals pending category accounting approval. No LIVE Stripe financial object, Customer or actual payment/subscription was created during this task.
