-- Guardemar operational schema for Supabase project ablktbpledjceddessyg.
-- Apply only to the dedicated Guardemar project.

create extension if not exists pgcrypto with schema extensions;

create type public.application_role as enum ('customer', 'staff', 'admin');
create type public.property_type as enum ('villa', 'apartment', 'townhouse', 'other');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role public.application_role not null default 'customer',
  first_name text,
  last_name text,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.clients (
  id uuid primary key default extensions.gen_random_uuid(),
  first_name text not null,
  last_name text not null,
  email text not null,
  phone text not null,
  tax_number text,
  billing_address text,
  country text not null default 'Portugal',
  internal_notes text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.client_users (
  id uuid primary key default extensions.gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  relationship_label text,
  created_at timestamptz not null default now(),
  constraint client_users_client_user_key unique (client_id, user_id)
);

create table public.properties (
  id uuid primary key default extensions.gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete restrict,
  display_name text not null,
  address_line_1 text not null,
  address_line_2 text,
  postal_code text not null,
  locality text not null,
  municipality text not null,
  country text not null default 'Portugal',
  property_type public.property_type not null default 'other',
  bedrooms integer,
  bathrooms integer,
  has_pool boolean not null default false,
  has_garden boolean not null default false,
  has_irrigation boolean not null default false,
  has_alarm boolean not null default false,
  access_notes_private text,
  internal_notes text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint properties_bedrooms_check check (bedrooms is null or bedrooms >= 0),
  constraint properties_bathrooms_check check (bathrooms is null or bathrooms >= 0)
);

create table public.property_users (
  id uuid primary key default extensions.gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint property_users_property_user_key unique (property_id, user_id)
);

create table public.staff_profiles (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  display_name text not null,
  role_title text not null,
  active boolean not null default true,
  photo_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.audit_events (
  id uuid primary key default extensions.gen_random_uuid(),
  actor_user_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index clients_name_idx on public.clients (last_name, first_name);
create index clients_email_idx on public.clients (email);
create index clients_phone_idx on public.clients (phone);
create index clients_tax_number_idx on public.clients (tax_number);
create index client_users_user_idx on public.client_users (user_id);
create index client_users_client_idx on public.client_users (client_id);
create index properties_client_idx on public.properties (client_id);
create index properties_locality_idx on public.properties (locality);
create index property_users_user_idx on public.property_users (user_id);
create index property_users_property_idx on public.property_users (property_id);
create index staff_profiles_user_idx on public.staff_profiles (user_id);
create index audit_events_actor_idx on public.audit_events (actor_user_id);
create index audit_events_entity_idx on public.audit_events (entity_type, entity_id);
create index audit_events_created_idx on public.audit_events (created_at desc);

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create function private.current_application_role()
returns public.application_role
language sql
stable
security definer
set search_path = ''
as $$
  select role from public.profiles where id = (select auth.uid());
$$;

create function private.is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(private.current_application_role() in ('staff', 'admin'), false);
$$;

create function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(private.current_application_role() = 'admin', false);
$$;

create function private.require_staff()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_staff() then
    raise exception 'staff access required' using errcode = '42501';
  end if;
end;
$$;

revoke all on function private.current_application_role() from public, anon;
revoke all on function private.is_staff() from public, anon;
revoke all on function private.is_admin() from public, anon;
revoke all on function private.require_staff() from public, anon;
grant execute on function private.current_application_role() to authenticated;
grant execute on function private.is_staff() to authenticated;
grant execute on function private.is_admin() to authenticated;

create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at before update on public.profiles
for each row execute function private.set_updated_at();
create trigger clients_set_updated_at before update on public.clients
for each row execute function private.set_updated_at();
create trigger properties_set_updated_at before update on public.properties
for each row execute function private.set_updated_at();
create trigger staff_profiles_set_updated_at before update on public.staff_profiles
for each row execute function private.set_updated_at();

revoke all on function private.set_updated_at() from public, anon, authenticated;

create function private.protect_profile_role()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.id is distinct from old.id then
    raise exception 'profile identity cannot be changed' using errcode = '42501';
  end if;
  if new.role is distinct from old.role and not private.is_admin() then
    raise exception 'role changes require administrator access' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger profiles_protect_role before update on public.profiles
for each row execute function private.protect_profile_role();

revoke all on function private.protect_profile_role() from public, anon, authenticated;

alter table public.profiles enable row level security;
alter table public.clients enable row level security;
alter table public.client_users enable row level security;
alter table public.properties enable row level security;
alter table public.property_users enable row level security;
alter table public.staff_profiles enable row level security;
alter table public.audit_events enable row level security;

create policy profiles_select_authorised on public.profiles
for select to authenticated
using (id = (select auth.uid()) or private.is_staff());

create policy profiles_insert_self_customer on public.profiles
for insert to authenticated
with check (id = (select auth.uid()) and role = 'customer');

create policy profiles_insert_admin on public.profiles
for insert to authenticated
with check (private.is_admin());

create policy profiles_update_self on public.profiles
for update to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

create policy profiles_update_admin on public.profiles
for update to authenticated
using (private.is_admin())
with check (private.is_admin());

create policy clients_select_authorised on public.clients
for select to authenticated
using (
  private.is_staff()
  or exists (
    select 1 from public.client_users
    where client_users.client_id = clients.id
      and client_users.user_id = (select auth.uid())
  )
);

create policy clients_staff_insert on public.clients
for insert to authenticated with check (private.is_staff());
create policy clients_staff_update on public.clients
for update to authenticated using (private.is_staff()) with check (private.is_staff());
create policy clients_admin_delete on public.clients
for delete to authenticated using (private.is_admin());

create policy client_users_select_authorised on public.client_users
for select to authenticated
using (user_id = (select auth.uid()) or private.is_staff());
create policy client_users_staff_insert on public.client_users
for insert to authenticated with check (private.is_staff());
create policy client_users_staff_update on public.client_users
for update to authenticated using (private.is_staff()) with check (private.is_staff());
create policy client_users_staff_delete on public.client_users
for delete to authenticated using (private.is_staff());

create policy properties_select_authorised on public.properties
for select to authenticated
using (
  private.is_staff()
  or exists (
    select 1 from public.property_users
    where property_users.property_id = properties.id
      and property_users.user_id = (select auth.uid())
  )
);

create policy properties_staff_insert on public.properties
for insert to authenticated with check (private.is_staff());
create policy properties_staff_update on public.properties
for update to authenticated using (private.is_staff()) with check (private.is_staff());
create policy properties_admin_delete on public.properties
for delete to authenticated using (private.is_admin());

create policy property_users_select_authorised on public.property_users
for select to authenticated
using (user_id = (select auth.uid()) or private.is_staff());
create policy property_users_staff_insert on public.property_users
for insert to authenticated with check (private.is_staff());
create policy property_users_staff_update on public.property_users
for update to authenticated using (private.is_staff()) with check (private.is_staff());
create policy property_users_staff_delete on public.property_users
for delete to authenticated using (private.is_staff());

create policy staff_profiles_select_staff on public.staff_profiles
for select to authenticated using (private.is_staff());
create policy staff_profiles_admin_insert on public.staff_profiles
for insert to authenticated with check (private.is_admin());
create policy staff_profiles_admin_update on public.staff_profiles
for update to authenticated using (private.is_admin()) with check (private.is_admin());
create policy staff_profiles_admin_delete on public.staff_profiles
for delete to authenticated using (private.is_admin());

create policy audit_events_staff_select on public.audit_events
for select to authenticated using (private.is_staff());
create policy audit_events_staff_insert on public.audit_events
for insert to authenticated
with check (private.is_staff() and actor_user_id = (select auth.uid()));

revoke all on public.profiles, public.clients, public.client_users, public.properties,
  public.property_users, public.staff_profiles, public.audit_events from public, anon, authenticated;

grant select on public.profiles to authenticated;
grant insert (id, role, first_name, last_name, phone) on public.profiles to authenticated;
grant update (role, first_name, last_name, phone) on public.profiles to authenticated;

grant select (id, first_name, last_name, email, phone, tax_number, billing_address, country, active, created_at, updated_at)
  on public.clients to authenticated;
grant insert, update, delete on public.clients to authenticated;

grant select, insert, update, delete on public.client_users to authenticated;

grant select (id, client_id, display_name, address_line_1, address_line_2, postal_code, locality,
  municipality, country, property_type, bedrooms, bathrooms, has_pool, has_garden, has_irrigation,
  active, created_at, updated_at) on public.properties to authenticated;
grant insert, update, delete on public.properties to authenticated;

grant select, insert, update, delete on public.property_users to authenticated;
grant select, insert, update, delete on public.staff_profiles to authenticated;
grant select, insert on public.audit_events to authenticated;

create function public.initialise_profile()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  current_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  requested_role public.application_role := 'customer';
  profile_record public.profiles;
begin
  if current_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  select * into profile_record from public.profiles where id = current_user_id;
  if found then
    return jsonb_build_object(
      'id', profile_record.id,
      'role', profile_record.role,
      'firstName', profile_record.first_name,
      'lastName', profile_record.last_name,
      'phone', profile_record.phone
    );
  end if;

  if current_email = 'info@guardemar.com'
    and not exists (select 1 from public.profiles where role = 'admin') then
    requested_role := 'admin';
  end if;

  insert into public.profiles (id, role)
  values (current_user_id, requested_role)
  on conflict (id) do nothing
  returning * into profile_record;

  if profile_record.id is null then
    select * into profile_record from public.profiles where id = current_user_id;
  else
    insert into public.audit_events (actor_user_id, event_type, entity_type, entity_id, metadata)
    values (
      current_user_id,
      case when requested_role = 'admin' then 'initial_admin_bootstrapped' else 'profile_created' end,
      'profile',
      current_user_id,
      jsonb_build_object('source', 'authenticated_initialisation')
    );
  end if;

  return jsonb_build_object(
    'id', profile_record.id,
    'role', profile_record.role,
    'firstName', profile_record.first_name,
    'lastName', profile_record.last_name,
    'phone', profile_record.phone
  );
end;
$$;

create function public.get_admin_dashboard()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_staff();
  return jsonb_build_object(
    'clients', (select count(*) from public.clients where active),
    'properties', (select count(*) from public.properties where active)
  );
end;
$$;

create function public.list_admin_clients(search_text text default '')
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare result jsonb;
begin
  perform private.require_staff();
  select coalesce(jsonb_agg(row_data order by row_data ->> 'lastName', row_data ->> 'firstName'), '[]'::jsonb)
  into result
  from (
    select jsonb_build_object(
      'id', c.id,
      'firstName', c.first_name,
      'lastName', c.last_name,
      'email', c.email,
      'phone', c.phone,
      'taxNumber', c.tax_number,
      'active', c.active,
      'propertyCount', (select count(*) from public.properties p where p.client_id = c.id and p.active)
    ) as row_data
    from public.clients c
    where coalesce(search_text, '') = ''
      or concat_ws(' ', c.first_name, c.last_name, c.email, c.phone, c.tax_number) ilike '%' || search_text || '%'
      or exists (
        select 1 from public.properties p
        where p.client_id = c.id
          and concat_ws(' ', p.address_line_1, p.locality) ilike '%' || search_text || '%'
      )
  ) rows;
  return result;
end;
$$;

create function public.get_admin_client(client_uuid uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare result jsonb;
begin
  perform private.require_staff();
  select to_jsonb(c) || jsonb_build_object(
    'properties', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id,
        'displayName', p.display_name,
        'addressLine1', p.address_line_1,
        'locality', p.locality,
        'municipality', p.municipality,
        'active', p.active
      ) order by p.display_name)
      from public.properties p where p.client_id = c.id
    ), '[]'::jsonb)
  ) into result
  from public.clients c where c.id = client_uuid;
  return result;
end;
$$;

create function public.list_admin_properties()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare result jsonb;
begin
  perform private.require_staff();
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', p.id,
    'displayName', p.display_name,
    'addressLine1', p.address_line_1,
    'locality', p.locality,
    'municipality', p.municipality,
    'propertyType', p.property_type,
    'active', p.active,
    'clientId', c.id,
    'clientName', concat_ws(' ', c.first_name, c.last_name)
  ) order by p.display_name), '[]'::jsonb) into result
  from public.properties p join public.clients c on c.id = p.client_id;
  return result;
end;
$$;

create function public.get_admin_property(property_uuid uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare result jsonb;
begin
  perform private.require_staff();
  select to_jsonb(p) || jsonb_build_object('client_name', concat_ws(' ', c.first_name, c.last_name))
  into result
  from public.properties p join public.clients c on c.id = p.client_id
  where p.id = property_uuid;
  return result;
end;
$$;

create function public.create_admin_client(client_data jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare created public.clients;
begin
  perform private.require_staff();
  insert into public.clients (first_name, last_name, email, phone, tax_number, billing_address, country, internal_notes)
  values (
    client_data ->> 'firstName', client_data ->> 'lastName', client_data ->> 'email', client_data ->> 'phone',
    nullif(client_data ->> 'taxNumber', ''), nullif(client_data ->> 'billingAddress', ''),
    coalesce(nullif(client_data ->> 'country', ''), 'Portugal'), nullif(client_data ->> 'internalNotes', '')
  ) returning * into created;
  insert into public.audit_events (actor_user_id, event_type, entity_type, entity_id)
  values (auth.uid(), 'client_created', 'client', created.id);
  return jsonb_build_object('id', created.id, 'firstName', created.first_name, 'lastName', created.last_name, 'email', created.email, 'phone', created.phone);
end;
$$;

create function public.create_admin_property(property_data jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare created public.properties;
begin
  perform private.require_staff();
  insert into public.properties (
    client_id, display_name, address_line_1, address_line_2, postal_code, locality, municipality,
    country, property_type, bedrooms, bathrooms, has_pool, has_garden, has_irrigation, has_alarm,
    access_notes_private, internal_notes
  ) values (
    (property_data ->> 'clientId')::uuid, property_data ->> 'displayName', property_data ->> 'addressLine1',
    nullif(property_data ->> 'addressLine2', ''), property_data ->> 'postalCode', property_data ->> 'locality',
    property_data ->> 'municipality', coalesce(nullif(property_data ->> 'country', ''), 'Portugal'),
    (property_data ->> 'propertyType')::public.property_type, nullif(property_data ->> 'bedrooms', '')::integer,
    nullif(property_data ->> 'bathrooms', '')::integer, coalesce((property_data ->> 'hasPool')::boolean, false),
    coalesce((property_data ->> 'hasGarden')::boolean, false), coalesce((property_data ->> 'hasIrrigation')::boolean, false),
    coalesce((property_data ->> 'hasAlarm')::boolean, false), nullif(property_data ->> 'accessNotesPrivate', ''),
    nullif(property_data ->> 'internalNotes', '')
  ) returning * into created;
  insert into public.audit_events (actor_user_id, event_type, entity_type, entity_id, metadata)
  values (auth.uid(), 'property_created', 'property', created.id, jsonb_build_object('clientId', created.client_id));
  return jsonb_build_object('id', created.id, 'displayName', created.display_name);
end;
$$;

revoke all on function public.initialise_profile() from public, anon;
revoke all on function public.get_admin_dashboard() from public, anon;
revoke all on function public.list_admin_clients(text) from public, anon;
revoke all on function public.get_admin_client(uuid) from public, anon;
revoke all on function public.list_admin_properties() from public, anon;
revoke all on function public.get_admin_property(uuid) from public, anon;
revoke all on function public.create_admin_client(jsonb) from public, anon;
revoke all on function public.create_admin_property(jsonb) from public, anon;

grant execute on function public.initialise_profile() to authenticated;
grant execute on function public.get_admin_dashboard() to authenticated;
grant execute on function public.list_admin_clients(text) to authenticated;
grant execute on function public.get_admin_client(uuid) to authenticated;
grant execute on function public.list_admin_properties() to authenticated;
grant execute on function public.get_admin_property(uuid) to authenticated;
grant execute on function public.create_admin_client(jsonb) to authenticated;
grant execute on function public.create_admin_property(jsonb) to authenticated;

comment on table public.properties is 'Guardemar properties. Customer SELECT is restricted by property_users and private columns are not granted to authenticated clients.';
comment on column public.properties.access_notes_private is 'Staff-only access information. Read only through role-checked RPCs.';
comment on column public.properties.internal_notes is 'Staff-only operational notes. Read only through role-checked RPCs.';
comment on column public.clients.internal_notes is 'Staff-only CRM notes. Read only through role-checked RPCs.';
