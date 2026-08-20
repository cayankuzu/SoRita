-- Cursor-paginated location cards avoid loading and filtering an arbitrary
-- number of complete lists on the client.

create or replace function public.location_place_cards_page(
  p_lat double precision,
  p_lng double precision,
  p_owner_id uuid default null,
  p_place_name text default null,
  p_cursor_updated_at timestamptz default null,
  p_cursor_id uuid default null,
  p_limit integer default 16
)
returns table (
  place_id uuid,
  added_at timestamptz,
  updated_at timestamptz,
  place_name text,
  place_title text,
  menu_url text,
  lat double precision,
  lng double precision,
  address text,
  notes text,
  rating numeric,
  category text,
  categories text[],
  student_discount boolean,
  price_range integer,
  price_min numeric,
  price_max numeric,
  best_time text,
  best_times text[],
  atmosphere text[],
  special_features text[],
  media jsonb,
  like_count bigint,
  comment_count bigint,
  viewer_has_liked boolean,
  list_id uuid,
  list_owner_id uuid,
  list_name text,
  list_description text,
  list_emoji text,
  list_cover_image_url text,
  list_is_public boolean,
  list_created_at timestamptz,
  list_updated_at timestamptz,
  owner_name text,
  owner_username text,
  owner_profile_photo_url text,
  owner_is_public_account boolean,
  has_public_list boolean,
  has_private_list boolean,
  total_count bigint
)
language sql
stable
security invoker
set search_path = pg_catalog, public, private
as $$
  with normalized as (
    select nullif(
      lower(regexp_replace(trim(coalesce(p_place_name, '')), '\s+', ' ', 'g')),
      ''
    ) as place_name
  ),
  location_visibility as (
    select
      coalesce(bool_or(lists.is_public), false) as has_public_list,
      coalesce(bool_or(not lists.is_public), false) as has_private_list
    from public.list_places
    join public.lists on lists.id = list_places.list_id
    where round(list_places.lat::numeric, 5) = round(p_lat::numeric, 5)
      and round(list_places.lng::numeric, 5) = round(p_lng::numeric, 5)
      and private.can_view_list_place(list_places.id)
  ),
  matching_places as (
    select
      list_places.*,
      lists.owner_id as list_owner_id,
      lists.name as list_name,
      lists.description as list_description,
      lists.emoji as list_emoji,
      lists.cover_image_url as list_cover_image_url,
      lists.is_public as list_is_public,
      lists.created_at as list_created_at,
      lists.updated_at as list_updated_at,
      location_visibility.has_public_list,
      location_visibility.has_private_list,
      count(*) over ()::bigint as total_count
    from public.list_places
    join public.lists on lists.id = list_places.list_id
    cross join normalized
    cross join location_visibility
    where round(list_places.lat::numeric, 5) = round(p_lat::numeric, 5)
      and round(list_places.lng::numeric, 5) = round(p_lng::numeric, 5)
      and (p_owner_id is null or lists.owner_id = p_owner_id)
      and (
        p_owner_id is null
        or normalized.place_name is null
        or lower(regexp_replace(trim(list_places.name), '\s+', ' ', 'g')) = normalized.place_name
      )
      and private.can_view_list_place(list_places.id)
      and (
        p_cursor_updated_at is null
        or (list_places.updated_at, list_places.id) < (p_cursor_updated_at, p_cursor_id)
      )
    order by list_places.updated_at desc, list_places.id desc
    limit least(greatest(coalesce(p_limit, 16), 1), 50)
  )
  select
    matching_places.id as place_id,
    matching_places.added_at,
    matching_places.updated_at,
    matching_places.name as place_name,
    matching_places.title as place_title,
    matching_places.menu_url,
    matching_places.lat,
    matching_places.lng,
    matching_places.address,
    matching_places.notes,
    matching_places.rating,
    matching_places.category,
    matching_places.categories,
    matching_places.student_discount,
    matching_places.price_range,
    matching_places.price_min,
    matching_places.price_max,
    matching_places.best_time,
    matching_places.best_times,
    matching_places.atmosphere,
    matching_places.special_features,
    coalesce(media_items.media, '[]'::jsonb) as media,
    coalesce(like_counts.like_count, 0) as like_count,
    coalesce(comment_counts.comment_count, 0) as comment_count,
    exists (
      select 1
      from public.list_place_likes
      where list_place_likes.list_place_id = matching_places.id
        and list_place_likes.user_id = auth.uid()
    ) as viewer_has_liked,
    matching_places.list_id,
    matching_places.list_owner_id,
    matching_places.list_name,
    matching_places.list_description,
    matching_places.list_emoji,
    matching_places.list_cover_image_url,
    matching_places.list_is_public,
    matching_places.list_created_at,
    matching_places.list_updated_at,
    owner_profile.name as owner_name,
    owner_profile.username as owner_username,
    owner_profile.profile_photo_url as owner_profile_photo_url,
    owner_profile.is_public_account as owner_is_public_account,
    matching_places.has_public_list,
    matching_places.has_private_list,
    matching_places.total_count
  from matching_places
  join public.public_profile_summaries owner_profile
    on owner_profile.id = matching_places.list_owner_id
  left join lateral (
    select jsonb_agg(
      jsonb_build_object(
        'id', media.id,
        'url', media.url,
        'type', media.media_type,
        'mimeType', media.mime_type,
        'durationMs', media.duration_ms,
        'thumbnailUrl', media.thumbnail_url,
        'width', media.width,
        'height', media.height
      ) order by media.sort_order asc, media.created_at asc
    ) as media
    from public.list_place_photos media
    where media.list_place_id = matching_places.id
  ) media_items on true
  left join lateral (
    select count(*)::bigint as like_count
    from public.list_place_likes
    where list_place_likes.list_place_id = matching_places.id
  ) like_counts on true
  left join lateral (
    select count(*)::bigint as comment_count
    from public.list_place_comments
    where list_place_comments.list_place_id = matching_places.id
  ) comment_counts on true
  order by matching_places.updated_at desc, matching_places.id desc;
$$;

revoke all on function public.location_place_cards_page(
  double precision,
  double precision,
  uuid,
  text,
  timestamptz,
  uuid,
  integer
) from public;
grant execute on function public.location_place_cards_page(
  double precision,
  double precision,
  uuid,
  text,
  timestamptz,
  uuid,
  integer
) to authenticated;
