-- Transactional non-financial verification; fixtures always rolled back.
begin;
set local session_replication_role=replica;
insert into public.profiles(id,role) values
 ('00000000-0000-4000-8000-000000000001','admin'),('00000000-0000-4000-8000-000000000002','staff'),
 ('00000000-0000-4000-8000-00000000000a','customer'),('00000000-0000-4000-8000-00000000000b','customer');
insert into public.clients(id,first_name,last_name,email,phone) values
 ('10000000-0000-4000-8000-00000000000a','Customer','A','a@example.invalid',''),('10000000-0000-4000-8000-00000000000b','Customer','B','b@example.invalid','');
insert into public.properties(id,client_id,display_name,address_line_1,postal_code,locality,municipality) values
 ('20000000-0000-4000-8000-00000000000a','10000000-0000-4000-8000-00000000000a','Property A','Address A','0000-001','Lagos','Lagos'),
 ('20000000-0000-4000-8000-00000000000b','10000000-0000-4000-8000-00000000000b','Property B','Address B','0000-002','Lagos','Lagos');
insert into public.client_users(client_id,user_id) values ('10000000-0000-4000-8000-00000000000a','00000000-0000-4000-8000-00000000000a'),('10000000-0000-4000-8000-00000000000b','00000000-0000-4000-8000-00000000000b');
insert into public.property_users(property_id,user_id) values ('20000000-0000-4000-8000-00000000000a','00000000-0000-4000-8000-00000000000a'),('20000000-0000-4000-8000-00000000000b','00000000-0000-4000-8000-00000000000b');
do $$
declare request uuid; payment uuid; recurring uuid; sub uuid; external uuid; attempt jsonb; again jsonb; replacement jsonb; input jsonb;
 admin_id uuid:='00000000-0000-4000-8000-000000000001'; lease uuid:='60000000-0000-4000-8000-000000000001';
begin
 request:=public.create_addon_request('00000000-0000-4000-8000-00000000000a','{"propertyId":"20000000-0000-4000-8000-00000000000a","idempotencyKey":"40000000-0000-4000-8000-00000000000a","serviceCode":"pre-arrival-shopping","publishedPrice":"€80 + VAT","publishedPriceNote":"shopping expenses additional","customerNotes":"Service fee only","serviceDetails":{"arrivalDate":"2026-10-20","arrivalTime":"15:30"},"shoppingItems":[{"product":"Water","quantity":"6","preferredBrand":"","alternativePolicy":"any_suitable","alternativeProduct":"","notes":""}]}','shopping');
 perform public.review_addon_request(admin_id,request,'requested','under_review','Private');
 input:=jsonb_build_object('requestId',request,'idempotencyKey','50000000-0000-4000-8000-00000000000a','email','a@example.invalid','amountEur',9840,'description','Shopping service fee','currency','EUR','monthly',false,'serviceFeeOnlyConfirmed',true);
 begin perform public.create_addon_payment_draft(admin_id,input||'{"serviceFeeOnlyConfirmed":false}'); raise exception 'Shopping expense confirmation bypassed'; exception when invalid_parameter_value then null; end;
 payment:=public.create_addon_payment_draft(admin_id,input);
 if payment<>public.create_addon_payment_draft(admin_id,input) then raise exception 'Payment idempotency'; end if;
 if not exists(select 1 from public.addon_payments where id=payment and amount=9840 and amount_net=8000 and amount_tax=1840 and vat_rate=23 and amount_semantics='vat_included') then raise exception 'VAT added twice or rounded incorrectly'; end if;
 begin perform public.create_addon_payment_draft(admin_id,input||'{"amountEur":10000}'); raise exception 'Retry changed amount'; exception when invalid_parameter_value then null; end;
 begin perform public.create_addon_payment_draft('00000000-0000-4000-8000-000000000002',input); raise exception 'Staff created payment'; exception when insufficient_privilege then null; end;
 attempt:=public.claim_addon_checkout(admin_id,payment,lease);
 begin perform public.claim_addon_checkout(admin_id,payment,lease); raise exception 'Concurrent lease accepted'; exception when serialization_failure then null; end;
 update public.addon_checkout_attempts set lease_until=now()-interval '1 minute' where id=(attempt->>'id')::uuid;
 again:=public.claim_addon_checkout(admin_id,payment,lease);
 if attempt->>'id'<>again->>'id' or attempt->>'idempotency_key'<>again->>'idempotency_key' then raise exception 'Retry created another Checkout'; end if;
 perform public.record_addon_checkout(admin_id,(attempt->>'id')::uuid,lease,'cs_mock_shopping','https://checkout.stripe.com/mock',now()+interval '1 day');
 again:=public.claim_addon_checkout(admin_id,payment,lease);
 if again->>'id'<>attempt->>'id' then raise exception 'Resend changed Checkout'; end if;
 begin perform public.claim_addon_checkout(admin_id,payment,lease,(attempt->>'id')::uuid); raise exception 'Open Checkout replaced'; exception when invalid_parameter_value then null; end;
 perform public.expire_addon_checkout(admin_id,(attempt->>'id')::uuid,'cs_mock_shopping');
 replacement:=public.claim_addon_checkout(admin_id,payment,lease,(attempt->>'id')::uuid);
 if (replacement->>'generation')::integer<>2 or replacement->>'idempotency_key'=attempt->>'idempotency_key' then raise exception 'Replacement generation'; end if;
 perform public.record_addon_checkout(admin_id,(replacement->>'id')::uuid,lease,'cs_mock_shopping_2','https://checkout.stripe.com/mock2',now()+interval '1 day');
 begin perform public.apply_addon_stripe_state(payment,'evt_no_verified_ledger',now(),'paid',jsonb_build_object('amountGross',9840,'currency','EUR')); raise exception 'Unverified payment marked paid'; exception when insufficient_privilege then null; end;
 insert into public.stripe_webhook_events(stripe_event_id,event_type,payload,livemode,processing_status) values('evt_mock_shopping','checkout.session.completed','{}',true,'processing');
 if not public.apply_addon_stripe_state(payment,'evt_mock_shopping',now(),'paid',jsonb_build_object('amountGross',9840,'currency','EUR','paymentIntentId','pi_mock','sessionId','cs_mock_shopping_2','attemptId',replacement->>'id')) then raise exception 'Verified payment not confirmed'; end if;
 if public.apply_addon_stripe_state(payment,'evt_mock_shopping',now(),'paid',jsonb_build_object('amountGross',9840,'currency','EUR','paymentIntentId','pi_mock','sessionId','cs_mock_shopping_2','attemptId',replacement->>'id')) then raise exception 'Duplicate paid side effects'; end if;
 if (select status from public.addon_requests where id=request)<>'paid' then raise exception 'Payment did not update request'; end if;
 begin perform public.claim_addon_checkout(admin_id,payment,lease); raise exception 'Paid payment charged again'; exception when invalid_parameter_value then null; end;
 begin perform public.cancel_addon_payment_draft(admin_id,payment); raise exception 'Paid payment cancelled as draft'; exception when invalid_parameter_value then null; end;
 request:=public.create_addon_request('00000000-0000-4000-8000-00000000000a','{"propertyId":"20000000-0000-4000-8000-00000000000a","idempotencyKey":"40000000-0000-4000-8000-00000000000c","serviceCode":"mail-care","publishedPrice":"€15/month + VAT","publishedPriceNote":"","customerNotes":"","serviceDetails":{},"shoppingItems":[]}','monthly');
 perform public.review_addon_request(admin_id,request,'requested','under_review','');
 input:=jsonb_build_object('requestId',request,'idempotencyKey','50000000-0000-4000-8000-00000000000c','email','a@example.invalid','amountEur',1845,'description','Mail Care monthly','currency','EUR','monthly',true);
 recurring:=public.create_addon_payment_draft(admin_id,input);
 select id into sub from public.addon_subscriptions where addon_payment_id=recurring;
 if sub is null or not exists(select 1 from public.addon_subscriptions where id=sub and monthly_amount_gross=1845 and status='draft') then raise exception 'Monthly model'; end if;
 insert into public.stripe_webhook_events(stripe_event_id,event_type,payload,livemode,processing_status) values('evt_mock_monthly','invoice.paid','{}',true,'processing'),('evt_mock_past_due','invoice.payment_failed','{}',true,'processing'),('evt_mock_cancel','customer.subscription.deleted','{}',true,'processing');
 attempt:=public.claim_addon_checkout(admin_id,recurring,lease);
 perform public.record_addon_checkout(admin_id,(attempt->>'id')::uuid,lease,'cs_mock_monthly','https://checkout.stripe.com/month',now()+interval '1 day');
 if (select status from public.addon_subscriptions where id=sub)<>'checkout_open' then raise exception 'Checkout prematurely activated monthly service'; end if;
 perform public.apply_addon_stripe_state(recurring,'evt_mock_monthly',now(),'invoice_paid','{"amountGross":1845,"currency":"EUR","subscriptionId":"sub_mock","customerId":"cus_mock","priceId":"price_mock","invoiceId":"in_mock"}');
 if (select status from public.addon_subscriptions where id=sub)<>'active' then raise exception 'Paid invoice did not activate'; end if;
 begin perform public.claim_addon_checkout(admin_id,recurring,lease); raise exception 'Active subscription duplicated'; exception when invalid_parameter_value then null; end;
 -- Another request for the same property/service cannot invite a second monthly subscription.
 request:=public.create_addon_request('00000000-0000-4000-8000-00000000000a','{"propertyId":"20000000-0000-4000-8000-00000000000a","idempotencyKey":"40000000-0000-4000-8000-00000000000d","serviceCode":"mail-care","publishedPrice":"€15/month + VAT","publishedPriceNote":"","customerNotes":"","serviceDetails":{},"shoppingItems":[]}','monthly2');
 perform public.review_addon_request(admin_id,request,'requested','under_review','');
 begin perform public.create_addon_payment_draft(admin_id,input||jsonb_build_object('requestId',request,'idempotencyKey','50000000-0000-4000-8000-00000000000d')); raise exception 'Equivalent monthly subscription duplicated'; exception when unique_violation then null; end;
 perform public.apply_addon_stripe_state(recurring,'evt_mock_past_due',now()+interval '1 minute','past_due','{"subscriptionId":"sub_mock","customerId":"cus_mock"}');
 perform public.apply_addon_stripe_state(recurring,'evt_mock_cancel',now()+interval '2 minutes','cancelled','{"subscriptionId":"sub_mock","customerId":"cus_mock"}');
 if public.apply_addon_stripe_state(recurring,'evt_mock_monthly',now()+interval '3 minutes','invoice_paid','{"amountGross":1845,"currency":"EUR","subscriptionId":"sub_mock","customerId":"cus_mock","priceId":"price_mock","invoiceId":"in_mock"}') then raise exception 'Cancelled subscription reactivated'; end if;
 external:=public.create_addon_payment_draft(admin_id,'{"serviceCode":"external-provider","idempotencyKey":"50000000-0000-4000-8000-00000000000e","email":"outside@example.invalid","amountEur":12345,"description":"Provider service","currency":"EUR","monthly":false}');
 if not exists(select 1 from public.addon_payments where id=external and client_id is null and addon_request_id is null and amount=12345 and amount_net is null and amount_tax is null and vat_rate is null and payment_category='external_provider' and amount_semantics='external_final') then raise exception 'External provider tax guessed'; end if;
 perform public.cancel_addon_payment_draft(admin_id,external);
 external:=public.create_addon_payment_draft(admin_id,'{"serviceCode":"external-provider","clientId":"10000000-0000-4000-8000-00000000000a","idempotencyKey":"50000000-0000-4000-8000-000000000020","email":"a@example.invalid","amountEur":12345,"description":"Unused provider draft","currency":"EUR","monthly":true}');
 perform public.cancel_addon_payment_draft(admin_id,external);
 -- Stale uncertain attempts never create a second object after Stripe's idempotency window.
 external:=public.create_addon_payment_draft(admin_id,'{"serviceCode":"external-provider","idempotencyKey":"50000000-0000-4000-8000-00000000000f","email":"outside@example.invalid","amountEur":12345,"description":"Provider service","currency":"EUR","monthly":true}');
 attempt:=public.claim_addon_checkout(admin_id,external,lease);
 update public.addon_checkout_attempts set first_attempt_at=now()-interval '25 hours',lease_until=null where id=(attempt->>'id')::uuid;
 begin perform public.claim_addon_checkout(admin_id,external,lease); raise exception 'Stale uncertain creation duplicated'; exception when invalid_parameter_value then null; end;
 insert into public.addon_email_deliveries(email_key,addon_payment_id,envelope,audit_event_type,audit_entity_type,audit_entity_id,actor_user_id) values('mock_link',recurring,'{}','ADDON_SUBSCRIPTION_LINK_SENT','addon_subscription',sub,admin_id);
 perform public.record_addon_email_sent('mock_link','email_mock'); perform public.record_addon_email_sent('mock_link','email_mock');
 if (select count(*) from public.audit_events where entity_id=sub and event_type='ADDON_SUBSCRIPTION_LINK_SENT')<>1 then raise exception 'Email sent audit duplicated'; end if;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-00000000000a',true);
set local role authenticated;
do $$ begin
 if (select count(id) from public.addon_payments where service_code='pre-arrival-shopping')<>1 then raise exception 'Own payment invisible'; end if;
 if (select count(id) from public.addon_subscriptions)<>1 then raise exception 'Cross-client or draft monthly data exposed'; end if;
 if exists(select id from public.addon_payments where payment_category='external_provider') then raise exception 'Email-only payment exposed'; end if;
 if has_column_privilege('authenticated','public.addon_subscriptions','stripe_subscription_id','select') or has_column_privilege('authenticated','public.addon_subscriptions','customer_email','select') then raise exception 'Private subscription data exposed'; end if;
 if has_table_privilege('authenticated','public.addon_subscriptions','update') or has_function_privilege('authenticated','public.apply_addon_stripe_state(uuid,text,timestamptz,text,jsonb)','execute') then raise exception 'Customer controls Stripe state'; end if;
 if has_table_privilege('authenticated','public.addon_checkout_attempts','select') or has_table_privilege('authenticated','public.addon_email_deliveries','select') then raise exception 'Technical ledger exposed'; end if;
end $$;
reset role;
delete from public.property_users where user_id='00000000-0000-4000-8000-00000000000a';
set local role authenticated;
do $$ begin if exists(select id from public.addon_payments where service_code in ('mail-care','pre-arrival-shopping')) or exists(select id from public.addon_subscriptions) then raise exception 'Revoked property still accessible'; end if; end $$;
reset role;
rollback;
