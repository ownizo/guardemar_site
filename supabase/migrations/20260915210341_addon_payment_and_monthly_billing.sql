-- Extend existing GUARDEMAR add-ons. Core subscriptions and property access untouched.
alter table public.addon_payments alter column addon_request_id drop not null;
alter table public.addon_payments alter column client_id drop not null;
alter table public.addon_payments drop constraint addon_payments_amount_semantics_check;
alter table public.addon_payments add constraint addon_payments_amount_semantics_check check(amount_semantics in ('unapproved','vat_included','external_final'));
alter table public.addon_payments add column payment_category text not null default 'guardemar_service' check(payment_category in ('guardemar_service','external_provider'));
alter table public.addon_payments add column payment_type text not null default 'one_time' check(payment_type in ('one_time','monthly'));
alter table public.addon_payments add column service_code text;
alter table public.addon_payments add column property_id uuid references public.properties(id);
alter table public.addon_payments add column vat_rate numeric(5,2);
alter table public.addon_payments add column amount_net integer;
alter table public.addon_payments add column amount_tax integer;
alter table public.addon_payments add column service_fee_only_confirmed boolean not null default false;
alter table public.addon_payments add column stripe_customer_id text;
alter table public.addon_payments add column stripe_tax_rate_id text;
alter table public.addon_payments add column stripe_product_id text;
update public.addon_payments p set service_code=r.service_code,property_id=r.property_id from public.addon_requests r where r.id=p.addon_request_id;
alter table public.addon_payments alter column service_code set not null;
alter table public.addon_payments add constraint addon_payment_scope check(
 (payment_category='guardemar_service' and addon_request_id is not null and client_id is not null and property_id is not null and service_code<>'external-provider')
 or (payment_category='external_provider' and service_code='external-provider'));
alter table public.addon_payments add constraint addon_payment_tax_evidence check(
 amount_semantics='unapproved' or
 (payment_category='guardemar_service' and amount_semantics='vat_included' and vat_rate is not null and vat_rate=23 and amount_net is not null and amount_tax is not null and amount_net>=0 and amount_tax>=0 and amount_net+amount_tax=amount)
 or (payment_category='external_provider' and amount_semantics='external_final' and vat_rate is null and amount_net is null and amount_tax is null));
create index addon_payments_property_idx on public.addon_payments(property_id);

create table public.addon_subscriptions (
 id uuid primary key default extensions.gen_random_uuid(), addon_payment_id uuid not null unique references public.addon_payments(id),
 addon_request_id uuid references public.addon_requests(id), client_id uuid references public.clients(id), property_id uuid references public.properties(id),
 service_code text not null, payment_category text not null check(payment_category in ('guardemar_service','external_provider')),
 customer_email text not null, description text not null, monthly_amount_gross integer not null check(monthly_amount_gross>0),
 vat_rate numeric(5,2), currency text not null check(currency='EUR'), equivalent_scope text not null,
 status text not null default 'draft' check(status in ('draft','payment_requested','checkout_open','active','past_due','cancelled','ended')),
 stripe_customer_id text, stripe_subscription_id text unique, stripe_checkout_session_id text unique, stripe_price_id text,
 created_by uuid not null references auth.users(id), created_at timestamptz not null default now(), activated_at timestamptz, cancelled_at timestamptz,
 state_updated_at timestamptz, payment_updated_at timestamptz
);
create unique index addon_subscriptions_one_equivalent on public.addon_subscriptions(equivalent_scope) where status not in ('cancelled','ended');
create index addon_subscriptions_client_idx on public.addon_subscriptions(client_id);
create index addon_subscriptions_property_idx on public.addon_subscriptions(property_id);
create index addon_subscriptions_request_idx on public.addon_subscriptions(addon_request_id);
create table public.addon_checkout_attempts (
 id uuid primary key default extensions.gen_random_uuid(), addon_payment_id uuid not null references public.addon_payments(id), generation integer not null,
 idempotency_key text not null unique, status text not null default 'prepared' check(status in ('prepared','open','complete','expired')),
 lease_token uuid, lease_until timestamptz, first_attempt_at timestamptz, stripe_checkout_session_id text unique, checkout_url text, expires_at timestamptz,
 created_at timestamptz not null default now(), unique(addon_payment_id,generation)
);
create table public.addon_subscription_payment_events (
 id uuid primary key default extensions.gen_random_uuid(), addon_subscription_id uuid not null references public.addon_subscriptions(id),
 stripe_invoice_id text not null, stripe_event_id text not null unique, payment_status text not null check(payment_status in ('paid','failed')),
 amount_gross integer not null, currency text not null check(currency='EUR'), occurred_at timestamptz not null
);
create index addon_invoice_subscription_idx on public.addon_subscription_payment_events(addon_subscription_id);
-- Same durable Resend pattern as request emails; immutable rendered envelope.
create table public.addon_email_deliveries (
 audit_event_type text, audit_entity_type text, audit_entity_id uuid, actor_user_id uuid references auth.users(id),
 email_key text primary key, addon_payment_id uuid not null references public.addon_payments(id), envelope jsonb not null,
 claimed_at timestamptz, first_attempt_at timestamptz, sent_at timestamptz, provider_message_id text, created_at timestamptz not null default now()
);
create index addon_email_payment_idx on public.addon_email_deliveries(addon_payment_id);
create unique index addon_audit_action_key on public.audit_events(entity_type,entity_id,event_type,(metadata->>'actionKey')) where entity_type in ('addon_payment','addon_subscription') and metadata ? 'actionKey';
alter table public.addon_subscriptions enable row level security;
alter table public.addon_checkout_attempts enable row level security;
alter table public.addon_subscription_payment_events enable row level security;
alter table public.addon_email_deliveries enable row level security;
revoke all on public.addon_subscriptions,public.addon_checkout_attempts,public.addon_subscription_payment_events,public.addon_email_deliveries from public,anon,authenticated;
grant all on public.addon_subscriptions,public.addon_checkout_attempts,public.addon_subscription_payment_events,public.addon_email_deliveries to service_role;
grant select(id,addon_payment_id,addon_request_id,client_id,property_id,service_code,payment_category,description,monthly_amount_gross,vat_rate,currency,status,created_at,activated_at,cancelled_at) on public.addon_subscriptions to authenticated;
grant select(service_code,payment_category,payment_type,amount_net,amount_tax,vat_rate) on public.addon_payments to authenticated;
create policy addon_subscriptions_read on public.addon_subscriptions for select to authenticated using(private.is_staff() or (
 status<>'draft' and exists(select 1 from public.client_users cu where cu.client_id=addon_subscriptions.client_id and cu.user_id=(select auth.uid()))
 and (property_id is null or exists(select 1 from public.property_users pu where pu.property_id=addon_subscriptions.property_id and pu.user_id=(select auth.uid())))
));
drop policy addon_payments_read on public.addon_payments;
create policy addon_payments_read on public.addon_payments for select to authenticated using(private.is_staff() or (
 payment_status<>'draft' and exists(select 1 from public.client_users cu where cu.client_id=addon_payments.client_id and cu.user_id=(select auth.uid()))
 and (property_id is null or exists(select 1 from public.property_users pu where pu.property_id=addon_payments.property_id and pu.user_id=(select auth.uid())))
));

create or replace function public.create_addon_payment_draft(actor uuid,input jsonb) returns uuid
language plpgsql security invoker set search_path='' as $$
declare linked public.addon_requests; existing public.addon_payments; payment_id uuid; subscription_id uuid;
 client_uuid uuid; property_uuid uuid; service text; category text; billing_type text; gross integer; net integer; scope text;
begin
 if not exists(select 1 from public.profiles where id=actor and role='admin') then raise exception 'Admin access required' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended(input->>'idempotencyKey',0));
 gross:=(input->>'amountEur')::integer;
 if gross is null or gross<1 or gross>99999999 or input->>'currency'<>'EUR' or length(trim(input->>'description')) not between 1 and 1000 or input->>'email' !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'Invalid payment details' using errcode='22023'; end if;
 billing_type:=case when coalesce((input->>'monthly')::boolean,false) then 'monthly' else 'one_time' end;
 if input->>'requestId' is not null then
  select * into strict linked from public.addon_requests where id=(input->>'requestId')::uuid for update;
  service:=linked.service_code; client_uuid:=linked.client_id; property_uuid:=linked.property_id; category:='guardemar_service';
  if input->>'serviceCode' is not null and input->>'serviceCode'<>service then raise exception 'Service mismatch' using errcode='22023'; end if;
 else
  if input->>'serviceCode'<>'external-provider' then raise exception 'Reviewed request required' using errcode='22023'; end if;
  service:='external-provider'; category:='external_provider'; client_uuid:=(input->>'clientId')::uuid;
  if client_uuid is not null and not exists(select 1 from public.clients where id=client_uuid and active) then raise exception 'Invalid client' using errcode='22023'; end if;
 end if;
 select * into existing from public.addon_payments where idempotency_key=(input->>'idempotencyKey')::uuid;
 if existing.id is not null then
  if existing.created_by_admin<>actor or existing.addon_request_id is distinct from linked.id or existing.client_id is distinct from client_uuid or existing.service_code<>service or existing.payment_type<>billing_type or existing.amount<>gross or existing.customer_email<>input->>'email' or existing.description<>input->>'description' or existing.service_fee_only_confirmed<>coalesce((input->>'serviceFeeOnlyConfirmed')::boolean,false) then raise exception 'Idempotency payload mismatch' using errcode='22023'; end if;
  return existing.id;
 end if;
 if linked.id is not null and linked.status not in ('under_review','awaiting_customer') then raise exception 'Request must be reviewed' using errcode='22023'; end if;
 if service='pre-arrival-shopping' and not coalesce((input->>'serviceFeeOnlyConfirmed')::boolean,false) then raise exception 'Shopping expenditure must remain outside Stripe' using errcode='22023'; end if;
 if linked.id is not null and exists(select 1 from public.addon_payments where addon_request_id=linked.id and payment_status<>'cancelled') then raise exception 'Payment already exists' using errcode='22023'; end if;
 net:=case when category='guardemar_service' then round(gross::numeric*100/123)::integer end;
 insert into public.addon_payments(addon_request_id,client_id,property_id,created_by_admin,idempotency_key,customer_email,description,currency,amount,service_code,payment_category,payment_type,amount_semantics,vat_rate,amount_net,amount_tax,service_fee_only_confirmed)
 values(linked.id,client_uuid,property_uuid,actor,(input->>'idempotencyKey')::uuid,input->>'email',input->>'description','EUR',gross,service,category,billing_type,case when category='guardemar_service' then 'vat_included' else 'external_final' end,case when category='guardemar_service' then 23 end,net,case when net is not null then gross-net end,coalesce((input->>'serviceFeeOnlyConfirmed')::boolean,false)) returning id into payment_id;
 insert into public.audit_events(actor_user_id,event_type,entity_type,entity_id,metadata) values(actor,case when category='external_provider' then 'EXTERNAL_PROVIDER_PAYMENT_CREATED' else 'ADDON_PAYMENT_CREATED' end,'addon_payment',payment_id,jsonb_build_object('paymentCategory',category,'paymentType',billing_type,'amountGross',gross));
 if billing_type='monthly' then
  scope:=case when category='guardemar_service' then property_uuid::text||':'||service else coalesce(client_uuid::text,lower(input->>'email'))||':'||service||':'||md5(lower(trim(input->>'description'))) end;
  insert into public.addon_subscriptions(addon_payment_id,addon_request_id,client_id,property_id,service_code,payment_category,customer_email,description,monthly_amount_gross,vat_rate,currency,equivalent_scope,created_by)
   values(payment_id,linked.id,client_uuid,property_uuid,service,category,input->>'email',input->>'description',gross,case when category='guardemar_service' then 23 end,'EUR',scope,actor) returning id into subscription_id;
  insert into public.audit_events(actor_user_id,event_type,entity_type,entity_id,metadata) values(actor,'ADDON_SUBSCRIPTION_CREATED','addon_subscription',subscription_id,jsonb_build_object('paymentId',payment_id,'paymentCategory',category,'amountGross',gross));
 end if;
 return payment_id;
end $$;

create function public.claim_addon_checkout(actor uuid,payment_id uuid,lease uuid,replace_attempt uuid default null) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare payment public.addon_payments; subscription public.addon_subscriptions; attempt public.addon_checkout_attempts; generation integer;
begin
 if not exists(select 1 from public.profiles where id=actor and role='admin') then raise exception 'Admin access required' using errcode='42501'; end if;
 select * into strict payment from public.addon_payments where id=payment_id for update;
 select * into subscription from public.addon_subscriptions where addon_payment_id=payment_id for update;
 if payment.payment_status in ('paid','cancelled') or payment.amount_semantics='unapproved' or subscription.status in ('active','past_due','cancelled','ended') or subscription.activated_at is not null then raise exception 'Payment/subscription cannot be recreated' using errcode='22023'; end if;
 if payment.addon_request_id is not null and exists(select 1 from public.addon_requests where id=payment.addon_request_id and status in ('cancelled','completed')) then raise exception 'Request is closed' using errcode='22023'; end if;
 select * into attempt from public.addon_checkout_attempts where addon_payment_id=payment_id order by generation desc limit 1 for update;
 if replace_attempt is not null then
  if attempt.id is distinct from replace_attempt or attempt.status<>'expired' then raise exception 'Only reconciled expired Checkout can be replaced' using errcode='22023'; end if;
  generation:=attempt.generation+1; attempt.id:=null;
 else generation:=coalesce(attempt.generation,0)+1;
 end if;
 if attempt.id is null then
  insert into public.addon_checkout_attempts(addon_payment_id,generation,idempotency_key) values(payment_id,generation,'guardemar-addon-'||payment_id::text||'-'||generation::text) returning * into attempt;
 end if;
 if attempt.status='open' then return to_jsonb(attempt); end if;
 if attempt.status<>'prepared' then raise exception 'Reconcile Checkout before continuing' using errcode='22023'; end if;
 if attempt.first_attempt_at<now()-interval '23 hours' then raise exception 'Ambiguous Stripe creation requires manual reconciliation' using errcode='22023'; end if;
 if attempt.lease_until>now() then raise exception 'Checkout creation already processing' using errcode='40001'; end if;
 update public.addon_checkout_attempts set lease_token=lease,lease_until=now()+interval '3 minutes',first_attempt_at=coalesce(first_attempt_at,now()) where id=attempt.id returning * into attempt;
 return to_jsonb(attempt);
end $$;

create function public.record_addon_checkout(actor uuid,attempt_id uuid,lease uuid,session_id text,session_url text,expiry timestamptz) returns void
language plpgsql security invoker set search_path='' as $$
declare attempt public.addon_checkout_attempts; payment public.addon_payments;
begin
 if not exists(select 1 from public.profiles where id=actor and role='admin') then raise exception 'Admin access required' using errcode='42501'; end if;
 select p.* into strict payment from public.addon_payments p join public.addon_checkout_attempts a on a.addon_payment_id=p.id where a.id=attempt_id for update of p;
 select * into strict attempt from public.addon_checkout_attempts where id=attempt_id for update;
 if attempt.stripe_checkout_session_id is not null and attempt.stripe_checkout_session_id<>session_id then raise exception 'Checkout mismatch' using errcode='22023'; end if;
 if attempt.lease_token is distinct from lease then raise exception 'Checkout lease mismatch' using errcode='40001'; end if;
 if payment.payment_status='paid' or attempt.status='complete' then return; end if;
 update public.addon_checkout_attempts set status='open',stripe_checkout_session_id=session_id,checkout_url=session_url,expires_at=expiry,lease_until=null where id=attempt_id;
 update public.addon_payments set stripe_checkout_session_id=session_id,payment_link_url=session_url,payment_status='payment_link_created' where id=payment.id and payment_status<>'paid';
 update public.addon_subscriptions set stripe_checkout_session_id=session_id,stripe_customer_id=payment.stripe_customer_id,status='checkout_open' where addon_payment_id=payment.id and activated_at is null;
 if payment.addon_request_id is not null then update public.addon_requests set status='payment_pending',updated_at=now() where id=payment.addon_request_id and status in ('under_review','awaiting_customer'); end if;
end $$;

create function public.expire_addon_checkout(actor uuid,attempt_id uuid,session_id text) returns void
language plpgsql security invoker set search_path='' as $$
declare payment public.addon_payments; attempt public.addon_checkout_attempts;
begin
 if not exists(select 1 from public.profiles where id=actor and role='admin') then raise exception 'Admin access required' using errcode='42501'; end if;
 select p.* into strict payment from public.addon_payments p join public.addon_checkout_attempts a on a.addon_payment_id=p.id where a.id=attempt_id for update of p;
 select * into strict attempt from public.addon_checkout_attempts where id=attempt_id for update;
 if payment.payment_status='paid' or attempt.stripe_checkout_session_id is distinct from session_id or attempt.status='complete' or exists(select 1 from public.addon_subscriptions where addon_payment_id=payment.id and (activated_at is not null or status in ('active','past_due'))) then raise exception 'Cannot expire paid/active payment' using errcode='22023'; end if;
 update public.addon_checkout_attempts set status='expired' where id=attempt_id;
 update public.addon_payments set payment_status='expired' where id=payment.id;
 insert into public.audit_events(actor_user_id,event_type,entity_type,entity_id,metadata) values(actor,'ADDON_PAYMENT_EXPIRED','addon_payment',payment.id,jsonb_build_object('actionKey',attempt.id::text)) on conflict do nothing;
end $$;

create function public.apply_addon_stripe_state(payment_id uuid,stripe_event text,event_time timestamptz,action text,evidence jsonb) returns boolean
language plpgsql security invoker set search_path='' as $$
declare payment public.addon_payments; subscription public.addon_subscriptions; old_status text; event_type text; entity text; entity_id uuid; changed boolean:=false;
begin
 if not exists(select 1 from public.stripe_webhook_events where stripe_event_id=stripe_event and livemode and processing_status='processing') then raise exception 'Verified webhook processing required' using errcode='42501'; end if;
 select * into strict payment from public.addon_payments where id=payment_id for update;
 select * into subscription from public.addon_subscriptions where addon_payment_id=payment_id for update;
 if action='paid' then
  if payment.payment_type<>'one_time' or (evidence->>'amountGross')::integer<>payment.amount or evidence->>'currency'<>'EUR' then raise exception 'Payment evidence mismatch' using errcode='22023'; end if;
  changed:=payment.payment_status<>'paid';
  update public.addon_payments set payment_status='paid',paid_at=coalesce(paid_at,event_time),stripe_payment_intent_id=evidence->>'paymentIntentId' where id=payment_id;
  update public.addon_checkout_attempts set status='complete',stripe_checkout_session_id=coalesce(stripe_checkout_session_id,evidence->>'sessionId') where id=(evidence->>'attemptId')::uuid and addon_payment_id=payment_id;
  event_type:='ADDON_PAYMENT_CONFIRMED'; entity:='addon_payment'; entity_id:=payment_id;
 elsif action='invoice_paid' then
  if subscription.id is null or (evidence->>'amountGross')::integer<>payment.amount or evidence->>'currency'<>'EUR' then raise exception 'Subscription invoice mismatch' using errcode='22023'; end if;
  insert into public.addon_subscription_payment_events(addon_subscription_id,stripe_invoice_id,stripe_event_id,payment_status,amount_gross,currency,occurred_at) values(subscription.id,evidence->>'invoiceId',stripe_event,'paid',payment.amount,'EUR',event_time) on conflict do nothing;
  if subscription.payment_updated_at>event_time or subscription.status in ('cancelled','ended') then return false; end if;
  changed:=subscription.activated_at is null;
  update public.addon_subscriptions set status='active',activated_at=coalesce(activated_at,event_time),stripe_subscription_id=evidence->>'subscriptionId',stripe_customer_id=evidence->>'customerId',stripe_price_id=evidence->>'priceId',payment_updated_at=event_time where id=subscription.id;
  update public.addon_payments set payment_status='paid',paid_at=coalesce(paid_at,event_time),stripe_customer_id=evidence->>'customerId' where id=payment_id;
  update public.addon_checkout_attempts set status='complete' where addon_payment_id=payment_id and status='open';
  event_type:='ADDON_SUBSCRIPTION_ACTIVATED'; entity:='addon_subscription'; entity_id:=subscription.id;
 elsif action in ('past_due','cancelled','ended') then
  if subscription.id is null or subscription.state_updated_at>event_time then return false; end if;
  old_status:=subscription.status;
  if old_status in ('cancelled','ended') then return false; end if;
  changed:=old_status<>action;
  update public.addon_subscriptions set status=action,stripe_subscription_id=coalesce(stripe_subscription_id,evidence->>'subscriptionId'),stripe_customer_id=coalesce(stripe_customer_id,evidence->>'customerId'),state_updated_at=event_time,cancelled_at=case when action in ('cancelled','ended') then coalesce(cancelled_at,event_time) else cancelled_at end where id=subscription.id;
  event_type:=case when action='past_due' then 'ADDON_SUBSCRIPTION_PAST_DUE' else 'ADDON_SUBSCRIPTION_CANCELLED' end; entity:='addon_subscription'; entity_id:=subscription.id;
 elsif action='expired' then
  if payment.payment_status='paid' or subscription.activated_at is not null then return false; end if;
  update public.addon_checkout_attempts set status='expired' where id=(evidence->>'attemptId')::uuid and addon_payment_id=payment_id and stripe_checkout_session_id=evidence->>'sessionId' and status='open';
  if not found then return false; end if;
  update public.addon_payments set payment_status='expired' where id=payment_id and stripe_checkout_session_id=evidence->>'sessionId';
  changed:=found; event_type:='ADDON_PAYMENT_EXPIRED'; entity:='addon_payment'; entity_id:=payment_id;
 else raise exception 'Invalid webhook action' using errcode='22023';
 end if;
 if action in ('paid','invoice_paid') and payment.addon_request_id is not null then update public.addon_requests set status='paid',updated_at=now() where id=payment.addon_request_id and status='payment_pending'; end if;
 if changed then insert into public.audit_events(actor_user_id,event_type,entity_type,entity_id,metadata) values(null,event_type,entity,entity_id,jsonb_build_object('stripeEventId',stripe_event,'paymentCategory',payment.payment_category,'paymentId',payment_id)) on conflict do nothing; end if;
 return changed;
end $$;
create function public.record_addon_email_sent(delivery_key text,provider_id text) returns void
language plpgsql security invoker set search_path='' as $$
declare delivery public.addon_email_deliveries;
begin
 select * into strict delivery from public.addon_email_deliveries where email_key=delivery_key for update;
 if delivery.sent_at is not null then return; end if;
 update public.addon_email_deliveries set sent_at=now(),provider_message_id=provider_id where email_key=delivery_key;
 if delivery.audit_event_type is not null then
  insert into public.audit_events(actor_user_id,event_type,entity_type,entity_id,metadata) values(delivery.actor_user_id,delivery.audit_event_type,delivery.audit_entity_type,delivery.audit_entity_id,jsonb_build_object('actionKey',delivery_key)) on conflict do nothing;
  update public.addon_payments set payment_status='sent',sent_at=coalesce(sent_at,now()) where id=delivery.addon_payment_id and payment_status='payment_link_created';
 end if;
end $$;
create function public.cancel_addon_payment_draft(actor uuid,payment_id uuid) returns void
language plpgsql security invoker set search_path='' as $$
declare payment public.addon_payments;
begin
 if not exists(select 1 from public.profiles where id=actor and role='admin') then raise exception 'Admin required' using errcode='42501'; end if;
 select * into strict payment from public.addon_payments where id=payment_id for update;
 if payment.payment_status<>'draft' or exists(select 1 from public.addon_checkout_attempts where addon_payment_id=payment_id) then raise exception 'Only unused drafts can be cancelled' using errcode='22023'; end if;
 update public.addon_payments set payment_status='cancelled',cancelled_at=now() where id=payment_id;
 update public.addon_subscriptions set status='cancelled',cancelled_at=now() where addon_payment_id=payment_id and status='draft';
 insert into public.audit_events(actor_user_id,event_type,entity_type,entity_id) values(actor,'ADDON_PAYMENT_DRAFT_CANCELLED','addon_payment',payment_id);
end $$;
revoke all on function public.record_addon_email_sent(text,text),public.cancel_addon_payment_draft(uuid,uuid) from public,anon,authenticated;
grant execute on function public.record_addon_email_sent(text,text),public.cancel_addon_payment_draft(uuid,uuid) to service_role;
revoke all on function public.claim_addon_checkout(uuid,uuid,uuid,uuid),public.record_addon_checkout(uuid,uuid,uuid,text,text,timestamptz),public.expire_addon_checkout(uuid,uuid,text),public.apply_addon_stripe_state(uuid,text,timestamptz,text,jsonb) from public,anon,authenticated;
grant execute on function public.claim_addon_checkout(uuid,uuid,uuid,uuid),public.record_addon_checkout(uuid,uuid,uuid,text,text,timestamptz),public.expire_addon_checkout(uuid,uuid,text),public.apply_addon_stripe_state(uuid,text,timestamptz,text,jsonb) to service_role;
