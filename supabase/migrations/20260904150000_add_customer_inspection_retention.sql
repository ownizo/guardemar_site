-- Customer inspection access remains available for exactly 180 elapsed days
-- from published_at. The boundary is evaluated in PostgreSQL timestamptz/UTC:
-- access is allowed for 4,320 elapsed hours while
-- now() < published_at + interval '4320 hours'.

create or replace function private.customer_inspection_is_available(published_at timestamptz)
returns boolean
language sql
stable
set search_path = ''
as $$
  select published_at is not null and now() < published_at + interval '4320 hours';
$$;

revoke all on function private.customer_inspection_is_available(timestamptz) from public, anon, authenticated;
grant execute on function private.customer_inspection_is_available(timestamptz) to authenticated;

drop policy if exists inspections_customer_published_select on public.inspections;
create policy inspections_customer_available_select on public.inspections
for select to authenticated using (
  status = 'published'
  and private.customer_inspection_is_available(published_at)
  and private.customer_has_property_access(property_id)
);

drop policy if exists inspection_areas_customer_published_select on public.inspection_areas;
create policy inspection_areas_customer_available_select on public.inspection_areas
for select to authenticated using (exists (
  select 1 from public.inspections inspection
  where inspection.id = inspection_id
    and inspection.status = 'published'
    and private.customer_inspection_is_available(inspection.published_at)
    and private.customer_has_property_access(inspection.property_id)
));

drop policy if exists inspection_items_customer_published_select on public.inspection_items;
create policy inspection_items_customer_available_select on public.inspection_items
for select to authenticated using (exists (
  select 1 from public.inspections inspection
  where inspection.id = inspection_id
    and inspection.status = 'published'
    and private.customer_inspection_is_available(inspection.published_at)
    and private.customer_has_property_access(inspection.property_id)
));

drop policy if exists inspection_photos_customer_published_select on public.inspection_photos;
create policy inspection_photos_customer_available_select on public.inspection_photos
for select to authenticated using (
  client_visible
  and rejected_at is null
  and exists (
    select 1 from public.inspections inspection
    where inspection.id = inspection_id
      and inspection.status = 'published'
      and private.customer_inspection_is_available(inspection.published_at)
      and private.customer_has_property_access(inspection.property_id)
  )
);

drop policy if exists inspection_storage_customer_select on storage.objects;
create policy inspection_storage_customer_select on storage.objects for select to authenticated
using (bucket_id = 'inspection-photos' and exists (
  select 1 from public.inspection_photos photo
  join public.inspections inspection on inspection.id = photo.inspection_id
  where photo.storage_path = name
    and photo.client_visible
    and photo.rejected_at is null
    and inspection.status = 'published'
    and private.customer_inspection_is_available(inspection.published_at)
    and private.customer_has_property_access(inspection.property_id)
));

drop policy if exists staff_storage_customer_select on storage.objects;
create policy staff_storage_customer_select on storage.objects for select to authenticated
using (bucket_id = 'staff-photos' and exists (
  select 1
  from public.staff_profiles staff
  join public.inspections inspection on inspection.inspector_staff_id = staff.id
  where staff.profile_photo_path = name
    and staff.show_on_client_reports
    and inspection.status = 'published'
    and private.customer_inspection_is_available(inspection.published_at)
    and private.customer_has_property_access(inspection.property_id)
));

create or replace function private.build_client_inspection_report(inspection_uuid uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', inspection.id,
    'scheduled_for', inspection.scheduled_for,
    'started_at', inspection.started_at,
    'completed_at', inspection.completed_at,
    'published_at', inspection.published_at,
    'property', jsonb_build_object(
      'id', property.id,
      'display_name', property.display_name,
      'address_line_1', property.address_line_1,
      'address_line_2', property.address_line_2,
      'postal_code', property.postal_code,
      'locality', property.locality,
      'municipality', property.municipality,
      'country', property.country
    ),
    'overall_condition', coalesce(inspection.final_condition, inspection.suggested_condition),
    'client_summary', inspection.client_summary,
    'inspector', case when staff.show_on_client_reports then jsonb_build_object(
      'display_name', staff.display_name,
      'role_title', staff.role_title,
      'profile_photo_path', staff.profile_photo_path
    ) else null end,
    'areas', coalesce((select jsonb_agg(jsonb_build_object(
      'id', area.id,
      'area_type', area.area_type,
      'custom_label', area.custom_label,
      'display_order', area.display_order,
      'status', case when area.status = 'not_checked' then area.suggested_status else area.status end,
      'observation', case when area.observation_client_visible then area.observation else null end,
      'recommendation', case when area.recommendation_client_visible then area.recommendation else null end,
      'items', coalesce((select jsonb_agg(jsonb_build_object(
        'id', item.id,
        'label', item.label,
        'display_order', item.display_order,
        'status', item.status,
        'observation', case when item.observation_client_visible then item.observation else null end,
        'recommendation', case when item.recommendation_client_visible then item.recommendation else null end
      ) order by item.display_order)
        from public.inspection_items item where item.inspection_area_id = area.id), '[]'::jsonb),
      'photos', coalesce((select jsonb_agg(jsonb_build_object(
        'id', photo.id,
        'inspection_item_id', photo.inspection_item_id,
        'storage_path', photo.storage_path,
        'caption', photo.caption,
        'display_order', photo.display_order
      ) order by photo.display_order)
        from public.inspection_photos photo
        where photo.inspection_area_id = area.id and photo.client_visible and photo.rejected_at is null), '[]'::jsonb)
    ) order by area.display_order)
      from public.inspection_areas area where area.inspection_id = inspection.id), '[]'::jsonb)
  )
  from public.inspections inspection
  join public.properties property on property.id = inspection.property_id
  join public.staff_profiles staff on staff.id = inspection.inspector_staff_id
  where inspection.id = inspection_uuid;
$$;

drop function if exists public.list_customer_inspections();
create function public.list_customer_inspections()
returns table(
  id uuid,
  scheduled_for timestamptz,
  published_at timestamptz,
  available_until timestamptz,
  is_available boolean,
  days_remaining integer,
  property_name text,
  locality text,
  inspector_name text,
  overall_condition public.inspection_condition
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
    inspection.published_snapshot #>> '{property,display_name}',
    inspection.published_snapshot #>> '{property,locality}',
    inspection.published_snapshot #>> '{inspector,display_name}',
    inspection.final_condition
  from public.inspections inspection
  where inspection.status = 'published'
    and private.customer_has_property_access(inspection.property_id)
  order by inspection.scheduled_for desc;
$$;

create or replace function public.get_customer_inspection(inspection_uuid uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select inspection.published_snapshot || jsonb_build_object(
    'available_until', inspection.published_at + interval '4320 hours',
    'days_remaining', greatest(0, ceil(extract(epoch from ((inspection.published_at + interval '4320 hours') - now())) / 86400))::integer
  )
  from public.inspections inspection
  where inspection.id = inspection_uuid
    and inspection.status = 'published'
    and private.customer_inspection_is_available(inspection.published_at)
    and private.customer_has_property_access(inspection.property_id);
$$;

revoke all on function public.list_customer_inspections(), public.get_customer_inspection(uuid) from public, anon, authenticated;
grant execute on function public.list_customer_inspections(), public.get_customer_inspection(uuid) to authenticated;
