create or replace function public.can_manage_list_place(target_list_place_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.list_places
    join public.lists on lists.id = list_places.list_id
    where list_places.id = target_list_place_id
      and lists.owner_id = auth.uid()
  );
$$;
revoke all on function public.can_manage_list_place(uuid) from public;
grant execute on function public.can_manage_list_place(uuid) to authenticated;
create or replace function public.can_view_list_place(target_list_place_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.list_places
    join public.lists on lists.id = list_places.list_id
    where list_places.id = target_list_place_id
      and (lists.is_public or lists.owner_id = auth.uid())
  );
$$;
revoke all on function public.can_view_list_place(uuid) from public;
grant execute on function public.can_view_list_place(uuid) to authenticated;
create table if not exists public.list_place_likes (
  list_place_id uuid not null references public.list_places (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (list_place_id, user_id)
);
create table if not exists public.list_place_comments (
  id uuid primary key default gen_random_uuid(),
  list_place_id uuid not null references public.list_places (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  content text not null check (char_length(trim(content)) between 1 and 1000),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);
create table if not exists public.list_place_comment_reports (
  id uuid primary key default gen_random_uuid(),
  comment_id uuid not null references public.list_place_comments (id) on delete cascade,
  reporter_user_id uuid not null references public.profiles (id) on delete cascade,
  reason text not null check (char_length(trim(reason)) between 1 and 120),
  created_at timestamptz not null default timezone('utc', now()),
  constraint list_place_comment_reports_unique unique (comment_id, reporter_user_id)
);
create index if not exists idx_list_place_likes_user_id on public.list_place_likes (user_id);
create index if not exists idx_list_place_comments_place_created_at on public.list_place_comments (list_place_id, created_at desc);
create index if not exists idx_list_place_comments_user_id on public.list_place_comments (user_id);
create index if not exists idx_list_place_comment_reports_comment_id on public.list_place_comment_reports (comment_id);
alter table public.list_place_likes enable row level security;
alter table public.list_place_comments enable row level security;
alter table public.list_place_comment_reports enable row level security;
drop trigger if exists list_place_comments_touch_updated_at on public.list_place_comments;
create trigger list_place_comments_touch_updated_at
before update on public.list_place_comments
for each row
execute function public.touch_updated_at();
drop policy if exists "list_place_likes_select_visible" on public.list_place_likes;
create policy "list_place_likes_select_visible"
on public.list_place_likes
for select
to authenticated
using (public.can_view_list_place(list_place_id));
drop policy if exists "list_place_likes_insert_self" on public.list_place_likes;
create policy "list_place_likes_insert_self"
on public.list_place_likes
for insert
to authenticated
with check (user_id = auth.uid() and public.can_view_list_place(list_place_id));
drop policy if exists "list_place_likes_delete_self" on public.list_place_likes;
create policy "list_place_likes_delete_self"
on public.list_place_likes
for delete
to authenticated
using (user_id = auth.uid());
drop policy if exists "list_place_comments_select_visible" on public.list_place_comments;
create policy "list_place_comments_select_visible"
on public.list_place_comments
for select
to authenticated
using (public.can_view_list_place(list_place_id));
drop policy if exists "list_place_comments_insert_self" on public.list_place_comments;
create policy "list_place_comments_insert_self"
on public.list_place_comments
for insert
to authenticated
with check (user_id = auth.uid() and public.can_view_list_place(list_place_id));
drop policy if exists "list_place_comments_update_self" on public.list_place_comments;
create policy "list_place_comments_update_self"
on public.list_place_comments
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());
drop policy if exists "list_place_comments_delete_author_or_owner" on public.list_place_comments;
create policy "list_place_comments_delete_author_or_owner"
on public.list_place_comments
for delete
to authenticated
using (user_id = auth.uid() or public.can_manage_list_place(list_place_id));
drop policy if exists "list_place_comment_reports_select_own" on public.list_place_comment_reports;
create policy "list_place_comment_reports_select_own"
on public.list_place_comment_reports
for select
to authenticated
using (reporter_user_id = auth.uid());
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
      and public.can_view_list_place(list_place_comments.list_place_id)
  )
);
create or replace function public.create_notification(
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
set search_path = public
as $$
begin
  if target_recipient_user_id is null or target_actor_user_id is null then
    return;
  end if;

  if target_recipient_user_id = target_actor_user_id then
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
revoke all on function public.create_notification(uuid, uuid, text, text, uuid, uuid) from public;
grant execute on function public.create_notification(uuid, uuid, text, text, uuid, uuid) to authenticated;
create or replace function public.notify_follow_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.create_notification(
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
create or replace function public.notify_list_liked()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_owner_id uuid;
  target_list_name text;
begin
  select owner_id, name
  into target_owner_id, target_list_name
  from public.lists
  where id = new.list_id;

  perform public.create_notification(
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
create or replace function public.notify_place_liked()
returns trigger
language plpgsql
security definer
set search_path = public
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

  perform public.create_notification(
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
create or replace function public.notify_place_commented()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_owner_id uuid;
  target_list_id uuid;
  target_place_name text;
  target_comment_preview text;
begin
  select lists.owner_id, list_places.list_id, list_places.name
  into target_owner_id, target_list_id, target_place_name
  from public.list_places
  join public.lists on lists.id = list_places.list_id
  where list_places.id = new.list_place_id;

  target_comment_preview := left(regexp_replace(trim(new.content), '\s+', ' ', 'g'), 80);

  perform public.create_notification(
    target_owner_id,
    new.user_id,
    'comment',
    '"' || coalesce(target_place_name, 'Mekan') || '" mekanina yorum yapti: "' || target_comment_preview || '"',
    target_list_id,
    new.list_place_id
  );

  return new;
end;
$$;
drop trigger if exists user_follows_notify_insert on public.user_follows;
create trigger user_follows_notify_insert
after insert on public.user_follows
for each row
execute function public.notify_follow_created();
drop trigger if exists list_likes_notify_insert on public.list_likes;
create trigger list_likes_notify_insert
after insert on public.list_likes
for each row
execute function public.notify_list_liked();
drop trigger if exists list_place_likes_notify_insert on public.list_place_likes;
create trigger list_place_likes_notify_insert
after insert on public.list_place_likes
for each row
execute function public.notify_place_liked();
drop trigger if exists list_place_comments_notify_insert on public.list_place_comments;
create trigger list_place_comments_notify_insert
after insert on public.list_place_comments
for each row
execute function public.notify_place_commented();
