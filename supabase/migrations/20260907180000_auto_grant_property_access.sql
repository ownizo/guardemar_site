-- Root cause: property_users is (correctly, deliberately) the sole authoritative
-- access-grant table used by customer-facing RLS on public.properties. It supports
-- per-user, per-property restriction (co-owners, spouses, users limited to selected
-- properties) via the existing "Manage access" flow (set_client_portal_property_access).
--
-- However neither of the two admin actions that should sensibly default to granting
-- access ever touched property_users:
--   - create_admin_property inserted a property under a client but never granted
--     access to that client's already-linked portal users.
--   - link_client_portal_user linked a customer to a client (client_users) but never
--     granted access to that client's existing properties.
--
-- This meant a client visibly had a property in the admin UI, and a customer was
-- visibly linked to that client, with no code path that ever created the
-- property_users row RLS actually requires. The only way access was ever granted was
-- a staff member manually opening "Manage access" and checking boxes — an easy step
-- to miss, and one with no prompt reminding staff it is still required after adding a
-- new property to an already-onboarded client.
--
-- Fix: both actions now grant access by default at the one moment it is safe to do so
-- automatically — when there is no pre-existing configuration to override:
--   - create_admin_property grants every already-linked user of that client access to
--     the brand-new property (nothing could have restricted it yet, it didn't exist).
--   - link_client_portal_user grants the newly-linked user access to the client's
--     existing active properties, but only on a genuinely new link (never on a label
--     update to an existing link), so it can never re-add access a staff member has
--     since deliberately revoked via "Manage access".
--
-- set_client_portal_property_access and revoke_client_portal_access are unchanged:
-- they remain the explicit mechanism for restricting or removing access.

create or replace function public.create_admin_property(property_data jsonb)
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

  -- A brand-new property has no pre-existing access configuration to override, so it
  -- is safe to grant every already-linked portal user of this client access by
  -- default. Staff can still restrict access afterwards via "Manage access".
  insert into public.property_users (property_id, user_id)
  select created.id, cu.user_id
  from public.client_users cu
  where cu.client_id = created.client_id
  on conflict (property_id, user_id) do nothing;

  insert into public.audit_events (actor_user_id, event_type, entity_type, entity_id, metadata)
  values (auth.uid(), 'property_created', 'property', created.id, jsonb_build_object('clientId', created.client_id));
  return jsonb_build_object('id', created.id, 'displayName', created.display_name);
end;
$$;

create or replace function public.link_client_portal_user(client_uuid uuid, user_uuid uuid, relationship_label text default null::text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  linked public.client_users;
  already_linked boolean;
begin
  if not private.is_admin() then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;
  if not exists (select 1 from public.clients where id = client_uuid) then
    raise exception 'Client not found';
  end if;
  if not exists (select 1 from auth.users where id = user_uuid) then
    raise exception 'Auth user not found';
  end if;
  if exists (
    select 1 from public.profiles where id = user_uuid and role <> 'customer'::public.application_role
  ) then
    raise exception 'Only customer accounts can be linked to clients' using errcode = '42501';
  end if;

  select exists (
    select 1 from public.client_users where client_id = client_uuid and user_id = user_uuid
  ) into already_linked;

  insert into public.client_users(client_id, user_id, relationship_label)
  values (client_uuid, user_uuid, nullif(trim(relationship_label), ''))
  on conflict (client_id, user_id) do update set relationship_label = excluded.relationship_label
  returning * into linked;

  -- Only backfill on a genuinely new link. Re-saving an existing link (for example
  -- just updating the relationship label) must never re-add access a staff member has
  -- since deliberately revoked via "Manage access".
  if not already_linked then
    insert into public.property_users (property_id, user_id)
    select p.id, user_uuid
    from public.properties p
    where p.client_id = client_uuid and p.active
    on conflict (property_id, user_id) do nothing;
  end if;

  insert into public.audit_events(actor_user_id, event_type, entity_type, entity_id, metadata)
  values (
    auth.uid(), 'client_portal_user_linked', 'client', client_uuid, jsonb_build_object('user_id', user_uuid)
  );
  return jsonb_build_object(
    'client_id', linked.client_id,
    'user_id', linked.user_id,
    'relationship_label', linked.relationship_label
  );
end;
$$;

-- One-time idempotent backfill for records already in this state. Scoped only to
-- portal users who currently have ZERO property_users rows at all — i.e. access was
-- never configured for them by anyone, so granting the default (all of their linked
-- client's active properties) cannot override a staff member's deliberate, partial
-- restriction. A user who already has at least one property_users row is left
-- untouched, since that indicates "Manage access" has genuinely been used for them.
insert into public.property_users (property_id, user_id)
select p.id, cu.user_id
from public.client_users cu
join public.properties p on p.client_id = cu.client_id
where p.active
  and not exists (select 1 from public.property_users pu where pu.user_id = cu.user_id)
on conflict (property_id, user_id) do nothing;

-- Unrelated fix, same migration window: get_admin_client used to_jsonb(c), which
-- serialises the clients row with its raw snake_case column names (first_name,
-- tax_number, ...). Every other admin RPC in this codebase (list_admin_clients,
-- create_admin_client, list_admin_properties, ...) explicitly builds a camelCase
-- object, which is what the frontend's ClientDetail type and every admin page
-- actually reads. The client detail page's heading interpolated the (undefined)
-- client.firstName/lastName directly into a template string, which is why it
-- rendered the literal text "undefined undefined" — other fields on the same page
-- (client.email, client.taxNumber, ...) were equally undefined, they just rendered
-- as blank instead of literal text, which is presumably why only the heading was
-- reported as visibly broken.
create or replace function public.get_admin_client(client_uuid uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare result jsonb;
begin
  perform private.require_staff();
  select jsonb_build_object(
    'id', c.id,
    'firstName', c.first_name,
    'lastName', c.last_name,
    'email', c.email,
    'phone', c.phone,
    'taxNumber', c.tax_number,
    'billingAddress', c.billing_address,
    'country', c.country,
    'internalNotes', c.internal_notes,
    'active', c.active,
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
