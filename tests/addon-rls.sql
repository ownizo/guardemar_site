-- Run after migrations on a disposable GUARDEMAR database, never another project.
-- All fixtures and state changes are rolled back; no email or Stripe calls.
begin;
set local session_replication_role=replica;
insert into public.profiles(id,role) values
 ('00000000-0000-4000-8000-000000000001','admin'),('00000000-0000-4000-8000-000000000002','staff'),
 ('00000000-0000-4000-8000-00000000000a','customer'),('00000000-0000-4000-8000-00000000000b','customer');
insert into public.clients(id,first_name,last_name,email,phone) values
 ('10000000-0000-4000-8000-00000000000a','Customer','A','a@example.invalid',''),
 ('10000000-0000-4000-8000-00000000000b','Customer','B','b@example.invalid','');
insert into public.properties(id,client_id,display_name,address_line_1,postal_code,locality,municipality) values
 ('20000000-0000-4000-8000-00000000000a','10000000-0000-4000-8000-00000000000a','Property A','Address A','0000-001','Lagos','Lagos'),
 ('20000000-0000-4000-8000-00000000000b','10000000-0000-4000-8000-00000000000b','Property B','Address B','0000-002','Lagos','Lagos');
insert into public.client_users(client_id,user_id) values
 ('10000000-0000-4000-8000-00000000000a','00000000-0000-4000-8000-00000000000a'),('10000000-0000-4000-8000-00000000000b','00000000-0000-4000-8000-00000000000b');
insert into public.property_users(property_id,user_id) values
 ('20000000-0000-4000-8000-00000000000a','00000000-0000-4000-8000-00000000000a'),('20000000-0000-4000-8000-00000000000b','00000000-0000-4000-8000-00000000000b');
-- FK fixtures omit auth.users; production functions still require real profiles.
do $$
declare a uuid; b uuid; repeat_id uuid; payment uuid;
 input jsonb := '{"propertyId":"20000000-0000-4000-8000-00000000000a","idempotencyKey":"40000000-0000-4000-8000-00000000000a","serviceCode":"pre-arrival-shopping","publishedPrice":"€80 + VAT","publishedPriceNote":"shopping expenses additional","customerNotes":"Put water in kitchen","serviceDetails":{"arrivalDate":"2026-10-20","arrivalTime":"15:30"},"shoppingItems":[{"product":"Water","quantity":"6 bottles","preferredBrand":"Luso","alternativePolicy":"any_suitable","alternativeProduct":"","notes":"Still"},{"product":"Milk","quantity":"2 litres","preferredBrand":"A","alternativePolicy":"specific","alternativeProduct":"B","notes":""}]}'::jsonb;
 pay_input jsonb;
begin
 a:=public.create_addon_request('00000000-0000-4000-8000-00000000000a',input,'fingerprint-a');
 repeat_id:=public.create_addon_request('00000000-0000-4000-8000-00000000000a',input,'fingerprint-a');
 if a<>repeat_id then raise exception 'Idempotency created another request'; end if;
 if (select count(*) from public.addon_requests where id=a)<>1 or (select status from public.addon_requests where id=a)<>'requested' then raise exception 'Initial request status'; end if;
 if (select client_id from public.addon_requests where id=a)<>'10000000-0000-4000-8000-00000000000a' then raise exception 'Client was not derived'; end if;
 if (select count(*) from public.addon_shopping_items where request_id=a)<>2 then raise exception 'Duplicate or lost shopping items'; end if;
 if (select count(*) from public.audit_events where entity_id=a and event_type='ADDON_REQUEST_CREATED')<>1 then raise exception 'Duplicate audit alert'; end if;
 if (select count(*) from public.addon_request_email_delivery where request_id=a)<>1 then raise exception 'Duplicate email marker'; end if;
 if exists(select 1 from public.addon_payments) then raise exception 'Request created payment'; end if;
 begin perform public.create_addon_request('00000000-0000-4000-8000-00000000000a',input,'different'); raise exception 'Mismatch accepted'; exception when invalid_parameter_value then null; end;
 begin perform public.create_addon_request('00000000-0000-4000-8000-00000000000b',input,'fingerprint-a'); raise exception 'Cross property request accepted'; exception when insufficient_privilege then null; end;
 b:=public.create_addon_request('00000000-0000-4000-8000-00000000000b', input || '{"propertyId":"20000000-0000-4000-8000-00000000000b","idempotencyKey":"40000000-0000-4000-8000-00000000000b"}', 'fingerprint-b');
 begin perform public.review_addon_request('00000000-0000-4000-8000-00000000000a',a,'requested','under_review',''); raise exception 'Customer changed status'; exception when insufficient_privilege then null; end;
 begin perform public.review_addon_request('00000000-0000-4000-8000-000000000001',a,'requested','paid',''); raise exception 'Admin marked paid'; exception when invalid_parameter_value then null; end;
 perform public.review_addon_request('00000000-0000-4000-8000-000000000002',a,'requested','under_review','PRIVATE STAFF NOTE');
 begin perform public.review_addon_request('00000000-0000-4000-8000-000000000001',a,'requested','under_review',''); raise exception 'Stale state accepted'; exception when serialization_failure then null; end;
 pay_input:=jsonb_build_object('requestId',a,'idempotencyKey','50000000-0000-4000-8000-00000000000a','email','a@example.invalid','amountEur',12345,'currency','EUR','description','Reviewed amount');
 begin perform public.create_addon_payment_draft('00000000-0000-4000-8000-000000000002',pay_input); raise exception 'Staff created payment'; exception when insufficient_privilege then null; end;
 payment:=public.create_addon_payment_draft('00000000-0000-4000-8000-000000000001',pay_input);
 if payment<>public.create_addon_payment_draft('00000000-0000-4000-8000-000000000001',pay_input) then raise exception 'Draft idempotency'; end if;
 if (select amount from public.addon_payments where id=payment)<>12345 or (select amount_semantics from public.addon_payments where id=payment)<>'unapproved' then raise exception 'Authoritative draft amount'; end if;
 if exists(select 1 from public.addon_payments where stripe_checkout_session_id is not null or payment_link_url is not null) then raise exception 'Stripe unexpectedly created'; end if;
 begin perform public.create_addon_payment_draft('00000000-0000-4000-8000-000000000001',pay_input || '{"idempotencyKey":"50000000-0000-4000-8000-00000000000b"}'); raise exception 'Second payment accepted'; exception when invalid_parameter_value then null; end;
 -- Simulate an eventual authoritative server write; no production webhook is modified.
 update public.addon_payments set payment_status='paid',paid_at=now() where id=payment;
 begin perform public.create_addon_payment_draft('00000000-0000-4000-8000-000000000001',pay_input || '{"idempotencyKey":"50000000-0000-4000-8000-00000000000c"}'); raise exception 'Paid payment duplicated'; exception when invalid_parameter_value then null; end;
 if (select status from public.addon_requests where id=a)='completed' then raise exception 'Payment completed service'; end if;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-00000000000a',true);
set local role authenticated;
do $$
begin
 if (select count(*) from public.addon_requests)<>1 then raise exception 'Cross-client request isolation'; end if;
 if (select count(*) from public.addon_shopping_items)<>2 then raise exception 'Cross-client shopping isolation'; end if;
 if (select count(*) from public.addon_internal_notes)<>0 then raise exception 'Customer read internal notes'; end if;
 if (select count(id) from public.addon_payments)<>1 then raise exception 'Own visible payment missing'; end if;
 if has_column_privilege('authenticated','public.addon_payments','stripe_checkout_session_id','select') then raise exception 'Stripe IDs exposed'; end if;
 if has_table_privilege('authenticated','public.addon_requests','insert') or has_table_privilege('authenticated','public.addon_requests','update') then raise exception 'Browser request mutation granted'; end if;
 if has_table_privilege('authenticated','public.addon_payments','insert') or has_table_privilege('authenticated','public.addon_payments','update') then raise exception 'Browser payment mutation granted'; end if;
 if has_function_privilege('authenticated','public.create_addon_request(uuid,jsonb,text)','execute') then raise exception 'Browser can forge RPC actor'; end if;
 begin perform public.create_addon_request('00000000-0000-4000-8000-00000000000b','{}',''); raise exception 'Browser forged RPC'; exception when insufficient_privilege then null; end;
end $$;
reset role;
-- Losing either property or client membership immediately hides request/children.
delete from public.property_users where user_id='00000000-0000-4000-8000-00000000000a';
set local role authenticated;
do $$ begin if exists(select 1 from public.addon_requests) or exists(select 1 from public.addon_shopping_items) or exists(select 1 from public.addon_payments) then raise exception 'Revoked property access retained'; end if; end $$;
reset role;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
set local role authenticated;
do $$ begin if (select count(*) from public.addon_requests)<>2 or (select count(*) from public.addon_internal_notes)<>1 then raise exception 'Staff request/notes access'; end if; end $$;
reset role;
set local role anon;
do $$ begin if has_table_privilege('anon','public.addon_requests','select') or has_function_privilege('anon','public.create_addon_request(uuid,jsonb,text)','execute') then raise exception 'Anonymous access'; end if; end $$;
reset role;
rollback;
