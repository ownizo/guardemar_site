-- GUARDEMAR only: request flow and accounting-unapproved payment drafts.
-- All mutations run through server-only RPCs; existing auth/access helpers unchanged.
create table public.addon_requests (
  id uuid primary key default extensions.gen_random_uuid(),
  request_reference text not null unique default ('GSR-' || upper(replace(extensions.gen_random_uuid()::text, '-', ''))),
  client_id uuid not null references public.clients(id), property_id uuid not null references public.properties(id),
  requested_by uuid not null references auth.users(id), idempotency_key uuid not null,
  submission_fingerprint text not null,
  service_code text not null, status text not null default 'requested' check (status in ('requested','under_review','awaiting_customer','payment_pending','paid','scheduled','in_progress','completed','cancelled')),
  published_price_snapshot text not null, published_price_note_snapshot text not null default '',
  customer_notes text not null default '' check (length(customer_notes) <= 5000),
  service_details jsonb not null default '{}' check (jsonb_typeof(service_details)='object'),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), completed_at timestamptz, cancelled_at timestamptz,
  unique(requested_by,idempotency_key)
);
create index addon_requests_property_idx on public.addon_requests(property_id);
create index addon_requests_client_idx on public.addon_requests(client_id);
create index addon_requests_queue_idx on public.addon_requests(status,created_at desc);
create table public.addon_shopping_items (
  id uuid primary key default extensions.gen_random_uuid(), request_id uuid not null references public.addon_requests(id) on delete cascade,
  product text not null check(length(product) between 1 and 200), quantity text not null check(length(quantity) between 1 and 80),
  preferred_brand text not null default '' check(length(preferred_brand)<=200),
  alternative_policy text not null check(alternative_policy in ('any_suitable','no_substitute','specific')),
  alternative_product text not null default '' check(length(alternative_product)<=200), notes text not null default '' check(length(notes)<=1000),
  display_order integer not null, unique(request_id,display_order),
  check((alternative_policy='specific' and length(alternative_product)>0) or (alternative_policy<>'specific' and alternative_product=''))
);
create table public.addon_internal_notes (
  id uuid primary key default extensions.gen_random_uuid(), request_id uuid not null references public.addon_requests(id),
  created_by uuid not null references auth.users(id), note text not null check(length(note) between 1 and 5000), created_at timestamptz not null default now()
);
create index addon_internal_notes_request_idx on public.addon_internal_notes(request_id);
create table public.addon_payments (
  id uuid primary key default extensions.gen_random_uuid(), addon_request_id uuid not null references public.addon_requests(id),
  client_id uuid not null references public.clients(id), created_by_admin uuid not null references auth.users(id),
  idempotency_key uuid not null unique, customer_email text not null, description text not null check(length(description) between 1 and 1000),
  currency text not null default 'EUR' check(currency='EUR'), amount integer not null check(amount between 1 and 99999999),
  amount_semantics text not null default 'unapproved' check(amount_semantics='unapproved'),
  payment_status text not null default 'draft' check(payment_status in ('draft','payment_link_created','sent','paid','expired','cancelled','failed')),
  stripe_checkout_session_id text unique, stripe_payment_intent_id text unique, payment_link_url text,
  created_at timestamptz not null default now(), sent_at timestamptz, paid_at timestamptz, cancelled_at timestamptz
);
create unique index addon_payments_one_unresolved_request on public.addon_payments(addon_request_id) where payment_status<>'cancelled';
create index addon_payments_client_idx on public.addon_payments(client_id);
-- Persistent email delivery marker supplements the existing Resend idempotency key.
create table public.addon_request_email_delivery (
  request_id uuid primary key references public.addon_requests(id), claimed_at timestamptz, first_attempt_at timestamptz, sent_at timestamptz, provider_message_id text
);

alter table public.addon_requests enable row level security;
alter table public.addon_shopping_items enable row level security;
alter table public.addon_internal_notes enable row level security;
alter table public.addon_payments enable row level security;
alter table public.addon_request_email_delivery enable row level security;
revoke all on public.addon_requests, public.addon_shopping_items, public.addon_internal_notes, public.addon_payments, public.addon_request_email_delivery from public, anon, authenticated;
grant select on public.addon_requests, public.addon_shopping_items, public.addon_internal_notes to authenticated;
grant select(id,addon_request_id,description,currency,amount,amount_semantics,payment_status,created_at,paid_at) on public.addon_payments to authenticated;
grant all on public.addon_requests, public.addon_shopping_items, public.addon_internal_notes, public.addon_payments, public.addon_request_email_delivery to service_role;
create policy addon_requests_read on public.addon_requests for select to authenticated using (
  private.is_staff() or (
    exists(select 1 from public.property_users pu where pu.property_id=addon_requests.property_id and pu.user_id=(select auth.uid()))
    and exists(select 1 from public.client_users cu where cu.client_id=addon_requests.client_id and cu.user_id=(select auth.uid()))
  )
);
create policy addon_shopping_read on public.addon_shopping_items for select to authenticated using (exists(select 1 from public.addon_requests r where r.id=request_id));
create policy addon_notes_staff_read on public.addon_internal_notes for select to authenticated using(private.is_staff());
create policy addon_payments_read on public.addon_payments for select to authenticated using (
  private.is_staff() or (payment_status<>'draft' and exists(select 1 from public.addon_requests r where r.id=addon_request_id))
);

create function public.create_addon_request(actor uuid, input jsonb, fingerprint text) returns uuid
language plpgsql security invoker set search_path='' as $$
declare request_id uuid; property_client uuid; existing public.addon_requests; item jsonb; position integer:=0;
begin
  if not exists(select 1 from public.profiles where id=actor and role='customer') then raise exception 'Customer access required' using errcode='42501'; end if;
  select p.client_id into property_client from public.properties p
    join public.property_users pu on pu.property_id=p.id and pu.user_id=actor
    join public.client_users cu on cu.client_id=p.client_id and cu.user_id=actor
    join public.clients c on c.id=p.client_id and c.active
    where p.id=(input->>'propertyId')::uuid and p.active;
  if property_client is null then raise exception 'Property access denied' using errcode='42501'; end if;
  -- Actor/key lock makes request, items, audit alert and email marker one transaction.
  perform pg_advisory_xact_lock(hashtextextended(actor::text || (input->>'idempotencyKey'),0));
  select * into existing from public.addon_requests where requested_by=actor and idempotency_key=(input->>'idempotencyKey')::uuid;
  if existing.id is not null then
    if existing.submission_fingerprint<>fingerprint then raise exception 'Idempotency payload mismatch' using errcode='22023'; end if;
    return existing.id;
  end if;
  insert into public.addon_requests(client_id,property_id,requested_by,idempotency_key,submission_fingerprint,service_code,published_price_snapshot,published_price_note_snapshot,customer_notes,service_details)
  values(property_client,(input->>'propertyId')::uuid,actor,(input->>'idempotencyKey')::uuid,fingerprint,input->>'serviceCode',input->>'publishedPrice',input->>'publishedPriceNote',input->>'customerNotes',input->'serviceDetails') returning id into request_id;
  for item in select * from jsonb_array_elements(input->'shoppingItems') loop
    insert into public.addon_shopping_items(request_id,product,quantity,preferred_brand,alternative_policy,alternative_product,notes,display_order)
    values(request_id,item->>'product',item->>'quantity',item->>'preferredBrand',item->>'alternativePolicy',item->>'alternativeProduct',item->>'notes',position);
    position:=position+1;
  end loop;
  insert into public.audit_events(actor_user_id,event_type,entity_type,entity_id,metadata)
    values(actor,'ADDON_REQUEST_CREATED','addon_request',request_id,jsonb_build_object('serviceCode',input->>'serviceCode','propertyId',input->>'propertyId','clientId',property_client));
  insert into public.addon_request_email_delivery(request_id) values(request_id);
  return request_id;
end $$;

create function public.review_addon_request(actor uuid, request_id uuid, expected_status text, next_status text, internal_note text) returns void
language plpgsql security invoker set search_path='' as $$
declare current_request public.addon_requests;
begin
  if not exists(select 1 from public.profiles where id=actor and role in ('admin','staff')) then raise exception 'Staff access required' using errcode='42501'; end if;
  select * into strict current_request from public.addon_requests where id=request_id for update;
  if current_request.status<>expected_status then raise exception 'Request changed; refresh before saving' using errcode='40001'; end if;
  if next_status<>expected_status then
    if not ((expected_status='requested' and next_status in ('under_review','cancelled'))
      or (expected_status='under_review' and next_status in ('awaiting_customer','cancelled'))
      or (expected_status='awaiting_customer' and next_status in ('under_review','cancelled'))
      or (expected_status='paid' and next_status in ('scheduled','cancelled'))
      or (expected_status in ('scheduled','in_progress') and next_status in ('in_progress','completed','cancelled'))) then
      raise exception 'Invalid operational transition' using errcode='22023';
    end if;
    if next_status='cancelled' and exists(select 1 from public.addon_payments where addon_request_id=request_id and payment_status in ('payment_link_created','sent')) then
      raise exception 'Resolve pending payment before cancellation' using errcode='22023';
    end if;
    update public.addon_requests set status=next_status,updated_at=now(),completed_at=case when next_status='completed' then now() else completed_at end,cancelled_at=case when next_status='cancelled' then now() else cancelled_at end where id=request_id;
    insert into public.audit_events(actor_user_id,event_type,entity_type,entity_id,metadata)
      values(actor,case next_status when 'completed' then 'ADDON_REQUEST_COMPLETED' when 'cancelled' then 'ADDON_REQUEST_CANCELLED' else 'ADDON_REQUEST_STATUS_CHANGED' end,'addon_request',request_id,jsonb_build_object('from',expected_status,'to',next_status));
  end if;
  if length(trim(internal_note))>0 then
    insert into public.addon_internal_notes(request_id,created_by,note) values(request_id,actor,trim(internal_note));
    insert into public.audit_events(actor_user_id,event_type,entity_type,entity_id) values(actor,'ADDON_REQUEST_NOTE_ADDED','addon_request',request_id);
  end if;
end $$;

create function public.create_addon_payment_draft(actor uuid, input jsonb) returns uuid
language plpgsql security invoker set search_path='' as $$
declare linked public.addon_requests; existing public.addon_payments; payment_id uuid;
begin
  if not exists(select 1 from public.profiles where id=actor and role='admin') then raise exception 'Admin access required' using errcode='42501'; end if;
  select * into strict linked from public.addon_requests where id=(input->>'requestId')::uuid for update;
  if linked.status not in ('under_review','awaiting_customer') then raise exception 'Review the request before preparing payment' using errcode='22023'; end if;
  select * into existing from public.addon_payments where idempotency_key=(input->>'idempotencyKey')::uuid;
  if existing.id is not null then
    if existing.addon_request_id<>linked.id or existing.created_by_admin<>actor or existing.amount<>(input->>'amountEur')::integer or existing.customer_email<>input->>'email' or existing.description<>input->>'description' then raise exception 'Idempotency payload mismatch' using errcode='22023'; end if;
    return existing.id;
  end if;
  if exists(select 1 from public.addon_payments where addon_request_id=linked.id and payment_status<>'cancelled') then raise exception 'Payment already exists for this request' using errcode='22023'; end if;
  insert into public.addon_payments(addon_request_id,client_id,created_by_admin,idempotency_key,customer_email,description,currency,amount)
    values(linked.id,linked.client_id,actor,(input->>'idempotencyKey')::uuid,input->>'email',input->>'description',input->>'currency',(input->>'amountEur')::integer) returning id into payment_id;
  insert into public.audit_events(actor_user_id,event_type,entity_type,entity_id,metadata)
    values(actor,'ADDON_PAYMENT_CREATED','addon_payment',payment_id,jsonb_build_object('requestId',linked.id,'draft',true,'amountSemantics','unapproved'));
  return payment_id;
end $$;
revoke all on function public.create_addon_request(uuid,jsonb,text), public.review_addon_request(uuid,uuid,text,text,text), public.create_addon_payment_draft(uuid,jsonb) from public, anon, authenticated;
grant execute on function public.create_addon_request(uuid,jsonb,text), public.review_addon_request(uuid,uuid,text,text,text), public.create_addon_payment_draft(uuid,jsonb) to service_role;
