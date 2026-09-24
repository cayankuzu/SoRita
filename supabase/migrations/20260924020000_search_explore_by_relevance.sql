-- Explore search finds what people look for, in the order they expect.
--
-- Searching reused the discovery feed's rules, so a search never returned
-- content from people the viewer follows, private accounts, or places by
-- their category's Turkish name ("kafe"), and ordered hits by recency alone.
-- Browsing without a query keeps its rules and its keyset plan unchanged; a
-- query now:
--
-- * matches public content from anyone the viewer is not blocked from,
--   followed people included, and any account in People; the viewer's own
--   lists and places stay on their profile, as they do in browsing;
-- * matches a place by its category's label as well as its key;
-- * ranks a name starting with the query (or with a word starting with it)
--   first, a name containing it next, any other field last; within each,
--   people the viewer follows come first, then the most recent.
--
-- Queries shorter than three characters still return nothing: the trigram
-- indexes cannot serve them, and the app asks for one more letter instead.

begin;

set local lock_timeout = '5s';
set local search_path = pg_catalog, public, private, extensions;

-- The Turkish labels and keys of a place's categories, as searchable text.
-- Generated from src/mobile/app/catalog/placeOptions.ts; a unit test keeps
-- the two lists equal.
create or replace function private.place_category_search_text(
  p_category text,
  p_categories text[]
)
returns text
language sql
immutable
parallel safe
set search_path = pg_catalog
as $$
  select coalesce(pg_catalog.string_agg(labels.label || ' ' || labels.value, ' '), '')
  from (
    values
    ('aquarium', 'Akvaryum'),
    ('amusementcenter', 'Aktivite Merkezi'),
    ('airport', 'Havalimanı'),
    ('antikaci', 'Antikacı'),
    ('artcenter', 'Sanat Merkezi'),
    ('artgallery', 'Sanat Galerisi'),
    ('asianrestaurant', 'Asya Mutfağı'),
    ('atolye', 'Atölye'),
    ('bakery', 'Fırın / Pastane'),
    ('bar', 'Bar'),
    ('bazaar', 'Çarşı / Pazar'),
    ('beach', 'Plaj'),
    ('beachclub', 'Beach Club'),
    ('bistro', 'Bistro'),
    ('boatTour', 'Tekne Turu Noktası'),
    ('bookstore', 'Kitapçı'),
    ('boutique', 'Butik'),
    ('breakfast', 'Kahvaltıcı'),
    ('brewery', 'Bira Evi'),
    ('brunchspot', 'Brunch Mekanı'),
    ('burger', 'Burgerci'),
    ('cafe', 'Kafe'),
    ('camping', 'Kamp Alanı'),
    ('campus', 'Kampüs Noktası'),
    ('cinema', 'Sinema'),
    ('cocktailbar', 'Kokteyl Barı'),
    ('concerthall', 'Konser Salonu'),
    ('coworking', 'Coworking'),
    ('dessert', 'Tatlıcı'),
    ('doner', 'Dönerci'),
    ('escapeRoom', 'Escape Room'),
    ('ethnicrestaurant', 'Dünya Mutfağı'),
    ('eventvenue', 'Etkinlik Alanı'),
    ('fastfood', 'Fast Food'),
    ('ferry', 'İskele / Vapur'),
    ('fishmarket', 'Balık Pazarı'),
    ('forest', 'Orman / Mesire'),
    ('garden', 'Botanik Bahçe'),
    ('gelato', 'Gelato / Dondurma'),
    ('gym', 'Spor Salonu'),
    ('historicsite', 'Tarihi Mekan'),
    ('hookahlounge', 'Nargile Kafe'),
    ('hostel', 'Hostel'),
    ('hotel', 'Otel'),
    ('icecream', 'Dondurmacı'),
    ('juicebar', 'Meyve Suyu / Smoothie'),
    ('kebab', 'Kebapçı'),
    ('library', 'Kütüphane'),
    ('lokanta', 'Lokanta'),
    ('market', 'Market'),
    ('meyhane', 'Meyhane'),
    ('mosque', 'Cami'),
    ('museum', 'Müze'),
    ('musicvenue', 'Müzik Mekanı'),
    ('nightclub', 'Gece Kulübü'),
    ('nightlife', 'Gece Hayatı'),
    ('observatory', 'Gözlem Noktası'),
    ('other', 'Diğer'),
    ('park', 'Park'),
    ('patisserie', 'Pastane'),
    ('petfriendlycafe', 'Pet Dostu Kafe'),
    ('pilatesstudio', 'Pilates Stüdyosu'),
    ('pizzeria', 'Pizzacı'),
    ('pool', 'Havuz'),
    ('pub', 'Pub'),
    ('ramen', 'Ramen / Noodle'),
    ('restaurant', 'Restoran'),
    ('roastery', 'Kahve Kavurma Evi'),
    ('rooftop', 'Rooftop'),
    ('seafood', 'Balık / Deniz Ürünü'),
    ('shopping', 'Alışveriş'),
    ('spa', 'Spa / Hamam'),
    ('sport', 'Spor Tesisi'),
    ('steakhouse', 'Et Restoranı'),
    ('streetfood', 'Sokak Lezzetleri'),
    ('studycafe', 'Çalışma Kafesi'),
    ('sushi', 'Suşi'),
    ('teahouse', 'Çay Evi'),
    ('theater', 'Tiyatro'),
    ('themepark', 'Eğlence Parkı'),
    ('veganrestaurant', 'Vegan / Sağlıklı Mutfak'),
    ('viewpoint', 'Manzara Noktası'),
    ('vintageStore', 'Vintage Dükkan'),
    ('watersports', 'Su Sporları'),
    ('winery', 'Şarap Evi'),
    ('workshop', 'Deneyim Alanı'),
    ('yoga', 'Yoga / Meditasyon'),
    ('zoo', 'Hayvanat Bahçesi')
  ) as labels(value, label)
  where labels.value = p_category
    or labels.value = any(coalesce(p_categories, '{}'::text[]));
$$;

revoke all on function private.place_category_search_text(text, text[]) from public;
revoke all on function private.place_category_search_text(text, text[]) from anon;
grant execute on function private.place_category_search_text(text, text[]) to authenticated;

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
        '%' as like_pattern,
      pg_catalog.replace(
          pg_catalog.replace(
            pg_catalog.replace(normalized_input.q, E'\\', E'\\\\'),
            '%',
            E'\\%'
          ),
          '_',
          E'\\_'
        ) ||
        '%' as prefix_pattern,
      '% ' ||
        pg_catalog.replace(
          pg_catalog.replace(
            pg_catalog.replace(normalized_input.q, E'\\', E'\\\\'),
            '%',
            E'\\%'
          ),
          '_',
          E'\\_'
        ) ||
        '%' as word_pattern
    from normalized_input
    where normalized_input.q = ''
      or pg_catalog.char_length(normalized_input.q) >= 3
  ),
  list_browse as (
    select
      lists.id as item_id,
      'list'::text as kind,
      extract(epoch from lists.updated_at)::double precision as rank
    from public.lists
    join public.public_profile_summaries owner_profile on owner_profile.id = lists.owner_id
    join request on true
    where p_kind in ('all', 'lists')
      and request.q = ''
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
        p_cursor_rank is null
        or (extract(epoch from lists.updated_at)::double precision, lists.id) <
          (p_cursor_rank, p_cursor_id)
      )
    order by lists.updated_at desc, lists.id desc
    limit (select page_size from request)
  ),
  list_search as (
    select ranked.item_id, 'list'::text as kind, ranked.rank
    from (
      select
        lists.id as item_id,
        (
          case
            when private.normalize_search_text(coalesce(lists.name, '')) like request.prefix_pattern escape E'\\'
              or private.normalize_search_text(coalesce(lists.name, '')) like request.word_pattern escape E'\\'
              then 3
            when private.normalize_search_text(coalesce(lists.name, '')) like request.like_pattern escape E'\\'
              then 2
            else 1
          end
        ) * 10000000000::double precision
          -- Within a tier, someone the viewer follows comes before a stranger:
          -- half a tier exceeds any epoch in seconds until 2128 and stays
          -- below the next tier.
          + case
            when exists (
              select 1
              from public.user_follows
              where user_follows.follower_id = request.viewer_id
                and user_follows.following_id = lists.owner_id
            )
              then 5000000000::double precision
            else 0
          end
          + extract(epoch from lists.updated_at)::double precision as rank
      from public.lists
      join public.public_profile_summaries owner_profile on owner_profile.id = lists.owner_id
      join request on true
      where p_kind in ('all', 'lists')
        and request.q <> ''
        and lists.is_public is true
        and lists.owner_id <> request.viewer_id
        and private.can_view_list(lists.id)
        and not private.users_have_block_relation(request.viewer_id, lists.owner_id)
        and private.normalize_search_text(
          coalesce(lists.name, '') || ' ' || coalesce(lists.description, '')
        ) like request.like_pattern escape E'\\'
    ) ranked
    where p_cursor_rank is null
      or (ranked.rank, ranked.item_id) < (p_cursor_rank, p_cursor_id)
    order by ranked.rank desc, ranked.item_id desc
    limit (select page_size from request)
  ),
  place_browse as (
    select
      list_places.id as item_id,
      'place'::text as kind,
      extract(epoch from list_places.updated_at)::double precision as rank
    from public.list_places
    join public.lists on lists.id = list_places.list_id
    join public.public_profile_summaries owner_profile on owner_profile.id = lists.owner_id
    join request on true
    where p_kind in ('all', 'places', 'photos')
      and request.q = ''
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
        p_cursor_rank is null
        or (extract(epoch from list_places.updated_at)::double precision, list_places.id) <
          (p_cursor_rank, p_cursor_id)
      )
    order by list_places.updated_at desc, list_places.id desc
    limit (select page_size from request)
  ),
  place_search as (
    select ranked.item_id, 'place'::text as kind, ranked.rank
    from (
      select
        list_places.id as item_id,
        (
          case
            when private.normalize_search_text(coalesce(list_places.name, '')) like request.prefix_pattern escape E'\\'
              or private.normalize_search_text(coalesce(list_places.name, '')) like request.word_pattern escape E'\\'
              then 3
            when private.normalize_search_text(coalesce(list_places.name, '')) like request.like_pattern escape E'\\'
              then 2
            else 1
          end
        ) * 10000000000::double precision
          + case
            when exists (
              select 1
              from public.user_follows
              where user_follows.follower_id = request.viewer_id
                and user_follows.following_id = lists.owner_id
            )
              then 5000000000::double precision
            else 0
          end
          + extract(epoch from list_places.updated_at)::double precision as rank
      from public.list_places
      join public.lists on lists.id = list_places.list_id
      join public.public_profile_summaries owner_profile on owner_profile.id = lists.owner_id
      join request on true
      where p_kind in ('all', 'places', 'photos')
        and request.q <> ''
        and lists.is_public is true
        and lists.owner_id <> request.viewer_id
        and private.can_view_list_place(list_places.id)
        and not private.users_have_block_relation(request.viewer_id, lists.owner_id)
        and (
          p_kind <> 'photos'
          or exists (
            select 1
            from public.list_place_photos
            where list_place_photos.list_place_id = list_places.id
          )
        )
        and (
          private.normalize_search_text(
            coalesce(list_places.name, '') || ' ' ||
            coalesce(list_places.address, '') || ' ' ||
            coalesce(list_places.notes, '')
          ) like request.like_pattern escape E'\\'
          or private.normalize_search_text(coalesce(lists.name, ''))
            like request.like_pattern escape E'\\'
          or private.normalize_search_text(
            coalesce(owner_profile.name, '') || ' ' || coalesce(owner_profile.username, '')
          ) like request.like_pattern escape E'\\'
          or private.normalize_search_text(
            private.place_category_search_text(list_places.category, list_places.categories)
          ) like request.like_pattern escape E'\\'
        )
    ) ranked
    where p_cursor_rank is null
      or (ranked.rank, ranked.item_id) < (p_cursor_rank, p_cursor_id)
    order by ranked.rank desc, ranked.item_id desc
    limit (select page_size from request)
  ),
  user_browse as (
    select
      profiles.id as item_id,
      'user'::text as kind,
      extract(epoch from profiles.updated_at)::double precision as rank
    from public.public_profile_summaries profiles
    join request on true
    where p_kind in ('all', 'users')
      and request.q = ''
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
        p_cursor_rank is null
        or (extract(epoch from profiles.updated_at)::double precision, profiles.id) <
          (p_cursor_rank, p_cursor_id)
      )
    order by profiles.updated_at desc, profiles.id desc
    limit (select page_size from request)
  ),
  user_search as (
    select ranked.item_id, 'user'::text as kind, ranked.rank
    from (
      select
        profiles.id as item_id,
        (
          case
            when private.normalize_search_text(coalesce(profiles.username, '')) like request.prefix_pattern escape E'\\'
              or private.normalize_search_text(coalesce(profiles.name, '')) like request.prefix_pattern escape E'\\'
              or private.normalize_search_text(coalesce(profiles.name, '')) like request.word_pattern escape E'\\'
              then 3
            when private.normalize_search_text(
              coalesce(profiles.name, '') || ' ' || coalesce(profiles.username, '')
            ) like request.like_pattern escape E'\\'
              then 2
            else 1
          end
        ) * 10000000000::double precision
          + case
            when exists (
              select 1
              from public.user_follows
              where user_follows.follower_id = request.viewer_id
                and user_follows.following_id = profiles.id
            )
              then 5000000000::double precision
            else 0
          end
          + extract(epoch from profiles.updated_at)::double precision as rank
      from public.public_profile_summaries profiles
      join request on true
      where p_kind in ('all', 'users')
        and request.q <> ''
        and profiles.id <> request.viewer_id
        and not private.users_have_block_relation(request.viewer_id, profiles.id)
        and private.normalize_search_text(
          coalesce(profiles.name, '') || ' ' ||
          coalesce(profiles.username, '') || ' ' ||
          coalesce(profiles.bio, '')
        ) like request.like_pattern escape E'\\'
    ) ranked
    where p_cursor_rank is null
      or (ranked.rank, ranked.item_id) < (p_cursor_rank, p_cursor_id)
    order by ranked.rank desc, ranked.item_id desc
    limit (select page_size from request)
  ),
  selected as (
    select * from list_browse
    union all
    select * from list_search
    union all
    select * from place_browse
    union all
    select * from place_search
    union all
    select * from user_browse
    union all
    select * from user_search
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
revoke all on function public.explore_page(text, text, double precision, uuid, integer) from anon;
grant execute on function public.explore_page(text, text, double precision, uuid, integer) to authenticated;

commit;
