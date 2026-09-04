-- Apply the Supabase migration first, then run this file with a privileged SQL connection
-- against a disposable branch of Guardemar project ablktbpledjceddessyg.
-- The transaction rolls back all fixtures. Any failed assertion aborts the test.
begin;

set local session_replication_role = replica;
insert into public.profiles (id, role) values
  ('00000000-0000-4000-8000-000000000001', 'admin'),
  ('00000000-0000-4000-8000-00000000000a', 'customer'),
  ('00000000-0000-4000-8000-00000000000b', 'customer');
insert into public.clients (id, first_name, last_name, email, phone, internal_notes) values
  ('10000000-0000-4000-8000-00000000000a', 'Customer', 'A', 'a@example.invalid', '+351000000001', 'Private A'),
  ('10000000-0000-4000-8000-00000000000b', 'Customer', 'B', 'b@example.invalid', '+351000000002', 'Private B');
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
end;
$$;

reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

do $$
begin
  if (select count(*) from public.properties) <> 2 then
    raise exception 'Admin property access failed';
  end if;
  if public.get_admin_property('20000000-0000-4000-8000-00000000000a') ->> 'access_notes_private' <> 'Key A' then
    raise exception 'Admin private property access failed';
  end if;
end;
$$;

reset role;
set local role anon;
do $$
begin
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
