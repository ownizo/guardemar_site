-- Apply the Supabase migrations first, then run this file with a privileged SQL connection
-- against a disposable branch of Guardemar project ablktbpledjceddessyg.
-- The transaction rolls back all fixtures. Any failed assertion aborts the test.
begin;

set local session_replication_role = replica;
insert into public.profiles (id, role) values
  ('00000000-0000-4000-8000-000000000001', 'admin'),
  ('00000000-0000-4000-8000-000000000002', 'staff'),
  ('00000000-0000-4000-8000-00000000000a', 'customer'),
  ('00000000-0000-4000-8000-00000000000b', 'customer');
insert into public.clients (id, first_name, last_name, email, phone, internal_notes) values
  ('10000000-0000-4000-8000-00000000000a', 'Customer', 'A', 'a@example.invalid', '+351000000001', 'Private A'),
  ('10000000-0000-4000-8000-00000000000b', 'Customer', 'B', 'b@example.invalid', '+351000000002', 'Private B'),
  ('10000000-0000-4000-8000-00000000000c', 'Unlinked', 'Single', 'c@example.invalid', '+351000000003', 'Private C'),
  ('10000000-0000-4000-8000-00000000000d', 'Unlinked', 'Bulk', 'd@example.invalid', '+351000000004', 'Private D');
insert into public.properties (
  id, client_id, display_name, address_line_1, postal_code, locality, municipality, access_notes_private, internal_notes
) values
  ('20000000-0000-4000-8000-00000000000a', '10000000-0000-4000-8000-00000000000a', 'Property A', 'Address A', '0000-001', 'Lagos', 'Lagos', 'Key A', 'Internal A'),
  ('20000000-0000-4000-8000-00000000000b', '10000000-0000-4000-8000-00000000000b', 'Property B', 'Address B', '0000-002', 'Lagos', 'Lagos', 'Key B', 'Internal B');
insert into public.client_users (client_id, user_id) values
  ('10000000-0000-4000-8000-00000000000a', '00000000-0000-4000-8000-00000000000a'),
  ('10000000-0000-4000-8000-00000000000b', '00000000-0000-4000-8000-00000000000b');
insert into public.property_users (property_id, user_id) values
  ('20000000-0000-4000-8000-00000000000a', '00000000-0000-4000-8000-00000000000a'),
  ('20000000-0000-4000-8000-00000000000b', '00000000-0000-4000-8000-00000000000b');
set local session_replication_role = origin;

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000000a', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

do $$
begin
  if (select count(*) from public.properties) <> 1 then
    raise exception 'Customer A property isolation failed';
  end if;
  if exists (select 1 from public.properties where id = '20000000-0000-4000-8000-00000000000b') then
    raise exception 'Customer A retrieved or guessed Property B';
  end if;
  if (select count(*) from public.clients) <> 1 then
    raise exception 'Customer A client isolation failed';
  end if;
  if has_column_privilege('authenticated', 'public.clients', 'internal_notes', 'select') then
    raise exception 'Customer can read client internal notes';
  end if;
  if has_column_privilege('authenticated', 'public.properties', 'access_notes_private', 'select') then
    raise exception 'Customer can read access_notes_private';
  end if;
  if has_column_privilege('authenticated', 'public.properties', 'internal_notes', 'select') then
    raise exception 'Customer can read property internal notes';
  end if;
  begin
    update public.profiles set role = 'admin' where id = '00000000-0000-4000-8000-00000000000a';
    raise exception 'Customer A changed role';
  exception when insufficient_privilege then
    null;
  end;
  begin
    perform public.get_admin_dashboard();
    raise exception 'Customer A called get_admin_dashboard';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.list_admin_clients('');
    raise exception 'Customer A called list_admin_clients';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.get_admin_client('10000000-0000-4000-8000-00000000000a');
    raise exception 'Customer A called get_admin_client';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.list_admin_properties();
    raise exception 'Customer A called list_admin_properties';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.get_admin_property('20000000-0000-4000-8000-00000000000a');
    raise exception 'Customer A called get_admin_property';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.create_admin_client('{}'::jsonb);
    raise exception 'Customer A called create_admin_client';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.create_admin_property('{}'::jsonb);
    raise exception 'Customer A called create_admin_property';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.delete_admin_client('10000000-0000-4000-8000-00000000000c');
    raise exception 'Customer A deleted a client';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.delete_admin_clients(array['10000000-0000-4000-8000-00000000000c'::uuid]);
    raise exception 'Customer A bulk deleted a client';
  exception when insufficient_privilege then null;
  end;
end;
$$;

reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000002', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

do $$
begin
  begin
    perform public.delete_admin_client('10000000-0000-4000-8000-00000000000c');
    raise exception 'Staff deleted a client';
  exception when insufficient_privilege then null;
  end;
end;
$$;

reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

do $$
declare
  bulk_result jsonb;
begin
  if (select count(*) from public.properties) <> 2 then
    raise exception 'Admin property access failed';
  end if;
  if public.get_admin_property('20000000-0000-4000-8000-00000000000a') ->> 'access_notes_private' <> 'Key A' then
    raise exception 'Admin private property access failed';
  end if;
  if (public.delete_admin_client('10000000-0000-4000-8000-00000000000a') ->> 'reason') <> 'linked_properties' then
    raise exception 'Admin deleted a client with a protected property';
  end if;
  if not (public.delete_admin_client('10000000-0000-4000-8000-00000000000c') ->> 'deleted')::boolean then
    raise exception 'Admin could not delete an unlinked client';
  end if;
  if exists (select 1 from public.clients where id = '10000000-0000-4000-8000-00000000000c') then
    raise exception 'Individually deleted client still exists';
  end if;
  if not exists (select 1 from public.audit_events where entity_id = '10000000-0000-4000-8000-00000000000c' and event_type = 'client_deleted') then
    raise exception 'Client deletion audit event is missing';
  end if;
  bulk_result := public.delete_admin_clients(array[
    '10000000-0000-4000-8000-00000000000d'::uuid,
    '10000000-0000-4000-8000-00000000000b'::uuid,
    'ffffffff-ffff-4fff-8fff-ffffffffffff'::uuid
  ]);
  if jsonb_array_length(bulk_result -> 'deleted') <> 1 then
    raise exception 'Bulk deletion did not delete exactly one safe client';
  end if;
  if jsonb_array_length(bulk_result -> 'blocked') <> 2 then
    raise exception 'Bulk deletion did not report both protected clients';
  end if;
  if not exists (select 1 from public.clients where id = '10000000-0000-4000-8000-00000000000b') then
    raise exception 'Bulk deletion removed a protected client';
  end if;
end;
$$;

reset role;
set local role anon;
do $$
begin
  if has_function_privilege('anon', 'public.initialise_profile()', 'execute')
    or has_function_privilege('anon', 'public.get_admin_dashboard()', 'execute')
    or has_function_privilege('anon', 'public.list_admin_clients(text)', 'execute')
    or has_function_privilege('anon', 'public.get_admin_client(uuid)', 'execute')
    or has_function_privilege('anon', 'public.list_admin_properties()', 'execute')
    or has_function_privilege('anon', 'public.get_admin_property(uuid)', 'execute')
    or has_function_privilege('anon', 'public.create_admin_client(jsonb)', 'execute')
    or has_function_privilege('anon', 'public.create_admin_property(jsonb)', 'execute')
    or has_function_privilege('anon', 'public.delete_admin_client(uuid)', 'execute')
    or has_function_privilege('anon', 'public.delete_admin_clients(uuid[])', 'execute') then
    raise exception 'Anonymous RPC execution privilege detected';
  end if;
  begin
    perform count(*) from public.properties;
    raise exception 'Unauthenticated property access succeeded';
  exception when insufficient_privilege then
    null;
  end;
end;
$$;

reset role;
rollback;
