-- Resolve a page of private media permissions with one database round-trip.
-- The scalar function remains the single authorization source of truth.

drop function if exists public.can_read_private_place_media_batch(text, text[], uuid);
create function public.can_read_private_place_media_batch(
  p_bucket text,
  p_paths text[],
  p_viewer_id uuid
)
returns table(path text, allowed boolean)
language sql
stable
security definer
set search_path = pg_catalog, public, private
as $$
  select
    requested.path,
    public.can_read_private_place_media(
      p_bucket,
      requested.path,
      p_viewer_id
    ) as allowed
  from (
    select distinct regexp_replace(trim(coalesce(raw_path, '')), '^/+', '') as path
    from unnest(coalesce(p_paths, array[]::text[])) as paths(raw_path)
    limit 64
  ) as requested
  where requested.path <> '';
$$;

revoke all on function public.can_read_private_place_media_batch(text, text[], uuid) from public;
grant execute on function public.can_read_private_place_media_batch(text, text[], uuid) to service_role;

-- Fetch one keyset-paginated set of top-level comments and all of their replies
-- without a client-side reply waterfall.
drop function if exists public.place_comment_threads_page(uuid, timestamptz, uuid, integer);
create function public.place_comment_threads_page(
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
  like_count bigint,
  viewer_has_liked boolean,
  thread_id uuid,
  thread_created_at timestamptz
)
language sql
stable
security invoker
set search_path = pg_catalog, public, private
as $$
  with top_level as (
    select comments.id, comments.created_at
    from public.list_place_comments comments
    where comments.list_place_id = p_list_place_id
      and comments.parent_comment_id is null
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
    limit least(greatest(coalesce(p_limit, 20), 1), 50)
  ),
  thread_rows as (
    select comments.*, top_level.id as root_id, top_level.created_at as root_created_at
    from top_level
    join public.list_place_comments comments
      on comments.id = top_level.id
      or comments.parent_comment_id = top_level.id
    where comments.user_id = auth.uid()
      or not private.users_have_block_relation(auth.uid(), comments.user_id)
  )
  select
    thread_rows.id,
    thread_rows.list_place_id,
    thread_rows.user_id,
    thread_rows.parent_comment_id,
    thread_rows.content,
    thread_rows.created_at,
    thread_rows.updated_at,
    (
      select count(*)::bigint
      from public.list_place_comment_likes likes
      where likes.comment_id = thread_rows.id
    ) as like_count,
    exists (
      select 1
      from public.list_place_comment_likes likes
      where likes.comment_id = thread_rows.id
        and likes.user_id = auth.uid()
    ) as viewer_has_liked,
    thread_rows.root_id as thread_id,
    thread_rows.root_created_at as thread_created_at
  from thread_rows
  order by
    thread_rows.root_created_at desc,
    thread_rows.root_id desc,
    (thread_rows.parent_comment_id is null) desc,
    thread_rows.created_at asc,
    thread_rows.id asc;
$$;

revoke all on function public.place_comment_threads_page(uuid, timestamptz, uuid, integer) from public;
grant execute on function public.place_comment_threads_page(uuid, timestamptz, uuid, integer) to authenticated;
