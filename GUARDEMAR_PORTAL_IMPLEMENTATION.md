# Guardemar Portal Phase 1 Implementation

## Current state

Phase 1 now targets the dedicated Guardemar Supabase project `ablktbpledjceddessyg` for authentication and all operational records. Netlify remains the application host and Function runtime. No Phase 2 domain tables or file uploads are implemented.

## Required environment

- `SUPABASE_URL`: Guardemar project URL; the application verifies the project reference
- `SUPABASE_PUBLISHABLE_KEY`: browser-safe key used with authenticated JWTs and RLS
- `RESEND_API_KEY`: server-only transactional email credential

`SUPABASE_SERVICE_ROLE_KEY` is not required for Phase 1. It may later be required by a server-only user invitation Function that calls the Supabase Admin API, but it must never be exposed to the browser or used for normal customer queries.

## Applying the database correction

The Supabase migration is `supabase/migrations/20260904090000_create_guardemar_portal_foundation.sql`. Apply it only to project `ablktbpledjceddessyg` using a Supabase CLI session linked to that project or the Guardemar Supabase SQL editor.

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

The portal Function forwards the caller's bearer token through Supabase JS. Customer property reads use direct table queries protected by RLS. Staff CRM reads and transactional creates use authenticated RPCs that check `profiles.role`; they do not use service-role or direct database credentials.

## Validation

`tests/portal-security.test.mts` statically checks the migration and application wiring. `tests/portal-rls.sql` verifies customer property isolation, UUID guessing resistance, client isolation, protected columns, role immutability, staff access and anonymous denial after the migration has been applied.

The Supabase SQL test and security advisors cannot produce live results until the owner applies the migration to a disposable Guardemar database target with a privileged SQL connection.
