-- Apply all Supabase migrations first, then run against a disposable branch of
-- Guardemar project ablktbpledjceddessyg with a privileged SQL connection.
-- All fixtures are rolled back.
begin;

set local session_replication_role = replica;
insert into public.profiles(id, role) values
  ('90000000-0000-4000-8000-000000000001', 'admin'),
  ('90000000-0000-4000-8000-00000000000a', 'customer'),
  ('90000000-0000-4000-8000-00000000000b', 'customer');
insert into public.clients(id, first_name, last_name, email, phone) values
  ('91000000-0000-4000-8000-00000000000a', 'Phase', 'Two A', 'phase2-a@example.invalid', '+351000000011'),
  ('91000000-0000-4000-8000-00000000000b', 'Phase', 'Two B', 'phase2-b@example.invalid', '+351000000012');
insert into public.properties(id, client_id, display_name, address_line_1, postal_code, locality, municipality) values
  ('92000000-0000-4000-8000-00000000000a', '91000000-0000-4000-8000-00000000000a', 'Phase 2 Property A', 'Address A', '8600-001', 'Lagos', 'Lagos'),
  ('92000000-0000-4000-8000-00000000000b', '91000000-0000-4000-8000-00000000000b', 'Phase 2 Property B', 'Address B', '8600-002', 'Lagos', 'Lagos');
insert into public.property_users(property_id, user_id) values
  ('92000000-0000-4000-8000-00000000000a', '90000000-0000-4000-8000-00000000000a'),
  ('92000000-0000-4000-8000-00000000000b', '90000000-0000-4000-8000-00000000000b');
insert into public.staff_profiles(id, first_name, last_name, display_name, role_title) values
  ('93000000-0000-4000-8000-000000000001', 'João', 'Silva', 'João Silva', 'Property Inspector');
insert into public.property_areas(id, property_id, area_type, custom_label, display_order) values
  ('94000000-0000-4000-8000-000000000001', '92000000-0000-4000-8000-00000000000a', 'WC', 'WC quarto de casal', 1);
insert into public.inspections(id, property_id, inspector_staff_id, status, scheduled_for, final_condition, published_at, published_by, published_snapshot, created_by) values
  ('95000000-0000-4000-8000-000000000001', '92000000-0000-4000-8000-00000000000a', '93000000-0000-4000-8000-000000000001', 'published', now(), 'good', now(), '90000000-0000-4000-8000-000000000001', '{"property":{"display_name":"Phase 2 Property A"}}', '90000000-0000-4000-8000-000000000001'),
  ('95000000-0000-4000-8000-000000000002', '92000000-0000-4000-8000-00000000000a', '93000000-0000-4000-8000-000000000001', 'awaiting_review', now(), 'attention', null, null, null, '90000000-0000-4000-8000-000000000001'),
  ('95000000-0000-4000-8000-000000000003', '92000000-0000-4000-8000-00000000000b', '93000000-0000-4000-8000-000000000001', 'published', now(), 'good', now(), '90000000-0000-4000-8000-000000000001', '{"property":{"display_name":"Phase 2 Property B"}}', '90000000-0000-4000-8000-000000000001');
insert into public.inspection_areas(id, inspection_id, source_property_area_id, area_type, custom_label, display_order, status) values
  ('96000000-0000-4000-8000-000000000001', '95000000-0000-4000-8000-000000000001', '94000000-0000-4000-8000-000000000001', 'WC', 'WC quarto de casal', 1, 'good');
update public.property_areas set custom_label = 'Casa de banho suite principal' where id = '94000000-0000-4000-8000-000000000001';
set local session_replication_role = origin;

select set_config('request.jwt.claim.sub', '90000000-0000-4000-8000-00000000000a', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

do $$
begin
  if (select count(*) from public.inspections) <> 1 then raise exception 'Customer did not receive exactly one published authorised inspection'; end if;
  if exists(select 1 from public.inspections where id = '95000000-0000-4000-8000-000000000002') then raise exception 'Customer retrieved awaiting-review inspection'; end if;
  if exists(select 1 from public.inspections where id = '95000000-0000-4000-8000-000000000003') then raise exception 'Customer retrieved another property inspection'; end if;
  if (select custom_label from public.inspection_areas where id = '96000000-0000-4000-8000-000000000001') <> 'WC quarto de casal' then raise exception 'Historical property-area label changed'; end if;
  begin update public.inspections set status = 'published'; raise exception 'Customer modified an inspection'; exception when insufficient_privilege then null; end;
  begin perform public.publish_admin_inspection('95000000-0000-4000-8000-000000000002'); raise exception 'Customer published an inspection'; exception when insufficient_privilege then null; end;
end;
$$;

reset role;
set local role anon;
do $$
begin
  begin perform count(*) from public.inspections; raise exception 'Anonymous inspection access succeeded'; exception when insufficient_privilege then null; end;
  if has_function_privilege('anon', 'public.publish_admin_inspection(uuid)', 'execute') then raise exception 'Anonymous publish privilege detected'; end if;
end;
$$;

reset role;
rollback;
