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
    join public.public_profile_summaries owner_profile on owner_profile.id = lists.owner_id
    join normalized on true
    where auth.uid() is not null
      and (p_kind in ('all', 'lists'))
      and lists.is_public is true
      and lists.owner_id <> auth.uid()
      and private.can_view_list(lists.id)
      and not private.users_have_block_relation(auth.uid(), lists.owner_id)
      and not exists (
        select 1
        from public.user_follows uf
        where uf.follower_id = auth.uid()
          and uf.following_id = lists.owner_id
      )
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
    where auth.uid() is not null
      and (p_kind in ('all', 'places', 'photos'))
      and lists.is_public is true
      and lists.owner_id <> auth.uid()
      and private.can_view_list_place(list_places.id)
      and not private.users_have_block_relation(auth.uid(), lists.owner_id)
      and not exists (
        select 1
        from public.user_follows uf
        where uf.follower_id = auth.uid()
          and uf.following_id = lists.owner_id
      )
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
    where auth.uid() is not null
      and (p_kind in ('all', 'users'))
      and profiles.id <> auth.uid()
      and profiles.is_public_account is true
      and not private.users_have_block_relation(auth.uid(), profiles.id)
      and not exists (
        select 1
        from public.user_follows uf
        where uf.follower_id = auth.uid()
          and uf.following_id = profiles.id
      )
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
