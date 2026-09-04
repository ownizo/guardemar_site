# GUARDEMAR Portal Implementation

## Environment

Required variable names are documented in `.env.example`:

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `RESEND_API_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (reserved for a later trusted invitation function)

The service-role value must never be exposed to browser code, checked into Git, printed in logs or placed in a public environment variable. It is not required for the Phase 1 implementation.

## Deployment

Netlify applies migrations from `netlify/database/migrations` during deployment. The application schema is defined in `db/schema.ts`, and `drizzle.config.ts` keeps generated migrations in the Netlify deployment directory.

Before deployment, confirm that `SUPABASE_URL` still resolves to project reference `ablktbpledjceddessyg`. Runtime functions enforce the same check and fail closed if the reference differs.

In Supabase Auth:

1. Keep email and password authentication enabled.
2. Disable open public sign-up for this private portal.
3. Add `https://guardemar.com/reset-password` and the relevant deploy-preview equivalent to allowed redirect URLs.
4. Invite `info@guardemar.com` through a trusted dashboard process if the user does not exist.
5. Do not create or send a plaintext password.

## Authentication flow

The browser creates a PKCE-compatible Supabase client with persistent session refresh. Login uses `signInWithPassword`. Password recovery uses Supabase's reset email and returns to `/reset-password`. Private route guards initialise the database profile, retrieve the stored role and enforce the required area role before rendering.

The API independently validates every access token. Frontend route guards improve user experience but are not the security boundary.

## Administrator bootstrap

The first successful login by the verified `info@guardemar.com` Supabase identity may insert the first administrator profile. The database policy additionally checks that no administrator already exists. Once created, all admin access is based on the stored role.

If another administrator already exists, the email address receives no special runtime authority. Further staff and admin role assignments require an existing administrator.

## CRM and properties

The backoffice supports:

- Operational dashboard counts and useful empty states
- Client listing, search and creation
- Client contact, billing, tax, property and staff-only note views
- Property listing and creation
- Property features, address, ownership and staff-only access notes
- Property detail with inspection and request empty states ready for later phases

The customer portal returns an explicit safe property projection. It never selects `access_notes_private`, `internal_notes` or alarm information.

## Customer invitations

Automated in-app invitation is deliberately not implemented without a privileged server credential. Supabase's administrative invite operation requires a server-only service-role key because a publishable key and ordinary user JWT cannot securely create another Auth user.

When invitation automation is added:

1. Configure `SUPABASE_SERVICE_ROLE_KEY` only in Netlify's server environment.
2. Add a staff/admin-only Function that calls Supabase `inviteUserByEmail`.
3. Never return or log the service-role value.
4. Create `client_users` and selected `property_users` rows only after the Auth user ID is known.
5. Record an audit event and send only the Supabase password-setup invitation.

Manual trusted dashboard invitations remain possible without adding the key to this application.

## Validation

- `pnpm typecheck` validates TypeScript.
- `pnpm test` runs contact and portal security tests.
- `tests/portal-security.test.mts` checks forced RLS, property relationship policies, role protection, safe customer projections and absence of service-role use in client code.
- `tests/portal-rls.sql` is a transactional isolation suite for a disposable database branch. It proves authorised property access, guessed-UUID denial, client isolation and role immutability.

The SQL isolation suite must be run after the migration is applied to a disposable branch. It is a release blocker before real customer data is introduced.

## Known Phase 1 boundary

No operational migration was applied to Supabase Postgres. Supabase is used for authentication only; the platform-required operational datastore is Netlify Database. No migration was applied to any Adler or insurance database.

Private file storage, inspections, tickets, documents, quotes and invoices remain intentionally outside this Phase 1 change. Their schema and authorisation approach are defined in the architecture document for the next implementation phase.
