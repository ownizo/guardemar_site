# Optional Services request flow — implementation and activation handover

Starting main: `2c8b03d5980d2a647b37063eac8a6245b0ed4f99`.
Branch: `feat/addon-service-requests`.

## Audit findings

- TanStack file routes are deliberately flat beneath `/portal` and `/admin`; every new page uses the existing `PrivateGuard`, `PrivateShell`, navigation and authenticated Supabase session.
- `profiles.role` is the authoritative customer/staff/admin role. `client_users` links a user to a client; `property_users` separately authorises a property. Neither user metadata nor browser-supplied client IDs are used for authorisation.
- Existing property access is reused; new requests additionally require the property owner's `client_users` relationship. Active client/property checks occur inside the creation transaction. Revoked property or client access hides requests and their children.
- There is no notification table/service in the repository. The admin dashboard has an operational activity placeholder and the database has `audit_events`. Request creation writes `ADDON_REQUEST_CREATED` atomically; Services and the existing dashboard expose the new-request queue as in-app alerts linking to request details. A second general-purpose notification architecture has not been introduced.
- Existing transactional emails use Resend, the business email in `src/config/site.ts`, escaped HTML and stable provider idempotency keys. The new request email uses those conventions and adds a persistent delivery marker because [Resend's 24-hour idempotency window](https://resend.com/docs/dashboard/emails/idempotency-keys) alone is insufficient for indefinite retries.
- The catalogue remains `src/config/optional-services.ts`. No second maintained catalogue or numeric charge mapping was introduced. The customer-visible fee/note is snapshotted as text and never used as a final charge.
- Stripe server helpers are in `_subscription-shared.mts`. They authenticate using the caller's token/profile, guard the production project reference, then use a server-only service-role client for privileged work. Stripe calls are REST requests with idempotency headers and LIVE-only key validation.
- The canonical Stripe Customer is `clients.stripe_customer_id`; subscription Checkout creates a missing Customer using `guardemar-client-{client_id}` idempotency. Add-on code creates no Stripe Customer.
- Subscription accounting explicitly uses EUR cents, approved exclusive Portuguese VAT at 23%, immutable accepted net/tax/gross evidence, approved recurring Prices and a configured Tax Rate. These semantics have not been approved for variable one-off add-ons.
- Subscription payments/invoice history use `subscription_payment_events`. The existing webhook verifies signatures and LIVE mode, records `stripe_webhook_events`, retries failed/stale processing and activates subscriptions only through validated `invoice.paid`. None of those paths were altered.
- The correct Netlify site is linked and authenticated; production function configuration for Supabase, Resend and Stripe is present. Secret values are redacted. Actual deployed restricted-key permissions could not be confirmed. The code accepts an `rk_live_` key, but that prefix does not prove its granted capabilities. Do not infer permission approval from it.
- The target Supabase project `ablktbpledjceddessyg` reported `INACTIVE`; SQL and table queries timed out. No migration was applied to production or any unrelated project.

## Schema and access

Migration: `supabase/migrations/20260915201630_addon_service_requests.sql`, generated using `supabase migration new addon_service_requests`.

- `addon_requests`: client/property/requester, stable reference, controlled status, published fee/note snapshot, customer observations (5,000 characters), structured details, lifecycle timestamps, requester/key uniqueness and a SHA-256 submission fingerprint.
- `addon_shopping_items`: ordered relational shopping items, free-form quantity with units, brands, validated alternative policy/product and notes.
- `addon_internal_notes`: staff-only notes stored separately from customer data.
- `addon_payments`: linked request/client/admin, EUR cents, email/description, unique idempotency key, separate payment state, nullable Stripe IDs/URL and payment timestamps. Draft amount semantics are explicitly `unapproved`.
- `addon_request_email_delivery`: request-specific durable send marker, first-attempt/claim/sent timestamps and provider message ID. It is not a customer notification feed.

All five tables enable RLS and revoke public/anonymous/default browser write grants. Authenticated users have read-only request/item access requiring both client and property membership; staff use the existing `private.is_staff()` helper. Internal notes are staff-only. Payment SELECT grants exclude email, Stripe identifiers and URLs; customer RLS excludes drafts. Delivery markers are server-only.

The three write RPCs use `SECURITY INVOKER`, an empty search path, explicit role/property/client checks and server-supplied actors. Execution is revoked from PUBLIC, anon and authenticated, and granted only to service_role. The browser cannot forge an actor via RPC.

Creation is atomic across request, shopping items, audit alert and email marker. A transaction-level advisory lock serialises requester/key retries; changed payloads with the same key fail closed. Payment draft creation locks the request and a partial unique index permits only one unresolved/payment record per request, including paid records. Staff changes use an expected-status comparison and a controlled transition graph. No operational endpoint permits setting `paid` or `payment_pending`.

## Customer experience

- `/portal/services`: all 12 catalogue services with icons, concise descriptions, exact published fees, external-cost notes and View service links; history of authorised requests.
- `/portal/services/:serviceCode`: full catalogue description, property cards (preselected when only one), published price disclaimer and large optional Additional details textarea. Opening this page never creates a request.
- Shopping: up to 60 stacked items, product/quantity/preferred brand/substitution/specific alternative/notes, arrival date/time (Portugal time), special instructions and general observations. Fields start empty; examples appear only in placeholders. No supermarket cost calculation.
- Transfer: both directions, airport/date/time/flight/passenger count/luggage/child seat details and general observations. No supplier booking integration.
- SEND REQUEST: server validation, derived client and authorisation, atomic persistence, audit alert and Resend notification. Confirmation says Request received, shows reference/service/property/Requested and explains agent contact and the later secure link. No booking or final-price promise.
- `/portal/services/requests/:id`: customer-safe observations/details/shopping list/status. Staff notes, audit metadata, email-delivery internals and Stripe IDs are excluded. Draft payments are invisible.

## Admin experience

- Services and Add-on Payments are separate navigation items.
- `/admin/services`: new request count, status filter, reference/service/customer/property/date/status and linked details. Scheduled includes in-progress requests.
- `/admin/services/:id`: customer contact/property/catalogue snapshot/observations/structured details/shopping list/history; controlled review/status changes and staff-only notes. Shows email delivery state, including stale deliveries requiring reconciliation.
- `/admin/add-on-payments?requestId=...`: populate a reviewed request, customer/email/service description. Admin enters a positive EUR amount; no default is taken from the catalogue. Only administrators can save drafts. Amount is labelled Proposed amount — tax treatment unapproved. Creating/sending a live link is disabled.
- Admin notification email contains the reference/customer/property/service/observations, concise shopping summary where applicable and an admin link. Customer data is escaped. Resend failures leave the request confirmed and a durable pending marker.
- Scheduled retries run every five minutes, claim pending deliveries atomically, and reuse the stable provider key. Confirmed sent markers prevent duplicates. An ambiguous first attempt older than 23 hours is never automatically resent; staff must inspect Resend before manual reconciliation. This deliberately avoids exceeding the provider's 24-hour idempotency window.

## Payment activation decision — deliberately blocked

Preferred architecture remains a **one-time server-created Checkout Session linked to exactly one local payment record**, rather than a reusable public Payment Link. It offers authoritative linkage, metadata, session expiry and webhook confirmation.

However, implementation of Stripe creation, payment-link email, replacement/resend and payment-confirmation webhook handling is **deferred**, not production-ready:

1. The admin amount's net/gross/VAT/external-cost meaning is unapproved. No tax calculation or subscription Tax Rate reuse has been implemented.
2. Modern Checkout dynamic `price_data` creates an inline Price, and `product_data` creates a Product. That conflicts with the explicit prohibition on creating per-request Products/Prices. A decision is required: permit inline non-reusable pricing against an approved shared add-on Product, or approve a different exact-amount hosted collection architecture. Do not silently treat inline pricing as exempt from the prohibition.
3. Deployed restricted-key permissions must be inspected and narrowly authorised before adding payment capabilities.

Sources: [Checkout pricing model](https://docs.stripe.com/payments/checkout/migrating-prices), [Checkout fulfilment](https://docs.stripe.com/checkout/fulfillment), [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security).

The server explicitly rejects `send`, `resend` and `replace` with `ADDON_PAYMENT_APPROVAL_REQUIRED`. No environment toggle can enable them. No Products, Prices, Customers, Checkout Sessions, PaymentIntents, Payment Links or payments were created during development/testing. No customer payment-link email was sent.

For the eventual approved implementation:

- Create the local payment first; amount/description/EUR and all linkage metadata come from the authorised server record.
- Reuse `clients.stripe_customer_id` where verified; never silently create Customers in development.
- Persist each Checkout attempt and idempotency key before Stripe; lock/compare-and-swap local ownership so concurrent attempts cannot create independent payable Sessions.
- Resend the same valid URL, never create another payment for an email resend. Reconcile Stripe state before any expiry replacement; fail closed for completed/processing/paid or uncertain payment state. A paid record must remain terminal for payment creation.
- Extend the existing verified webhook ledger, keeping subscription dispatch isolated. Candidate events are `checkout.session.completed` with authoritative `payment_status=paid`, `checkout.session.async_payment_succeeded` for delayed methods, and expiry/failure events. Verify current Stripe Session/PaymentIntent amount, currency, IDs and metadata before an atomic paid transition. A return page never confirms payment.
- Payment confirmation sets payment/request paid, never operational completed, and writes `ADDON_PAYMENT_CONFIRMED`, then appropriate idempotent notifications. Expiry/send/resend events are audited when those operations actually exist.

Currently implemented audit actions: `ADDON_REQUEST_CREATED`, `ADDON_REQUEST_STATUS_CHANGED`, `ADDON_REQUEST_NOTE_ADDED`, `ADDON_PAYMENT_CREATED` (draft), `ADDON_REQUEST_COMPLETED`, `ADDON_REQUEST_CANCELLED`. Payment send/resend/confirmed/expired audit actions have intentionally not been emitted for operations that are not implemented.

## Validation and production rollout

All required checks passed: `npm run typecheck`, `npm test`, `npm run build`, `npm run lint`, `npm run legal:hash`, `git diff --check`.

`tests/addon-requests.test.mts` covers catalogue fees, strict request/payment input, server-derived snapshot/actor, authorisation failures, customer-safe projections, structured shopping/transfer details, operational transitions, email delivery idempotency/failure, payment drafts, disabled send/resend/replacement and return-page safety. These use mocks and do not claim to verify real Stripe events or production delivery.

`tests/addon-rls.sql` contains transactional database assertions for creation/item/audit/email-marker idempotency, fingerprint mismatch, client derivation/property denial, staff access, stale/invalid transitions, admin-only payment drafts, authoritative draft amount, duplicate/paid draft protection and RLS/privilege isolation. All fixtures roll back.

Local execution without production access:

```sh
npm install --prefix /tmp/guardemar-addon-db-test --no-audit --no-fund @electric-sql/pglite@0.5.8
node scripts/verify-addon-schema.mjs
```

The local runner uses repository foundation table definitions and role helpers with local auth/extension substitutes and scoped membership read policies. It validates the new migration and assertions in isolated PostgreSQL; it is not a replacement for testing the actual deployed RLS environment. No repository dependency/lockfile change is required.

Production is **not deployed or verified**. Restore access to the inactive target project; review/apply this migration only there; run advisors and transactional tests in an approved disposable GUARDEMAR environment; verify the existing function environment and Resend configuration; deploy the tested branch. A browser was unavailable in this session, so interactive/mobile visual checks remain outstanding.

Use a designated test customer with authorised property and explicit synthetic request observations for the controlled production request test. Verify customer submission/confirmation, admin alert/email/details and loading the payment draft form. Stop before creating any real Stripe object. Do not claim successful production delivery from mocked tests.

Current production is unchanged: Netlify deploy `6aa98b9b00d152000859b2fe`, state `ready`, commit `2c8b03d5980d2a647b37063eac8a6245b0ed4f99`.

Application test runner: 20 files passed, 0 failed, including 20 new add-on test cases. The isolated SQL runner, separate server-function TypeScript check and local Netlify function bundling also passed. Build completed with existing Vite chunk-size/unused-import warnings. Lint is the repository's TypeScript check.

General Terms 2.5 SHA-256 remains `7bdf2ed911c1c6f312e20a985c8e40ddc09af5b7e401925a9c3ffd49d6bf76fd`.

## Required legal/accounting decisions

No General Terms or Fee Schedule changes have been made. Confirm before LIVE activation:

1. Published prices say “+ VAT”; confirm VAT-exclusive treatment and applicability for each add-on, and define admin amount semantics explicitly.
2. How variable third-party costs are invoiced/collected, including supplier/customer relationships and VAT evidence.
3. Shopping reimbursement versus resale/disbursement treatment and receipts.
4. Cancellation/refund rules and operational handling of paid cancellations.
5. Mail Care/Vehicle Care recurring charging model; they remain requests and are not added to care subscriptions.
6. Third-party provider liability wording.
7. Resolve dynamic Checkout inline Price/Product creation versus the stated prohibition.
