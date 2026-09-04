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
  ('95000000-0000-4000-8000-000000000001', '92000000-0000-4000-8000-00000000000a', '93000000-0000-4000-8000-000000000001', 'published', now(), 'good', now() - interval '1 day', '90000000-0000-4000-8000-000000000001', '{"property":{"display_name":"Phase 2 Property A"}}', '90000000-0000-4000-8000-000000000001'),
  ('95000000-0000-4000-8000-000000000002', '92000000-0000-4000-8000-00000000000a', '93000000-0000-4000-8000-000000000001', 'awaiting_review', now(), 'attention', null, null, null, '90000000-0000-4000-8000-000000000001'),
  ('95000000-0000-4000-8000-000000000003', '92000000-0000-4000-8000-00000000000b', '93000000-0000-4000-8000-000000000001', 'published', now(), 'good', now() - interval '1 day', '90000000-0000-4000-8000-000000000001', '{"property":{"display_name":"Phase 2 Property B"}}', '90000000-0000-4000-8000-000000000001'),
  ('95000000-0000-4000-8000-000000000004', '92000000-0000-4000-8000-00000000000a', '93000000-0000-4000-8000-000000000001', 'published', now(), 'attention', now() - interval '179 days', '90000000-0000-4000-8000-000000000001', '{"property":{"display_name":"Day 179"}}', '90000000-0000-4000-8000-000000000001'),
  ('95000000-0000-4000-8000-000000000005', '92000000-0000-4000-8000-00000000000a', '93000000-0000-4000-8000-000000000001', 'published', now(), 'attention', now() - interval '4320 hours', '90000000-0000-4000-8000-000000000001', '{"property":{"display_name":"Exact boundary"}}', '90000000-0000-4000-8000-000000000001'),
  ('95000000-0000-4000-8000-000000000006', '92000000-0000-4000-8000-00000000000a', '93000000-0000-4000-8000-000000000001', 'published', now(), 'urgent', now() - interval '181 days', '90000000-0000-4000-8000-000000000001', '{"property":{"display_name":"Expired"}}', '90000000-0000-4000-8000-000000000001');
insert into public.inspection_areas(id, inspection_id, source_property_area_id, area_type, custom_label, display_order, status) values
  ('96000000-0000-4000-8000-000000000001', '95000000-0000-4000-8000-000000000001', '94000000-0000-4000-8000-000000000001', 'WC', 'WC quarto de casal', 1, 'good'),
  ('96000000-0000-4000-8000-000000000005', '95000000-0000-4000-8000-000000000005', '94000000-0000-4000-8000-000000000001', 'WC', 'Expired area', 1, 'attention');
insert into public.inspection_photos(id, inspection_id, inspection_area_id, storage_path, client_visible, display_order, created_by) values
  ('97000000-0000-4000-8000-000000000001', '95000000-0000-4000-8000-000000000001', '96000000-0000-4000-8000-000000000001', 'inspections/95000000-0000-4000-8000-000000000001/client.jpg', true, 1, '90000000-0000-4000-8000-000000000001'),
  ('97000000-0000-4000-8000-000000000005', '95000000-0000-4000-8000-000000000005', '96000000-0000-4000-8000-000000000005', 'inspections/95000000-0000-4000-8000-000000000005/expired.jpg', true, 1, '90000000-0000-4000-8000-000000000001');
update public.property_areas set custom_label = 'Casa de banho suite principal' where id = '94000000-0000-4000-8000-000000000001';
set local session_replication_role = origin;

select set_config('request.jwt.claim.sub', '90000000-0000-4000-8000-00000000000a', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

do $$
begin
  if (select count(*) from public.inspections) <> 2 then raise exception 'Customer did not receive exactly the day 1 and day 179 inspections'; end if;
  if not exists(select 1 from public.inspections where id = '95000000-0000-4000-8000-000000000004') then raise exception 'Day 179 inspection was unavailable'; end if;
  if exists(select 1 from public.inspections where id = '95000000-0000-4000-8000-000000000005') then raise exception 'Exact 180-day boundary remained available'; end if;
  if exists(select 1 from public.inspections where id = '95000000-0000-4000-8000-000000000006') then raise exception 'Expired inspection remained available'; end if;
  if exists(select 1 from public.inspections where id = '95000000-0000-4000-8000-000000000002') then raise exception 'Customer retrieved awaiting-review inspection'; end if;
  if exists(select 1 from public.inspections where id = '95000000-0000-4000-8000-000000000003') then raise exception 'Customer retrieved another property inspection'; end if;
  if (select count(*) from public.list_customer_inspections()) <> 4 then raise exception 'Lightweight history did not retain all authorised published entries'; end if;
  if (select count(*) from public.list_customer_inspections() where is_available) <> 2 then raise exception 'Customer history availability flags were incorrect'; end if;
  if public.get_customer_inspection('95000000-0000-4000-8000-000000000005') is not null then raise exception 'Expired full report RPC remained accessible'; end if;
  if exists(select 1 from public.inspection_photos where id = '97000000-0000-4000-8000-000000000005') then raise exception 'Expired customer photograph metadata remained accessible'; end if;
  if (select custom_label from public.inspection_areas where id = '96000000-0000-4000-8000-000000000001') <> 'WC quarto de casal' then raise exception 'Historical property-area label changed'; end if;
  begin update public.inspections set status = 'published'; raise exception 'Customer modified an inspection'; exception when insufficient_privilege then null; end;
  begin perform public.publish_admin_inspection('95000000-0000-4000-8000-000000000002'); raise exception 'Customer published an inspection'; exception when insufficient_privilege then null; end;
end;
$$;

reset role;
select set_config('request.jwt.claim.sub', '90000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;
do $$
begin
  if (select count(*) from public.inspections where id in ('95000000-0000-4000-8000-000000000005', '95000000-0000-4000-8000-000000000006')) <> 2 then raise exception 'Internal admin retention was incorrectly constrained by customer expiry'; end if;
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
