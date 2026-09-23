-- A profile's Gallery tab showed no count until every page of places had
-- loaded, because the summary counted lists and places but not the places
-- that carry media. gallery_count is exactly what the tab shows: the places
-- the viewer may see that have at least one photo or video.
--
-- Adding an output column changes the return type, so the function is dropped
-- and recreated with the same body, security and grants as before.

drop function if exists public.profile_summary(uuid);

create function public.profile_summary(p_user_id uuid)
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
  gallery_count bigint,
  viewer_has_followed boolean,
  viewer_has_pending_follow_request boolean,
  is_blocked_by_viewer boolean,
  is_blocking_viewer boolean,
  can_view_content boolean
)
language sql
stable
set search_path to 'pg_catalog', 'public', 'private'
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
    (
      select count(*)
      from public.list_places
      join public.lists on lists.id = list_places.list_id
      where lists.owner_id = profiles.id
        and private.can_view_list_place(list_places.id)
        and exists (
          select 1
          from public.list_place_photos
          where list_place_photos.list_place_id = list_places.id
        )
    )::bigint as gallery_count,
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
grant execute on function public.profile_summary(uuid) to anon;
grant execute on function public.profile_summary(uuid) to authenticated;
grant execute on function public.profile_summary(uuid) to service_role;
