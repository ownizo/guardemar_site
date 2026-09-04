create or replace function public.register_inspection_photo(photo_data jsonb)
returns public.inspection_photos
language plpgsql
security definer
set search_path = ''
as $$
declare saved public.inspection_photos;
declare inspection_uuid uuid := (photo_data ->> 'inspectionId')::uuid;
declare area_uuid uuid := (photo_data ->> 'inspectionAreaId')::uuid;
declare item_uuid uuid := nullif(photo_data ->> 'inspectionItemId', '')::uuid;
declare storage_path text := photo_data ->> 'storagePath';
declare token_hash_hex text := nullif(photo_data ->> 'tokenHash', '');
declare property_uuid uuid;
begin
  if token_hash_hex is not null then
    if private.require_valid_inspection_token(token_hash_hex) <> inspection_uuid then raise exception 'Invalid inspection access' using errcode = '42501'; end if;
  elsif not private.is_staff() then
    raise exception 'Staff access required' using errcode = '42501';
  end if;

  select inspection.property_id into property_uuid
  from public.inspections inspection
  where inspection.id = inspection_uuid;

  if property_uuid is null
    or not exists (select 1 from public.inspection_areas area where area.id = area_uuid and area.inspection_id = inspection_uuid)
    or (item_uuid is not null and not exists (
      select 1 from public.inspection_items item
      where item.id = item_uuid and item.inspection_id = inspection_uuid and item.inspection_area_id = area_uuid
    ))
    or storage_path !~* (
      '^' || property_uuid::text || '/' || inspection_uuid::text || '/' || area_uuid::text ||
      '/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|png|webp)$'
    )
    or not exists (
      select 1 from storage.objects object
      where object.bucket_id = 'inspection-photos' and object.name = storage_path
    )
  then
    raise exception 'Invalid photo relationship' using errcode = '42501';
  end if;

  insert into public.inspection_photos(inspection_id, inspection_area_id, inspection_item_id, storage_path, caption, display_order, created_by)
  values (
    inspection_uuid,
    area_uuid,
    item_uuid,
    storage_path,
    nullif(trim(photo_data ->> 'caption'), ''),
    coalesce((photo_data ->> 'displayOrder')::integer, 0),
    case when token_hash_hex is null then auth.uid() else null end
  )
  returning * into saved;

  return saved;
end;
$$;
