-- Extend the existing private place-media authorization source of truth to
-- list covers. Private list covers are stored in the same bucket and use the
-- same signed-read endpoint, but they do not have a list_place_photos row.

create index if not exists idx_lists_cover_image_url
on public.lists (cover_image_url)
where cover_image_url is not null;

create or replace function public.can_read_private_place_media(
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
  ),
  list_cover_rows as (
    select
      lists.owner_id,
      lists.is_public
    from requested
    join public.lists
      on lists.cover_image_url = 'sorita-storage://' || requested.bucket || '/' || requested.path
  )
  select coalesce((
    select case
      when p_viewer_id is null then false
      when requested.bucket <> 'place-media-private' then false
      when char_length(requested.path) not between 1 and 512 then false
      when requested.path !~ '^[a-zA-Z0-9/_.,-]+$' then false
      when requested.path ~ '(^|/)\.\.(/|$)' then false
      when split_part(requested.path, '/', 1) = p_viewer_id::text then true
      else
        exists (
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
        or exists (
          select 1
          from list_cover_rows
          where (list_cover_rows.owner_id = p_viewer_id or list_cover_rows.is_public)
            and (
              list_cover_rows.owner_id = p_viewer_id
              or not private.users_have_block_relation(p_viewer_id, list_cover_rows.owner_id)
            )
        )
    end
    from requested
  ), false);
$$;

revoke all on function public.can_read_private_place_media(text, text, uuid)
from public, anon, authenticated;
grant execute on function public.can_read_private_place_media(text, text, uuid) to service_role;
