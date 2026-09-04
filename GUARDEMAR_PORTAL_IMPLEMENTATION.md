# Guardemar Portal Phase 1 Implementation

## Current state

Phase 1 now targets the dedicated Guardemar Supabase project `ablktbpledjceddessyg` for authentication and all operational records. Netlify remains the application host and Function runtime. No Phase 2 domain tables or file uploads are implemented.

## Required environment

- `SUPABASE_URL`: Guardemar project URL; the application verifies the project reference
- `SUPABASE_PUBLISHABLE_KEY`: browser-safe key used with authenticated JWTs and RLS
- `RESEND_API_KEY`: server-only transactional email credential

`SUPABASE_SERVICE_ROLE_KEY` is not required for Phase 1. It may later be required by a server-only user invitation Function that calls the Supabase Admin API, but it must never be exposed to the browser or used for normal customer queries.

## Applying the database correction

The Supabase migrations are `supabase/migrations/20260904074341_create_guardemar_portal_foundation.sql` and `supabase/migrations/20260904113000_add_admin_client_deletion.sql`. Apply them in order only to project `ablktbpledjceddessyg` using a Supabase CLI session linked to that project or the Guardemar Supabase SQL editor.

The current environment does not include a Supabase database connection secret or linked Supabase CLI, so the migration is generated but not applied by this repository change. Do not apply it to Adler or any other project.

After applying it:

1. Confirm `SUPABASE_URL` resolves to project `ablktbpledjceddessyg`.
2. Ensure the invited `info@guardemar.com` Auth user exists.
3. Sign in once through `/admin/login` to create the initial admin profile.
4. Run `tests/portal-rls.sql` on a disposable Guardemar branch or equivalent test project.
5. Run Supabase Database Linter and Security Advisor, then review RLS, function `search_path`, grants and indexes.
6. Verify customer and staff routes against real invited test users before considering Phase 1 complete.

## Auth flow

The existing login, password recovery, reset-password and invitation-only account flow remains based on Supabase Auth. Private route guards initialise the Supabase profile, fetch `profiles.role` and enforce customer or staff/admin route access.

Supabase Auth URL Configuration must use `https://guardemar.com` as the production Site URL. The production redirect allow-list must include `https://guardemar.com/reset-password`, `https://guardemar.com/admin/login` and `https://guardemar.com/portal/login`. Localhost equivalents may remain allow-listed for local development only. Password-reset requests derive their redirect origin from the active browser, so production mail returns to Guardemar while local development continues to use its local origin.

Public user registration must remain disabled in the Supabase Auth provider settings. Users are created only through Guardemar's invitation process; the browser application contains no sign-up or OTP registration call. The public `/auth/v1/settings` response should report `disable_signup: true` before production invitation testing is signed off.

The portal Function forwards the caller's bearer token through Supabase JS. Customer property reads use direct table queries protected by RLS. Staff CRM reads and transactional creates use authenticated RPCs that check `profiles.role`; they do not use service-role or direct database credentials.

## Client deletion rules

Client deletion is admin-only in the UI, the portal Function and the database RPC. An unlinked client can be hard-deleted. A client with properties or linked portal users is blocked and must have those relationships removed or reassigned first. Bulk deletion evaluates each requested UUID independently and returns separate deleted and blocked results, so a protected client does not make successful deletions ambiguous.

The deletion RPC does not add cascade behaviour. Existing property restrictions remain in place, portal-user links are treated as protected despite their legacy foreign-key cascade, and audit events remain as historical records with a `client_deleted` event for each completed deletion.

## Validation

`tests/portal-security.test.mts` and `tests/admin-clients.test.mts` check the migrations, application wiring, creation success semantics and submit locking. `tests/portal-rls.sql` verifies customer property isolation, UUID guessing resistance, client isolation, protected columns, role immutability, admin-only deletion, dependency blocking, partial bulk results, audit creation and anonymous denial after the migrations have been applied.

The Supabase SQL test and security advisors cannot produce live results until the owner applies the migration to a disposable Guardemar database target with a privileged SQL connection.

## Phase 2 implementation

Phase 2 adds team management, property inspection-area configuration, template-backed immutable inspection snapshots, scheduling, secure field links, mobile autosave, private photo handling, internal review, client preview, explicit publication and published customer reports.

New private routes are `/admin/inspections`, `/admin/inspections/:id`, `/admin/team`, `/admin/team/:id`, `/portal/inspections` and `/portal/inspections/:id`. The field workflow uses `/i#token`; the fragment form deliberately keeps the credential out of request paths and access logs.

The forward-only migration is `supabase/migrations/20260904120000_create_phase2_inspection_operations.sql`. It has not been applied by this repository run because no privileged database connection is configured. Apply it only to `ablktbpledjceddessyg`, then run `tests/phase2-rls.sql` in a disposable branch/test project and review Supabase Security and Performance Advisors.

`SUPABASE_JWT_SECRET` is the only additional environment variable. It is used server-side solely to mint short-lived, inspection-scoped Storage JWTs after a mobile token has been verified. `SUPABASE_SERVICE_ROLE_KEY` is neither required nor introduced.

Mobile notes and status changes are debounced, marked Saving/Saved/Connection problem, protected by per-record revisions so stale responses cannot mark newer edits saved, and retained in session storage for refresh recovery. Image uploads are resized in-browser where supported, remain private and are registered relationally only after Storage succeeds.

Initial templates are conservative and editable at the database level. A dedicated template-management screen remains a future enhancement; checklist content is not hard-coded into the application runtime.

## Phase 2 customer inspection retention and downloads

### 180-day customer availability

Published customer reports remain eligible for portal access for exactly 4,320 elapsed hours from `published_at`, equivalent to 180 24-hour days. PostgreSQL `timestamptz` is authoritative. Access is allowed only while `now() < published_at + interval '4320 hours'`; at the exact expiry timestamp it is denied. The portal displays the calculated `available_until` date and shows a quiet remaining-days reminder during the final 30 days.

The inspection list retains a lightweight historical entry after expiry, including the inspection date, frozen property name and an “Inspection report expired” label. It does not expose the published report body or media. Direct report requests show a calm expired state and link back to inspection history.

This is a customer-portal access rule, not an internal destruction policy. Expiry is enforced in customer RPCs, inspection/area/item/photo RLS policies and private Storage policies. Staff and administrator access continues under the existing internal role rules. Database metadata and source photographs remain retained internally in this phase; no destructive job, automatic object deletion or permanent public archive was introduced.

### PDF architecture and authorisation

`inspection-files.mts` is an authenticated Netlify Function dedicated to customer report files. Every PDF, photograph and ZIP request validates the Supabase session, requires the stored `customer` role, and calls `get_customer_inspection`. That database function returns data only when the customer has a `property_users` relationship, the inspection is published and the 180-day window remains open. Browser-supplied UUIDs and Storage paths are never treated as authorisation.

The PDF renderer consumes only the immutable `published_snapshot`. It does not query raw inspection review tables and therefore cannot include internal notes, hidden photographs, unapproved observations, access tokens, auth identifiers or system metadata. Future snapshots include frozen property location, timing, inspector presentation, area/item order and photo-to-item relationships. Existing snapshots remain unchanged, so historical property and room names are not silently regenerated from later configuration.

PDFs are produced on demand with Guardemar branding, contact details from `src/config/site.ts`, overall and per-area statuses, approved observations and recommendations, client-approved photographs, report ID, page numbering and concise visual-inspection wording. No duplicate PDF is stored. Images are auto-rotated, resized to a maximum 1,200 × 900 report resolution and compressed as quality-appropriate JPEGs before embedding.

### Gallery and photograph downloads

The customer report presents optimised 520 × 390 thumbnails and an authenticated 1,800 × 1,350 display variant instead of loading original phone images into the page. The accessible lightbox provides area and checklist context, captions, photo numbering, visible previous/next/download/close controls and Escape/arrow-key navigation. It adapts to desktop, tablet and mobile layouts.

Individual downloads return the retained customer-quality source object with a sanitised property/date/area filename. “Download all photos” creates a private ZIP on demand from only the photo IDs frozen into the client-visible snapshot. Neither ZIPs nor photo variants are permanently stored.

Customer media responses are delivered through the authenticated Function with `private, no-store`; no customer signed Storage URL is exposed. Internal administration continues to use 15-minute signed previews where already implemented. The earlier field-upload credential remains a separate one-hour, inspection-scoped operational token and does not grant customer report access.

### Validation and future retention

Automated tests cover day 1, day 179, the exact day-180 timestamp and post-expiry behaviour; report, photograph, PDF and ZIP authorisation; cross-customer and unpublished denial; immutable snapshot fields; approved/hidden field projection; PDF image optimisation and exclusions; and accessible gallery controls. `tests/phase2-rls.sql` additionally verifies that expired customer rows and photo metadata are denied while lightweight history and internal administrator retention remain available.

A future internal retention policy may define an archival storage tier and eventual physical deletion schedule after considering contractual, legal, operational, incident, insurance and audit requirements. No physical deletion should be implemented until Guardemar approves that separate policy and its recovery/audit implications.
