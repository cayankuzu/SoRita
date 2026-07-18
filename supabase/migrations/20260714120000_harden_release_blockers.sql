create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

drop function if exists public.get_public_profile(uuid);
create function public.get_public_profile(target_user_id uuid)
returns table (
  id uuid,
  name text,
  username text,
  is_public_account boolean,
  bio text,
  profile_photo_url text,
  cover_photo_url text,
  interests text[],
  created_at timestamptz,
  updated_at timestamptz
)
language sql
stable
security invoker
set search_path = pg_catalog, public
as $$
  select
    public_profile_summaries.id,
    public_profile_summaries.name,
    public_profile_summaries.username,
    public_profile_summaries.is_public_account,
    public_profile_summaries.bio,
    public_profile_summaries.profile_photo_url,
    public_profile_summaries.cover_photo_url,
    public_profile_summaries.interests,
    public_profile_summaries.created_at,
    public_profile_summaries.updated_at
  from public.public_profile_summaries
  where auth.uid() is not null
    and public_profile_summaries.id = target_user_id
  limit 1;
$$;
revoke all on function public.get_public_profile(uuid) from public;
grant execute on function public.get_public_profile(uuid) to authenticated;

create or replace function public.check_block_state(
  p_current_user_id uuid,
  p_target_user_id uuid
)
returns table (
  is_blocked_by_me boolean,
  is_blocking_me boolean
)
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select
    case
      when auth.uid() = p_current_user_id then exists (
        select 1
        from public.user_blocks
        where blocker_user_id = p_current_user_id
          and blocked_user_id = p_target_user_id
      )
      else false
    end as is_blocked_by_me,
    case
      when auth.uid() = p_current_user_id then exists (
        select 1
        from public.user_blocks
        where blocker_user_id = p_target_user_id
          and blocked_user_id = p_current_user_id
      )
      else false
    end as is_blocking_me;
$$;
revoke all on function public.check_block_state(uuid, uuid) from public;
grant execute on function public.check_block_state(uuid, uuid) to authenticated;

create or replace function private.toggle_list_place_like(target_place_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'Authentication required'
      using errcode = '28000';
  end if;

  if not private.can_view_list_place(target_place_id) then
    raise exception 'Place is not visible'
      using errcode = '42501';
  end if;

  delete from public.list_place_likes
  where list_place_id = target_place_id
    and user_id = current_user_id;

  if found then
    return;
  end if;

  insert into public.list_place_likes (list_place_id, user_id)
  values (target_place_id, current_user_id)
  on conflict (list_place_id, user_id) do nothing;
end;
$$;
revoke all on function private.toggle_list_place_like(uuid) from public;
grant execute on function private.toggle_list_place_like(uuid) to authenticated;

create or replace function public.toggle_list_place_like(target_place_id uuid)
returns void
language plpgsql
security invoker
set search_path = pg_catalog, public, private
as $$
begin
  perform private.toggle_list_place_like(target_place_id);
end;
$$;
revoke all on function public.toggle_list_place_like(uuid) from public;
grant execute on function public.toggle_list_place_like(uuid) to authenticated;

alter table public.list_place_photos
  drop constraint if exists list_place_photos_duration_ms_check;
alter table public.list_place_photos
  add constraint list_place_photos_duration_ms_check
  check (duration_ms is null or (duration_ms > 0 and duration_ms <= 60000));

update storage.buckets
set file_size_limit = 52428800
where id = 'place-media';

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'place-media-private',
  'place-media-private',
  false,
  52428800,
  array[
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/heic',
    'video/mp4',
    'video/quicktime',
    'video/x-m4v',
    'video/3gpp',
    'video/webm'
  ]
)
on conflict (id) do update
set
  name = excluded.name,
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
