-- Make Explore substring search indexable and defer card hydration until after
-- keyset pagination has selected the small result window.

begin;

-- The pinned Supabase CLI currently runs migrations in a transaction, so keep
-- these builds transactional but fail quickly instead of waiting on live writes.
set local lock_timeout = '5s';
set local statement_timeout = '15min';

create extension if not exists pg_trgm with schema extensions;

set local search_path = pg_catalog, public, private, extensions;

create index if not exists idx_profiles_explore_search_trgm
  on public.profiles using gin (
    (
      private.normalize_search_text(
        coalesce(name, '') || ' ' || coalesce(username, '') || ' ' || coalesce(bio, '')
      )
    ) gin_trgm_ops
  );

create index if not exists idx_profiles_identity_search_trgm
  on public.profiles using gin (
    (
      private.normalize_search_text(
        coalesce(name, '') || ' ' || coalesce(username, '')
      )
    ) gin_trgm_ops
  );

create index if not exists idx_lists_explore_search_trgm
  on public.lists using gin (
    (
      private.normalize_search_text(
        coalesce(name, '') || ' ' || coalesce(description, '')
      )
    ) gin_trgm_ops
  );

create index if not exists idx_lists_name_search_trgm
  on public.lists using gin (
    (private.normalize_search_text(coalesce(name, ''))) gin_trgm_ops
  );

create index if not exists idx_list_places_explore_search_trgm
  on public.list_places using gin (
    (
      private.normalize_search_text(
        coalesce(name, '') || ' ' || coalesce(address, '') || ' ' || coalesce(notes, '')
      )
    ) gin_trgm_ops
  );

create index if not exists idx_profiles_public_updated_keyset
  on public.profiles (updated_at desc, id desc)
  where is_public_account is true;

create index if not exists idx_lists_public_updated_keyset
  on public.lists (updated_at desc, id desc)
  where is_public is true;

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
set search_path = pg_catalog, public, private, extensions
as $$
  with normalized_input as (
    select
      auth.uid() as viewer_id,
      private.normalize_search_text(p_query) as q,
      least(greatest(coalesce(p_limit, 20), 1), 50) as page_size
    where auth.uid() is not null
      and p_kind in ('all', 'lists', 'places', 'photos', 'users')
      and pg_catalog.char_length(coalesce(p_query, '')) <= 120
  ),
  request as (
    select
      normalized_input.*,
      '%' ||
        pg_catalog.replace(
          pg_catalog.replace(
            pg_catalog.replace(normalized_input.q, E'\\', E'\\\\'),
            '%',
            E'\\%'
          ),
          '_',
          E'\\_'
        ) ||
        '%' as like_pattern
    from normalized_input
    where normalized_input.q = ''
      or pg_catalog.char_length(normalized_input.q) >= 3
  ),
  list_candidates as (
    select
      lists.id as item_id,
      'list'::text as kind,
      extract(epoch from lists.updated_at)::double precision as rank
    from public.lists
    join public.public_profile_summaries owner_profile on owner_profile.id = lists.owner_id
    join request on true
    where p_kind in ('all', 'lists')
      and lists.is_public is true
      and lists.owner_id <> request.viewer_id
      and private.can_view_list(lists.id)
      and not private.users_have_block_relation(request.viewer_id, lists.owner_id)
      and not exists (
        select 1
        from public.user_follows
        where user_follows.follower_id = request.viewer_id
          and user_follows.following_id = lists.owner_id
      )
      and (
        request.q = ''
        or private.normalize_search_text(
          coalesce(lists.name, '') || ' ' || coalesce(lists.description, '')
        ) like request.like_pattern escape E'\\'
      )
      and (
        p_cursor_rank is null
        or (extract(epoch from lists.updated_at)::double precision, lists.id) <
          (p_cursor_rank, p_cursor_id)
      )
    order by lists.updated_at desc, lists.id desc
    limit (select page_size from request)
  ),
  place_candidates as (
    select
      list_places.id as item_id,
      'place'::text as kind,
      extract(epoch from list_places.updated_at)::double precision as rank
    from public.list_places
    join public.lists on lists.id = list_places.list_id
    join public.public_profile_summaries owner_profile on owner_profile.id = lists.owner_id
    join request on true
    where p_kind in ('all', 'places', 'photos')
      and lists.is_public is true
      and lists.owner_id <> request.viewer_id
      and private.can_view_list_place(list_places.id)
      and not private.users_have_block_relation(request.viewer_id, lists.owner_id)
      and not exists (
        select 1
        from public.user_follows
        where user_follows.follower_id = request.viewer_id
          and user_follows.following_id = lists.owner_id
      )
      and (
        p_kind <> 'photos'
        or exists (
          select 1
          from public.list_place_photos
          where list_place_photos.list_place_id = list_places.id
        )
      )
      and (
        request.q = ''
        or private.normalize_search_text(
          coalesce(list_places.name, '') || ' ' ||
          coalesce(list_places.address, '') || ' ' ||
          coalesce(list_places.notes, '')
        ) like request.like_pattern escape E'\\'
        or private.normalize_search_text(coalesce(lists.name, ''))
          like request.like_pattern escape E'\\'
        or private.normalize_search_text(
          coalesce(owner_profile.name, '') || ' ' || coalesce(owner_profile.username, '')
        ) like request.like_pattern escape E'\\'
      )
      and (
        p_cursor_rank is null
        or (extract(epoch from list_places.updated_at)::double precision, list_places.id) <
          (p_cursor_rank, p_cursor_id)
      )
    order by list_places.updated_at desc, list_places.id desc
    limit (select page_size from request)
  ),
  user_candidates as (
    select
      profiles.id as item_id,
      'user'::text as kind,
      extract(epoch from profiles.updated_at)::double precision as rank
    from public.public_profile_summaries profiles
    join request on true
    where p_kind in ('all', 'users')
      and profiles.id <> request.viewer_id
      and profiles.is_public_account is true
      and not private.users_have_block_relation(request.viewer_id, profiles.id)
      and not exists (
        select 1
        from public.user_follows
        where user_follows.follower_id = request.viewer_id
          and user_follows.following_id = profiles.id
      )
      and (
        request.q = ''
        or private.normalize_search_text(
          coalesce(profiles.name, '') || ' ' ||
          coalesce(profiles.username, '') || ' ' ||
          coalesce(profiles.bio, '')
        ) like request.like_pattern escape E'\\'
      )
      and (
        p_cursor_rank is null
        or (extract(epoch from profiles.updated_at)::double precision, profiles.id) <
          (p_cursor_rank, p_cursor_id)
      )
    order by profiles.updated_at desc, profiles.id desc
    limit (select page_size from request)
  ),
  selected as (
    select * from list_candidates
    union all
    select * from place_candidates
    union all
    select * from user_candidates
    order by rank desc, item_id desc
    limit (select page_size from request)
  )
  select
    selected.item_id,
    selected.kind,
    selected.rank,
    case selected.kind
      when 'list' then (
        select pg_catalog.jsonb_build_object(
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
        )
        from public.lists
        join public.public_profile_summaries owner_profile on owner_profile.id = lists.owner_id
        where lists.id = selected.item_id
      )
      when 'place' then (
        select pg_catalog.jsonb_build_object(
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
          'media', coalesce((
            select pg_catalog.jsonb_agg(
              pg_catalog.jsonb_build_object(
                'id', media.id,
                'url', media.url,
                'type', media.media_type,
                'mimeType', media.mime_type,
                'durationMs', media.duration_ms,
                'thumbnailUrl', media.thumbnail_url,
                'width', media.width,
                'height', media.height
              )
              order by media.sort_order asc, media.created_at asc
            )
            from (
              select *
              from public.list_place_photos
              where list_place_photos.list_place_id = list_places.id
              order by sort_order asc, created_at asc
              limit 2
            ) media
          ), '[]'::jsonb),
          'likeCount', (
            select pg_catalog.count(*)
            from public.list_place_likes
            where list_place_likes.list_place_id = list_places.id
          ),
          'commentCount', (
            select pg_catalog.count(*)
            from public.list_place_comments
            where list_place_comments.list_place_id = list_places.id
          ),
          'viewerHasLiked', exists (
            select 1
            from public.list_place_likes
            join request on true
            where list_place_likes.list_place_id = list_places.id
              and list_place_likes.user_id = request.viewer_id
          )
        )
        from public.list_places
        join public.lists on lists.id = list_places.list_id
        join public.public_profile_summaries owner_profile on owner_profile.id = lists.owner_id
        where list_places.id = selected.item_id
      )
      else (
        select pg_catalog.jsonb_build_object(
          'id', profiles.id,
          'name', profiles.name,
          'username', profiles.username,
          'bio', profiles.bio,
          'profilePhotoUrl', profiles.profile_photo_url,
          'isPublicAccount', profiles.is_public_account
        )
        from public.public_profile_summaries profiles
        where profiles.id = selected.item_id
      )
    end as item
  from selected
  order by selected.rank desc, selected.item_id desc;
$$;

revoke all on function public.explore_page(text, text, double precision, uuid, integer) from public;
grant execute on function public.explore_page(text, text, double precision, uuid, integer) to authenticated;

commit;
