create schema if not exists private;

revoke all on schema private from public;
grant usage on schema private to anon, authenticated;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create or replace function private.can_manage_list_place(target_list_place_id uuid)
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
      and lists.owner_id = auth.uid()
  );
$$;

revoke all on function private.can_manage_list_place(uuid) from public;
grant execute on function private.can_manage_list_place(uuid) to authenticated;

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
      and (lists.is_public or lists.owner_id = auth.uid())
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
  );
$$;

revoke all on function private.can_view_list_place_comment(uuid) from public;
grant execute on function private.can_view_list_place_comment(uuid) to authenticated;

create or replace function private.comment_parent_matches_place(
  target_list_place_id uuid,
  target_parent_comment_id uuid
)
returns boolean
language sql
security definer
set search_path = pg_catalog, public, private
as $$
  select
    target_parent_comment_id is null
    or exists (
      select 1
      from public.list_place_comments
      where id = target_parent_comment_id
        and list_place_id = target_list_place_id
    );
$$;

revoke all on function private.comment_parent_matches_place(uuid, uuid) from public;
grant execute on function private.comment_parent_matches_place(uuid, uuid) to authenticated;

create or replace function private.users_have_block_relation(user_a uuid, user_b uuid)
returns boolean
language sql
security definer
set search_path = pg_catalog, public, private
as $$
  select exists (
    select 1
    from public.user_blocks
    where (blocker_user_id = user_a and blocked_user_id = user_b)
       or (blocker_user_id = user_b and blocked_user_id = user_a)
  );
$$;

revoke all on function private.users_have_block_relation(uuid, uuid) from public;
grant execute on function private.users_have_block_relation(uuid, uuid) to authenticated;

create or replace function private.create_notification(
  target_recipient_user_id uuid,
  target_actor_user_id uuid,
  target_type text,
  target_message text,
  target_list_id uuid default null,
  target_list_place_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
begin
  if target_recipient_user_id is null or target_actor_user_id is null then
    return;
  end if;

  if target_recipient_user_id = target_actor_user_id then
    return;
  end if;

  if private.users_have_block_relation(target_recipient_user_id, target_actor_user_id) then
    return;
  end if;

  insert into public.notifications (
    recipient_user_id,
    actor_user_id,
    type,
    message,
    list_id,
    list_place_id
  )
  values (
    target_recipient_user_id,
    target_actor_user_id,
    target_type,
    target_message,
    target_list_id,
    target_list_place_id
  );
end;
$$;

revoke all on function private.create_notification(uuid, uuid, text, text, uuid, uuid) from public;

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  next_name text;
  next_username text;
  next_interests text[];
begin
  next_name := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'name'), ''),
    split_part(coalesce(new.email, ''), '@', 1),
    'Yeni Kullanici'
  );

  next_username := public.resolve_profile_username(
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'username'), ''),
      regexp_replace(split_part(coalesce(new.email, ''), '@', 1), '[^a-zA-Z0-9_]', '', 'g'),
      'user_' || left(new.id::text, 8)
    ),
    new.id
  );

  next_interests := case
    when jsonb_typeof(new.raw_user_meta_data -> 'interests') = 'array'
      then array(select jsonb_array_elements_text(new.raw_user_meta_data -> 'interests'))
    else '{}'::text[]
  end;

  insert into public.profiles (
    id,
    email,
    name,
    username,
    is_public_account,
    bio,
    interests,
    profile_photo_url,
    cover_photo_url
  )
  values (
    new.id,
    coalesce(new.email, ''),
    next_name,
    next_username,
    true,
    nullif(new.raw_user_meta_data ->> 'bio', ''),
    next_interests,
    nullif(new.raw_user_meta_data ->> 'profile_photo_url', ''),
    nullif(new.raw_user_meta_data ->> 'cover_photo_url', '')
  )
  on conflict (id) do update
  set
    email = excluded.email,
    name = coalesce(nullif(trim(public.profiles.name), ''), excluded.name),
    username = coalesce(nullif(trim(public.profiles.username), ''), excluded.username),
    is_public_account = coalesce(public.profiles.is_public_account, excluded.is_public_account),
    bio = coalesce(public.profiles.bio, excluded.bio),
    interests = coalesce(public.profiles.interests, excluded.interests),
    profile_photo_url = coalesce(public.profiles.profile_photo_url, excluded.profile_photo_url),
    cover_photo_url = coalesce(public.profiles.cover_photo_url, excluded.cover_photo_url),
    updated_at = timezone('utc', now());

  return new;
end;
$$;

revoke all on function private.handle_new_user() from public;

create or replace function private.handle_user_block()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
begin
  delete from public.user_follows
  where (follower_id = new.blocker_user_id and following_id = new.blocked_user_id)
     or (follower_id = new.blocked_user_id and following_id = new.blocker_user_id);

  delete from public.follow_requests
  where (requester_id = new.blocker_user_id and target_user_id = new.blocked_user_id)
     or (requester_id = new.blocked_user_id and target_user_id = new.blocker_user_id);

  delete from public.notifications
  where (recipient_user_id = new.blocker_user_id and actor_user_id = new.blocked_user_id)
     or (recipient_user_id = new.blocked_user_id and actor_user_id = new.blocker_user_id);

  return new;
end;
$$;

revoke all on function private.handle_user_block() from public;

create or replace function private.notify_follow_created()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
begin
  if exists (
    select 1
    from public.follow_requests
    where requester_id = new.follower_id
      and target_user_id = new.following_id
      and status = 'accepted'
  ) then
    return new;
  end if;

  perform private.create_notification(
    new.following_id,
    new.follower_id,
    'follow',
    'seni takip etmeye basladi',
    null,
    null
  );

  return new;
end;
$$;

revoke all on function private.notify_follow_created() from public;

create or replace function private.notify_follow_request_created()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
begin
  if new.status <> 'pending' then
    return new;
  end if;

  insert into public.notifications (
    recipient_user_id,
    actor_user_id,
    type,
    message,
    follow_request_id
  )
  values (
    new.target_user_id,
    new.requester_id,
    'follow_request',
    'seni takip etmek istiyor',
    new.id
  );

  return new;
end;
$$;

revoke all on function private.notify_follow_request_created() from public;

create or replace function private.notify_list_liked()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  target_owner_id uuid;
  target_list_name text;
begin
  select owner_id, name
  into target_owner_id, target_list_name
  from public.lists
  where id = new.list_id;

  perform private.create_notification(
    target_owner_id,
    new.user_id,
    'list_liked',
    '"' || coalesce(target_list_name, 'Listen') || '" listesini begendi',
    new.list_id,
    null
  );

  return new;
end;
$$;

revoke all on function private.notify_list_liked() from public;

create or replace function private.notify_place_liked()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  target_owner_id uuid;
  target_list_id uuid;
  target_place_name text;
begin
  select lists.owner_id, list_places.list_id, list_places.name
  into target_owner_id, target_list_id, target_place_name
  from public.list_places
  join public.lists on lists.id = list_places.list_id
  where list_places.id = new.list_place_id;

  perform private.create_notification(
    target_owner_id,
    new.user_id,
    'like',
    '"' || coalesce(target_place_name, 'Mekan') || '" mekanini begendi',
    target_list_id,
    new.list_place_id
  );

  return new;
end;
$$;

revoke all on function private.notify_place_liked() from public;

create or replace function private.notify_place_commented()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  target_owner_id uuid;
  target_list_id uuid;
  target_place_name text;
  target_comment_preview text;
  target_parent_author_id uuid;
begin
  select lists.owner_id, list_places.list_id, list_places.name
  into target_owner_id, target_list_id, target_place_name
  from public.list_places
  join public.lists on lists.id = list_places.list_id
  where list_places.id = new.list_place_id;

  target_comment_preview := left(regexp_replace(trim(new.content), '\s+', ' ', 'g'), 80);

  if new.parent_comment_id is null then
    perform private.create_notification(
      target_owner_id,
      new.user_id,
      'comment',
      '"' || coalesce(target_place_name, 'Mekan') || '" mekanina yorum yapti: "' || target_comment_preview || '"',
      target_list_id,
      new.list_place_id
    );
  else
    select user_id
    into target_parent_author_id
    from public.list_place_comments
    where id = new.parent_comment_id;

    perform private.create_notification(
      target_parent_author_id,
      new.user_id,
      'comment_reply',
      'yorumuna yanit verdi: "' || target_comment_preview || '"',
      target_list_id,
      new.list_place_id
    );
  end if;

  return new;
end;
$$;

revoke all on function private.notify_place_commented() from public;

create or replace function private.notify_place_comment_liked()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  target_comment_author_id uuid;
  target_list_id uuid;
  target_place_id uuid;
  target_comment_preview text;
begin
  select
    list_place_comments.user_id,
    list_place_comments.list_place_id,
    left(regexp_replace(trim(list_place_comments.content), '\s+', ' ', 'g'), 80)
  into
    target_comment_author_id,
    target_place_id,
    target_comment_preview
  from public.list_place_comments
  where list_place_comments.id = new.comment_id;

  select list_id
  into target_list_id
  from public.list_places
  where id = target_place_id;

  perform private.create_notification(
    target_comment_author_id,
    new.user_id,
    'comment_like',
    'yorumunu begendi: "' || coalesce(target_comment_preview, '') || '"',
    target_list_id,
    target_place_id
  );

  return new;
end;
$$;

revoke all on function private.notify_place_comment_liked() from public;

create or replace function private.dispatch_push_notification()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  target_actor_name text;
  target_token text;
begin
  if new.recipient_user_id is null then
    return new;
  end if;

  select name
  into target_actor_name
  from public.profiles
  where id = new.actor_user_id;

  for target_token in
    select expo_push_token
    from public.user_push_tokens
    where user_id = new.recipient_user_id
      and is_active = true
  loop
    perform net.http_post(
      url := 'https://exp.host/--/api/v2/push/send',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Accept', 'application/json'
      ),
      body := jsonb_build_object(
        'to', target_token,
        'title', coalesce(target_actor_name, 'SoRita'),
        'body', new.message,
        'sound', 'default',
        'priority', 'high',
        'channelId', 'default',
        'data', jsonb_build_object(
          'notificationId', new.id,
          'type', new.type,
          'userId', new.actor_user_id,
          'listId', new.list_id,
          'placeId', new.list_place_id
        )
      )
    );
  end loop;

  return new;
end;
$$;

revoke all on function private.dispatch_push_notification() from public;

create or replace function private.check_account_availability(
  input_email text default null,
  input_username text default null,
  input_exclude_user_id uuid default null
)
returns table (
  email_available boolean,
  username_available boolean
)
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
begin
  return query
  select
    case
      when nullif(trim(coalesce(input_email, '')), '') is null then true
      else not exists (
        select 1
        from public.profiles
        where lower(email) = lower(trim(input_email))
          and (input_exclude_user_id is null or id <> input_exclude_user_id)
      )
      and not exists (
        select 1
        from auth.users
        where lower(email) = lower(trim(input_email))
          and (input_exclude_user_id is null or id <> input_exclude_user_id)
      )
    end,
    case
      when nullif(trim(coalesce(input_username, '')), '') is null then true
      else not exists (
        select 1
        from public.profiles
        where username = lower(trim(input_username))
          and (input_exclude_user_id is null or id <> input_exclude_user_id)
      )
    end;
end;
$$;

revoke all on function private.check_account_availability(text, text, uuid) from public;
grant execute on function private.check_account_availability(text, text, uuid) to anon;
grant execute on function private.check_account_availability(text, text, uuid) to authenticated;

create or replace function public.check_account_availability(
  input_email text default null,
  input_username text default null,
  input_exclude_user_id uuid default null
)
returns table (
  email_available boolean,
  username_available boolean
)
language plpgsql
security invoker
set search_path = pg_catalog, public, private
as $$
begin
  return query
  select *
  from private.check_account_availability(input_email, input_username, input_exclude_user_id);
end;
$$;

revoke all on function public.check_account_availability(text, text, uuid) from public;
grant execute on function public.check_account_availability(text, text, uuid) to anon;
grant execute on function public.check_account_availability(text, text, uuid) to authenticated;

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

create or replace function public.get_place_list_reference_summaries(
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
security invoker
set search_path = pg_catalog, public, private
as $$
begin
  return query
  select *
  from private.get_place_list_reference_summaries(
    input_owner_id,
    input_place_name,
    input_lat,
    input_lng
  );
end;
$$;

revoke all on function public.get_place_list_reference_summaries(uuid, text, double precision, double precision) from public;
grant execute on function public.get_place_list_reference_summaries(uuid, text, double precision, double precision) to authenticated;

create or replace function private.respond_to_follow_request(
  input_request_id uuid,
  input_decision text
)
returns text
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  target_request public.follow_requests%rowtype;
  normalized_decision text;
begin
  normalized_decision := lower(trim(coalesce(input_decision, '')));

  if normalized_decision not in ('accept', 'reject') then
    raise exception 'Invalid follow request decision';
  end if;

  select *
  into target_request
  from public.follow_requests
  where id = input_request_id
    and target_user_id = auth.uid()
    and status = 'pending'
  for update;

  if not found then
    raise exception 'Follow request not found';
  end if;

  update public.follow_requests
  set
    status = case when normalized_decision = 'accept' then 'accepted' else 'rejected' end,
    responded_at = timezone('utc', now())
  where id = target_request.id;

  if normalized_decision = 'accept' then
    insert into public.user_follows (follower_id, following_id)
    values (target_request.requester_id, target_request.target_user_id)
    on conflict (follower_id, following_id) do nothing;
  end if;

  update public.notifications
  set read = true
  where follow_request_id = target_request.id
    and recipient_user_id = auth.uid();

  return case when normalized_decision = 'accept' then 'accepted' else 'rejected' end;
end;
$$;

revoke all on function private.respond_to_follow_request(uuid, text) from public;
grant execute on function private.respond_to_follow_request(uuid, text) to authenticated;

create or replace function public.respond_to_follow_request(
  input_request_id uuid,
  input_decision text
)
returns text
language plpgsql
security invoker
set search_path = pg_catalog, public, private
as $$
begin
  return private.respond_to_follow_request(input_request_id, input_decision);
end;
$$;

revoke all on function public.respond_to_follow_request(uuid, text) from public;
grant execute on function public.respond_to_follow_request(uuid, text) to authenticated;

create or replace function private.upsert_user_push_token(
  input_token text,
  input_platform text
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  normalized_token text;
  normalized_platform text;
begin
  if auth.uid() is null then
    raise exception 'Unauthorized';
  end if;

  normalized_token := trim(coalesce(input_token, ''));
  normalized_platform := lower(trim(coalesce(input_platform, '')));

  if normalized_token = '' then
    raise exception 'Invalid push token';
  end if;

  if normalized_platform not in ('android', 'ios') then
    raise exception 'Invalid push platform';
  end if;

  delete from public.user_push_tokens
  where expo_push_token = normalized_token
    and user_id <> auth.uid();

  insert into public.user_push_tokens (
    user_id,
    expo_push_token,
    platform,
    is_active,
    last_seen_at
  )
  values (
    auth.uid(),
    normalized_token,
    normalized_platform,
    true,
    timezone('utc', now())
  )
  on conflict (expo_push_token) do update
  set
    user_id = auth.uid(),
    platform = excluded.platform,
    is_active = true,
    last_seen_at = timezone('utc', now()),
    updated_at = timezone('utc', now());
end;
$$;

revoke all on function private.upsert_user_push_token(text, text) from public;
grant execute on function private.upsert_user_push_token(text, text) to authenticated;

create or replace function public.upsert_user_push_token(
  input_token text,
  input_platform text
)
returns void
language plpgsql
security invoker
set search_path = pg_catalog, public, private
as $$
begin
  perform private.upsert_user_push_token(input_token, input_platform);
end;
$$;

revoke all on function public.upsert_user_push_token(text, text) from public;
grant execute on function public.upsert_user_push_token(text, text) to authenticated;

create or replace function private.remove_user_push_token(input_token text)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  normalized_token text;
begin
  if auth.uid() is null then
    raise exception 'Unauthorized';
  end if;

  normalized_token := trim(coalesce(input_token, ''));

  if normalized_token = '' then
    return;
  end if;

  delete from public.user_push_tokens
  where user_id = auth.uid()
    and expo_push_token = normalized_token;
end;
$$;

revoke all on function private.remove_user_push_token(text) from public;
grant execute on function private.remove_user_push_token(text) to authenticated;

create or replace function public.remove_user_push_token(input_token text)
returns void
language plpgsql
security invoker
set search_path = pg_catalog, public, private
as $$
begin
  perform private.remove_user_push_token(input_token);
end;
$$;

revoke all on function public.remove_user_push_token(text) from public;
grant execute on function public.remove_user_push_token(text) to authenticated;

create or replace function private.toggle_list_place_comment_like(target_comment_id uuid)
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

  if not private.can_view_list_place_comment(target_comment_id) then
    raise exception 'Comment is not visible'
      using errcode = '42501';
  end if;

  delete from public.list_place_comment_likes
  where comment_id = target_comment_id
    and user_id = current_user_id;

  if found then
    return;
  end if;

  insert into public.list_place_comment_likes (comment_id, user_id)
  values (target_comment_id, current_user_id)
  on conflict (comment_id, user_id) do nothing;
end;
$$;

revoke all on function private.toggle_list_place_comment_like(uuid) from public;
grant execute on function private.toggle_list_place_comment_like(uuid) to authenticated;

create or replace function public.toggle_list_place_comment_like(target_comment_id uuid)
returns void
language plpgsql
security invoker
set search_path = pg_catalog, public, private
as $$
begin
  perform private.toggle_list_place_comment_like(target_comment_id);
end;
$$;

revoke all on function public.toggle_list_place_comment_like(uuid) from public;
grant execute on function public.toggle_list_place_comment_like(uuid) to authenticated;

drop policy if exists "list_place_photos_insert_own_list" on public.list_place_photos;
create policy "list_place_photos_insert_own_list"
on public.list_place_photos
for insert
to authenticated
with check (private.can_manage_list_place(list_place_id));

drop policy if exists "list_place_photos_update_own_list" on public.list_place_photos;
create policy "list_place_photos_update_own_list"
on public.list_place_photos
for update
to authenticated
using (private.can_manage_list_place(list_place_id))
with check (private.can_manage_list_place(list_place_id));

drop policy if exists "list_place_photos_delete_own_list" on public.list_place_photos;
create policy "list_place_photos_delete_own_list"
on public.list_place_photos
for delete
to authenticated
using (private.can_manage_list_place(list_place_id));

drop policy if exists "list_place_likes_select_visible" on public.list_place_likes;
create policy "list_place_likes_select_visible"
on public.list_place_likes
for select
to authenticated
using (private.can_view_list_place(list_place_id));

drop policy if exists "list_place_likes_insert_self" on public.list_place_likes;
create policy "list_place_likes_insert_self"
on public.list_place_likes
for insert
to authenticated
with check (user_id = auth.uid() and private.can_view_list_place(list_place_id));

drop policy if exists "list_place_comments_select_visible" on public.list_place_comments;
create policy "list_place_comments_select_visible"
on public.list_place_comments
for select
to authenticated
using (private.can_view_list_place(list_place_id));

drop policy if exists "list_place_comments_insert_self" on public.list_place_comments;
create policy "list_place_comments_insert_self"
on public.list_place_comments
for insert
to authenticated
with check (
  user_id = auth.uid()
  and private.can_view_list_place(list_place_id)
  and private.comment_parent_matches_place(list_place_id, parent_comment_id)
);

drop policy if exists "list_place_comments_update_self" on public.list_place_comments;
create policy "list_place_comments_update_self"
on public.list_place_comments
for update
to authenticated
using (user_id = auth.uid())
with check (
  user_id = auth.uid()
  and private.comment_parent_matches_place(list_place_id, parent_comment_id)
);

drop policy if exists "list_place_comments_delete_author_or_owner" on public.list_place_comments;
create policy "list_place_comments_delete_author_or_owner"
on public.list_place_comments
for delete
to authenticated
using (user_id = auth.uid() or private.can_manage_list_place(list_place_id));

drop policy if exists "list_place_comment_reports_insert_self" on public.list_place_comment_reports;
create policy "list_place_comment_reports_insert_self"
on public.list_place_comment_reports
for insert
to authenticated
with check (
  reporter_user_id = auth.uid()
  and exists (
    select 1
    from public.list_place_comments
    where list_place_comments.id = comment_id
      and list_place_comments.user_id <> auth.uid()
      and private.can_view_list_place(list_place_comments.list_place_id)
  )
);

drop policy if exists "list_place_comment_likes_select_visible" on public.list_place_comment_likes;
create policy "list_place_comment_likes_select_visible"
on public.list_place_comment_likes
for select
to authenticated
using (private.can_view_list_place_comment(comment_id));

drop policy if exists "list_place_comment_likes_insert_self" on public.list_place_comment_likes;
create policy "list_place_comment_likes_insert_self"
on public.list_place_comment_likes
for insert
to authenticated
with check (
  user_id = auth.uid()
  and private.can_view_list_place_comment(comment_id)
);

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row
execute function private.handle_new_user();

drop trigger if exists user_blocks_handle_insert on public.user_blocks;
create trigger user_blocks_handle_insert
after insert on public.user_blocks
for each row
execute function private.handle_user_block();

drop trigger if exists user_follows_notify_insert on public.user_follows;
create trigger user_follows_notify_insert
after insert on public.user_follows
for each row
execute function private.notify_follow_created();

drop trigger if exists follow_requests_notify_insert on public.follow_requests;
create trigger follow_requests_notify_insert
after insert on public.follow_requests
for each row
execute function private.notify_follow_request_created();

drop trigger if exists list_likes_notify_insert on public.list_likes;
create trigger list_likes_notify_insert
after insert on public.list_likes
for each row
execute function private.notify_list_liked();

drop trigger if exists list_place_likes_notify_insert on public.list_place_likes;
create trigger list_place_likes_notify_insert
after insert on public.list_place_likes
for each row
execute function private.notify_place_liked();

drop trigger if exists list_place_comments_notify_insert on public.list_place_comments;
create trigger list_place_comments_notify_insert
after insert on public.list_place_comments
for each row
execute function private.notify_place_commented();

drop trigger if exists list_place_comment_likes_notify_insert on public.list_place_comment_likes;
create trigger list_place_comment_likes_notify_insert
after insert on public.list_place_comment_likes
for each row
execute function private.notify_place_comment_liked();

drop trigger if exists notifications_dispatch_push on public.notifications;
create trigger notifications_dispatch_push
after insert on public.notifications
for each row
execute function private.dispatch_push_notification();

drop policy if exists "profile_media_public_read" on storage.objects;
drop policy if exists "place_media_public_read" on storage.objects;

drop function if exists public.can_manage_list_place(uuid);
drop function if exists public.can_view_list_place(uuid);
drop function if exists public.can_view_list_place_comment(uuid);
drop function if exists public.comment_parent_matches_place(uuid, uuid);
drop function if exists public.create_notification(uuid, uuid, text, text, uuid, uuid);
drop function if exists public.dispatch_push_notification();
drop function if exists public.handle_new_user();
drop function if exists public.handle_user_block();
drop function if exists public.notify_follow_created();
drop function if exists public.notify_follow_request_created();
drop function if exists public.notify_list_liked();
drop function if exists public.notify_place_comment_liked();
drop function if exists public.notify_place_commented();
drop function if exists public.notify_place_liked();
drop function if exists public.users_have_block_relation(uuid, uuid);

do $$
begin
  if exists (
    select 1
    from pg_proc proc
    join pg_namespace ns on ns.oid = proc.pronamespace
    where ns.nspname = 'public'
      and proc.proname = 'rls_auto_enable'
      and pg_get_function_identity_arguments(proc.oid) = ''
  ) then
    execute 'revoke all on function public.rls_auto_enable() from public, anon, authenticated';
  end if;
end
$$;
