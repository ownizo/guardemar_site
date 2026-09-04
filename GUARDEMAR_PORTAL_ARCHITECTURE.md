# Guardemar Private Application Architecture

## Platform boundary

The private application extends the existing TanStack Start website without replacing public marketing routes. Netlify provides hosting, deployment, environment variables and server Functions. Resend remains the transactional email provider.

Supabase project `ablktbpledjceddessyg` is the single system of record for Guardemar operational data. It provides Supabase Auth, PostgreSQL, Row Level Security and, in later phases, private Supabase Storage buckets. The Function configuration rejects any Supabase URL whose project reference is not `ablktbpledjceddessyg`.

## Authentication and database access

The browser receives only `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` from `/api/portal-config`. It manages the Supabase Auth session and sends the access token to `/api/portal/*`.

`portal-api.mts` creates a Supabase client with that bearer token attached to every database request. PostgreSQL therefore receives the caller's authenticated JWT and evaluates policies with native `auth.uid()`. The Function validates the token with Supabase Auth, but it does not create a second identity context, accept a browser-supplied user ID, open a privileged PostgreSQL connection or use a service-role key.

Drizzle and `@netlify/database` were removed. Supabase JS is the clearer query layer for this phase because it preserves the authenticated user context automatically and makes RLS the final authority for every normal request.

## Phase 1 schema

The versioned Supabase migration creates:

- `profiles`: application role and user details, keyed directly to `auth.users.id`
- `clients`: CRM and billing records, with internal notes protected from direct authenticated reads
- `client_users`: authenticated-user to CRM-client relationships
- `properties`: property records, with alarm, access and internal notes protected from direct authenticated reads
- `property_users`: the authoritative user-to-property relationship used by customer RLS
- `staff_profiles`: operational staff details
- `audit_events`: security and operational audit records

Future operational tables, including inspections, tickets, documents, quotes and invoices, belong in the same Supabase PostgreSQL project. Phase 2 tables are not included in this correction.

## Roles and bootstrap

Roles are `customer`, `staff` and `admin` and are stored in `profiles.role`. Normal authorisation resolves the current profile by `auth.uid()` and never compares email addresses.

The authenticated `initialise_profile()` function creates a missing customer profile. The sole bootstrap exception assigns `admin` to the verified Supabase identity `info@guardemar.com` only when no admin profile exists. The resulting role is stored in Supabase PostgreSQL; subsequent access uses only `profiles.role`. A trigger prevents non-admin callers from changing any profile role.

## Row Level Security

RLS is enabled on all seven Phase 1 tables. Policies implement these rules:

- `profiles`: users select and update their own profile; staff can select profiles; admins can update profiles and roles
- `clients`: customers select only rows linked through `client_users.user_id = auth.uid()`; staff can manage rows; only admins can delete
- `client_users`: customers select only their own relationship rows; staff can manage relationships
- `properties`: customers select only rows linked through `property_users.user_id = auth.uid()`; staff can manage rows; only admins can delete
- `property_users`: customers select only their own relationship rows; staff can manage relationships
- `staff_profiles`: staff can select; admins can create, update and delete
- `audit_events`: staff can select and can insert events only with `actor_user_id = auth.uid()`

Direct authenticated column grants exclude `clients.internal_notes`, `properties.has_alarm`, `properties.access_notes_private` and `properties.internal_notes`. Staff-only SECURITY DEFINER RPCs expose those fields only after checking the stored role. Every such function has an empty `search_path`, explicit execution grants and no anonymous access.

## Netlify Database retirement

The applied Netlify migration `20260904070446_create_portal_foundation` remains unchanged because applied migrations are immutable. A forward-only retirement migration drops its Guardemar tables, functions and enum types. No application code or package depends on Netlify Database after the correction.

## Storage strategy

Private Guardemar files belong in Supabase Storage, not Netlify Blobs. Later phases should create private buckets named `inspection-photos`, `ticket-attachments` and `property-documents` in project `ablktbpledjceddessyg`.

Storage object paths must include the owning property UUID, and Storage policies must resolve access from the authenticated `auth.uid()` through `property_users`. Inspection photographs and property documents must never use public buckets or permanent public URLs. Clients should use authenticated downloads or short-lived signed URLs after authorisation.

## Phase 2 boundary

No inspection, ticket, document, quote or invoice tables are introduced here. Phase 2 starts only after the Supabase migration is applied, the RLS test script passes with real Auth identities or a disposable branch, and Supabase security advisors have been reviewed.

## Phase 2 inspection operations

Phase 2 remains inside the dedicated Guardemar Supabase project `ablktbpledjceddessyg`. Netlify hosts the TanStack application and authenticated Functions, while Supabase Auth, PostgreSQL RLS and private Storage remain the operational system of record. The retired Netlify database is not reactivated.

### Relational model

Operational collaborators continue to use `staff_profiles`, now with optional `user_id`, separate first/last/display names, optional contact details, report visibility, internal notes and a private Storage path. This lets Guardemar assign an inspector who does not have login credentials.

`property_areas` stores the reusable generic `area_type` separately from the free-text `custom_label`. Duplicate area types are intentionally allowed, and `display_order` defines the field walking order. Archiving preserves inspection history.

`inspection_templates` and `inspection_template_items` define what is normally checked. Creating an inspection copies active property areas and matching template items into `inspection_areas` and `inspection_items`. These relational snapshots retain historical labels, order, guidance and checklist content when later configuration changes.

`inspections` owns scheduling, assigned `inspector_staff_id`, lifecycle timestamps, suggested/final condition, internal review notes, client summary and a frozen `published_snapshot`. `inspection_photos` links private objects to an inspection area and optional item. `inspection_access_tokens` contains only SHA-256 token hashes, expiry, revocation and use timestamps.

### Authorization and publication

Customers resolve access through `auth.uid()` → `property_users` → property → inspection. RLS permits customer reads only for `published` inspections. Draft, scheduled, in-progress, completed, awaiting-review and cancelled records remain invisible. The publication RPC is admin-only, records `published_at` and `published_by`, and freezes the exact client projection used by preview and the portal.

Staff can perform operational reads and review edits. Team management, property-area configuration, mobile-link generation/revocation and publishing default to administrators. Authorization uses stored roles, never email addresses or browser-supplied user IDs.

### Token-only field access

Field links use a random 256-bit token carried in the URL fragment (`/i#token`) so the credential is not sent in HTTP request paths or normal access logs. The browser removes the fragment immediately and keeps the credential only in session storage. Netlify Functions hash it before calling narrowly scoped SECURITY DEFINER RPCs. Those RPCs can read or update only the linked scheduled/in-progress inspection and cannot list inspections, access CRM data, reassign inspectors or publish.

For direct private Storage upload, the Function can mint a one-hour custom Supabase JWT containing only the verified `inspection_access_id`. Storage RLS rechecks the underlying token row for expiry/revocation and limits paths to the linked inspection. This requires `SUPABASE_JWT_SECRET`; no service-role key is used.

### Storage

`inspection-photos` is private, limited to supported image MIME types and 10 MB objects. Customer download requires a published authorised inspection plus approved photo metadata. Field access requires an active token for the exact inspection. `staff-photos` is also private; administrators upload, staff can view, and customers can view a report-enabled photograph only when it belongs to an inspector on one of their published inspections.

### Review workflow

Field completion records `completed_at`, moves directly to `awaiting_review`, revokes the mobile token and never publishes. Review supports area/item statuses, observations, recommendations and explicit client-visible controls, plus photo approval and final/internal summaries. “Preview as client” uses the same projection as publication. “Share with client” is a separate confirmed administrator action.
