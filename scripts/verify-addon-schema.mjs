// Install pinned @electric-sql/pglite@0.5.8 in /tmp/guardemar-addon-db-test first.
// This script is local-only and never connects to Supabase or Stripe.
const { PGlite } = await import(process.env.ADDON_PGLITE_MODULE || '/tmp/guardemar-addon-db-test/node_modules/@electric-sql/pglite/dist/index.js')
import { readFile } from 'node:fs/promises'
const root=new URL('../', import.meta.url).pathname
const db=new PGlite()
await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
create schema auth; create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
grant usage on schema auth to authenticated;
grant execute on function auth.uid() to authenticated;
create schema extensions; create function extensions.gen_random_uuid() returns uuid language sql as $$ select gen_random_uuid() $$;
`)
const foundation=await readFile(root+'supabase/migrations/20260904074341_create_guardemar_portal_foundation.sql','utf8')
await db.exec(foundation.slice(foundation.indexOf('create type public.application_role'),foundation.indexOf('create schema if not exists private;')))
await db.exec(foundation.slice(foundation.indexOf('create schema if not exists private;'),foundation.indexOf('create function private.set_updated_at()')))
await db.exec(`alter table public.profiles enable row level security;
alter table public.client_users enable row level security; alter table public.property_users enable row level security;
create policy profile_read on public.profiles for select to authenticated using(id=auth.uid() or private.is_staff());
create policy client_user_read on public.client_users for select to authenticated using(user_id=auth.uid() or private.is_staff());
create policy property_user_read on public.property_users for select to authenticated using(user_id=auth.uid() or private.is_staff());
grant select on public.profiles,public.client_users,public.property_users to authenticated;`)
await db.exec(await readFile(root+'supabase/migrations/20260915201630_addon_service_requests.sql','utf8'))
console.log('Migration applied to isolated PostgreSQL engine using foundation table definitions and role helpers.')
await db.exec(await readFile(root+'tests/addon-rls.sql','utf8'))
console.log('Transactional request, draft, idempotency, status and RLS assertions passed; fixtures rolled back.')
await db.close()
