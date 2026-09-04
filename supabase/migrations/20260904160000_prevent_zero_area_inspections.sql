create or replace function public.list_admin_properties()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare result jsonb;
begin
  perform private.require_staff();
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', p.id,
    'displayName', p.display_name,
    'addressLine1', p.address_line_1,
    'locality', p.locality,
    'municipality', p.municipality,
    'propertyType', p.property_type,
    'active', p.active,
    'clientId', c.id,
    'clientName', concat_ws(' ', c.first_name, c.last_name),
    'activeAreaCount', (select count(*) from public.property_areas area where area.property_id = p.id and area.active)
  ) order by p.display_name), '[]'::jsonb) into result
  from public.properties p join public.clients c on c.id = p.client_id;
  return result;
end;
$$;

create or replace function public.create_inspection(inspection_data jsonb)
returns public.inspections
language plpgsql
security definer
set search_path = ''
as $$
declare created public.inspections;
declare property_uuid uuid := (inspection_data ->> 'propertyId')::uuid;
declare idempotency_uuid uuid := (inspection_data ->> 'idempotencyKey')::uuid;
begin
  perform private.require_staff();

  select inspection.* into created
  from public.inspections inspection
  where inspection.created_by = auth.uid() and inspection.idempotency_key = idempotency_uuid;
  if created.id is not null then return created; end if;

  if not exists (
    select 1 from public.property_areas area
    where area.property_id = property_uuid and area.active
  ) then
    raise exception 'This property has no inspection areas configured.' using errcode = 'P0001';
  end if;

  insert into public.inspections(property_id, template_id, inspector_staff_id, status, scheduled_for, idempotency_key, created_by)
  values (property_uuid, (inspection_data ->> 'templateId')::uuid,
    (inspection_data ->> 'inspectorStaffId')::uuid, 'scheduled', (inspection_data ->> 'scheduledFor')::timestamptz,
    idempotency_uuid, auth.uid())
  on conflict (created_by, idempotency_key) do nothing
  returning * into created;

  if created.id is null then
    select inspection.* into created
    from public.inspections inspection
    where inspection.created_by = auth.uid() and inspection.idempotency_key = idempotency_uuid;
    return created;
  end if;

  insert into public.inspection_areas(inspection_id, source_property_area_id, area_type, custom_label, display_order)
  select created.id, area.id, area.area_type, area.custom_label, area.display_order
  from public.property_areas area
  where area.property_id = created.property_id and area.active
  order by area.display_order;

  if not exists (select 1 from public.inspection_areas area where area.inspection_id = created.id) then
    raise exception 'This property has no inspection areas configured.' using errcode = 'P0001';
  end if;

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

  return created;
end;
$$;

create or replace function public.get_field_inspection(token_hash_hex text)
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
      'inspection_setup_complete', exists (select 1 from public.inspection_areas area where area.inspection_id = inspection.id),
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
