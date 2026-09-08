-- GUARDEMAR mixed inspection media (photos + videos).
-- Apply only to Supabase project ablktbpledjceddessyg.
--
-- Generalises the existing inspection_photos table into one canonical
-- inspection_media table (Option A from the task's architecture audit):
-- table RENAME preserves every existing row, its primary key, its unique
-- storage_path constraint, and every existing storage_path value/URL
-- unchanged -- no data migration, no re-upload, nothing to lose. New
-- columns default so every pre-existing row becomes a normal media_type =
-- 'image' record automatically.
--
-- A maximum of 5 media items (photos and/or videos, any mix) per inspection
-- area is enforced by a BEFORE INSERT trigger that row-locks the area first,
-- so concurrent uploads cannot both slip past the count check and create a
-- 6th item.

-- =====================================================================
-- 0. CORRECTIVE FIX -- unrelated to media, found during this migration's
-- mandatory audit. The baseline-condition migration (20260908090000)
-- redefined create_inspection from a stale, pre-20260904160000 copy of the
-- function body, which silently dropped that migration's zero-area guard
-- ("This property has no inspection areas configured.") and its more
-- careful two-step idempotent-conflict handling. This restores that
-- behaviour, merged with the is_baseline support added since.
-- =====================================================================
create or replace function public.create_inspection(inspection_data jsonb)
returns public.inspections
language plpgsql
security definer
set search_path = ''
as $$
declare created public.inspections;
declare property_uuid uuid := (inspection_data ->> 'propertyId')::uuid;
declare idempotency_uuid uuid := (inspection_data ->> 'idempotencyKey')::uuid;
declare requested_baseline boolean := coalesce((inspection_data ->> 'isBaseline')::boolean, false);
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

  insert into public.inspections(property_id, template_id, inspector_staff_id, status, scheduled_for, idempotency_key, created_by, is_baseline)
  values (property_uuid, (inspection_data ->> 'templateId')::uuid,
    (inspection_data ->> 'inspectorStaffId')::uuid, 'scheduled', (inspection_data ->> 'scheduledFor')::timestamptz,
    idempotency_uuid, auth.uid(), requested_baseline)
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
    jsonb_build_object('property_id', created.property_id, 'inspector_staff_id', created.inspector_staff_id, 'is_baseline', created.is_baseline));

  return created;
end;
$$;

-- =====================================================================
-- 1. TABLE GENERALISATION
-- =====================================================================
create type public.inspection_media_type as enum ('image', 'video');

alter table public.inspection_photos rename to inspection_media;
alter table public.inspection_media rename constraint inspection_photos_pkey to inspection_media_pkey;
alter table public.inspection_media rename constraint inspection_photos_storage_path_key to inspection_media_storage_path_key;
alter table public.inspection_media rename constraint inspection_photos_order_check to inspection_media_order_check;
alter index public.inspection_photos_inspection_idx rename to inspection_media_inspection_idx;
alter trigger inspection_photos_set_updated_at on public.inspection_media rename to inspection_media_set_updated_at;

alter table public.inspection_media
  add column media_type public.inspection_media_type not null default 'image',
  add column original_filename text,
  add column mime_type text,
  add column file_size bigint,
  add column duration_seconds integer,
  add column poster_storage_path text,
  add constraint inspection_media_file_size_check check (file_size is null or file_size > 0),
  add constraint inspection_media_duration_check check (duration_seconds is null or duration_seconds between 1 and 3600),
  add constraint inspection_media_poster_video_only_check check (poster_storage_path is null or media_type = 'video');

comment on table public.inspection_media is 'Photographs and short videos captured during an inspection. Renamed and extended from inspection_photos -- every pre-existing row is media_type=''image'' with its original storage_path unchanged.';
comment on column public.inspection_media.duration_seconds is 'Client-reported at capture time; not independently re-derived server-side (no video-processing pipeline). Not a security control -- the 60s cap is enforced client-side before upload starts, and the max-file-size check is the real server-side backstop.';

-- =====================================================================
-- 2. FIVE-ITEM LIMIT -- server-enforced, concurrency-safe
-- =====================================================================
create function private.enforce_inspection_media_limit()
returns trigger
language plpgsql
set search_path = ''
as $$
declare current_count integer;
begin
  -- Lock the area row first so two concurrent uploads for the same area
  -- serialise here rather than both reading the same count and both
  -- inserting a 6th item.
  perform 1 from public.inspection_areas where id = new.inspection_area_id for update;
  select count(*) into current_count from public.inspection_media
  where inspection_area_id = new.inspection_area_id and rejected_at is null;
  if current_count >= 5 then
    raise exception 'This area already has the maximum of 5 media items.' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger inspection_media_enforce_limit before insert on public.inspection_media
for each row execute function private.enforce_inspection_media_limit();

-- =====================================================================
-- 3. STORAGE -- same bucket (id kept as 'inspection-photos' so every
-- existing storage_path/URL keeps resolving), widened for video.
-- =====================================================================
insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('inspection-photos', 'inspection-photos', false, 104857600, array[
  'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif',
  'video/mp4', 'video/quicktime', 'video/webm'
])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
-- Existing storage RLS policies on storage.objects (staff/field select and
-- all insert/update/delete, all scoped to bucket_id = 'inspection-photos')
-- are untouched and keep applying to the same bucket without modification.
-- Per-type size/mimetype limits (10MB image / 100MB video) are enforced at
-- registration time below, using storage.objects.metadata -- data Supabase
-- itself recorded on upload, not client-supplied values.
--
-- The one customer-facing policy that DOES need updating: a video's poster
-- image is stored at its own object path (inspection_media.poster_storage_path)
-- rather than as its own media row, so the existing match on
-- media.storage_path = name alone would never authorise a customer to view
-- it. This adds that second match, changing nothing else about the policy.
drop policy if exists inspection_storage_customer_select on storage.objects;
create policy inspection_storage_customer_select on storage.objects for select to authenticated
using (bucket_id = 'inspection-photos' and exists (
  select 1 from public.inspection_media media
  join public.inspections inspection on inspection.id = media.inspection_id
  where (media.storage_path = name or media.poster_storage_path = name)
    and media.client_visible
    and media.rejected_at is null
    and inspection.status = 'published'
    and private.customer_inspection_is_available(inspection.published_at)
    and private.customer_has_property_access(inspection.property_id)
));

-- =====================================================================
-- 4. RPCs -- register / update / reorder. Follows the existing dual-path
-- pattern (field token OR staff session) already used by
-- register_inspection_photo.
-- =====================================================================
drop function if exists public.register_inspection_photo(jsonb);
create function public.register_inspection_media(media_data jsonb)
returns public.inspection_media
language plpgsql
security definer
set search_path = ''
as $$
declare saved public.inspection_media;
declare inspection_uuid uuid := (media_data ->> 'inspectionId')::uuid;
declare area_uuid uuid := (media_data ->> 'inspectionAreaId')::uuid;
declare item_uuid uuid := nullif(media_data ->> 'inspectionItemId', '')::uuid;
declare storage_path text := media_data ->> 'storagePath';
declare poster_path text := nullif(media_data ->> 'posterStoragePath', '');
declare token_hash_hex text := nullif(media_data ->> 'tokenHash', '');
declare declared_type text := media_data ->> 'mediaType';
declare property_uuid uuid;
declare object_meta jsonb;
declare object_size bigint;
declare object_mimetype text;
declare max_bytes bigint;
declare allowed_mimetypes text[];
declare duration_input integer := nullif(media_data ->> 'durationSeconds', '')::integer;
begin
  if declared_type not in ('image', 'video') then
    raise exception 'Invalid media type' using errcode = '22023';
  end if;

  if token_hash_hex is not null then
    if private.require_valid_inspection_token(token_hash_hex) <> inspection_uuid then raise exception 'Invalid inspection access' using errcode = '42501'; end if;
  elsif not private.is_staff() then
    raise exception 'Staff access required' using errcode = '42501';
  end if;

  select inspection.property_id into property_uuid
  from public.inspections inspection
  where inspection.id = inspection_uuid;

  max_bytes := case when declared_type = 'video' then 104857600 else 10485760 end;
  allowed_mimetypes := case when declared_type = 'video'
    then array['video/mp4', 'video/quicktime', 'video/webm']
    else array['image/jpeg', 'image/png', 'image/webp'] end;

  if property_uuid is null
    or not exists (select 1 from public.inspection_areas area where area.id = area_uuid and area.inspection_id = inspection_uuid)
    or (item_uuid is not null and not exists (
      select 1 from public.inspection_items item
      where item.id = item_uuid and item.inspection_id = inspection_uuid and item.inspection_area_id = area_uuid
    ))
    or storage_path !~* (
      '^' || property_uuid::text || '/' || inspection_uuid::text || '/' || area_uuid::text ||
      '/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.' ||
      (case when declared_type = 'video' then '(mp4|mov|webm)' else '(jpg|png|webp)' end) || '$'
    )
  then
    raise exception 'Invalid media relationship' using errcode = '42501';
  end if;

  select object.metadata into object_meta from storage.objects object
  where object.bucket_id = 'inspection-photos' and object.name = storage_path;
  if object_meta is null then
    raise exception 'Invalid media relationship' using errcode = '42501';
  end if;
  -- Defense-in-depth only, using data Supabase itself recorded on upload
  -- (not the client-supplied fileSize/mediaType): if the metadata is
  -- present and disagrees with the declared type, reject. The primary,
  -- unconditional server-side guarantees are (a) the existence check above
  -- against the exact validated path, (b) the bucket's own
  -- file_size_limit/allowed_mime_types enforced by Supabase Storage at
  -- upload time, and (c) the content-type allowlist already applied when
  -- the signed upload URL was issued (see inspection-api.mts). So this
  -- check fails safe (skips, rather than blocks every upload) if Supabase's
  -- metadata shape ever differs from what's read here.
  object_size := nullif(object_meta ->> 'size', '')::bigint;
  object_mimetype := coalesce(object_meta ->> 'mimetype', object_meta ->> 'mimeType', object_meta ->> 'contentType');
  if object_size is not null and object_size > max_bytes then
    raise exception 'Invalid media file' using errcode = '22023';
  end if;
  if object_mimetype is not null and not (object_mimetype = any(allowed_mimetypes)) then
    raise exception 'Invalid media file' using errcode = '22023';
  end if;

  if poster_path is not null then
    -- Existence + path-shape are the hard gate (same certainty as the main
    -- media check above). The mimetype/size re-check is defense-in-depth
    -- only and fails safe: an unreadable metadata shape drops the poster
    -- rather than rejecting the whole video registration.
    if declared_type <> 'video'
      or poster_path !~* ('^' || property_uuid::text || '/' || inspection_uuid::text || '/' || area_uuid::text || '/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}-poster\.jpg$')
    then
      raise exception 'Invalid poster image' using errcode = '22023';
    end if;
    select object.metadata into object_meta from storage.objects object
    where object.bucket_id = 'inspection-photos' and object.name = poster_path;
    if object_meta is null then
      poster_path := null;
    else
      object_mimetype := coalesce(object_meta ->> 'mimetype', object_meta ->> 'mimeType', object_meta ->> 'contentType');
      object_size := nullif(object_meta ->> 'size', '')::bigint;
      if (object_mimetype is not null and object_mimetype <> 'image/jpeg') or (object_size is not null and object_size > 2097152) then
        poster_path := null;
      end if;
    end if;
  end if;

  insert into public.inspection_media(
    inspection_id, inspection_area_id, inspection_item_id, media_type, storage_path,
    original_filename, mime_type, file_size, duration_seconds, poster_storage_path,
    caption, display_order, created_by
  )
  values (
    inspection_uuid, area_uuid, item_uuid, declared_type::public.inspection_media_type, storage_path,
    nullif(trim(media_data ->> 'originalFilename'), ''), object_mimetype, object_size,
    case when declared_type = 'video' then nullif(greatest(0, least(coalesce(duration_input, 0), 3600)), 0) else null end,
    poster_path,
    nullif(trim(media_data ->> 'caption'), ''), coalesce((media_data ->> 'displayOrder')::integer, 0),
    case when token_hash_hex is null then auth.uid() else null end
  )
  returning * into saved;

  return saved;
end;
$$;

drop function if exists public.update_inspection_photo(uuid, jsonb);
create function public.update_inspection_media(media_uuid uuid, media_data jsonb)
returns public.inspection_media
language plpgsql
security definer
set search_path = ''
as $$
declare saved public.inspection_media;
declare current_row public.inspection_media;
declare token_hash_hex text := nullif(media_data ->> 'tokenHash', '');
declare is_field boolean := false;
begin
  select * into current_row from public.inspection_media where id = media_uuid;
  if current_row.id is null then raise exception 'Media item not found'; end if;

  if token_hash_hex is not null then
    if private.require_valid_inspection_token(token_hash_hex) <> current_row.inspection_id then raise exception 'Invalid inspection access' using errcode = '42501'; end if;
    is_field := true;
  elsif not private.is_staff() then
    raise exception 'Staff access required' using errcode = '42501';
  end if;

  -- Field workers may caption, reorder and remove their own just-captured
  -- media on site, but client visibility is a deliberate staff review
  -- decision, made only from the desktop review step -- matching the
  -- existing boundary where field registration never sets client_visible.
  if is_field and (media_data ? 'clientVisible') then
    raise exception 'Field access cannot change client visibility' using errcode = '42501';
  end if;

  update public.inspection_media set
    caption = case when media_data ? 'caption' then nullif(trim(media_data ->> 'caption'), '') else caption end,
    display_order = coalesce((media_data ->> 'displayOrder')::integer, display_order),
    client_visible = case when is_field then client_visible else coalesce((media_data ->> 'clientVisible')::boolean, client_visible) end,
    rejected_at = case when coalesce((media_data ->> 'rejected')::boolean, false) then now() else rejected_at end
  where id = media_uuid and exists (select 1 from public.inspections i where i.id = inspection_id and i.status <> 'published')
  returning * into saved;
  if saved.id is null then raise exception 'Media item is not editable'; end if;
  return saved;
end;
$$;

create function public.reorder_inspection_media(area_uuid uuid, ordered_ids uuid[], token_hash text default null)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare inspection_uuid uuid;
begin
  select inspection_id into inspection_uuid from public.inspection_areas where id = area_uuid;
  if inspection_uuid is null then raise exception 'Inspection area not found'; end if;

  if token_hash is not null then
    if private.require_valid_inspection_token(token_hash) <> inspection_uuid then raise exception 'Invalid inspection access' using errcode = '42501'; end if;
  elsif not private.is_staff() then
    raise exception 'Staff access required' using errcode = '42501';
  end if;

  if not exists (select 1 from public.inspections i where i.id = inspection_uuid and i.status <> 'published') then
    raise exception 'This inspection is published and its media order is fixed' using errcode = '42501';
  end if;

  if exists (
    select 1 from unnest(ordered_ids) id
    left join public.inspection_media media on media.id = id and media.inspection_area_id = area_uuid and media.rejected_at is null
    where media.id is null
  ) then
    raise exception 'Invalid media order';
  end if;

  update public.inspection_media media set display_order = ordering.position - 1
  from unnest(ordered_ids) with ordinality ordering(id, position)
  where media.id = ordering.id and media.inspection_area_id = area_uuid;
  return true;
end;
$$;

revoke all on function public.register_inspection_media(jsonb), public.update_inspection_media(uuid, jsonb), public.reorder_inspection_media(uuid, uuid[], text) from public, anon, authenticated;
grant execute on function public.register_inspection_media(jsonb), public.update_inspection_media(uuid, jsonb), public.reorder_inspection_media(uuid, uuid[], text) to authenticated;
grant execute on function public.register_inspection_media(jsonb), public.update_inspection_media(uuid, jsonb), public.reorder_inspection_media(uuid, uuid[], text) to anon;

-- =====================================================================
-- 5. LIVE READ PATHS -- admin detail and field session now expose the full
-- media row (to_jsonb already includes every new column automatically) as
-- 'media' instead of 'photos'.
-- =====================================================================
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
      'media', coalesce((select jsonb_agg(to_jsonb(media) order by media.display_order) from public.inspection_media media where media.inspection_area_id = area.id and media.rejected_at is null), '[]'::jsonb),
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
        'media', coalesce((select jsonb_agg(to_jsonb(media) order by media.display_order)
          from public.inspection_media media where media.inspection_area_id = area.id and media.rejected_at is null), '[]'::jsonb)
      ) order by area.display_order) from public.inspection_areas area where area.inspection_id = inspection.id), '[]'::jsonb)
    )
    from public.inspections inspection
    join public.properties property on property.id = inspection.property_id
    join public.staff_profiles staff on staff.id = inspection.inspector_staff_id
    where inspection.id = inspection_uuid
  );
end;
$$;

-- =====================================================================
-- 6. FROZEN CUSTOMER SNAPSHOT -- only affects future publishes. Reports
-- already published before this migration keep their frozen 'photos' key
-- (image-only shape) exactly as evidence requires; the frontend/PDF/ZIP
-- normalise both shapes (see src/lib/portal/types.ts, mediaForArea).
-- =====================================================================
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
      'media', coalesce((select jsonb_agg(jsonb_build_object(
        'id', media.id,
        'inspection_item_id', media.inspection_item_id,
        'media_type', media.media_type,
        'storage_path', media.storage_path,
        'poster_storage_path', media.poster_storage_path,
        'duration_seconds', media.duration_seconds,
        'caption', media.caption,
        'display_order', media.display_order
      ) order by media.display_order)
        from public.inspection_media media
        where media.inspection_area_id = area.id and media.client_visible and media.rejected_at is null), '[]'::jsonb)
    ) order by area.display_order)
      from public.inspection_areas area where area.inspection_id = inspection.id), '[]'::jsonb)
  )
  from public.inspections inspection
  join public.properties property on property.id = inspection.property_id
  join public.staff_profiles staff on staff.id = inspection.inspector_staff_id
  where inspection.id = inspection_uuid;
$$;
