alter table public.list_place_photos
  add column if not exists storage_bucket text,
  add column if not exists storage_path text,
  add column if not exists asset_owner_id uuid references public.profiles (id) on delete set null,
  add column if not exists asset_state text not null default 'ready',
  add column if not exists uploaded_at timestamptz;

alter table public.list_place_photos
  drop constraint if exists list_place_photos_asset_state_check;
alter table public.list_place_photos
  add constraint list_place_photos_asset_state_check
  check (asset_state in ('pending', 'ready', 'failed'));

alter table public.list_place_photos
  drop constraint if exists list_place_photos_storage_ref_check;
alter table public.list_place_photos
  add constraint list_place_photos_storage_ref_check
  check (
    (storage_bucket is null and storage_path is null)
    or (
      storage_bucket = 'place-media-private'
      and storage_path is not null
      and char_length(storage_path) between 1 and 512
      and storage_path !~ '(^|/)\.\.(/|$)'
    )
  );

create index if not exists idx_list_place_photos_storage_ref
  on public.list_place_photos (storage_bucket, storage_path)
  where storage_bucket is not null and storage_path is not null;

update public.list_place_photos
set
  storage_bucket = 'place-media-private',
  storage_path = substring(url from char_length('sorita-storage://place-media-private/') + 1),
  asset_state = 'ready',
  uploaded_at = coalesce(uploaded_at, created_at, timezone('utc', now()))
where storage_bucket is null
  and url like 'sorita-storage://place-media-private/%';

drop function if exists public.can_read_private_place_media(text, text, uuid);
create function public.can_read_private_place_media(
  p_bucket text,
  p_path text,
  p_viewer_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, private
as $$
  with requested as (
    select
      nullif(trim(coalesce(p_bucket, '')), '') as bucket,
      regexp_replace(trim(coalesce(p_path, '')), '^/+', '') as path
  ),
  media_rows as (
    select
      lists.owner_id,
      lists.is_public,
      list_places.created_by,
      list_places.source_user_id
    from requested
    join public.list_place_photos
      on list_place_photos.asset_state = 'ready'
      and (
        (
          list_place_photos.storage_bucket = requested.bucket
          and list_place_photos.storage_path = requested.path
        )
        or list_place_photos.url = 'sorita-storage://' || requested.bucket || '/' || requested.path
        or list_place_photos.thumbnail_url = 'sorita-storage://' || requested.bucket || '/' || requested.path
      )
    join public.list_places on list_places.id = list_place_photos.list_place_id
    join public.lists on lists.id = list_places.list_id
  )
  select coalesce((
    select case
      when p_viewer_id is null then false
      when requested.bucket <> 'place-media-private' then false
      when requested.path = '' or requested.path !~ '^[a-zA-Z0-9/_.,-]{1,512}$' then false
      when requested.path ~ '(^|/)\.\.(/|$)' then false
      when split_part(requested.path, '/', 1) = p_viewer_id::text then true
      else exists (
        select 1
        from media_rows
        where (media_rows.owner_id = p_viewer_id or media_rows.is_public)
          and (
            media_rows.owner_id = p_viewer_id
            or not private.users_have_block_relation(p_viewer_id, media_rows.owner_id)
          )
          and (
            media_rows.created_by is null
            or media_rows.created_by = p_viewer_id
            or not private.users_have_block_relation(p_viewer_id, media_rows.created_by)
          )
          and (
            media_rows.source_user_id is null
            or media_rows.source_user_id = p_viewer_id
            or not private.users_have_block_relation(p_viewer_id, media_rows.source_user_id)
          )
      )
    end
    from requested
  ), false);
$$;

revoke all on function public.can_read_private_place_media(text, text, uuid) from public;
grant execute on function public.can_read_private_place_media(text, text, uuid) to service_role;

drop function if exists public.upsert_list_place_with_media(jsonb, jsonb);
create function public.upsert_list_place_with_media(
  p_place jsonb,
  p_media jsonb default '[]'::jsonb
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_current_user_id uuid := auth.uid();
  v_list_id uuid;
  v_place_id uuid;
  v_existing_list_id uuid;
  v_media_payload jsonb := coalesce(p_media, '[]'::jsonb);
  v_media_count integer;
  v_video_count integer;
  v_private_storage_prefix constant text := 'sorita-storage://place-media-private/';
  v_expected_storage_prefix text;
begin
  if v_current_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if coalesce(jsonb_typeof(p_place), '') <> 'object' then
    raise exception 'Invalid place payload' using errcode = '22023';
  end if;

  if coalesce(jsonb_typeof(v_media_payload), '') <> 'array' then
    raise exception 'Invalid media payload' using errcode = '22023';
  end if;

  v_list_id := nullif(p_place ->> 'list_id', '')::uuid;
  v_place_id := nullif(p_place ->> 'id', '')::uuid;

  if v_list_id is null or v_place_id is null then
    raise exception 'Invalid place payload' using errcode = '22023';
  end if;

  v_expected_storage_prefix :=
    v_private_storage_prefix || v_current_user_id::text || '/' || v_list_id::text || '/' || v_place_id::text || '/';

  perform 1
  from public.lists
  where lists.id = v_list_id
    and lists.owner_id = v_current_user_id
  for update;

  if not found then
    raise exception 'List is not writable by the authenticated user' using errcode = '42501';
  end if;

  select list_places.list_id
  into v_existing_list_id
  from public.list_places
  where list_places.id = v_place_id
  for update;

  if v_existing_list_id is not null and v_existing_list_id <> v_list_id then
    raise exception 'Place belongs to a different list' using errcode = '42501';
  end if;

  select count(*)
  into v_media_count
  from jsonb_array_elements(v_media_payload) as media_items(item);

  if v_media_count > 6 then
    raise exception 'A place can have at most 6 media items' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(v_media_payload) as media_items(item)
    where jsonb_typeof(item) <> 'object'
      or nullif(item ->> 'url', '') is null
  ) then
    raise exception 'Invalid media payload' using errcode = '22023';
  end if;

  if exists (
    with media_ids as (
      select nullif(item ->> 'id', '') as media_id
      from jsonb_array_elements(v_media_payload) as media_items(item)
      where nullif(item ->> 'id', '') is not null
    )
    select 1
    from media_ids
    group by media_id
    having count(*) > 1
  ) then
    raise exception 'Duplicate media ids are not allowed' using errcode = '22023';
  end if;

  if exists (
    with media_urls as (
      select nullif(item ->> 'url', '') as media_url
      from jsonb_array_elements(v_media_payload) as media_items(item)
      union all
      select nullif(item ->> 'thumbnailUrl', '') as media_url
      from jsonb_array_elements(v_media_payload) as media_items(item)
    )
    select 1
    from media_urls
    where media_url is not null
    group by media_url
    having count(*) > 1
  ) then
    raise exception 'Duplicate media urls are not allowed' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(v_media_payload) as media_items(item)
    where coalesce(nullif(item ->> 'type', ''), 'photo') not in ('photo', 'video')
  ) then
    raise exception 'Invalid media type' using errcode = '22023';
  end if;

  select count(*)
  into v_video_count
  from jsonb_array_elements(v_media_payload) as media_items(item)
  where coalesce(nullif(item ->> 'type', ''), 'photo') = 'video';

  if v_video_count > 2 then
    raise exception 'A place can have at most 2 videos' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(v_media_payload) as media_items(item)
    where nullif(item ->> 'mimeType', '') is not null
      and lower(item ->> 'mimeType') not in (
        'image/heic',
        'image/jpeg',
        'image/png',
        'image/webp',
        'video/3gpp',
        'video/mp4',
        'video/quicktime',
        'video/webm',
        'video/x-m4v'
      )
  ) then
    raise exception 'Unsupported media type' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(v_media_payload) as media_items(item)
    where nullif(item ->> 'mimeType', '') is not null
      and (
        (
          coalesce(nullif(item ->> 'type', ''), 'photo') = 'photo'
          and lower(item ->> 'mimeType') not like 'image/%'
        )
        or (
          coalesce(nullif(item ->> 'type', ''), 'photo') = 'video'
          and lower(item ->> 'mimeType') not like 'video/%'
        )
      )
  ) then
    raise exception 'Media type does not match mime type' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(v_media_payload) as media_items(item)
    where (
        nullif(item ->> 'durationMs', '') is not null
        and (item ->> 'durationMs')::integer <= 0
      )
      or (
        nullif(item ->> 'width', '') is not null
        and (item ->> 'width')::integer <= 0
      )
      or (
        nullif(item ->> 'height', '') is not null
        and (item ->> 'height')::integer <= 0
      )
  ) then
    raise exception 'Invalid media dimensions or duration' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(v_media_payload) as media_items(item)
    cross join lateral (
      values
        (nullif(item ->> 'url', '')),
        (nullif(item ->> 'thumbnailUrl', ''))
    ) as media_refs(value)
    where media_refs.value is not null
      and not (
        media_refs.value like 'http://%'
        or media_refs.value like 'https://%'
        or media_refs.value like v_expected_storage_prefix || '%'
      )
  ) then
    raise exception 'Media storage path is outside the authenticated list scope' using errcode = '42501';
  end if;

  insert into public.list_places (
    id,
    list_id,
    created_by,
    source_list_id,
    source_place_id,
    source_place_name,
    source_user_avatar_url,
    source_user_id,
    source_user_name,
    name,
    title,
    menu_url,
    lat,
    lng,
    address,
    notes,
    rating,
    category,
    categories,
    student_discount,
    price_range,
    price_min,
    price_max,
    best_time,
    best_times,
    atmosphere,
    special_features,
    added_at,
    updated_at
  )
  values (
    v_place_id,
    v_list_id,
    v_current_user_id,
    nullif(p_place ->> 'source_list_id', '')::uuid,
    nullif(p_place ->> 'source_place_id', '')::uuid,
    nullif(p_place ->> 'source_place_name', ''),
    nullif(p_place ->> 'source_user_avatar_url', ''),
    nullif(p_place ->> 'source_user_id', '')::uuid,
    nullif(p_place ->> 'source_user_name', ''),
    nullif(p_place ->> 'name', ''),
    nullif(p_place ->> 'title', ''),
    nullif(p_place ->> 'menu_url', ''),
    (p_place ->> 'lat')::double precision,
    (p_place ->> 'lng')::double precision,
    nullif(p_place ->> 'address', ''),
    nullif(p_place ->> 'notes', ''),
    nullif(p_place ->> 'rating', '')::numeric,
    nullif(p_place ->> 'category', ''),
    coalesce(
      (
        select array_agg(value order by ordinality)
        from jsonb_array_elements_text(coalesce(p_place -> 'categories', '[]'::jsonb))
          with ordinality as items(value, ordinality)
      ),
      '{}'::text[]
    ),
    coalesce((p_place ->> 'student_discount')::boolean, false),
    nullif(p_place ->> 'price_range', '')::integer,
    nullif(p_place ->> 'price_min', '')::integer,
    nullif(p_place ->> 'price_max', '')::integer,
    nullif(p_place ->> 'best_time', ''),
    coalesce(
      (
        select array_agg(value order by ordinality)
        from jsonb_array_elements_text(coalesce(p_place -> 'best_times', '[]'::jsonb))
          with ordinality as items(value, ordinality)
      ),
      '{}'::text[]
    ),
    coalesce(
      (
        select array_agg(value order by ordinality)
        from jsonb_array_elements_text(coalesce(p_place -> 'atmosphere', '[]'::jsonb))
          with ordinality as items(value, ordinality)
      ),
      '{}'::text[]
    ),
    coalesce(
      (
        select array_agg(value order by ordinality)
        from jsonb_array_elements_text(coalesce(p_place -> 'special_features', '[]'::jsonb))
          with ordinality as items(value, ordinality)
      ),
      '{}'::text[]
    ),
    coalesce(nullif(p_place ->> 'added_at', '')::timestamptz, timezone('utc', now())),
    coalesce(nullif(p_place ->> 'updated_at', '')::timestamptz, timezone('utc', now()))
  )
  on conflict (id) do update
  set
    created_by = v_current_user_id,
    source_list_id = excluded.source_list_id,
    source_place_id = excluded.source_place_id,
    source_place_name = excluded.source_place_name,
    source_user_avatar_url = excluded.source_user_avatar_url,
    source_user_id = excluded.source_user_id,
    source_user_name = excluded.source_user_name,
    name = excluded.name,
    title = excluded.title,
    menu_url = excluded.menu_url,
    lat = excluded.lat,
    lng = excluded.lng,
    address = excluded.address,
    notes = excluded.notes,
    rating = excluded.rating,
    category = excluded.category,
    categories = excluded.categories,
    student_discount = excluded.student_discount,
    price_range = excluded.price_range,
    price_min = excluded.price_min,
    price_max = excluded.price_max,
    best_time = excluded.best_time,
    best_times = excluded.best_times,
    atmosphere = excluded.atmosphere,
    special_features = excluded.special_features,
    updated_at = excluded.updated_at;

  delete from public.list_place_photos
  where list_place_id = v_place_id;

  insert into public.list_place_photos (
    id,
    list_place_id,
    url,
    media_type,
    mime_type,
    duration_ms,
    thumbnail_url,
    width,
    height,
    sort_order,
    storage_bucket,
    storage_path,
    asset_owner_id,
    asset_state,
    uploaded_at
  )
  select
    coalesce(nullif(item ->> 'id', '')::uuid, gen_random_uuid()),
    v_place_id,
    item ->> 'url',
    coalesce(nullif(item ->> 'type', ''), 'photo'),
    nullif(item ->> 'mimeType', ''),
    nullif(item ->> 'durationMs', '')::integer,
    nullif(item ->> 'thumbnailUrl', ''),
    nullif(item ->> 'width', '')::integer,
    nullif(item ->> 'height', '')::integer,
    (ordinality - 1)::integer,
    case
      when item ->> 'url' like v_private_storage_prefix || '%' then 'place-media-private'
      else null
    end,
    case
      when item ->> 'url' like v_private_storage_prefix || '%'
        then substring(item ->> 'url' from char_length(v_private_storage_prefix) + 1)
      else null
    end,
    case
      when item ->> 'url' like v_private_storage_prefix || '%' then v_current_user_id
      else null
    end,
    'ready',
    case
      when item ->> 'url' like v_private_storage_prefix || '%' then timezone('utc', now())
      else null
    end
  from jsonb_array_elements(v_media_payload)
    with ordinality as media_items(item, ordinality);
end;
$$;

revoke all on function public.upsert_list_place_with_media(jsonb, jsonb) from public;
grant execute on function public.upsert_list_place_with_media(jsonb, jsonb) to authenticated;
