-- Keep existing paged read models backward compatible while hydrating every card
-- with its complete media set and authoritative summary counts.

begin;

create or replace function public.feed_page_complete(
  p_cursor_published_at timestamptz default null,
  p_cursor_id uuid default null,
  p_limit integer default 20
)
returns table (item jsonb)
language sql
stable
security invoker
set search_path = pg_catalog, public, private
as $$
  select
    to_jsonb(feed_row) || jsonb_build_object(
      'media', coalesce((
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
          )
          order by media.sort_order asc, media.created_at asc
        )
        from public.list_place_photos media
        where media.list_place_id = feed_row.place_id
      ), '[]'::jsonb),
      'location_place_cards_count', (
        select count(*)::bigint
        from public.list_places related_place
        join public.lists related_list on related_list.id = related_place.list_id
        where related_list.owner_id = feed_row.owner_id
          and round(related_place.lat::numeric, 5) = round(feed_row.lat::numeric, 5)
          and round(related_place.lng::numeric, 5) = round(feed_row.lng::numeric, 5)
          and lower(regexp_replace(trim(related_place.name), '\s+', ' ', 'g')) =
            lower(regexp_replace(trim(feed_row.place_name), '\s+', ' ', 'g'))
          and private.can_view_list_place(related_place.id)
      )
    ) as item
  from public.feed_page(
    p_cursor_published_at,
    p_cursor_id,
    p_limit
  ) feed_row
  order by feed_row.published_at desc, feed_row.feed_item_id desc;
$$;

revoke all on function public.feed_page_complete(timestamptz, uuid, integer) from public;
grant execute on function public.feed_page_complete(timestamptz, uuid, integer) to authenticated;

create or replace function public.explore_page_complete(
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
  select
    page_row.item_id,
    page_row.kind,
    page_row.rank,
    case page_row.kind
      when 'list' then page_row.item || jsonb_build_object(
        'createdAt', (
          select lists.created_at
          from public.lists
          where lists.id = page_row.item_id
            and private.can_view_list(lists.id)
        ),
        'placeCount', (
          select count(*)::bigint
          from public.list_places
          where list_places.list_id = page_row.item_id
            and private.can_view_list_place(list_places.id)
        )
      )
      when 'place' then page_row.item || jsonb_build_object(
        'media', coalesce((
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
            )
            order by media.sort_order asc, media.created_at asc
          )
          from public.list_place_photos media
          where media.list_place_id = page_row.item_id
        ), '[]'::jsonb),
        'locationPlaceCardsCount', (
          select count(*)::bigint
          from public.list_places related_place
          join public.lists related_list on related_list.id = related_place.list_id
          join public.list_places target_place on target_place.id = page_row.item_id
          join public.lists target_list on target_list.id = target_place.list_id
          where related_list.owner_id = target_list.owner_id
            and round(related_place.lat::numeric, 5) = round(target_place.lat::numeric, 5)
            and round(related_place.lng::numeric, 5) = round(target_place.lng::numeric, 5)
            and lower(regexp_replace(trim(related_place.name), '\s+', ' ', 'g')) =
              lower(regexp_replace(trim(target_place.name), '\s+', ' ', 'g'))
            and private.can_view_list_place(related_place.id)
        )
      )
      else page_row.item
    end as item
  from public.explore_page(
    p_kind,
    p_query,
    p_cursor_rank,
    p_cursor_id,
    p_limit
  ) page_row
  order by page_row.rank desc, page_row.item_id desc;
$$;

revoke all on function public.explore_page_complete(text, text, double precision, uuid, integer) from public;
grant execute on function public.explore_page_complete(text, text, double precision, uuid, integer) to authenticated;

create or replace function public.profile_content_page_complete(
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
  select
    page_row.item_id,
    page_row.sort_at,
    case page_row.item ->> 'type'
      when 'list' then page_row.item || jsonb_build_object(
        'placeCount', (
          select count(*)::bigint
          from public.list_places
          where list_places.list_id = page_row.item_id
            and private.can_view_list_place(list_places.id)
        )
      )
      when 'place' then page_row.item || jsonb_build_object(
        'media', coalesce((
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
            )
            order by media.sort_order asc, media.created_at asc
          )
          from public.list_place_photos media
          where media.list_place_id = page_row.item_id
        ), '[]'::jsonb),
        'locationPlaceCardsCount', (
          select count(*)::bigint
          from public.list_places related_place
          join public.lists related_list on related_list.id = related_place.list_id
          join public.list_places target_place on target_place.id = page_row.item_id
          join public.lists target_list on target_list.id = target_place.list_id
          where related_list.owner_id = target_list.owner_id
            and round(related_place.lat::numeric, 5) = round(target_place.lat::numeric, 5)
            and round(related_place.lng::numeric, 5) = round(target_place.lng::numeric, 5)
            and lower(regexp_replace(trim(related_place.name), '\s+', ' ', 'g')) =
              lower(regexp_replace(trim(target_place.name), '\s+', ' ', 'g'))
            and private.can_view_list_place(related_place.id)
        )
      )
      else page_row.item
    end as item
  from public.profile_content_page(
    p_user_id,
    p_tab,
    p_cursor,
    p_cursor_id,
    p_limit
  ) page_row
  order by page_row.sort_at desc, page_row.item_id desc;
$$;

revoke all on function public.profile_content_page_complete(uuid, text, timestamptz, uuid, integer) from public;
grant execute on function public.profile_content_page_complete(uuid, text, timestamptz, uuid, integer) to authenticated;

commit;
