create or replace function public.upsert_list_place_with_media(
  p_place jsonb,
  p_media jsonb default '[]'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_list_id uuid;
  v_place_id uuid;
begin
  v_list_id := nullif(p_place ->> 'list_id', '')::uuid;
  v_place_id := nullif(p_place ->> 'id', '')::uuid;

  if v_list_id is null or v_place_id is null then
    raise exception 'Invalid place payload' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.lists
    where lists.id = v_list_id
      and lists.owner_id = auth.uid()
  ) then
    raise exception 'List is not writable by the authenticated user' using errcode = '42501';
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
    nullif(p_place ->> 'created_by', '')::uuid,
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
    (p_place ->> 'added_at')::timestamptz,
    (p_place ->> 'updated_at')::timestamptz
  )
  on conflict (id) do update
  set
    created_by = excluded.created_by,
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
    sort_order
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
    (ordinality - 1)::integer
  from jsonb_array_elements(coalesce(p_media, '[]'::jsonb))
    with ordinality as media_items(item, ordinality)
  where nullif(item ->> 'url', '') is not null;
end;
$$;

revoke all on function public.upsert_list_place_with_media(jsonb, jsonb) from public;
grant execute on function public.upsert_list_place_with_media(jsonb, jsonb) to authenticated;
