-- The comments sheet showed its rows only after the app had downloaded every
-- visible user, because place_comment_threads_page returned an author id and
-- nothing else. On a slow connection the sheet sat on its loading state, and a
-- comment whose author was not in that download read "SoRita" with no photo.
--
-- The page now carries each comment's author name, username and photo, joined
-- from the same public profile summaries the feed and notifications use, so
-- one request draws the sheet. Replies are joined through two index-backed
-- lookups instead of one OR join. Visibility, block filtering, ordering and
-- paging are unchanged; the return type grows, so the function is recreated.

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
  thread_created_at timestamptz,
  author_name text,
  author_username text,
  author_profile_photo_url text
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
    join public.list_place_comments comments on comments.id = top_level.id
    union all
    select comments.*, top_level.id as root_id, top_level.created_at as root_created_at
    from top_level
    join public.list_place_comments comments on comments.parent_comment_id = top_level.id
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
    thread_rows.root_created_at as thread_created_at,
    author_profile.name as author_name,
    author_profile.username as author_username,
    author_profile.profile_photo_url as author_profile_photo_url
  from thread_rows
  left join public.public_profile_summaries author_profile
    on author_profile.id = thread_rows.user_id
  order by
    thread_rows.root_created_at desc,
    thread_rows.root_id desc,
    (thread_rows.parent_comment_id is null) desc,
    thread_rows.created_at asc,
    thread_rows.id asc;
$$;

-- Supabase's default privileges grant new functions to anon directly, which
-- revoking from public leaves in place. Comments are for signed-in viewers.
revoke all on function public.place_comment_threads_page(uuid, timestamptz, uuid, integer) from public;
revoke all on function public.place_comment_threads_page(uuid, timestamptz, uuid, integer) from anon;
grant execute on function public.place_comment_threads_page(uuid, timestamptz, uuid, integer) to authenticated;
