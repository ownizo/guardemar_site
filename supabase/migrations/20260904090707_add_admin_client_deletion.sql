-- Phase 1 admin-only client deletion with dependency protection.

create function private.require_admin()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'administrator access required' using errcode = '42501';
  end if;
end;
$$;

revoke all on function private.require_admin() from public, anon, authenticated;

create function private.delete_client_if_safe(client_uuid uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.clients;
  client_name text;
  property_count integer;
  portal_user_count integer;
begin
  select * into target
  from public.clients
  where id = client_uuid
  for update;

  if target.id is null then
    return jsonb_build_object(
      'deleted', false,
      'id', client_uuid,
      'name', 'Unknown client',
      'reason', 'not_found'
    );
  end if;

  client_name := concat_ws(' ', target.first_name, target.last_name);

  select count(*) into property_count
  from public.properties
  where client_id = client_uuid;

  if property_count > 0 then
    return jsonb_build_object(
      'deleted', false,
      'id', target.id,
      'name', client_name,
      'reason', 'linked_properties',
      'dependencyCount', property_count
    );
  end if;

  select count(*) into portal_user_count
  from public.client_users
  where client_id = client_uuid;

  if portal_user_count > 0 then
    return jsonb_build_object(
      'deleted', false,
      'id', target.id,
      'name', client_name,
      'reason', 'linked_portal_users',
      'dependencyCount', portal_user_count
    );
  end if;

  delete from public.clients where id = target.id;

  insert into public.audit_events (actor_user_id, event_type, entity_type, entity_id, metadata)
  values (
    auth.uid(),
    'client_deleted',
    'client',
    target.id,
    jsonb_build_object('clientName', client_name)
  );

  return jsonb_build_object(
    'deleted', true,
    'id', target.id,
    'name', client_name
  );
exception
  when foreign_key_violation then
    return jsonb_build_object(
      'deleted', false,
      'id', client_uuid,
      'name', coalesce(client_name, 'Unknown client'),
      'reason', 'protected_relationship'
    );
end;
$$;

revoke all on function private.delete_client_if_safe(uuid) from public, anon, authenticated;

create function public.delete_admin_client(client_uuid uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require_admin();
  return private.delete_client_if_safe(client_uuid);
end;
$$;

create function public.delete_admin_clients(client_uuids uuid[])
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_id uuid;
  deletion_result jsonb;
  deleted_results jsonb := '[]'::jsonb;
  blocked_results jsonb := '[]'::jsonb;
begin
  perform private.require_admin();

  if client_uuids is null or cardinality(client_uuids) = 0 then
    raise exception 'at least one client UUID is required' using errcode = '22023';
  end if;

  for requested_id in
    select distinct value from unnest(client_uuids) as requested(value)
  loop
    deletion_result := private.delete_client_if_safe(requested_id);
    if coalesce((deletion_result ->> 'deleted')::boolean, false) then
      deleted_results := deleted_results || jsonb_build_array(deletion_result - 'deleted');
    else
      blocked_results := blocked_results || jsonb_build_array(deletion_result - 'deleted');
    end if;
  end loop;

  return jsonb_build_object('deleted', deleted_results, 'blocked', blocked_results);
end;
$$;

revoke all on function public.delete_admin_client(uuid) from public, anon;
revoke all on function public.delete_admin_clients(uuid[]) from public, anon;
grant execute on function public.delete_admin_client(uuid) to authenticated;
grant execute on function public.delete_admin_clients(uuid[]) to authenticated;

comment on function public.delete_admin_client(uuid) is 'Admin-only hard delete for a client with no properties, portal users, or other protected relationships.';
comment on function public.delete_admin_clients(uuid[]) is 'Admin-only bulk client deletion that reports deleted and blocked records independently.';
