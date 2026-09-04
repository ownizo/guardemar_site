# GUARDEMAR Portal Architecture

## Scope

The private application extends the existing TanStack Start website without replacing the public marketing routes. Supabase Auth provides invited-user identity. Netlify Functions validate every bearer token against the Guardemar Supabase project before setting an authenticated request context for Netlify Database. Operational records live in managed Postgres and are protected by forced row-level security.

The configured Supabase URL was verified on 4 September 2026. Its project reference is `ablktbpledjceddessyg`. Both authentication functions also reject configuration for any other project reference.

## Existing stack

- TanStack Start and TanStack Router file-based routes
- React 19 and TypeScript
- Tailwind CSS 4 plus the existing Guardemar CSS design tokens
- Netlify hosting, Functions, Forms and managed Postgres
- Resend in a server-only Netlify Function
- Content Collections for editorial Markdown
- Vitest is not installed; tests use Node's built-in test runner

## Runtime boundaries

### Browser

The browser receives only the Supabase URL and publishable key from `/api/portal-config`. It manages the Supabase Auth session and sends the short-lived access token to `/api/portal/*`. It never receives database credentials, Resend credentials or a service-role key.

### Netlify Functions

`portal-api.mts` validates the access token by calling Supabase Auth. After validation, it starts a database transaction and sets transaction-local `app.user_id` and `app.user_email` values. Database policies derive identity and role exclusively from this trusted context. Browser-provided user, client and property identifiers do not establish authorisation.

### Database

`db/schema.ts` is the typed Drizzle source of truth. Versioned SQL is stored in `netlify/database/migrations`. The first migration enables and forces RLS on every Phase 1 table, creates safe helper functions, updated-at triggers, indexes and role protection.

## Phase 1 schema

- `profiles`: Supabase user UUID, immutable application role, personal details
- `clients`: CRM customer and billing record; internal notes are staff-only
- `client_users`: many-to-many relationship between CRM clients and authenticated users
- `properties`: property record, features and staff-only access/internal notes
- `property_users`: explicit user-to-property authorisation; central to customer RLS
- `staff_profiles`: operational staff identity and display information
- `audit_events`: important security and operational actions

Supabase Auth passwords remain exclusively in Supabase Auth. A cross-database foreign key to `auth.users` is not possible because identity and operational records are intentionally in separate managed services; UUIDs are validated against Supabase before database context is established.

## Roles and bootstrap

Roles are `customer`, `staff` and `admin`. Roles are stored in `profiles`, are not sourced from email during normal authorisation, and may only be changed by a database-backed administrator.

The one-time bootstrap permits the verified Supabase identity `info@guardemar.com` to create the first `admin` profile only when no administrator exists. Subsequent requests use the stored role. No public form can choose a role.

If that Supabase user does not exist, invite or create it through the trusted Supabase dashboard without setting or emailing a plaintext password. After password setup, sign in at `/admin/login`; the first authenticated request completes the database bootstrap.

## RLS strategy

- Customers select only their own profile.
- Customers select a CRM client only through `client_users`.
- Customers select a property only through `property_users`.
- Staff and administrators can manage operational CRM and property records.
- Only administrators can alter application roles or delete core records.
- Customer-facing API queries select explicit safe columns and omit alarm flags, access notes and internal notes.
- Every Phase 1 sensitive table uses both `ENABLE ROW LEVEL SECURITY` and `FORCE ROW LEVEL SECURITY`.

Phase 2 policies must preserve the same rule: a published inspection is visible only when its property is authorised through `property_users`. Draft, in-progress and completed-but-unpublished inspections remain staff-only.

## Routes

### Public

- Existing marketing and editorial routes remain unchanged.
- A quiet `Client Login` link points to `/portal/login` in the main navigation and footer.

### Customer

- `/portal/login`
- `/portal/forgot-password`
- `/reset-password`
- `/portal`
- `/portal/properties`
- `/portal/account`

### Operations

- `/admin/login`
- `/admin`
- `/admin/clients`
- `/admin/clients/:id`
- `/admin/properties`
- `/admin/properties/:id`

Unimplemented navigation sections are hidden rather than shown as broken placeholders.

## Phase 2 inspection design

The next migration should add `inspection_templates`, `inspection_template_items`, `inspections`, `inspection_items` and `inspection_photos`. Starting an inspection copies template rows into immutable inspection item snapshots. Workflow states are `draft`, `in_progress`, `completed` and `published`; `published_at` is written only by an explicit publish action.

The mobile workflow should use debounced draft saves, large status controls with text and icons, direct camera uploads, review and explicit publication. Customer reads must filter to `published` in both RLS and server projections.

## Storage strategy

Private files should use Netlify Blobs under server-authorised UUID paths because the project platform requires Netlify persistence primitives. Proposed stores are `inspection-photos`, `ticket-attachments` and `property-documents`. Browser access should pass through authenticated Functions that verify the same property relationship before returning a short-lived download response. Original images must not be loaded on dashboard pages.

No public bucket or public asset URL is acceptable for private-home photographs or documents.

## Notifications

Resend remains server-only. Phase 2 and later notifications should contain minimal information and link recipients back to authenticated portal routes. Inspection photographs, access information, alarm details and internal notes must never be attached or copied into email.

## Later phases

1. Inspection templates, mobile draft workflow, publication and private photographs
2. Tickets, public messages, database-enforced internal notes and attachments
3. Property documents, quotes, decisions, invoices and intervention lifecycle
4. Expanded audit coverage, notification templates, print reports and hardening

Each phase requires versioned migrations, RLS tests, storage isolation tests, mobile checks, accessibility review and production validation before release.
