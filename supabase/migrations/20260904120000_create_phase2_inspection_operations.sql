-- Guardemar Phase 2 inspection operations.
-- Apply only to Supabase project ablktbpledjceddessyg.

create type public.inspection_lifecycle_status as enum (
  'draft', 'scheduled', 'in_progress', 'completed', 'awaiting_review', 'published', 'cancelled'
);

create type public.inspection_result_status as enum (
  'good', 'attention', 'urgent', 'not_checked', 'not_applicable'
);

create type public.inspection_condition as enum ('good', 'attention', 'urgent');

alter table public.staff_profiles
  drop constraint staff_profiles_user_id_fkey,
  alter column user_id drop not null,
  add column first_name text,
  add column last_name text,
  add column email text,
  add column phone text,
  add column show_on_client_reports boolean not null default true,
  add column internal_notes text,
  add column profile_photo_path text;

alter table public.staff_profiles
  add constraint staff_profiles_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete set null;

update public.staff_profiles
set first_name = coalesce(first_name, split_part(display_name, ' ', 1)),
    last_name = coalesce(last_name, nullif(trim(substr(display_name, length(split_part(display_name, ' ', 1)) + 1)), ''));

alter table public.staff_profiles alter column first_name set not null;
alter table public.staff_profiles alter column last_name set not null;

create table public.property_areas (
  id uuid primary key default extensions.gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete restrict,
  area_type text not null,
  custom_label text not null,
  display_order integer not null default 0,
  active boolean not null default true,
  internal_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint property_areas_type_check check (char_length(trim(area_type)) between 1 and 80),
  constraint property_areas_label_check check (char_length(trim(custom_label)) between 1 and 160),
  constraint property_areas_order_check check (display_order >= 0)
);

create table public.inspection_templates (
  id uuid primary key default extensions.gen_random_uuid(),
  name text not null,
  description text,
  active boolean not null default true,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint inspection_templates_name_check check (char_length(trim(name)) between 1 and 160),
  constraint inspection_templates_version_check check (version > 0)
);

create table public.inspection_template_items (
  id uuid primary key default extensions.gen_random_uuid(),
  template_id uuid not null references public.inspection_templates(id) on delete restrict,
  area_type text,
  label text not null,
  guidance text,
  display_order integer not null default 0,
  required boolean not null default true,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint inspection_template_items_label_check check (char_length(trim(label)) between 1 and 200),
  constraint inspection_template_items_order_check check (display_order >= 0)
);

create table public.inspections (
  id uuid primary key default extensions.gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete restrict,
  template_id uuid references public.inspection_templates(id) on delete restrict,
  inspector_staff_id uuid not null references public.staff_profiles(id) on delete restrict,
  status public.inspection_lifecycle_status not null default 'draft',
  scheduled_for timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null,
  published_at timestamptz,
  published_by uuid references auth.users(id) on delete set null,
  cancelled_at timestamptz,
  cancelled_by uuid references auth.users(id) on delete set null,
  cancellation_reason text,
  suggested_condition public.inspection_condition,
  final_condition public.inspection_condition,
  client_summary text,
  internal_review_notes text,
  published_snapshot jsonb,
  idempotency_key uuid,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint inspections_schedule_check check (status = 'draft' or scheduled_for is not null),
  constraint inspections_publication_check check (
    (status = 'published' and published_at is not null and published_by is not null and published_snapshot is not null and final_condition is not null)
    or status <> 'published'
  ),
  constraint inspections_idempotency_key_unique unique (created_by, idempotency_key)
);

create table public.inspection_areas (
  id uuid primary key default extensions.gen_random_uuid(),
  inspection_id uuid not null references public.inspections(id) on delete restrict,
  source_property_area_id uuid references public.property_areas(id) on delete set null,
  area_type text not null,
  custom_label text not null,
  display_order integer not null,
  status public.inspection_result_status not null default 'not_checked',
  suggested_status public.inspection_result_status not null default 'not_checked',
  observation text,
  observation_client_visible boolean not null default false,
  recommendation text,
  recommendation_client_visible boolean not null default false,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint inspection_areas_order_check check (display_order >= 0),
  constraint inspection_areas_snapshot_unique unique (inspection_id, source_property_area_id)
);

create table public.inspection_items (
  id uuid primary key default extensions.gen_random_uuid(),
  inspection_id uuid not null references public.inspections(id) on delete restrict,
  inspection_area_id uuid not null references public.inspection_areas(id) on delete restrict,
  source_template_item_id uuid references public.inspection_template_items(id) on delete set null,
  label text not null,
  guidance text,
  display_order integer not null,
  required boolean not null default true,
  status public.inspection_result_status not null default 'not_checked',
  observation text,
  observation_client_visible boolean not null default false,
  recommendation text,
  recommendation_client_visible boolean not null default false,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint inspection_items_order_check check (display_order >= 0),
  constraint inspection_items_snapshot_unique unique (inspection_area_id, source_template_item_id)
);

create table public.inspection_photos (
  id uuid primary key default extensions.gen_random_uuid(),
  inspection_id uuid not null references public.inspections(id) on delete restrict,
  inspection_area_id uuid not null references public.inspection_areas(id) on delete restrict,
  inspection_item_id uuid references public.inspection_items(id) on delete restrict,
  storage_path text not null unique,
  caption text,
  display_order integer not null default 0,
  client_visible boolean not null default false,
  rejected_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint inspection_photos_order_check check (display_order >= 0)
);

create table public.inspection_access_tokens (
  id uuid primary key default extensions.gen_random_uuid(),
  inspection_id uuid not null references public.inspections(id) on delete restrict,
  token_hash bytea not null unique,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  last_used_at timestamptz,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint inspection_access_tokens_expiry_check check (expires_at > created_at)
);

create index property_areas_property_order_idx on public.property_areas (property_id, active, display_order);
create index inspection_template_items_template_idx on public.inspection_template_items (template_id, active, area_type, display_order);
create index inspections_property_date_idx on public.inspections (property_id, scheduled_for desc);
create index inspections_inspector_date_idx on public.inspections (inspector_staff_id, scheduled_for desc);
create index inspections_status_date_idx on public.inspections (status, scheduled_for desc);
create index inspection_areas_inspection_order_idx on public.inspection_areas (inspection_id, display_order);
create index inspection_items_inspection_area_idx on public.inspection_items (inspection_id, inspection_area_id, display_order);
create index inspection_photos_inspection_idx on public.inspection_photos (inspection_id, inspection_area_id, display_order);
create index inspection_tokens_inspection_idx on public.inspection_access_tokens (inspection_id, revoked_at, expires_at);

create trigger property_areas_set_updated_at before update on public.property_areas
for each row execute function private.set_updated_at();
create trigger inspection_templates_set_updated_at before update on public.inspection_templates
for each row execute function private.set_updated_at();
create trigger inspection_template_items_set_updated_at before update on public.inspection_template_items
for each row execute function private.set_updated_at();
create trigger inspections_set_updated_at before update on public.inspections
for each row execute function private.set_updated_at();
create trigger inspection_areas_set_updated_at before update on public.inspection_areas
for each row execute function private.set_updated_at();
create trigger inspection_items_set_updated_at before update on public.inspection_items
for each row execute function private.set_updated_at();
create trigger inspection_photos_set_updated_at before update on public.inspection_photos
for each row execute function private.set_updated_at();

alter table public.property_areas enable row level security;
alter table public.inspection_templates enable row level security;
alter table public.inspection_template_items enable row level security;
alter table public.inspections enable row level security;
alter table public.inspection_areas enable row level security;
alter table public.inspection_items enable row level security;
alter table public.inspection_photos enable row level security;
alter table public.inspection_access_tokens enable row level security;

create function private.customer_has_property_access(property_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.property_users pu
    where pu.property_id = property_uuid and pu.user_id = auth.uid()
  );
$$;

create function private.field_access_allows(inspection_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.inspection_access_tokens token
    join public.inspections inspection on inspection.id = token.inspection_id
    where token.id = nullif(auth.jwt() ->> 'inspection_access_id', '')::uuid
      and token.inspection_id = inspection_uuid
      and token.revoked_at is null
      and token.expires_at > now()
      and inspection.status in ('scheduled', 'in_progress')
  );
$$;

create function private.storage_inspection_id(object_name text)
returns uuid
language plpgsql
immutable
set search_path = ''
as $$
begin
  return (storage.foldername(object_name))[2]::uuid;
exception when others then
  return null;
end;
$$;

create policy property_areas_staff_all on public.property_areas
for all to authenticated using (private.is_staff()) with check (private.is_staff());

create policy templates_staff_select on public.inspection_templates
for select to authenticated using (private.is_staff());
create policy templates_admin_write on public.inspection_templates
for all to authenticated using (private.is_admin()) with check (private.is_admin());

create policy template_items_staff_select on public.inspection_template_items
for select to authenticated using (private.is_staff());
create policy template_items_admin_write on public.inspection_template_items
for all to authenticated using (private.is_admin()) with check (private.is_admin());

create policy inspections_staff_select on public.inspections
for select to authenticated using (private.is_staff());
create policy inspections_staff_write on public.inspections
for all to authenticated using (private.is_staff()) with check (private.is_staff());
create policy inspections_customer_published_select on public.inspections
for select to authenticated using (status = 'published' and private.customer_has_property_access(property_id));

create policy inspection_areas_staff_all on public.inspection_areas
for all to authenticated using (private.is_staff()) with check (private.is_staff());
create policy inspection_areas_customer_published_select on public.inspection_areas
for select to authenticated using (exists (
  select 1 from public.inspections inspection
  where inspection.id = inspection_id
    and inspection.status = 'published'
    and private.customer_has_property_access(inspection.property_id)
));

create policy inspection_items_staff_all on public.inspection_items
for all to authenticated using (private.is_staff()) with check (private.is_staff());
create policy inspection_items_customer_published_select on public.inspection_items
for select to authenticated using (exists (
  select 1 from public.inspections inspection
  where inspection.id = inspection_id
    and inspection.status = 'published'
    and private.customer_has_property_access(inspection.property_id)
));

create policy inspection_photos_staff_all on public.inspection_photos
for all to authenticated using (private.is_staff()) with check (private.is_staff());
create policy inspection_photos_customer_published_select on public.inspection_photos
for select to authenticated using (client_visible and rejected_at is null and exists (
  select 1 from public.inspections inspection
  where inspection.id = inspection_id
    and inspection.status = 'published'
    and private.customer_has_property_access(inspection.property_id)
));

create policy inspection_tokens_admin_all on public.inspection_access_tokens
for all to authenticated using (private.is_admin()) with check (private.is_admin());

revoke all on public.property_areas, public.inspection_templates, public.inspection_template_items,
  public.inspections, public.inspection_areas, public.inspection_items, public.inspection_photos,
  public.inspection_access_tokens from public, anon, authenticated;
grant select, insert, update on public.property_areas to authenticated;
grant select, insert, update on public.inspection_templates, public.inspection_template_items to authenticated;
grant select, insert, update on public.inspections, public.inspection_areas, public.inspection_items, public.inspection_photos to authenticated;
grant select, insert, update on public.inspection_access_tokens to authenticated;

create function private.require_valid_inspection_token(token_hash_hex text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare inspection_uuid uuid;
begin
  select token.inspection_id into inspection_uuid
  from public.inspection_access_tokens token
  join public.inspections inspection on inspection.id = token.inspection_id
  where token.token_hash = decode(token_hash_hex, 'hex')
    and token.revoked_at is null
    and token.expires_at > now()
    and inspection.status in ('scheduled', 'in_progress');

  if inspection_uuid is null then
    raise exception 'Invalid or expired inspection access' using errcode = '42501';
  end if;

  update public.inspection_access_tokens
  set last_used_at = now()
  where token_hash = decode(token_hash_hex, 'hex');

  return inspection_uuid;
end;
$$;

create function private.refresh_inspection_suggestions(inspection_uuid uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.inspection_areas area
  set suggested_status = coalesce((
    select case
      when bool_or(item.status = 'urgent') then 'urgent'::public.inspection_result_status
      when bool_or(item.status = 'attention') then 'attention'::public.inspection_result_status
      when bool_or(item.status = 'not_checked') then 'not_checked'::public.inspection_result_status
      when bool_and(item.status = 'not_applicable') then 'not_applicable'::public.inspection_result_status
      else 'good'::public.inspection_result_status
    end
    from public.inspection_items item where item.inspection_area_id = area.id
  ), 'not_checked'::public.inspection_result_status)
  where area.inspection_id = inspection_uuid;

  update public.inspections inspection
  set suggested_condition = (
    select case
      when bool_or(coalesce(nullif(area.status, 'not_checked'), area.suggested_status) = 'urgent') then 'urgent'::public.inspection_condition
      when bool_or(coalesce(nullif(area.status, 'not_checked'), area.suggested_status) = 'attention') then 'attention'::public.inspection_condition
      else 'good'::public.inspection_condition
    end
    from public.inspection_areas area where area.inspection_id = inspection_uuid
  )
  where inspection.id = inspection_uuid;
end;
$$;

create function public.create_staff_profile(staff_data jsonb)
returns public.staff_profiles
language plpgsql
security definer
set search_path = ''
as $$
declare created public.staff_profiles;
begin
  perform private.require_staff();
  if not private.is_admin() then raise exception 'Administrator access required' using errcode = '42501'; end if;

  insert into public.staff_profiles (
    first_name, last_name, display_name, role_title, email, phone,
    active, show_on_client_reports, internal_notes
  ) values (
    trim(staff_data ->> 'firstName'), trim(staff_data ->> 'lastName'),
    coalesce(nullif(trim(staff_data ->> 'displayName'), ''), trim(concat_ws(' ', staff_data ->> 'firstName', staff_data ->> 'lastName'))),
    trim(staff_data ->> 'roleTitle'), nullif(trim(staff_data ->> 'email'), ''),
    nullif(trim(staff_data ->> 'phone'), ''), coalesce((staff_data ->> 'active')::boolean, true),
    coalesce((staff_data ->> 'showOnClientReports')::boolean, true), nullif(trim(staff_data ->> 'internalNotes'), '')
  ) returning * into created;

  insert into public.audit_events(actor_user_id, event_type, entity_type, entity_id)
  values (auth.uid(), 'staff_created', 'staff_profile', created.id);
  return created;
end;
$$;

create function public.update_staff_profile(staff_uuid uuid, staff_data jsonb)
returns public.staff_profiles
language plpgsql
security definer
set search_path = ''
as $$
declare updated public.staff_profiles;
begin
  if not private.is_admin() then raise exception 'Administrator access required' using errcode = '42501'; end if;
  update public.staff_profiles set
    first_name = coalesce(nullif(trim(staff_data ->> 'firstName'), ''), first_name),
    last_name = coalesce(nullif(trim(staff_data ->> 'lastName'), ''), last_name),
    display_name = coalesce(nullif(trim(staff_data ->> 'displayName'), ''), display_name),
    role_title = coalesce(nullif(trim(staff_data ->> 'roleTitle'), ''), role_title),
    email = case when staff_data ? 'email' then nullif(trim(staff_data ->> 'email'), '') else email end,
    phone = case when staff_data ? 'phone' then nullif(trim(staff_data ->> 'phone'), '') else phone end,
    active = coalesce((staff_data ->> 'active')::boolean, active),
    show_on_client_reports = coalesce((staff_data ->> 'showOnClientReports')::boolean, show_on_client_reports),
    internal_notes = case when staff_data ? 'internalNotes' then nullif(trim(staff_data ->> 'internalNotes'), '') else internal_notes end,
    profile_photo_path = case when staff_data ? 'profilePhotoPath' then nullif(trim(staff_data ->> 'profilePhotoPath'), '') else profile_photo_path end
  where id = staff_uuid returning * into updated;
  if updated.id is null then raise exception 'Staff profile not found'; end if;
  insert into public.audit_events(actor_user_id, event_type, entity_type, entity_id)
  values (auth.uid(), 'staff_updated', 'staff_profile', updated.id);
  return updated;
end;
$$;

create function public.list_admin_team()
returns setof public.staff_profiles
language sql
stable
security definer
set search_path = ''
as $$
  select staff.* from public.staff_profiles staff
  where private.is_staff()
  order by staff.active desc, staff.display_name;
$$;

create function public.get_admin_team_member(staff_uuid uuid)
returns public.staff_profiles
language sql
stable
security definer
set search_path = ''
as $$
  select staff.* from public.staff_profiles staff
  where private.is_staff() and staff.id = staff_uuid;
$$;

create function public.save_property_area(area_data jsonb)
returns public.property_areas
language plpgsql
security definer
set search_path = ''
as $$
declare saved public.property_areas;
declare target_id uuid := nullif(area_data ->> 'id', '')::uuid;
declare event_name text;
begin
  if not private.is_admin() then raise exception 'Administrator access required' using errcode = '42501'; end if;
  if target_id is null then
    insert into public.property_areas(property_id, area_type, custom_label, display_order, internal_notes)
    values ((area_data ->> 'propertyId')::uuid, trim(area_data ->> 'areaType'), trim(area_data ->> 'customLabel'),
      coalesce((area_data ->> 'displayOrder')::integer, 0), nullif(trim(area_data ->> 'internalNotes'), ''))
    returning * into saved;
    event_name := 'property_area_created';
  else
    update public.property_areas set
      area_type = coalesce(nullif(trim(area_data ->> 'areaType'), ''), area_type),
      custom_label = coalesce(nullif(trim(area_data ->> 'customLabel'), ''), custom_label),
      display_order = coalesce((area_data ->> 'displayOrder')::integer, display_order),
      active = coalesce((area_data ->> 'active')::boolean, active),
      internal_notes = case when area_data ? 'internalNotes' then nullif(trim(area_data ->> 'internalNotes'), '') else internal_notes end
    where id = target_id returning * into saved;
    event_name := case when saved.active then 'property_area_updated' else 'property_area_archived' end;
  end if;
  if saved.id is null then raise exception 'Property area not found'; end if;
  insert into public.audit_events(actor_user_id, event_type, entity_type, entity_id, metadata)
  values (auth.uid(), event_name, 'property_area', saved.id, jsonb_build_object('property_id', saved.property_id));
  return saved;
end;
$$;

create function public.reorder_property_areas(property_uuid uuid, ordered_ids uuid[])
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_admin() then raise exception 'Administrator access required' using errcode = '42501'; end if;
  if exists (select 1 from unnest(ordered_ids) id left join public.property_areas area on area.id = id and area.property_id = property_uuid where area.id is null) then
    raise exception 'Invalid property area order';
  end if;
  update public.property_areas area set display_order = ordering.position - 1
  from unnest(ordered_ids) with ordinality ordering(id, position)
  where area.id = ordering.id and area.property_id = property_uuid;
  return true;
end;
$$;

create function public.get_property_inspection_operations(property_uuid uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case when private.is_staff() then jsonb_build_object(
    'areas', coalesce((select jsonb_agg(to_jsonb(area) order by area.display_order) from public.property_areas area where area.property_id = property_uuid), '[]'::jsonb),
    'inspections', coalesce((select jsonb_agg(jsonb_build_object(
      'id', inspection.id, 'scheduled_for', inspection.scheduled_for, 'status', inspection.status,
      'condition', coalesce(inspection.final_condition, inspection.suggested_condition),
      'inspector_name', staff.display_name
    ) order by inspection.scheduled_for desc) from public.inspections inspection join public.staff_profiles staff on staff.id = inspection.inspector_staff_id where inspection.property_id = property_uuid), '[]'::jsonb)
  ) else null end;
$$;

create function public.list_inspection_templates()
returns table(id uuid, name text, description text, version integer)
language sql
stable
security definer
set search_path = ''
as $$ select template.id, template.name, template.description, template.version from public.inspection_templates template where private.is_staff() and template.active order by template.name; $$;

create function public.create_inspection(inspection_data jsonb)
returns public.inspections
language plpgsql
security definer
set search_path = ''
as $$
declare created public.inspections;
begin
  perform private.require_staff();
  insert into public.inspections(property_id, template_id, inspector_staff_id, status, scheduled_for, idempotency_key, created_by)
  values ((inspection_data ->> 'propertyId')::uuid, (inspection_data ->> 'templateId')::uuid,
    (inspection_data ->> 'inspectorStaffId')::uuid, 'scheduled', (inspection_data ->> 'scheduledFor')::timestamptz,
    (inspection_data ->> 'idempotencyKey')::uuid, auth.uid())
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
      jsonb_build_object('property_id', created.property_id, 'inspector_staff_id', created.inspector_staff_id));
  end if;
  return created;
end;
$$;

create function public.list_admin_inspections(filters jsonb default '{}'::jsonb)
returns table(id uuid, scheduled_for timestamptz, property_id uuid, property_name text, locality text, inspector_staff_id uuid, inspector_name text, status public.inspection_lifecycle_status, condition public.inspection_condition)
language sql
stable
security definer
set search_path = ''
as $$
  select inspection.id, inspection.scheduled_for, property.id, property.display_name, property.locality,
    staff.id, staff.display_name, inspection.status, coalesce(inspection.final_condition, inspection.suggested_condition)
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

create function public.get_admin_inspection(inspection_uuid uuid)
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
      'inspector_staff_id', staff.id, 'inspector_name', staff.display_name
    ),
    'areas', coalesce((select jsonb_agg(jsonb_build_object(
      'id', area.id, 'area_type', area.area_type, 'custom_label', area.custom_label, 'display_order', area.display_order,
      'status', area.status, 'suggested_status', area.suggested_status, 'observation', area.observation,
      'observation_client_visible', area.observation_client_visible, 'recommendation', area.recommendation,
      'recommendation_client_visible', area.recommendation_client_visible,
      'items', coalesce((select jsonb_agg(to_jsonb(item) order by item.display_order) from public.inspection_items item where item.inspection_area_id = area.id), '[]'::jsonb),
      'photos', coalesce((select jsonb_agg(to_jsonb(photo) order by photo.display_order) from public.inspection_photos photo where photo.inspection_area_id = area.id and photo.rejected_at is null), '[]'::jsonb)
    ) order by area.display_order) from public.inspection_areas area where area.inspection_id = inspection.id), '[]'::jsonb)
  ) else null end
  from public.inspections inspection
  join public.properties property on property.id = inspection.property_id
  join public.staff_profiles staff on staff.id = inspection.inspector_staff_id
  where inspection.id = inspection_uuid;
$$;

create function public.generate_inspection_access(inspection_uuid uuid, token_hash_hex text, expiry timestamptz)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare token_id uuid;
begin
  if not private.is_admin() then raise exception 'Administrator access required' using errcode = '42501'; end if;
  if expiry <= now() or expiry > now() + interval '30 days' then raise exception 'Invalid token expiry'; end if;
  if not exists (select 1 from public.inspections where id = inspection_uuid and status in ('scheduled', 'in_progress')) then raise exception 'Inspection cannot accept a field link'; end if;
  update public.inspection_access_tokens set revoked_at = now() where inspection_id = inspection_uuid and revoked_at is null;
  insert into public.inspection_access_tokens(inspection_id, token_hash, expires_at, created_by)
  values (inspection_uuid, decode(token_hash_hex, 'hex'), expiry, auth.uid()) returning id into token_id;
  insert into public.audit_events(actor_user_id, event_type, entity_type, entity_id)
  values (auth.uid(), 'inspection_link_generated', 'inspection', inspection_uuid);
  return token_id;
end;
$$;

create function public.revoke_inspection_access(inspection_uuid uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_admin() then raise exception 'Administrator access required' using errcode = '42501'; end if;
  update public.inspection_access_tokens set revoked_at = now() where inspection_id = inspection_uuid and revoked_at is null;
  insert into public.audit_events(actor_user_id, event_type, entity_type, entity_id)
  values (auth.uid(), 'inspection_link_revoked', 'inspection', inspection_uuid);
  return true;
end;
$$;

create function public.get_field_inspection(token_hash_hex text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare inspection_uuid uuid := private.require_valid_inspection_token(token_hash_hex);
begin
  return (
    select jsonb_build_object(
      'access_id', (select token.id from public.inspection_access_tokens token where token.token_hash = decode(token_hash_hex, 'hex')),
      'inspection', jsonb_build_object('id', inspection.id, 'status', inspection.status, 'scheduled_for', inspection.scheduled_for,
        'property_id', property.id,
        'property_name', property.display_name, 'locality', property.locality, 'inspector_name', staff.display_name),
      'areas', coalesce((select jsonb_agg(jsonb_build_object(
        'id', area.id, 'area_type', area.area_type, 'custom_label', area.custom_label, 'display_order', area.display_order,
        'status', area.status, 'suggested_status', area.suggested_status, 'observation', area.observation,
        'recommendation', area.recommendation,
        'items', coalesce((select jsonb_agg(jsonb_build_object('id', item.id, 'label', item.label, 'guidance', item.guidance,
          'display_order', item.display_order, 'required', item.required, 'status', item.status, 'observation', item.observation,
          'recommendation', item.recommendation, 'updated_at', item.updated_at) order by item.display_order)
          from public.inspection_items item where item.inspection_area_id = area.id), '[]'::jsonb),
        'photos', coalesce((select jsonb_agg(jsonb_build_object('id', photo.id, 'inspection_item_id', photo.inspection_item_id,
          'storage_path', photo.storage_path, 'caption', photo.caption, 'display_order', photo.display_order) order by photo.display_order)
          from public.inspection_photos photo where photo.inspection_area_id = area.id and photo.rejected_at is null), '[]'::jsonb)
      ) order by area.display_order) from public.inspection_areas area where area.inspection_id = inspection.id), '[]'::jsonb)
    )
    from public.inspections inspection
    join public.properties property on property.id = inspection.property_id
    join public.staff_profiles staff on staff.id = inspection.inspector_staff_id
    where inspection.id = inspection_uuid
  );
end;
$$;

create function public.update_field_item(token_hash_hex text, item_uuid uuid, item_data jsonb)
returns public.inspection_items
language plpgsql
security definer
set search_path = ''
as $$
declare inspection_uuid uuid := private.require_valid_inspection_token(token_hash_hex);
declare saved public.inspection_items;
begin
  update public.inspection_items set
    status = coalesce((item_data ->> 'status')::public.inspection_result_status, status),
    observation = case when item_data ? 'observation' then nullif(trim(item_data ->> 'observation'), '') else observation end,
    recommendation = case when item_data ? 'recommendation' then nullif(trim(item_data ->> 'recommendation'), '') else recommendation end
  where id = item_uuid and inspection_id = inspection_uuid returning * into saved;
  if saved.id is null then raise exception 'Inspection item not found' using errcode = '42501'; end if;
  update public.inspections set status = 'in_progress', started_at = coalesce(started_at, now()) where id = inspection_uuid and status = 'scheduled';
  perform private.refresh_inspection_suggestions(inspection_uuid);
  return saved;
end;
$$;

create function public.update_field_area(token_hash_hex text, area_uuid uuid, area_data jsonb)
returns public.inspection_areas
language plpgsql
security definer
set search_path = ''
as $$
declare inspection_uuid uuid := private.require_valid_inspection_token(token_hash_hex);
declare saved public.inspection_areas;
begin
  update public.inspection_areas set
    status = coalesce((area_data ->> 'status')::public.inspection_result_status, status),
    observation = case when area_data ? 'observation' then nullif(trim(area_data ->> 'observation'), '') else observation end,
    recommendation = case when area_data ? 'recommendation' then nullif(trim(area_data ->> 'recommendation'), '') else recommendation end
  where id = area_uuid and inspection_id = inspection_uuid returning * into saved;
  if saved.id is null then raise exception 'Inspection area not found' using errcode = '42501'; end if;
  update public.inspections set status = 'in_progress', started_at = coalesce(started_at, now()) where id = inspection_uuid and status = 'scheduled';
  perform private.refresh_inspection_suggestions(inspection_uuid);
  return saved;
end;
$$;

create function public.complete_field_inspection(token_hash_hex text, allow_incomplete boolean default false)
returns public.inspections
language plpgsql
security definer
set search_path = ''
as $$
declare inspection_uuid uuid := private.require_valid_inspection_token(token_hash_hex);
declare completed public.inspections;
begin
  if not allow_incomplete and exists (select 1 from public.inspection_items where inspection_id = inspection_uuid and required and status = 'not_checked') then
    raise exception 'Required checklist items remain unanswered';
  end if;
  perform private.refresh_inspection_suggestions(inspection_uuid);
  update public.inspections set status = 'awaiting_review', completed_at = now()
  where id = inspection_uuid returning * into completed;
  update public.inspection_access_tokens set revoked_at = now() where inspection_id = inspection_uuid and revoked_at is null;
  insert into public.audit_events(event_type, entity_type, entity_id, metadata)
  values ('inspection_completed', 'inspection', inspection_uuid, jsonb_build_object('token_access', true));
  return completed;
end;
$$;

create function public.update_admin_inspection_area(area_uuid uuid, area_data jsonb)
returns public.inspection_areas
language plpgsql
security definer
set search_path = ''
as $$
declare saved public.inspection_areas;
begin
  perform private.require_staff();
  update public.inspection_areas set
    status = coalesce((area_data ->> 'status')::public.inspection_result_status, status),
    observation = case when area_data ? 'observation' then nullif(trim(area_data ->> 'observation'), '') else observation end,
    observation_client_visible = coalesce((area_data ->> 'observationClientVisible')::boolean, observation_client_visible),
    recommendation = case when area_data ? 'recommendation' then nullif(trim(area_data ->> 'recommendation'), '') else recommendation end,
    recommendation_client_visible = coalesce((area_data ->> 'recommendationClientVisible')::boolean, recommendation_client_visible),
    updated_by = auth.uid()
  where id = area_uuid and exists (select 1 from public.inspections i where i.id = inspection_id and i.status <> 'published')
  returning * into saved;
  if saved.id is null then raise exception 'Area is not editable'; end if;
  perform private.refresh_inspection_suggestions(saved.inspection_id);
  return saved;
end;
$$;

create function public.update_admin_inspection_item(item_uuid uuid, item_data jsonb)
returns public.inspection_items
language plpgsql
security definer
set search_path = ''
as $$
declare saved public.inspection_items;
begin
  perform private.require_staff();
  update public.inspection_items set
    status = coalesce((item_data ->> 'status')::public.inspection_result_status, status),
    observation = case when item_data ? 'observation' then nullif(trim(item_data ->> 'observation'), '') else observation end,
    observation_client_visible = coalesce((item_data ->> 'observationClientVisible')::boolean, observation_client_visible),
    recommendation = case when item_data ? 'recommendation' then nullif(trim(item_data ->> 'recommendation'), '') else recommendation end,
    recommendation_client_visible = coalesce((item_data ->> 'recommendationClientVisible')::boolean, recommendation_client_visible),
    updated_by = auth.uid()
  where id = item_uuid and exists (select 1 from public.inspections i where i.id = inspection_id and i.status <> 'published')
  returning * into saved;
  if saved.id is null then raise exception 'Item is not editable'; end if;
  perform private.refresh_inspection_suggestions(saved.inspection_id);
  return saved;
end;
$$;

create function public.update_admin_inspection_review(inspection_uuid uuid, review_data jsonb)
returns public.inspections
language plpgsql
security definer
set search_path = ''
as $$
declare saved public.inspections;
begin
  perform private.require_staff();
  update public.inspections set
    final_condition = coalesce((review_data ->> 'finalCondition')::public.inspection_condition, final_condition),
    client_summary = case when review_data ? 'clientSummary' then nullif(trim(review_data ->> 'clientSummary'), '') else client_summary end,
    internal_review_notes = case when review_data ? 'internalReviewNotes' then nullif(trim(review_data ->> 'internalReviewNotes'), '') else internal_review_notes end,
    reviewed_at = now(), reviewed_by = auth.uid()
  where id = inspection_uuid and status = 'awaiting_review' returning * into saved;
  if saved.id is null then raise exception 'Inspection is not awaiting review'; end if;
  insert into public.audit_events(actor_user_id, event_type, entity_type, entity_id)
  values (auth.uid(), 'inspection_reviewed', 'inspection', inspection_uuid);
  return saved;
end;
$$;

create function private.build_client_inspection_report(inspection_uuid uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', inspection.id, 'scheduled_for', inspection.scheduled_for, 'published_at', inspection.published_at,
    'property', jsonb_build_object('id', property.id, 'display_name', property.display_name, 'locality', property.locality),
    'overall_condition', coalesce(inspection.final_condition, inspection.suggested_condition),
    'client_summary', inspection.client_summary,
    'inspector', case when staff.show_on_client_reports then jsonb_build_object('display_name', staff.display_name, 'role_title', staff.role_title, 'profile_photo_path', staff.profile_photo_path) else null end,
    'areas', coalesce((select jsonb_agg(jsonb_build_object(
      'id', area.id, 'area_type', area.area_type, 'custom_label', area.custom_label, 'display_order', area.display_order,
      'status', case when area.status = 'not_checked' then area.suggested_status else area.status end,
      'observation', case when area.observation_client_visible then area.observation else null end,
      'recommendation', case when area.recommendation_client_visible then area.recommendation else null end,
      'items', coalesce((select jsonb_agg(jsonb_build_object('id', item.id, 'label', item.label, 'status', item.status,
        'observation', case when item.observation_client_visible then item.observation else null end,
        'recommendation', case when item.recommendation_client_visible then item.recommendation else null end) order by item.display_order)
        from public.inspection_items item where item.inspection_area_id = area.id), '[]'::jsonb),
      'photos', coalesce((select jsonb_agg(jsonb_build_object('id', photo.id, 'storage_path', photo.storage_path, 'caption', photo.caption) order by photo.display_order)
        from public.inspection_photos photo where photo.inspection_area_id = area.id and photo.client_visible and photo.rejected_at is null), '[]'::jsonb)
    ) order by area.display_order) from public.inspection_areas area where area.inspection_id = inspection.id), '[]'::jsonb)
  )
  from public.inspections inspection
  join public.properties property on property.id = inspection.property_id
  join public.staff_profiles staff on staff.id = inspection.inspector_staff_id
  where inspection.id = inspection_uuid;
$$;

create function public.preview_admin_inspection(inspection_uuid uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_staff();
  return private.build_client_inspection_report(inspection_uuid);
end;
$$;

create function public.publish_admin_inspection(inspection_uuid uuid)
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
  update public.inspections set status = 'published', published_snapshot = snapshot
  where id = inspection_uuid returning * into published;
  insert into public.audit_events(actor_user_id, event_type, entity_type, entity_id)
  values (auth.uid(), 'inspection_published', 'inspection', inspection_uuid);
  return published;
end;
$$;

create function public.list_customer_inspections()
returns table(id uuid, scheduled_for timestamptz, published_at timestamptz, property_name text, locality text, inspector_name text, overall_condition public.inspection_condition)
language sql
stable
security definer
set search_path = ''
as $$
  select inspection.id, inspection.scheduled_for, inspection.published_at,
    inspection.published_snapshot #>> '{property,display_name}', inspection.published_snapshot #>> '{property,locality}',
    inspection.published_snapshot #>> '{inspector,display_name}', inspection.final_condition
  from public.inspections inspection
  where inspection.status = 'published' and private.customer_has_property_access(inspection.property_id)
  order by inspection.scheduled_for desc;
$$;

create function public.get_customer_inspection(inspection_uuid uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select inspection.published_snapshot
  from public.inspections inspection
  where inspection.id = inspection_uuid and inspection.status = 'published'
    and private.customer_has_property_access(inspection.property_id);
$$;

create function public.register_inspection_photo(photo_data jsonb)
returns public.inspection_photos
language plpgsql
security definer
set search_path = ''
as $$
declare saved public.inspection_photos;
declare inspection_uuid uuid := (photo_data ->> 'inspectionId')::uuid;
declare token_hash_hex text := nullif(photo_data ->> 'tokenHash', '');
begin
  if token_hash_hex is not null then
    if private.require_valid_inspection_token(token_hash_hex) <> inspection_uuid then raise exception 'Invalid inspection access' using errcode = '42501'; end if;
  elsif not private.is_staff() then
    raise exception 'Staff access required' using errcode = '42501';
  end if;
  insert into public.inspection_photos(inspection_id, inspection_area_id, inspection_item_id, storage_path, caption, display_order, created_by)
  select inspection_uuid, (photo_data ->> 'inspectionAreaId')::uuid, nullif(photo_data ->> 'inspectionItemId', '')::uuid,
    photo_data ->> 'storagePath', nullif(trim(photo_data ->> 'caption'), ''), coalesce((photo_data ->> 'displayOrder')::integer, 0),
    case when token_hash_hex is null then auth.uid() else null end
  where exists (select 1 from public.inspection_areas area where area.id = (photo_data ->> 'inspectionAreaId')::uuid and area.inspection_id = inspection_uuid)
    and (photo_data ->> 'storagePath') like (
      (select property_id::text from public.inspections where id = inspection_uuid) || '/' || inspection_uuid::text || '/%'
    )
  returning * into saved;
  if saved.id is null then raise exception 'Invalid photo relationship'; end if;
  return saved;
end;
$$;

create function public.update_inspection_photo(photo_uuid uuid, photo_data jsonb)
returns public.inspection_photos
language plpgsql
security definer
set search_path = ''
as $$
declare saved public.inspection_photos;
begin
  perform private.require_staff();
  update public.inspection_photos set
    caption = case when photo_data ? 'caption' then nullif(trim(photo_data ->> 'caption'), '') else caption end,
    display_order = coalesce((photo_data ->> 'displayOrder')::integer, display_order),
    client_visible = coalesce((photo_data ->> 'clientVisible')::boolean, client_visible),
    rejected_at = case when coalesce((photo_data ->> 'rejected')::boolean, false) then now() else rejected_at end
  where id = photo_uuid and exists (select 1 from public.inspections i where i.id = inspection_id and i.status <> 'published')
  returning * into saved;
  if saved.id is null then raise exception 'Photo is not editable'; end if;
  return saved;
end;
$$;

revoke all on function private.customer_has_property_access(uuid), private.field_access_allows(uuid), private.storage_inspection_id(text),
  private.require_valid_inspection_token(text), private.refresh_inspection_suggestions(uuid), private.build_client_inspection_report(uuid) from public, anon, authenticated;
grant execute on function private.customer_has_property_access(uuid), private.field_access_allows(uuid), private.storage_inspection_id(text) to authenticated;

revoke all on function public.create_staff_profile(jsonb), public.update_staff_profile(uuid, jsonb), public.list_admin_team(),
  public.get_admin_team_member(uuid), public.save_property_area(jsonb), public.reorder_property_areas(uuid, uuid[]),
  public.get_property_inspection_operations(uuid), public.list_inspection_templates(), public.create_inspection(jsonb),
  public.list_admin_inspections(jsonb), public.get_admin_inspection(uuid), public.generate_inspection_access(uuid, text, timestamptz),
  public.revoke_inspection_access(uuid), public.update_admin_inspection_area(uuid, jsonb), public.update_admin_inspection_item(uuid, jsonb),
  public.update_admin_inspection_review(uuid, jsonb), public.preview_admin_inspection(uuid), public.publish_admin_inspection(uuid),
  public.list_customer_inspections(), public.get_customer_inspection(uuid), public.register_inspection_photo(jsonb),
  public.update_inspection_photo(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.create_staff_profile(jsonb), public.update_staff_profile(uuid, jsonb), public.list_admin_team(),
  public.get_admin_team_member(uuid), public.save_property_area(jsonb), public.reorder_property_areas(uuid, uuid[]),
  public.get_property_inspection_operations(uuid), public.list_inspection_templates(), public.create_inspection(jsonb),
  public.list_admin_inspections(jsonb), public.get_admin_inspection(uuid), public.generate_inspection_access(uuid, text, timestamptz),
  public.revoke_inspection_access(uuid), public.update_admin_inspection_area(uuid, jsonb), public.update_admin_inspection_item(uuid, jsonb),
  public.update_admin_inspection_review(uuid, jsonb), public.preview_admin_inspection(uuid), public.publish_admin_inspection(uuid),
  public.list_customer_inspections(), public.get_customer_inspection(uuid), public.register_inspection_photo(jsonb),
  public.update_inspection_photo(uuid, jsonb) to authenticated;

revoke all on function public.get_field_inspection(text), public.update_field_item(text, uuid, jsonb),
  public.update_field_area(text, uuid, jsonb), public.complete_field_inspection(text, boolean) from public, anon, authenticated;
grant execute on function public.get_field_inspection(text), public.update_field_item(text, uuid, jsonb),
  public.update_field_area(text, uuid, jsonb), public.complete_field_inspection(text, boolean) to anon, authenticated;
grant execute on function public.register_inspection_photo(jsonb) to anon;

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('inspection-photos', 'inspection-photos', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('staff-photos', 'staff-photos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy inspection_storage_staff_select on storage.objects for select to authenticated
using (bucket_id = 'inspection-photos' and private.is_staff());
create policy inspection_storage_customer_select on storage.objects for select to authenticated
using (bucket_id = 'inspection-photos' and exists (
  select 1 from public.inspection_photos photo
  join public.inspections inspection on inspection.id = photo.inspection_id
  where photo.storage_path = name and photo.client_visible and photo.rejected_at is null
    and inspection.status = 'published' and private.customer_has_property_access(inspection.property_id)
));
create policy inspection_storage_field_select on storage.objects for select to authenticated
using (bucket_id = 'inspection-photos' and private.field_access_allows(private.storage_inspection_id(name)));
create policy inspection_storage_staff_insert on storage.objects for insert to authenticated
with check (bucket_id = 'inspection-photos' and private.is_staff());
create policy inspection_storage_field_insert on storage.objects for insert to authenticated
with check (bucket_id = 'inspection-photos' and private.field_access_allows(private.storage_inspection_id(name)));
create policy inspection_storage_staff_update on storage.objects for update to authenticated
using (bucket_id = 'inspection-photos' and private.is_staff()) with check (bucket_id = 'inspection-photos' and private.is_staff());
create policy inspection_storage_staff_delete on storage.objects for delete to authenticated
using (bucket_id = 'inspection-photos' and private.is_staff());

create policy staff_storage_staff_select on storage.objects for select to authenticated
using (bucket_id = 'staff-photos' and private.is_staff());
create policy staff_storage_customer_select on storage.objects for select to authenticated
using (bucket_id = 'staff-photos' and exists (
  select 1
  from public.staff_profiles staff
  join public.inspections inspection on inspection.inspector_staff_id = staff.id and inspection.status = 'published'
  where staff.profile_photo_path = name and staff.show_on_client_reports
    and private.customer_has_property_access(inspection.property_id)
));
create policy staff_storage_admin_insert on storage.objects for insert to authenticated
with check (bucket_id = 'staff-photos' and private.is_admin());
create policy staff_storage_admin_update on storage.objects for update to authenticated
using (bucket_id = 'staff-photos' and private.is_admin()) with check (bucket_id = 'staff-photos' and private.is_admin());
create policy staff_storage_admin_delete on storage.objects for delete to authenticated
using (bucket_id = 'staff-photos' and private.is_admin());

insert into public.inspection_templates(name, description)
values
  ('Apartment Standard', 'A conservative visual property-care checklist for apartments.'),
  ('Villa Standard', 'A visual property-care checklist for villas and exterior areas.'),
  ('Villa + Pool', 'A villa inspection checklist including visual pool checks.');

insert into public.inspection_template_items(template_id, area_type, label, guidance, display_order)
select template.id, seed.area_type, seed.label, seed.guidance, seed.display_order
from public.inspection_templates template
cross join (values
  (null::text, 'Visible signs of forced entry', 'Visual check only; do not represent as a security certification.', 10),
  (null::text, 'Windows, doors and shutters', 'Check visible condition and closure where agreed.', 20),
  (null::text, 'Visible leaks or moisture', 'Check accessible visible surfaces only.', 30),
  (null::text, 'Unusual odours', null, 40),
  ('Kitchen', 'Under-sink area', 'Check for visible leaks, moisture and pest indicators.', 50),
  ('Kitchen', 'Fridge and freezer indicators', 'Only where included in the agreed service.', 60),
  ('Bathroom', 'Taps, shower and seals', 'Basic visual check.', 50),
  ('Bathroom', 'Toilet and cistern', 'Basic visual check.', 60),
  ('WC', 'Taps and toilet', 'Basic visual check.', 50),
  ('WC', 'Drainage and humidity', 'Visual and odour check.', 60),
  ('Exterior', 'Walls, gates and drainage', 'Ground-level visual inspection only.', 50),
  ('Garden', 'Storm or branch damage', 'Visual check of accessible areas.', 50),
  ('Pool', 'Water appearance and level', 'Visual property-care check, not a pool safety certification.', 50),
  ('Pool', 'Pump indicators and surroundings', 'Visual check only.', 60),
  ('Mail', 'Post and deliveries', 'Record material items requiring attention.', 50)
) as seed(area_type, label, guidance, display_order)
where template.name in ('Apartment Standard', 'Villa Standard', 'Villa + Pool')
  and (template.name <> 'Apartment Standard' or seed.area_type is null or seed.area_type not in ('Exterior', 'Garden', 'Pool'))
  and (template.name <> 'Villa Standard' or seed.area_type <> 'Pool');
