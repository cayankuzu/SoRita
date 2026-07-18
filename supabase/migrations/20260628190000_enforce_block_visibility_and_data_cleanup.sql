create or replace function private.normalize_optional_media_url(value text)
returns text
language sql
immutable
as $$
  select nullif(private.clamp_text(value, 2048), '');
$$;

create or replace function private.can_view_list(target_list_id uuid)
returns boolean
language sql
security definer
set search_path = pg_catalog, public, private
as $$
  select exists (
    select 1
    from public.lists
    where lists.id = target_list_id
      and (lists.is_public or lists.owner_id = auth.uid())
      and (
        lists.owner_id = auth.uid()
        or not private.users_have_block_relation(auth.uid(), lists.owner_id)
      )
  );
$$;

revoke all on function private.can_view_list(uuid) from public;
grant execute on function private.can_view_list(uuid) to authenticated;

create or replace function private.can_view_list_place(target_list_place_id uuid)
returns boolean
language sql
security definer
set search_path = pg_catalog, public, private
as $$
  select exists (
    select 1
    from public.list_places
    join public.lists on lists.id = list_places.list_id
    where list_places.id = target_list_place_id
      and private.can_view_list(lists.id)
      and (
        list_places.created_by is null
        or list_places.created_by = auth.uid()
        or not private.users_have_block_relation(auth.uid(), list_places.created_by)
      )
      and (
        list_places.source_user_id is null
        or list_places.source_user_id = auth.uid()
        or not private.users_have_block_relation(auth.uid(), list_places.source_user_id)
      )
  );
$$;

revoke all on function private.can_view_list_place(uuid) from public;
grant execute on function private.can_view_list_place(uuid) to authenticated;

create or replace function private.can_view_list_place_comment(target_comment_id uuid)
returns boolean
language sql
security definer
set search_path = pg_catalog, public, private
as $$
  select exists (
    select 1
    from public.list_place_comments
    where list_place_comments.id = target_comment_id
      and private.can_view_list_place(list_place_comments.list_place_id)
      and (
        list_place_comments.user_id = auth.uid()
        or not private.users_have_block_relation(auth.uid(), list_place_comments.user_id)
      )
  );
$$;

revoke all on function private.can_view_list_place_comment(uuid) from public;
grant execute on function private.can_view_list_place_comment(uuid) to authenticated;

create or replace function public.normalize_profile_fields()
returns trigger
language plpgsql
set search_path = public, private
as $$
begin
  new.email := private.normalize_email(new.email);
  new.name := private.normalize_required_text(new.name, 60);
  new.username := private.normalize_username(new.username);
  new.bio := private.normalize_optional_text(new.bio, 150);
  new.profile_photo_url := private.normalize_optional_media_url(new.profile_photo_url);
  new.cover_photo_url := private.normalize_optional_media_url(new.cover_photo_url);
  new.interests := private.normalize_text_array(new.interests, 20, 40);

  if char_length(new.name) < 2 then
    raise exception 'Profile name must be at least 2 characters long';
  end if;

  if char_length(new.email) < 3 or new.email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Profile email is invalid';
  end if;

  if new.username !~ '^[a-z0-9_]{3,30}$' then
    raise exception 'Profile username must be 3-30 lowercase letters, numbers, or underscores';
  end if;

  return new;
end;
$$;

create or replace function public.normalize_list_fields()
returns trigger
language plpgsql
set search_path = public, private
as $$
begin
  new.name := private.normalize_required_text(new.name, 100);
  new.description := private.normalize_optional_text(new.description, 300);
  new.emoji := private.normalize_optional_text(new.emoji, 8);
  new.cover_image_url := private.normalize_optional_media_url(new.cover_image_url);

  if char_length(new.name) < 1 then
    raise exception 'List name is required';
  end if;

  return new;
end;
$$;

create or replace function public.normalize_list_place_fields()
returns trigger
language plpgsql
set search_path = public, private
as $$
begin
  new.name := private.normalize_required_text(new.name, 100);
  new.title := private.normalize_optional_text(new.title, 100);
  new.address := private.normalize_optional_text(new.address, 150);
  new.notes := private.normalize_optional_text(new.notes, 300);
  new.category := private.normalize_optional_text(new.category, 40);
  new.categories := private.normalize_text_array(new.categories, 12, 40);
  new.best_time := private.normalize_optional_text(new.best_time, 40);
  new.best_times := private.normalize_text_array(new.best_times, 8, 40);
  new.atmosphere := private.normalize_text_array(new.atmosphere, 12, 40);
  new.special_features := private.normalize_text_array(new.special_features, 12, 40);
  new.source_place_name := case
    when new.source_place_id is null then null
    else private.normalize_optional_text(new.source_place_name, 100)
  end;
  new.source_user_avatar_url := case
    when new.source_user_id is null then null
    else private.normalize_optional_media_url(new.source_user_avatar_url)
  end;
  new.source_user_name := case
    when new.source_user_id is null then null
    else private.normalize_optional_text(new.source_user_name, 60)
  end;

  if char_length(new.name) < 1 then
    raise exception 'Place name is required';
  end if;

  if new.lat < -90 or new.lat > 90 then
    raise exception 'Place latitude is out of range';
  end if;

  if new.lng < -180 or new.lng > 180 then
    raise exception 'Place longitude is out of range';
  end if;

  return new;
end;
$$;

create or replace function public.normalize_list_place_photo_fields()
returns trigger
language plpgsql
set search_path = public, private
as $$
begin
  new.url := private.normalize_required_text(new.url, 2048);
  new.thumbnail_url := private.normalize_optional_media_url(new.thumbnail_url);
  new.mime_type := private.normalize_optional_text(new.mime_type, 100);

  if char_length(new.url) < 1 then
    raise exception 'Place media url is required';
  end if;

  return new;
end;
$$;

create or replace function private.handle_profile_delete_cleanup()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
begin
  update public.list_places
  set
    source_list_id = null,
    source_place_id = null,
    source_place_name = null,
    source_user_id = null,
    source_user_name = null,
    source_user_avatar_url = null
  where source_user_id = old.id;

  return old;
end;
$$;

revoke all on function private.handle_profile_delete_cleanup() from public;

update public.profiles
set
  profile_photo_url = private.normalize_optional_media_url(profile_photo_url),
  cover_photo_url = private.normalize_optional_media_url(cover_photo_url);

update public.lists
set
  cover_image_url = private.normalize_optional_media_url(cover_image_url);

update public.list_places
set
  source_place_name = case
    when source_place_id is null then null
    else private.normalize_optional_text(source_place_name, 100)
  end,
  source_user_avatar_url = case
    when source_user_id is null then null
    else private.normalize_optional_media_url(source_user_avatar_url)
  end,
  source_user_name = case
    when source_user_id is null then null
    else private.normalize_optional_text(source_user_name, 60)
  end;

update public.list_place_photos
set
  url = private.normalize_required_text(url, 2048),
  thumbnail_url = private.normalize_optional_media_url(thumbnail_url),
  mime_type = private.normalize_optional_text(mime_type, 100);

drop trigger if exists list_place_photos_normalize_security_fields on public.list_place_photos;
create trigger list_place_photos_normalize_security_fields
before insert or update on public.list_place_photos
for each row
execute function public.normalize_list_place_photo_fields();

drop trigger if exists profiles_cleanup_before_delete on public.profiles;
create trigger profiles_cleanup_before_delete
before delete on public.profiles
for each row
execute function private.handle_profile_delete_cleanup();

alter table public.profiles
drop constraint if exists profiles_profile_photo_url_not_blank_check;

alter table public.profiles
add constraint profiles_profile_photo_url_not_blank_check
check (profile_photo_url is null or char_length(profile_photo_url) > 0);

alter table public.profiles
drop constraint if exists profiles_cover_photo_url_not_blank_check;

alter table public.profiles
add constraint profiles_cover_photo_url_not_blank_check
check (cover_photo_url is null or char_length(cover_photo_url) > 0);

alter table public.lists
drop constraint if exists lists_cover_image_url_not_blank_check;

alter table public.lists
add constraint lists_cover_image_url_not_blank_check
check (cover_image_url is null or char_length(cover_image_url) > 0);

alter table public.list_places
drop constraint if exists list_places_source_place_name_not_blank_check;

alter table public.list_places
add constraint list_places_source_place_name_not_blank_check
check (source_place_name is null or char_length(source_place_name) > 0);

alter table public.list_places
drop constraint if exists list_places_source_user_name_not_blank_check;

alter table public.list_places
add constraint list_places_source_user_name_not_blank_check
check (source_user_name is null or char_length(source_user_name) > 0);

alter table public.list_places
drop constraint if exists list_places_source_user_avatar_url_not_blank_check;

alter table public.list_places
add constraint list_places_source_user_avatar_url_not_blank_check
check (source_user_avatar_url is null or char_length(source_user_avatar_url) > 0);

alter table public.list_place_photos
drop constraint if exists list_place_photos_url_not_blank_check;

alter table public.list_place_photos
add constraint list_place_photos_url_not_blank_check
check (char_length(url) > 0);

alter table public.list_place_photos
drop constraint if exists list_place_photos_thumbnail_url_not_blank_check;

alter table public.list_place_photos
add constraint list_place_photos_thumbnail_url_not_blank_check
check (thumbnail_url is null or char_length(thumbnail_url) > 0);

drop policy if exists "lists_select_visible" on public.lists;
create policy "lists_select_visible"
on public.lists
for select
to authenticated
using (private.can_view_list(id));

drop policy if exists "list_places_select_visible" on public.list_places;
create policy "list_places_select_visible"
on public.list_places
for select
to authenticated
using (private.can_view_list_place(id));

drop policy if exists "list_place_photos_select_visible" on public.list_place_photos;
create policy "list_place_photos_select_visible"
on public.list_place_photos
for select
to authenticated
using (private.can_view_list_place(list_place_id));

drop policy if exists "list_likes_select_authenticated" on public.list_likes;
create policy "list_likes_select_authenticated"
on public.list_likes
for select
to authenticated
using (
  private.can_view_list(list_id)
  and (
    user_id = auth.uid()
    or not private.users_have_block_relation(auth.uid(), user_id)
  )
);

drop policy if exists "list_likes_insert_self" on public.list_likes;
create policy "list_likes_insert_self"
on public.list_likes
for insert
to authenticated
with check (user_id = auth.uid() and private.can_view_list(list_id));

drop policy if exists "list_place_likes_select_visible" on public.list_place_likes;
create policy "list_place_likes_select_visible"
on public.list_place_likes
for select
to authenticated
using (
  private.can_view_list_place(list_place_id)
  and (
    user_id = auth.uid()
    or not private.users_have_block_relation(auth.uid(), user_id)
  )
);

drop policy if exists "list_place_comments_select_visible" on public.list_place_comments;
create policy "list_place_comments_select_visible"
on public.list_place_comments
for select
to authenticated
using (
  private.can_view_list_place(list_place_id)
  and (
    user_id = auth.uid()
    or not private.users_have_block_relation(auth.uid(), user_id)
  )
);

drop policy if exists "list_place_comments_update_self" on public.list_place_comments;
create policy "list_place_comments_update_self"
on public.list_place_comments
for update
to authenticated
using (user_id = auth.uid() and private.can_view_list_place(list_place_id))
with check (
  user_id = auth.uid()
  and private.can_view_list_place(list_place_id)
  and private.comment_parent_matches_place(list_place_id, parent_comment_id)
);

drop policy if exists "list_place_comment_likes_select_visible" on public.list_place_comment_likes;
create policy "list_place_comment_likes_select_visible"
on public.list_place_comment_likes
for select
to authenticated
using (
  private.can_view_list_place_comment(comment_id)
  and (
    user_id = auth.uid()
    or not private.users_have_block_relation(auth.uid(), user_id)
  )
);

drop policy if exists "notifications_select_recipient" on public.notifications;
create policy "notifications_select_recipient"
on public.notifications
for select
to authenticated
using (
  recipient_user_id = auth.uid()
  and (
    actor_user_id is null
    or actor_user_id = auth.uid()
    or not private.users_have_block_relation(auth.uid(), actor_user_id)
  )
);

create or replace function private.get_place_list_reference_summaries(
  input_owner_id uuid,
  input_place_name text,
  input_lat double precision,
  input_lng double precision
)
returns table (
  list_id uuid,
  place_id uuid,
  list_name text,
  list_cover_image_url text,
  list_is_public boolean,
  list_updated_at timestamptz,
  place_added_at timestamptz,
  place_updated_at timestamptz,
  is_locked boolean
)
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  viewer_id uuid := auth.uid();
begin
  if input_owner_id is null
    or nullif(trim(coalesce(input_place_name, '')), '') is null
    or input_lat is null
    or input_lng is null then
    return;
  end if;

  if viewer_id is not null and private.users_have_block_relation(viewer_id, input_owner_id) then
    return;
  end if;

  if viewer_id = input_owner_id then
    return query
    select
      lists.id,
      list_places.id,
      lists.name,
      lists.cover_image_url,
      lists.is_public,
      lists.updated_at,
      list_places.added_at,
      coalesce(list_places.updated_at, list_places.added_at),
      false
    from public.lists
    join public.list_places on list_places.list_id = lists.id
    where lists.owner_id = input_owner_id
      and lower(trim(list_places.name)) = lower(trim(input_place_name))
      and abs(list_places.lat - input_lat) < 0.00001
      and abs(list_places.lng - input_lng) < 0.00001
    order by coalesce(list_places.updated_at, list_places.added_at) desc, lists.updated_at desc;

    return;
  end if;

  return query
  with matching_rows as (
    select
      lists.id as list_id,
      list_places.id as place_id,
      lists.name as list_name,
      lists.cover_image_url as list_cover_image_url,
      lists.is_public as list_is_public,
      lists.updated_at as list_updated_at,
      list_places.added_at as place_added_at,
      coalesce(list_places.updated_at, list_places.added_at) as place_updated_at
    from public.lists
    join public.list_places on list_places.list_id = lists.id
    where lists.owner_id = input_owner_id
      and lower(trim(list_places.name)) = lower(trim(input_place_name))
      and abs(list_places.lat - input_lat) < 0.00001
      and abs(list_places.lng - input_lng) < 0.00001
  ),
  public_rows as (
    select
      matching_rows.list_id,
      matching_rows.place_id,
      matching_rows.list_name,
      matching_rows.list_cover_image_url,
      matching_rows.list_is_public,
      matching_rows.list_updated_at,
      matching_rows.place_added_at,
      matching_rows.place_updated_at,
      false as is_locked
    from matching_rows
    where matching_rows.list_is_public = true
  ),
  private_locked_rows as (
    select
      null::uuid as list_id,
      null::uuid as place_id,
      null::text as list_name,
      null::text as list_cover_image_url,
      false as list_is_public,
      matching_rows.list_updated_at,
      matching_rows.place_added_at,
      matching_rows.place_updated_at,
      true as is_locked
    from matching_rows
    where matching_rows.list_is_public = false
  )
  select *
  from public_rows
  union all
  select *
  from private_locked_rows
  where exists (select 1 from public_rows)
  order by place_updated_at desc, list_updated_at desc;
end;
$$;

revoke all on function private.get_place_list_reference_summaries(uuid, text, double precision, double precision) from public;
grant execute on function private.get_place_list_reference_summaries(uuid, text, double precision, double precision) to authenticated;

drop function if exists public.can_view_list(uuid);
