-- Notification copy was stored without Turkish letters ("mekanini begendi",
-- "seni takip etmeye basladi"), and create_notification inserted a new row,
-- with a new push, every time someone toggled a like back on or followed
-- again. The notifications screen showed the same like twice in a row.
--
-- This rewrites the six templates in Turkish, lets a repeated like, list like,
-- comment like or follow reach its recipient once, and corrects the copy that
-- is already stored. Signatures, security and search_path are unchanged.

create or replace function private.create_notification(
  target_recipient_user_id uuid,
  target_actor_user_id uuid,
  target_type text,
  target_message text,
  target_list_id uuid default null::uuid,
  target_list_place_id uuid default null::uuid
)
returns void
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'private'
as $function$
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

  -- Liking again after an unlike, or following again after an unfollow, is
  -- the same event to the recipient. A comment like is told apart by its
  -- message, because two comments on one place share list and place ids.
  if target_type in ('like', 'list_liked', 'comment_like', 'follow')
    and exists (
      select 1
      from public.notifications
      where recipient_user_id = target_recipient_user_id
        and actor_user_id = target_actor_user_id
        and type = target_type
        and list_id is not distinct from target_list_id
        and list_place_id is not distinct from target_list_place_id
        and (target_type <> 'comment_like' or message = target_message)
    ) then
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
$function$;

create or replace function private.notify_place_liked()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'private'
as $function$
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
    '"' || coalesce(target_place_name, 'Mekân') || '" mekânını beğendi',
    target_list_id,
    new.list_place_id
  );

  return new;
end;
$function$;

create or replace function private.notify_list_liked()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'private'
as $function$
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
    '"' || coalesce(target_list_name, 'Liste') || '" listesini beğendi',
    new.list_id,
    null
  );

  return new;
end;
$function$;

create or replace function private.notify_place_commented()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'private'
as $function$
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
      '"' || coalesce(target_place_name, 'Mekân') || '" mekânına yorum yaptı: "' || target_comment_preview || '"',
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
      'yorumuna yanıt verdi: "' || target_comment_preview || '"',
      target_list_id,
      new.list_place_id
    );
  end if;

  return new;
end;
$function$;

create or replace function private.notify_place_comment_liked()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'private'
as $function$
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
    'yorumunu beğendi: "' || coalesce(target_comment_preview, '') || '"',
    target_list_id,
    target_place_id
  );

  return new;
end;
$function$;

create or replace function private.notify_follow_created()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'private'
as $function$
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
    'seni takip etmeye başladı',
    null,
    null
  );

  return new;
end;
$function$;

-- Stored rows keep the old copy until corrected. Only each template's fixed
-- part is rewritten, anchored where the template puts it, so a place name or
-- comment that happens to contain the same words is left alone.
--
-- The update guard lets clients change nothing but read state, and it rightly
-- has no exception for anyone else. It is switched off for these statements
-- only, inside this migration's transaction, and switched back on below.
alter table public.notifications
  disable trigger notifications_enforce_client_update_invariants;

update public.notifications
set message = regexp_replace(message, '" mekanini begendi$', '" mekânını beğendi')
where type = 'like' and message ~ '" mekanini begendi$';

update public.notifications
set message = regexp_replace(message, '" listesini begendi$', '" listesini beğendi')
where type = 'list_liked' and message ~ '" listesini begendi$';

update public.notifications
set message = regexp_replace(message, '" mekanina yorum yapti: "', '" mekânına yorum yaptı: "')
where type = 'comment' and message like '%" mekanina yorum yapti: "%';

update public.notifications
set message = regexp_replace(message, '^yorumuna yanit verdi: "', 'yorumuna yanıt verdi: "')
where type = 'comment_reply' and message like 'yorumuna yanit verdi: "%';

update public.notifications
set message = regexp_replace(message, '^yorumunu begendi: "', 'yorumunu beğendi: "')
where type = 'comment_like' and message like 'yorumunu begendi: "%';

update public.notifications
set message = 'seni takip etmeye başladı'
where type = 'follow' and message = 'seni takip etmeye basladi';

alter table public.notifications
  enable trigger notifications_enforce_client_update_invariants;
