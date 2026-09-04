# Retired Guardemar schema

Guardemar operational data lives only in Supabase PostgreSQL project `ablktbpledjceddessyg`.

The original `20260904070446_create_portal_foundation` migration is retained unchanged because it was applied to a Netlify Database preview branch and is immutable. The forward-only `20260904093000_retire_portal_foundation` migration removes those tables, functions and enum types. Application code has no Netlify Database runtime dependency.
