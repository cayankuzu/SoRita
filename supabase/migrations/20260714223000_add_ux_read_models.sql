-- UX/performance read models for screen-specific payloads and keyset pagination.

create index if not exists idx_list_places_feed_keyset
  on public.list_places (updated_at desc, id desc);

create index if not exists idx_list_places_list_keyset
  on public.list_places (list_id, added_at desc, id desc);

create index if not exists idx_list_place_photos_place_sort
  on public.list_place_photos (list_place_id, sort_order asc, created_at asc);

create index if not exists idx_list_likes_list_id
  on public.list_likes (list_id);

create index if not exists idx_notifications_recipient_keyset
  on public.notifications (recipient_user_id, created_at desc, id desc);

create index if not exists idx_public_profiles_search
  on public.profiles using gin (
    to_tsvector('simple', coalesce(name, '') || ' ' || coalesce(username, '') || ' ' || coalesce(bio, ''))
  );

create or replace function public.feed_page(
  p_cursor_published_at timestamptz default null,
  p_cursor_id uuid default null,
  p_limit integer default 20
)
returns table (
  feed_item_id uuid,
  published_at timestamptz,
  owner_id uuid,
  owner_name text,
  owner_username text,
  owner_profile_photo_url text,
  list_id uuid,
  list_name text,
  list_emoji text,
  list_cover_image_url text,
  list_is_public boolean,
  place_id uuid,
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
  added_at timestamptz,
  updated_at timestamptz,
  media jsonb,
  like_count bigint,
  comment_count bigint,
  viewer_has_liked boolean
)
language sql
stable
security invoker
set search_path = pg_catalog, public, private
as $$
  with viewer as (
    select auth.uid() as id
  ),
  owner_scope as (
    select id as owner_id from viewer where id is not null
    union
    select user_follows.following_id
    from public.user_follows, viewer
    where viewer.id is not null
      and user_follows.follower_id = viewer.id
  ),
  limited_places as (
    select
      list_places.*,
      lists.owner_id,
      lists.name as list_name,
      lists.emoji as list_emoji,
      lists.cover_image_url as list_cover_image_url,
      lists.is_public as list_is_public
    from public.list_places
    join public.lists on lists.id = list_places.list_id
    join owner_scope on owner_scope.owner_id = lists.owner_id
    where private.can_view_list_place(list_places.id)
      and (
        p_cursor_published_at is null
        or (list_places.updated_at, list_places.id) < (p_cursor_published_at, p_cursor_id)
      )
    order by list_places.updated_at desc, list_places.id desc
    limit least(greatest(coalesce(p_limit, 20), 1), 50)
  )
  select
    limited_places.id as feed_item_id,
    limited_places.updated_at as published_at,
    owner_profile.id as owner_id,
    owner_profile.name as owner_name,
    owner_profile.username as owner_username,
    owner_profile.profile_photo_url as owner_profile_photo_url,
    limited_places.list_id,
    limited_places.list_name,
    limited_places.list_emoji,
    limited_places.list_cover_image_url,
    limited_places.list_is_public,
    limited_places.id as place_id,
    limited_places.name as place_name,
    limited_places.title as place_title,
    limited_places.menu_url,
    limited_places.lat,
    limited_places.lng,
    limited_places.address,
    limited_places.notes,
    limited_places.rating,
    limited_places.category,
    limited_places.categories,
    limited_places.student_discount,
    limited_places.price_range,
    limited_places.price_min,
    limited_places.price_max,
    limited_places.best_time,
    limited_places.best_times,
    limited_places.atmosphere,
    limited_places.special_features,
    limited_places.added_at,
    limited_places.updated_at,
    coalesce(media_items.media, '[]'::jsonb) as media,
    coalesce(like_counts.like_count, 0) as like_count,
    coalesce(comment_counts.comment_count, 0) as comment_count,
    exists (
      select 1
      from public.list_place_likes
      where list_place_likes.list_place_id = limited_places.id
        and list_place_likes.user_id = auth.uid()
    ) as viewer_has_liked
  from limited_places
  join public.public_profile_summaries owner_profile on owner_profile.id = limited_places.owner_id
  left join lateral (
    select jsonb_agg(
      jsonb_build_object(
        'id', ordered_media.id,
        'url', ordered_media.url,
        'type', ordered_media.media_type,
        'mimeType', ordered_media.mime_type,
        'durationMs', ordered_media.duration_ms,
        'thumbnailUrl', ordered_media.thumbnail_url,
        'width', ordered_media.width,
        'height', ordered_media.height
      )
      order by ordered_media.sort_order asc, ordered_media.created_at asc
    ) as media
    from (
      select *
      from public.list_place_photos
      where list_place_photos.list_place_id = limited_places.id
      order by sort_order asc, created_at asc
      limit 2
    ) ordered_media
  ) media_items on true
  left join lateral (
    select count(*)::bigint as like_count
    from public.list_place_likes
    where list_place_likes.list_place_id = limited_places.id
  ) like_counts on true
  left join lateral (
    select count(*)::bigint as comment_count
    from public.list_place_comments
    where list_place_comments.list_place_id = limited_places.id
  ) comment_counts on true
  order by limited_places.updated_at desc, limited_places.id desc;
$$;

revoke all on function public.feed_page(timestamptz, uuid, integer) from public;
grant execute on function public.feed_page(timestamptz, uuid, integer) to authenticated;

create or replace function public.profile_summary(p_user_id uuid)
returns table (
  id uuid,
  name text,
  username text,
  is_public_account boolean,
  bio text,
  profile_photo_url text,
  cover_photo_url text,
  interests text[],
  follower_count bigint,
  following_count bigint,
  list_count bigint,
  place_count bigint,
  viewer_has_followed boolean,
  viewer_has_pending_follow_request boolean,
  is_blocked_by_viewer boolean,
  is_blocking_viewer boolean,
  can_view_content boolean
)
language sql
stable
security invoker
set search_path = pg_catalog, public, private
as $$
  select
    profiles.id,
    profiles.name,
    profiles.username,
    profiles.is_public_account,
    profiles.bio,
    profiles.profile_photo_url,
    profiles.cover_photo_url,
    profiles.interests,
    (select count(*) from public.user_follows where following_id = profiles.id)::bigint as follower_count,
    (select count(*) from public.user_follows where follower_id = profiles.id)::bigint as following_count,
    (select count(*) from public.lists where owner_id = profiles.id and private.can_view_list(id))::bigint as list_count,
    (
      select count(*)
      from public.list_places
      join public.lists on lists.id = list_places.list_id
      where lists.owner_id = profiles.id
        and private.can_view_list_place(list_places.id)
    )::bigint as place_count,
    exists (
      select 1
      from public.user_follows
      where follower_id = auth.uid()
        and following_id = profiles.id
    ) as viewer_has_followed,
    exists (
      select 1
      from public.follow_requests
      where requester_id = auth.uid()
        and target_user_id = profiles.id
        and status = 'pending'
    ) as viewer_has_pending_follow_request,
    exists (
      select 1 from public.user_blocks
      where blocker_user_id = auth.uid()
        and blocked_user_id = profiles.id
    ) as is_blocked_by_viewer,
    exists (
      select 1 from public.user_blocks
      where blocker_user_id = profiles.id
        and blocked_user_id = auth.uid()
    ) as is_blocking_viewer,
    (
      profiles.id = auth.uid()
      or profiles.is_public_account
      or exists (
        select 1
        from public.user_follows
        where follower_id = auth.uid()
          and following_id = profiles.id
      )
    ) as can_view_content
  from public.public_profile_summaries profiles
  where auth.uid() is not null
    and profiles.id = p_user_id
  limit 1;
$$;

revoke all on function public.profile_summary(uuid) from public;
grant execute on function public.profile_summary(uuid) to authenticated;

create or replace function public.profile_content_page(
  p_user_id uuid,
  p_tab text default 'lists',
  p_cursor timestamptz default null,
  p_cursor_id uuid default null,
  p_limit integer default 20
)
returns table (
  item_id uuid,
  sort_at timestamptz,
  item jsonb
)
language sql
stable
security invoker
set search_path = pg_catalog, public, private
as $$
  with list_items as (
    select
      lists.id as item_id,
      lists.updated_at as sort_at,
      jsonb_build_object(
        'type', 'list',
        'id', lists.id,
        'ownerId', lists.owner_id,
        'name', lists.name,
        'description', lists.description,
        'emoji', lists.emoji,
        'coverImageUrl', lists.cover_image_url,
        'isPublic', lists.is_public,
        'createdAt', lists.created_at,
        'updatedAt', lists.updated_at,
        'likeCount', (select count(*) from public.list_likes where list_id = lists.id),
        'viewerHasLiked', exists (
          select 1
          from public.list_likes
          where list_id = lists.id
            and user_id = auth.uid()
        ),
        'placeCount', (
          select count(*)
          from public.list_places
          where list_places.list_id = lists.id
        )
      ) as item
    from public.lists
    where p_tab = 'lists'
      and lists.owner_id = p_user_id
      and private.can_view_list(lists.id)
      and (
        p_cursor is null
        or (lists.updated_at, lists.id) < (p_cursor, p_cursor_id)
      )
    order by lists.updated_at desc, lists.id desc
    limit least(greatest(coalesce(p_limit, 20), 1), 50)
  ),
  place_items as (
    select
      list_places.id as item_id,
      list_places.updated_at as sort_at,
      jsonb_build_object(
        'type', 'place',
        'ownerId', owner_profile.id,
        'ownerName', owner_profile.name,
        'ownerUsername', owner_profile.username,
        'ownerProfilePhotoUrl', owner_profile.profile_photo_url,
        'listId', lists.id,
        'listName', lists.name,
        'listEmoji', lists.emoji,
        'listCoverImageUrl', lists.cover_image_url,
        'listIsPublic', lists.is_public,
        'listUpdatedAt', lists.updated_at,
        'placeId', list_places.id,
        'placeName', list_places.name,
        'placeTitle', list_places.title,
        'menuUrl', list_places.menu_url,
        'lat', list_places.lat,
        'lng', list_places.lng,
        'address', list_places.address,
        'notes', list_places.notes,
        'rating', list_places.rating,
        'category', list_places.category,
        'categories', list_places.categories,
        'studentDiscount', list_places.student_discount,
        'priceRange', list_places.price_range,
        'priceMin', list_places.price_min,
        'priceMax', list_places.price_max,
        'bestTime', list_places.best_time,
        'bestTimes', list_places.best_times,
        'atmosphere', list_places.atmosphere,
        'specialFeatures', list_places.special_features,
        'addedAt', list_places.added_at,
        'updatedAt', list_places.updated_at,
        'media', coalesce(media_items.media, '[]'::jsonb),
        'likeCount', coalesce(like_counts.like_count, 0),
        'commentCount', coalesce(comment_counts.comment_count, 0),
        'viewerHasLiked', exists (
          select 1
          from public.list_place_likes
          where list_place_likes.list_place_id = list_places.id
            and list_place_likes.user_id = auth.uid()
        )
      ) as item
    from public.list_places
    join public.lists on lists.id = list_places.list_id
    join public.public_profile_summaries owner_profile on owner_profile.id = lists.owner_id
    left join lateral (
      select jsonb_agg(
        jsonb_build_object(
          'id', ordered_media.id,
          'url', ordered_media.url,
          'type', ordered_media.media_type,
          'mimeType', ordered_media.mime_type,
          'durationMs', ordered_media.duration_ms,
          'thumbnailUrl', ordered_media.thumbnail_url,
          'width', ordered_media.width,
          'height', ordered_media.height
        )
        order by ordered_media.sort_order asc, ordered_media.created_at asc
      ) as media
      from (
        select *
        from public.list_place_photos
        where list_place_photos.list_place_id = list_places.id
        order by sort_order asc, created_at asc
        limit 3
      ) ordered_media
    ) media_items on true
    left join lateral (
      select count(*)::bigint as like_count
      from public.list_place_likes
      where list_place_likes.list_place_id = list_places.id
    ) like_counts on true
    left join lateral (
      select count(*)::bigint as comment_count
      from public.list_place_comments
      where list_place_comments.list_place_id = list_places.id
    ) comment_counts on true
    where p_tab in ('places', 'gallery')
      and lists.owner_id = p_user_id
      and private.can_view_list_place(list_places.id)
      and (
        p_cursor is null
        or (list_places.updated_at, list_places.id) < (p_cursor, p_cursor_id)
      )
    order by list_places.updated_at desc, list_places.id desc
    limit least(greatest(coalesce(p_limit, 20), 1), 50)
  )
  select * from list_items
  union all
  select * from place_items
  order by sort_at desc, item_id desc;
$$;

revoke all on function public.profile_content_page(uuid, text, timestamptz, uuid, integer) from public;
grant execute on function public.profile_content_page(uuid, text, timestamptz, uuid, integer) to authenticated;

create or replace function public.list_detail_header(p_list_id uuid)
returns table (
  list_id uuid,
  owner_id uuid,
  owner_name text,
  owner_username text,
  owner_profile_photo_url text,
  list_name text,
  list_description text,
  list_emoji text,
  list_cover_image_url text,
  list_is_public boolean,
  created_at timestamptz,
  updated_at timestamptz,
  like_count bigint,
  viewer_has_liked boolean,
  place_count bigint
)
language sql
stable
security invoker
set search_path = pg_catalog, public, private
as $$
  select
    lists.id as list_id,
    owner_profile.id as owner_id,
    owner_profile.name as owner_name,
    owner_profile.username as owner_username,
    owner_profile.profile_photo_url as owner_profile_photo_url,
    lists.name as list_name,
    lists.description as list_description,
    lists.emoji as list_emoji,
    lists.cover_image_url as list_cover_image_url,
    lists.is_public as list_is_public,
    lists.created_at,
    lists.updated_at,
    (select count(*) from public.list_likes where list_id = lists.id)::bigint as like_count,
    exists (
      select 1
      from public.list_likes
      where list_id = lists.id
        and user_id = auth.uid()
    ) as viewer_has_liked,
    (select count(*) from public.list_places where list_id = lists.id)::bigint as place_count
  from public.lists
  join public.public_profile_summaries owner_profile on owner_profile.id = lists.owner_id
  where lists.id = p_list_id
    and private.can_view_list(lists.id)
  limit 1;
$$;

revoke all on function public.list_detail_header(uuid) from public;
grant execute on function public.list_detail_header(uuid) to authenticated;

create or replace function public.list_places_page(
  p_list_id uuid,
  p_cursor_added_at timestamptz default null,
  p_cursor_id uuid default null,
  p_limit integer default 20
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
  viewer_has_liked boolean
)
language sql
stable
security invoker
set search_path = pg_catalog, public, private
as $$
  with limited_places as (
    select *
    from public.list_places
    where list_id = p_list_id
      and private.can_view_list_place(id)
      and (
        p_cursor_added_at is null
        or (added_at, id) < (p_cursor_added_at, p_cursor_id)
      )
    order by added_at desc, id desc
    limit least(greatest(coalesce(p_limit, 20), 1), 50)
  )
  select
    limited_places.id as place_id,
    limited_places.added_at,
    limited_places.updated_at,
    limited_places.name as place_name,
    limited_places.title as place_title,
    limited_places.menu_url,
    limited_places.lat,
    limited_places.lng,
    limited_places.address,
    limited_places.notes,
    limited_places.rating,
    limited_places.category,
    limited_places.categories,
    limited_places.student_discount,
    limited_places.price_range,
    limited_places.price_min,
    limited_places.price_max,
    limited_places.best_time,
    limited_places.best_times,
    limited_places.atmosphere,
    limited_places.special_features,
    coalesce(media_items.media, '[]'::jsonb) as media,
    coalesce(like_counts.like_count, 0) as like_count,
    coalesce(comment_counts.comment_count, 0) as comment_count,
    exists (
      select 1
      from public.list_place_likes
      where list_place_likes.list_place_id = limited_places.id
        and list_place_likes.user_id = auth.uid()
    ) as viewer_has_liked
  from limited_places
  left join lateral (
    select jsonb_agg(
      jsonb_build_object(
        'id', ordered_media.id,
        'url', ordered_media.url,
        'type', ordered_media.media_type,
        'mimeType', ordered_media.mime_type,
        'durationMs', ordered_media.duration_ms,
        'thumbnailUrl', ordered_media.thumbnail_url,
        'width', ordered_media.width,
        'height', ordered_media.height
      )
      order by ordered_media.sort_order asc, ordered_media.created_at asc
    ) as media
    from (
      select *
      from public.list_place_photos
      where list_place_photos.list_place_id = limited_places.id
      order by sort_order asc, created_at asc
      limit 9
    ) ordered_media
  ) media_items on true
  left join lateral (
    select count(*)::bigint as like_count
    from public.list_place_likes
    where list_place_likes.list_place_id = limited_places.id
  ) like_counts on true
  left join lateral (
    select count(*)::bigint as comment_count
    from public.list_place_comments
    where list_place_comments.list_place_id = limited_places.id
  ) comment_counts on true
  order by limited_places.added_at desc, limited_places.id desc;
$$;

revoke all on function public.list_places_page(uuid, timestamptz, uuid, integer) from public;
grant execute on function public.list_places_page(uuid, timestamptz, uuid, integer) to authenticated;

create or replace function public.notifications_page(
  p_cursor_created_at timestamptz default null,
  p_cursor_id uuid default null,
  p_limit integer default 20
)
returns table (
  id uuid,
  recipient_user_id uuid,
  actor_user_id uuid,
  type text,
  message text,
  list_id uuid,
  list_place_id uuid,
  follow_request_id uuid,
  read boolean,
  created_at timestamptz,
  actor_name text,
  actor_username text,
  actor_profile_photo_url text,
  follow_request_status text
)
language sql
stable
security invoker
set search_path = pg_catalog, public, private
as $$
  select
    notifications.id,
    notifications.recipient_user_id,
    notifications.actor_user_id,
    notifications.type,
    notifications.message,
    notifications.list_id,
    notifications.list_place_id,
    notifications.follow_request_id,
    notifications.read,
    notifications.created_at,
    actor_profile.name as actor_name,
    actor_profile.username as actor_username,
    actor_profile.profile_photo_url as actor_profile_photo_url,
    follow_requests.status as follow_request_status
  from public.notifications
  left join public.public_profile_summaries actor_profile on actor_profile.id = notifications.actor_user_id
  left join public.follow_requests on follow_requests.id = notifications.follow_request_id
  where notifications.recipient_user_id = auth.uid()
    and (
      notifications.actor_user_id is null
      or notifications.actor_user_id = auth.uid()
      or not private.users_have_block_relation(auth.uid(), notifications.actor_user_id)
    )
    and (
      p_cursor_created_at is null
      or (notifications.created_at, notifications.id) < (p_cursor_created_at, p_cursor_id)
    )
  order by notifications.created_at desc, notifications.id desc
  limit least(greatest(coalesce(p_limit, 20), 1), 50);
$$;

revoke all on function public.notifications_page(timestamptz, uuid, integer) from public;
grant execute on function public.notifications_page(timestamptz, uuid, integer) to authenticated;

create or replace function public.notification_unread_count()
returns bigint
language sql
stable
security invoker
set search_path = pg_catalog, public, private
as $$
  select count(*)::bigint
  from public.notifications
  where recipient_user_id = auth.uid()
    and read = false
    and (
      actor_user_id is null
      or actor_user_id = auth.uid()
      or not private.users_have_block_relation(auth.uid(), actor_user_id)
    );
$$;

revoke all on function public.notification_unread_count() from public;
grant execute on function public.notification_unread_count() to authenticated;

create or replace function public.place_comments_page(
  p_list_place_id uuid,
  p_cursor_created_at timestamptz default null,
  p_cursor_id uuid default null,
  p_limit integer default 20
)
returns table (
  id uuid,
  list_place_id uuid,
  user_id uuid,
  parent_comment_id uuid,
  content text,
  created_at timestamptz,
  updated_at timestamptz,
  author_name text,
  author_username text,
  author_profile_photo_url text,
  like_count bigint,
  viewer_has_liked boolean
)
language sql
stable
security invoker
set search_path = pg_catalog, public, private
as $$
  select
    comments.id,
    comments.list_place_id,
    comments.user_id,
    comments.parent_comment_id,
    comments.content,
    comments.created_at,
    comments.updated_at,
    author_profile.name as author_name,
    author_profile.username as author_username,
    author_profile.profile_photo_url as author_profile_photo_url,
    (select count(*) from public.list_place_comment_likes where comment_id = comments.id)::bigint as like_count,
    exists (
      select 1
      from public.list_place_comment_likes
      where comment_id = comments.id
        and user_id = auth.uid()
    ) as viewer_has_liked
  from public.list_place_comments comments
  join public.public_profile_summaries author_profile on author_profile.id = comments.user_id
  where comments.list_place_id = p_list_place_id
    and private.can_view_list_place(p_list_place_id)
    and (
      comments.user_id = auth.uid()
      or not private.users_have_block_relation(auth.uid(), comments.user_id)
    )
    and (
      p_cursor_created_at is null
      or (comments.created_at, comments.id) < (p_cursor_created_at, p_cursor_id)
    )
  order by comments.created_at desc, comments.id desc
  limit least(greatest(coalesce(p_limit, 20), 1), 50);
$$;

revoke all on function public.place_comments_page(uuid, timestamptz, uuid, integer) from public;
grant execute on function public.place_comments_page(uuid, timestamptz, uuid, integer) to authenticated;

create or replace function public.explore_page(
  p_kind text default 'all',
  p_query text default '',
  p_cursor_rank double precision default null,
  p_cursor_id uuid default null,
  p_limit integer default 20
)
returns table (
  item_id uuid,
  kind text,
  rank double precision,
  item jsonb
)
language sql
stable
security invoker
set search_path = pg_catalog, public, private
as $$
  with normalized as (
    select lower(trim(coalesce(p_query, ''))) as q
  ),
  list_items as (
    select
      lists.id as item_id,
      'list'::text as kind,
      extract(epoch from lists.updated_at)::double precision as rank,
      jsonb_build_object(
        'id', lists.id,
        'name', lists.name,
        'description', lists.description,
        'emoji', lists.emoji,
        'coverImageUrl', lists.cover_image_url,
        'isPublic', lists.is_public,
        'ownerId', lists.owner_id,
        'ownerName', owner_profile.name,
        'ownerUsername', owner_profile.username,
        'ownerProfilePhotoUrl', owner_profile.profile_photo_url,
        'updatedAt', lists.updated_at
      ) as item
    from public.lists
    join public.public_profile_summaries owner_profile on owner_profile.id = lists.owner_id,
      normalized
    where (p_kind in ('all', 'lists'))
      and private.can_view_list(lists.id)
      and (
        normalized.q = ''
        or lower(lists.name) like '%' || normalized.q || '%'
        or lower(coalesce(lists.description, '')) like '%' || normalized.q || '%'
      )
  ),
  place_items as (
    select
      list_places.id as item_id,
      'place'::text as kind,
      extract(epoch from list_places.updated_at)::double precision as rank,
      jsonb_build_object(
        'ownerId', owner_profile.id,
        'ownerName', owner_profile.name,
        'ownerUsername', owner_profile.username,
        'ownerProfilePhotoUrl', owner_profile.profile_photo_url,
        'listId', lists.id,
        'listName', lists.name,
        'listEmoji', lists.emoji,
        'listCoverImageUrl', lists.cover_image_url,
        'listIsPublic', lists.is_public,
        'listUpdatedAt', lists.updated_at,
        'placeId', list_places.id,
        'placeName', list_places.name,
        'placeTitle', list_places.title,
        'menuUrl', list_places.menu_url,
        'lat', list_places.lat,
        'lng', list_places.lng,
        'address', list_places.address,
        'notes', list_places.notes,
        'rating', list_places.rating,
        'category', list_places.category,
        'categories', list_places.categories,
        'studentDiscount', list_places.student_discount,
        'priceRange', list_places.price_range,
        'priceMin', list_places.price_min,
        'priceMax', list_places.price_max,
        'bestTime', list_places.best_time,
        'bestTimes', list_places.best_times,
        'atmosphere', list_places.atmosphere,
        'specialFeatures', list_places.special_features,
        'addedAt', list_places.added_at,
        'updatedAt', list_places.updated_at,
        'media', coalesce(media_items.media, '[]'::jsonb),
        'likeCount', coalesce(like_counts.like_count, 0),
        'commentCount', coalesce(comment_counts.comment_count, 0),
        'viewerHasLiked', exists (
          select 1
          from public.list_place_likes
          where list_place_likes.list_place_id = list_places.id
            and list_place_likes.user_id = auth.uid()
        )
      ) as item
    from public.list_places
    join public.lists on lists.id = list_places.list_id
    join public.public_profile_summaries owner_profile on owner_profile.id = lists.owner_id
    join normalized on true
    left join lateral (
      select jsonb_agg(
        jsonb_build_object(
          'id', ordered_media.id,
          'url', ordered_media.url,
          'type', ordered_media.media_type,
          'mimeType', ordered_media.mime_type,
          'durationMs', ordered_media.duration_ms,
          'thumbnailUrl', ordered_media.thumbnail_url,
          'width', ordered_media.width,
          'height', ordered_media.height
        )
        order by ordered_media.sort_order asc, ordered_media.created_at asc
      ) as media
      from (
        select *
        from public.list_place_photos
        where list_place_photos.list_place_id = list_places.id
        order by sort_order asc, created_at asc
        limit 2
      ) ordered_media
    ) media_items on true
    left join lateral (
      select count(*)::bigint as like_count
      from public.list_place_likes
      where list_place_likes.list_place_id = list_places.id
    ) like_counts on true
    left join lateral (
      select count(*)::bigint as comment_count
      from public.list_place_comments
      where list_place_comments.list_place_id = list_places.id
    ) comment_counts on true
    where (p_kind in ('all', 'places', 'photos'))
      and private.can_view_list_place(list_places.id)
      and (
        p_kind <> 'photos'
        or jsonb_array_length(coalesce(media_items.media, '[]'::jsonb)) > 0
      )
      and (
        normalized.q = ''
        or lower(list_places.name) like '%' || normalized.q || '%'
        or lower(coalesce(list_places.address, '')) like '%' || normalized.q || '%'
        or lower(coalesce(list_places.notes, '')) like '%' || normalized.q || '%'
        or lower(lists.name) like '%' || normalized.q || '%'
        or lower(owner_profile.name) like '%' || normalized.q || '%'
        or lower(owner_profile.username) like '%' || normalized.q || '%'
      )
  ),
  user_items as (
    select
      profiles.id as item_id,
      'user'::text as kind,
      extract(epoch from profiles.updated_at)::double precision as rank,
      jsonb_build_object(
        'id', profiles.id,
        'name', profiles.name,
        'username', profiles.username,
        'bio', profiles.bio,
        'profilePhotoUrl', profiles.profile_photo_url,
        'isPublicAccount', profiles.is_public_account
      ) as item
    from public.public_profile_summaries profiles, normalized
    where (p_kind in ('all', 'users'))
      and profiles.id <> auth.uid()
      and not private.users_have_block_relation(auth.uid(), profiles.id)
      and (
        normalized.q = ''
        or lower(profiles.name) like '%' || normalized.q || '%'
        or lower(profiles.username) like '%' || normalized.q || '%'
        or lower(coalesce(profiles.bio, '')) like '%' || normalized.q || '%'
      )
  ),
  combined as (
    select * from list_items
    union all
    select * from place_items
    union all
    select * from user_items
  )
  select *
  from combined
  where p_cursor_rank is null
    or (rank, item_id) < (p_cursor_rank, p_cursor_id)
  order by rank desc, item_id desc
  limit least(greatest(coalesce(p_limit, 20), 1), 50);
$$;

revoke all on function public.explore_page(text, text, double precision, uuid, integer) from public;
grant execute on function public.explore_page(text, text, double precision, uuid, integer) to authenticated;
