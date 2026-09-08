-- GUARDEMAR Initial Property Condition Report (baseline condition record).
-- Apply only to Supabase project ablktbpledjceddessyg.
--
-- Reuses the existing inspection domain (inspections/inspection_areas/
-- inspection_items/inspection_photos, their staff review + publish workflow,
-- and published_snapshot as the frozen client-facing record) rather than
-- creating a competing inspection system. A "baseline finding" is simply an
-- inspection_area/inspection_item with status in ('attention','urgent')
-- inside an inspection flagged is_baseline -- no separate findings table.
--
-- New in this migration: designating an inspection as the property's
-- baseline, a client review/acknowledgement lifecycle layered on top of the
-- existing publish workflow, and a comment/dispute mechanism that never
-- overwrites the original staff observation.

create type public.baseline_acknowledgement_state as enum ('pending', 'comments_received', 'acknowledged');

alter table public.inspections
  add column is_baseline boolean not null default false,
  add column superseded_by uuid references public.inspections(id) on delete set null,
  add column baseline_state public.baseline_acknowledgement_state;

-- At most one *active* (not superseded, not cancelled) baseline per property.
-- The unique index is the hard guarantee: a second concurrent baseline for
-- the same property is rejected outright rather than silently accepted.
-- superseded_by exists so that a genuinely required controlled replacement
-- (e.g. a materially flawed baseline) can be modelled later by pointing the
-- old row at its replacement -- no such replacement RPC is exposed yet, as
-- normal operation should never need one; treat any real need for it as an
-- operational exception requiring direct, logged staff action, not routine UI.
create unique index inspections_one_active_baseline_per_property_key
on public.inspections (property_id)
where is_baseline and superseded_by is null and status <> 'cancelled';

create table public.baseline_condition_comments (
  id uuid primary key default extensions.gen_random_uuid(),
  inspection_id uuid not null references public.inspections(id) on delete restrict,
  inspection_area_id uuid references public.inspection_areas(id) on delete restrict,
  client_user_id uuid not null references auth.users(id) on delete restrict,
  comment_text text not null,
  staff_response_text text,
  staff_responded_by uuid references auth.users(id) on delete set null,
  staff_responded_at timestamptz,
  created_at timestamptz not null default now(),
  constraint baseline_condition_comments_text_check check (char_length(trim(comment_text)) between 1 and 4000),
  constraint baseline_condition_comments_response_check check (
    (staff_response_text is null and staff_responded_by is null and staff_responded_at is null)
    or (staff_response_text is not null and staff_responded_by is not null and staff_responded_at is not null)
  )
);

create index baseline_condition_comments_inspection_idx on public.baseline_condition_comments (inspection_id, created_at);
create index baseline_condition_comments_area_idx on public.baseline_condition_comments (inspection_area_id);

-- The original observation this comment is about, the comment itself, its
-- author and its timestamp are immutable once written. Only a staff response
-- may be added later (once), via respond_to_baseline_condition_comment.
create function private.protect_baseline_comment_origin()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.inspection_id <> old.inspection_id
    or coalesce(new.inspection_area_id, '00000000-0000-0000-0000-000000000000'::uuid) <> coalesce(old.inspection_area_id, '00000000-0000-0000-0000-000000000000'::uuid)
    or new.client_user_id <> old.client_user_id
    or new.comment_text <> old.comment_text
    or new.created_at <> old.created_at
  then
    raise exception 'the original customer comment is immutable' using errcode = '55000';
  end if;
  return new;
end;
$$;

create trigger baseline_condition_comments_protect_origin before update on public.baseline_condition_comments
for each row execute function private.protect_baseline_comment_origin();

-- Final acknowledgement evidence. One canonical acknowledgement per baseline
-- inspection (unique inspection_id): a retry returns the existing row rather
-- than creating a duplicate. Fully immutable once written, like
-- service_agreement_acceptances (see private.prevent_immutable_legal_record_change,
-- defined in the subscription/payment migration).
create table public.baseline_condition_acknowledgements (
  id uuid primary key default extensions.gen_random_uuid(),
  inspection_id uuid not null unique references public.inspections(id) on delete restrict,
  property_id uuid not null references public.properties(id) on delete restrict,
  client_id uuid not null references public.clients(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete restrict,
  report_snapshot jsonb not null,
  report_sha256 text not null,
  acknowledgement_wording jsonb not null,
  acknowledgement_wording_version text not null default '1.0',
  open_comment_count integer not null default 0,
  acknowledged_at timestamptz not null default now(),
  constraint baseline_condition_acknowledgements_sha256_check check (report_sha256 ~ '^[a-f0-9]{64}$'),
  constraint baseline_condition_acknowledgements_count_check check (open_comment_count >= 0)
);

create trigger baseline_condition_acknowledgements_immutable before update or delete on public.baseline_condition_acknowledgements
for each row execute function private.prevent_immutable_legal_record_change();

alter table public.baseline_condition_comments enable row level security;
alter table public.baseline_condition_acknowledgements enable row level security;

create policy baseline_comments_staff_select on public.baseline_condition_comments
for select to authenticated using (private.is_staff());

create policy baseline_comments_customer_select on public.baseline_condition_comments
for select to authenticated using (exists (
  select 1 from public.inspections inspection
  where inspection.id = inspection_id and inspection.is_baseline and inspection.status = 'published'
    and private.customer_has_property_access(inspection.property_id)
));

create policy baseline_comments_customer_insert on public.baseline_condition_comments
for insert to authenticated with check (
  client_user_id = (select auth.uid())
  and staff_response_text is null and staff_responded_by is null and staff_responded_at is null
  and exists (
    select 1 from public.inspections inspection
    where inspection.id = inspection_id and inspection.is_baseline and inspection.status = 'published'
      and private.customer_has_property_access(inspection.property_id)
  )
);

create policy baseline_acks_staff_select on public.baseline_condition_acknowledgements
for select to authenticated using (private.is_staff());
create policy baseline_acks_customer_select on public.baseline_condition_acknowledgements
for select to authenticated using (private.customer_has_property_access(property_id));

revoke all on public.baseline_condition_comments, public.baseline_condition_acknowledgements from public, anon, authenticated;
grant select, insert on public.baseline_condition_comments to authenticated;
grant select on public.baseline_condition_acknowledgements to authenticated;

-- Staff designates an inspection as the property's baseline at creation time
-- (extends the existing create_inspection RPC rather than adding a parallel
-- creation path). The one-active-baseline-per-property unique index turns an
-- accidental second baseline into a clear, catchable error.
create or replace function public.create_inspection(inspection_data jsonb)
returns public.inspections
language plpgsql
security definer
set search_path = ''
as $$
declare created public.inspections;
declare requested_baseline boolean := coalesce((inspection_data ->> 'isBaseline')::boolean, false);
begin
  perform private.require_staff();
  insert into public.inspections(property_id, template_id, inspector_staff_id, status, scheduled_for, idempotency_key, created_by, is_baseline)
  values ((inspection_data ->> 'propertyId')::uuid, (inspection_data ->> 'templateId')::uuid,
    (inspection_data ->> 'inspectorStaffId')::uuid, 'scheduled', (inspection_data ->> 'scheduledFor')::timestamptz,
    (inspection_data ->> 'idempotencyKey')::uuid, auth.uid(), requested_baseline)
  on conflict (created_by, idempotency_key) do update set updated_at = public.inspections.updated_at
  returning * into created;

  if not exists (select 1 from public.inspection_areas where inspection_id = created.id) then
    insert into public.inspection_areas(inspection_id, source_property_area_id, area_type, custom_label, display_order)
    select created.id, area.id, area.area_type, area.custom_label, area.display_order
    from public.property_areas area where area.property_id = created.property_id and area.active
    order by area.display_order;

    insert into public.inspection_items(inspection_id, inspection_area_id, source_template_item_id, label, guidance, display_order, required)
    select created.id, area_snapshot.id, item.id, item.label, item.guidance, item.display_order, item.required
    from public.inspection_areas area_snapshot
    join public.inspection_template_items item on item.template_id = created.template_id
      and item.active and (item.area_type is null or lower(item.area_type) = lower(area_snapshot.area_type))
    where area_snapshot.inspection_id = created.id
    order by area_snapshot.display_order, item.display_order;

    insert into public.audit_events(actor_user_id, event_type, entity_type, entity_id, metadata)
    values (auth.uid(), 'inspection_created', 'inspection', created.id,
      jsonb_build_object('property_id', created.property_id, 'inspector_staff_id', created.inspector_staff_id, 'is_baseline', created.is_baseline));
  end if;
  return created;
end;
$$;

-- Publishing a baseline inspection also opens its client acknowledgement
-- lifecycle (published + is_baseline => baseline_state = 'pending'). Every
-- other publish behaviour is unchanged.
create or replace function public.publish_admin_inspection(inspection_uuid uuid)
returns public.inspections
language plpgsql
security definer
set search_path = ''
as $$
declare published public.inspections;
declare snapshot jsonb;
begin
  if not private.is_admin() then raise exception 'Administrator access required' using errcode = '42501'; end if;
  if not exists (select 1 from public.inspections where id = inspection_uuid and status = 'awaiting_review' and reviewed_at is not null and coalesce(final_condition, suggested_condition) is not null) then
    raise exception 'Inspection is not ready to publish';
  end if;
  update public.inspections set published_at = now(), published_by = auth.uid(),
    final_condition = coalesce(final_condition, suggested_condition)
  where id = inspection_uuid;
  snapshot := private.build_client_inspection_report(inspection_uuid);
  update public.inspections set status = 'published', published_snapshot = snapshot,
    baseline_state = case when is_baseline then 'pending'::public.baseline_acknowledgement_state else baseline_state end
  where id = inspection_uuid returning * into published;
  insert into public.audit_events(actor_user_id, event_type, entity_type, entity_id)
  values (auth.uid(), 'inspection_published', 'inspection', inspection_uuid);
  return published;
end;
$$;

-- Admin inspection detail now also surfaces baseline designation/state, and
-- -- for a later, non-baseline inspection -- traceability back to the
-- corresponding baseline finding for the same area (matched via the area's
-- existing source_property_area_id, reusing that linkage rather than adding
-- a parallel defect-tracking structure). Staff can then judge and record, in
-- the ordinary observation field, whether a finding is unchanged, worse, or
-- resolved relative to the baseline -- see General Terms v2.5 Clause 8.
create or replace function public.get_admin_inspection(inspection_uuid uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case when private.is_staff() then jsonb_build_object(
    'inspection', jsonb_build_object(
      'id', inspection.id, 'status', inspection.status, 'scheduled_for', inspection.scheduled_for,
      'started_at', inspection.started_at, 'completed_at', inspection.completed_at,
      'reviewed_at', inspection.reviewed_at, 'published_at', inspection.published_at,
      'suggested_condition', inspection.suggested_condition, 'final_condition', inspection.final_condition,
      'client_summary', inspection.client_summary, 'internal_review_notes', inspection.internal_review_notes,
      'property_id', property.id, 'property_name', property.display_name, 'locality', property.locality,
      'inspector_staff_id', staff.id, 'inspector_name', staff.display_name,
      'is_baseline', inspection.is_baseline, 'baseline_state', inspection.baseline_state,
      'superseded_by', inspection.superseded_by
    ),
    'areas', coalesce((select jsonb_agg(jsonb_build_object(
      'id', area.id, 'area_type', area.area_type, 'custom_label', area.custom_label, 'display_order', area.display_order,
      'status', area.status, 'suggested_status', area.suggested_status, 'observation', area.observation,
      'observation_client_visible', area.observation_client_visible, 'recommendation', area.recommendation,
      'recommendation_client_visible', area.recommendation_client_visible,
      'items', coalesce((select jsonb_agg(to_jsonb(item) order by item.display_order) from public.inspection_items item where item.inspection_area_id = area.id), '[]'::jsonb),
      'photos', coalesce((select jsonb_agg(to_jsonb(photo) order by photo.display_order) from public.inspection_photos photo where photo.inspection_area_id = area.id and photo.rejected_at is null), '[]'::jsonb),
      'baseline', case when not inspection.is_baseline and area.source_property_area_id is not null then (
        select jsonb_build_object('inspectionId', baseline_inspection.id, 'status', baseline_area.status, 'observation', baseline_area.observation)
        from public.inspections baseline_inspection
        join public.inspection_areas baseline_area
          on baseline_area.inspection_id = baseline_inspection.id and baseline_area.source_property_area_id = area.source_property_area_id
        where baseline_inspection.property_id = inspection.property_id and baseline_inspection.is_baseline and baseline_inspection.superseded_by is null
        order by baseline_inspection.created_at desc limit 1
      ) else null end
    ) order by area.display_order) from public.inspection_areas area where area.inspection_id = inspection.id), '[]'::jsonb)
  ) else null end
  from public.inspections inspection
  join public.properties property on property.id = inspection.property_id
  join public.staff_profiles staff on staff.id = inspection.inspector_staff_id
  where inspection.id = inspection_uuid;
$$;

-- Admin inspection list now also surfaces is_baseline (return shape changes,
-- so this requires drop + create rather than create or replace).
drop function if exists public.list_admin_inspections(jsonb);
create function public.list_admin_inspections(filters jsonb default '{}'::jsonb)
returns table(id uuid, scheduled_for timestamptz, property_id uuid, property_name text, locality text, inspector_staff_id uuid, inspector_name text, status public.inspection_lifecycle_status, condition public.inspection_condition, is_baseline boolean, baseline_state public.baseline_acknowledgement_state)
language sql
stable
security definer
set search_path = ''
as $$
  select inspection.id, inspection.scheduled_for, property.id, property.display_name, property.locality,
    staff.id, staff.display_name, inspection.status, coalesce(inspection.final_condition, inspection.suggested_condition),
    inspection.is_baseline, inspection.baseline_state
  from public.inspections inspection
  join public.properties property on property.id = inspection.property_id
  join public.staff_profiles staff on staff.id = inspection.inspector_staff_id
  where private.is_staff()
    and (coalesce(filters ->> 'status', '') = '' or inspection.status::text = filters ->> 'status')
    and (coalesce(filters ->> 'propertyId', '') = '' or inspection.property_id = (filters ->> 'propertyId')::uuid)
    and (coalesce(filters ->> 'inspectorStaffId', '') = '' or inspection.inspector_staff_id = (filters ->> 'inspectorStaffId')::uuid)
    and (coalesce(filters ->> 'dateFrom', '') = '' or inspection.scheduled_for >= (filters ->> 'dateFrom')::timestamptz)
    and (coalesce(filters ->> 'dateTo', '') = '' or inspection.scheduled_for < ((filters ->> 'dateTo')::date + 1))
  order by inspection.scheduled_for desc;
$$;

-- Customer inspection list (already extended once, in
-- 20260904150000_add_customer_inspection_retention.sql, with the 180-day
-- retention window fields) now also flags property_id/is_baseline/
-- baseline_state so the portal can badge "INITIAL PROPERTY CONDITION REPORT"
-- and show an "Action required" state without a per-inspection round trip.
-- This drop+create is rebased on that migration's current definition, not
-- the original phase-2 one.
drop function if exists public.list_customer_inspections();
create function public.list_customer_inspections()
returns table(
  id uuid,
  scheduled_for timestamptz,
  published_at timestamptz,
  available_until timestamptz,
  is_available boolean,
  days_remaining integer,
  property_id uuid,
  property_name text,
  locality text,
  inspector_name text,
  overall_condition public.inspection_condition,
  is_baseline boolean,
  baseline_state public.baseline_acknowledgement_state,
  baseline_acknowledged_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    inspection.id,
    inspection.scheduled_for,
    inspection.published_at,
    inspection.published_at + interval '4320 hours',
    private.customer_inspection_is_available(inspection.published_at),
    greatest(0, ceil(extract(epoch from ((inspection.published_at + interval '4320 hours') - now())) / 86400))::integer,
    inspection.property_id,
    inspection.published_snapshot #>> '{property,display_name}',
    inspection.published_snapshot #>> '{property,locality}',
    inspection.published_snapshot #>> '{inspector,display_name}',
    inspection.final_condition,
    inspection.is_baseline,
    inspection.baseline_state,
    ack.acknowledged_at
  from public.inspections inspection
  left join public.baseline_condition_acknowledgements ack on ack.inspection_id = inspection.id
  where inspection.status = 'published'
    and private.customer_has_property_access(inspection.property_id)
  order by inspection.scheduled_for desc;
$$;

revoke all on function public.list_customer_inspections() from public, anon, authenticated;
grant execute on function public.list_customer_inspections() to authenticated;

-- Property-level baseline status for the admin property page: whether a
-- baseline exists at all, and if so its full lifecycle state.
create function public.get_property_baseline_status(property_uuid uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case when private.is_staff() then coalesce(
    (select jsonb_build_object(
      'inspectionId', inspection.id, 'status', inspection.status, 'isBaseline', inspection.is_baseline,
      'baselineState', inspection.baseline_state, 'publishedAt', inspection.published_at,
      'acknowledgedAt', ack.acknowledged_at, 'openCommentCount', coalesce(open_comments.count, 0)
    )
    from public.inspections inspection
    left join public.baseline_condition_acknowledgements ack on ack.inspection_id = inspection.id
    left join lateral (
      select count(*) as count from public.baseline_condition_comments comment
      where comment.inspection_id = inspection.id and comment.staff_response_text is null
    ) open_comments on true
    where inspection.property_id = property_uuid and inspection.is_baseline and inspection.superseded_by is null
    order by inspection.created_at desc limit 1),
    jsonb_build_object('inspectionId', null, 'status', null, 'isBaseline', false, 'baselineState', null)
  ) else null end;
$$;

-- Customer-facing baseline status + comments for one inspection. Reuses
-- get_customer_inspection's own access rule (published_snapshot is the
-- source of truth for the report content itself; this only adds the
-- acknowledgement/comment layer on top).
create function public.get_baseline_condition_status(inspection_uuid uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'isBaseline', inspection.is_baseline,
    'baselineState', inspection.baseline_state,
    'comments', coalesce((select jsonb_agg(jsonb_build_object(
      'id', comment.id, 'inspectionAreaId', comment.inspection_area_id, 'commentText', comment.comment_text,
      'createdAt', comment.created_at, 'staffResponseText', comment.staff_response_text, 'staffRespondedAt', comment.staff_responded_at
    ) order by comment.created_at) from public.baseline_condition_comments comment where comment.inspection_id = inspection.id), '[]'::jsonb),
    'acknowledgement', (select jsonb_build_object('acknowledgedAt', ack.acknowledged_at, 'acknowledgementWording', ack.acknowledgement_wording, 'wordingVersion', ack.acknowledgement_wording_version)
      from public.baseline_condition_acknowledgements ack where ack.inspection_id = inspection.id)
  )
  from public.inspections inspection
  where inspection.id = inspection_uuid and inspection.status = 'published'
    and private.customer_inspection_is_available(inspection.published_at)
    and private.customer_has_property_access(inspection.property_id);
$$;

-- Customer submits a comment/dispute on a baseline finding (or the report
-- generally, when area_uuid is null). Never touches the original staff
-- observation; only ever inserts a new row.
create function public.submit_baseline_condition_comment(inspection_uuid uuid, area_uuid uuid, comment_body text)
returns public.baseline_condition_comments
language plpgsql
security definer
set search_path = ''
as $$
declare inspection_record public.inspections;
declare saved public.baseline_condition_comments;
begin
  select * into inspection_record from public.inspections where id = inspection_uuid;
  if inspection_record.id is null or not inspection_record.is_baseline or inspection_record.status <> 'published'
    or not private.customer_inspection_is_available(inspection_record.published_at) then
    raise exception 'This is not a published baseline condition report' using errcode = '22023';
  end if;
  if not private.customer_has_property_access(inspection_record.property_id) then
    raise exception 'property access denied' using errcode = '42501';
  end if;
  if area_uuid is not null and not exists (select 1 from public.inspection_areas where id = area_uuid and inspection_id = inspection_uuid) then
    raise exception 'condition not found on this report' using errcode = '22023';
  end if;
  if coalesce(trim(comment_body), '') = '' then raise exception 'a comment is required' using errcode = '22023'; end if;

  insert into public.baseline_condition_comments(inspection_id, inspection_area_id, client_user_id, comment_text)
  values (inspection_uuid, area_uuid, auth.uid(), trim(comment_body))
  returning * into saved;

  update public.inspections set baseline_state = 'comments_received'
  where id = inspection_uuid and baseline_state in ('pending', 'comments_received');

  insert into public.audit_events(actor_user_id, event_type, entity_type, entity_id, metadata)
  values (auth.uid(), 'baseline_comment_submitted', 'inspection', inspection_uuid, jsonb_build_object('commentId', saved.id, 'inspectionAreaId', area_uuid));

  return saved;
end;
$$;

-- Staff response to a customer comment. Only ever sets the response columns;
-- the trigger above independently guarantees the original comment cannot be
-- altered even if this function's logic were ever changed incorrectly.
create function public.respond_to_baseline_condition_comment(comment_uuid uuid, response_body text)
returns public.baseline_condition_comments
language plpgsql
security definer
set search_path = ''
as $$
declare saved public.baseline_condition_comments;
begin
  perform private.require_staff();
  if coalesce(trim(response_body), '') = '' then raise exception 'a response is required' using errcode = '22023'; end if;
  update public.baseline_condition_comments
  set staff_response_text = trim(response_body), staff_responded_by = auth.uid(), staff_responded_at = now()
  where id = comment_uuid
  returning * into saved;
  if saved.id is null then raise exception 'comment not found' using errcode = 'P0002'; end if;

  insert into public.audit_events(actor_user_id, event_type, entity_type, entity_id, metadata)
  values (auth.uid(), 'baseline_comment_responded', 'inspection', saved.inspection_id, jsonb_build_object('commentId', saved.id));

  return saved;
end;
$$;

-- Final client acknowledgement. Idempotent: a retry (or a second authorised
-- portal user for the same property) returns the existing evidence row
-- rather than creating a duplicate -- inspection_id is unique on the table.
-- The acknowledgement wording is fixed server-side, never client-supplied,
-- the same way Terms acceptance verifies a canonical hash rather than
-- trusting client text.
create function public.acknowledge_baseline_condition(inspection_uuid uuid)
returns public.baseline_condition_acknowledgements
language plpgsql
security definer
set search_path = ''
as $$
declare inspection_record public.inspections;
declare property_record public.properties;
declare existing public.baseline_condition_acknowledgements;
declare saved public.baseline_condition_acknowledgements;
declare wording jsonb := jsonb_build_object(
  'confirmation', 'I confirm that I have reviewed the Initial Property Condition Report and that, except for any comments or corrections submitted by me, it fairly records the visible condition of the property at the commencement of Guardemar''s service.',
  'scopeCaveat', 'I understand that the report is a visual, non-invasive condition record and not a technical survey, and that concealed, latent or inaccessible defects may not be identified.'
);
declare comment_count integer;
begin
  select * into existing from public.baseline_condition_acknowledgements where inspection_id = inspection_uuid;
  if existing.id is not null then return existing; end if;

  select * into inspection_record from public.inspections where id = inspection_uuid;
  if inspection_record.id is null or not inspection_record.is_baseline or inspection_record.status <> 'published'
    or not private.customer_inspection_is_available(inspection_record.published_at) then
    raise exception 'This is not a published baseline condition report' using errcode = '22023';
  end if;
  select * into property_record from public.properties where id = inspection_record.property_id;
  if not private.customer_has_property_access(property_record.id) then
    raise exception 'property access denied' using errcode = '42501';
  end if;

  select count(*) into comment_count from public.baseline_condition_comments where inspection_id = inspection_uuid;

  insert into public.baseline_condition_acknowledgements(
    inspection_id, property_id, client_id, user_id, report_snapshot, report_sha256,
    acknowledgement_wording, acknowledgement_wording_version, open_comment_count
  ) values (
    inspection_uuid, property_record.id, property_record.client_id, auth.uid(),
    inspection_record.published_snapshot, encode(extensions.digest(convert_to(inspection_record.published_snapshot::text, 'UTF8'), 'sha256'), 'hex'),
    wording, '1.0', comment_count
  )
  on conflict (inspection_id) do nothing
  returning * into saved;

  if saved.id is null then
    select * into saved from public.baseline_condition_acknowledgements where inspection_id = inspection_uuid;
    return saved;
  end if;

  update public.inspections set baseline_state = 'acknowledged' where id = inspection_uuid;

  insert into public.audit_events(actor_user_id, event_type, entity_type, entity_id, metadata)
  values (auth.uid(), 'baseline_condition_acknowledged', 'inspection', inspection_uuid, jsonb_build_object('acknowledgementId', saved.id));

  return saved;
end;
$$;

revoke all on function public.get_property_baseline_status(uuid), public.get_baseline_condition_status(uuid),
  public.submit_baseline_condition_comment(uuid, uuid, text), public.respond_to_baseline_condition_comment(uuid, text),
  public.acknowledge_baseline_condition(uuid) from public, anon, authenticated;
grant execute on function public.get_property_baseline_status(uuid), public.get_baseline_condition_status(uuid),
  public.submit_baseline_condition_comment(uuid, uuid, text), public.respond_to_baseline_condition_comment(uuid, text),
  public.acknowledge_baseline_condition(uuid) to authenticated;

comment on table public.baseline_condition_comments is 'Customer comments/disputes on baseline (Initial Property Condition Report) findings. Original observation, comment text, author and timestamp are immutable; only a staff response may be added.';
comment on table public.baseline_condition_acknowledgements is 'Immutable evidence that a customer reviewed and acknowledged the Initial Property Condition Report for a property. One row per baseline inspection.';
