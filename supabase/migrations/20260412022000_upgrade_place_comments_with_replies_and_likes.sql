create or replace function public.can_view_list_place_comment(target_comment_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.list_place_comments
    where list_place_comments.id = target_comment_id
      and public.can_view_list_place(list_place_comments.list_place_id)
  );
$$;

revoke all on function public.can_view_list_place_comment(uuid) from public;
grant execute on function public.can_view_list_place_comment(uuid) to authenticated;

create or replace function public.comment_parent_matches_place(
  target_list_place_id uuid,
  target_parent_comment_id uuid
)
returns boolean
language sql
security definer
set search_path = public
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

revoke all on function public.comment_parent_matches_place(uuid, uuid) from public;
grant execute on function public.comment_parent_matches_place(uuid, uuid) to authenticated;

alter table public.list_place_comments
add column if not exists parent_comment_id uuid references public.list_place_comments (id) on delete cascade;

alter table public.list_place_comments
drop constraint if exists list_place_comments_no_self_parent;

alter table public.list_place_comments
add constraint list_place_comments_no_self_parent
check (parent_comment_id is null or parent_comment_id <> id);

create table if not exists public.list_place_comment_likes (
  comment_id uuid not null references public.list_place_comments (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (comment_id, user_id)
);

create index if not exists idx_list_place_comments_parent_comment_id
on public.list_place_comments (parent_comment_id, created_at asc);

create index if not exists idx_list_place_comment_likes_user_id
on public.list_place_comment_likes (user_id);

alter table public.list_place_comment_likes enable row level security;

drop policy if exists "list_place_comments_insert_self" on public.list_place_comments;
create policy "list_place_comments_insert_self"
on public.list_place_comments
for insert
to authenticated
with check (
  user_id = auth.uid()
  and public.can_view_list_place(list_place_id)
  and public.comment_parent_matches_place(list_place_id, parent_comment_id)
);

drop policy if exists "list_place_comments_update_self" on public.list_place_comments;
create policy "list_place_comments_update_self"
on public.list_place_comments
for update
to authenticated
using (user_id = auth.uid())
with check (
  user_id = auth.uid()
  and public.comment_parent_matches_place(list_place_id, parent_comment_id)
);

drop policy if exists "list_place_comment_likes_select_visible" on public.list_place_comment_likes;
create policy "list_place_comment_likes_select_visible"
on public.list_place_comment_likes
for select
to authenticated
using (public.can_view_list_place_comment(comment_id));

drop policy if exists "list_place_comment_likes_insert_self" on public.list_place_comment_likes;
create policy "list_place_comment_likes_insert_self"
on public.list_place_comment_likes
for insert
to authenticated
with check (
  user_id = auth.uid()
  and public.can_view_list_place_comment(comment_id)
);

drop policy if exists "list_place_comment_likes_delete_self" on public.list_place_comment_likes;
create policy "list_place_comment_likes_delete_self"
on public.list_place_comment_likes
for delete
to authenticated
using (user_id = auth.uid());

alter table public.notifications
drop constraint if exists notifications_type_check;

alter table public.notifications
add constraint notifications_type_check
check (
  type in (
    'like',
    'follow',
    'follow_request',
    'comment',
    'place_added',
    'list_liked',
    'comment_like',
    'comment_reply'
  )
);

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
  target_parent_author_id uuid;
begin
  select lists.owner_id, list_places.list_id, list_places.name
  into target_owner_id, target_list_id, target_place_name
  from public.list_places
  join public.lists on lists.id = list_places.list_id
  where list_places.id = new.list_place_id;

  target_comment_preview := left(regexp_replace(trim(new.content), '\s+', ' ', 'g'), 80);

  if new.parent_comment_id is null then
    perform public.create_notification(
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

    perform public.create_notification(
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

create or replace function public.notify_place_comment_liked()
returns trigger
language plpgsql
security definer
set search_path = public
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

  perform public.create_notification(
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

drop trigger if exists list_place_comments_notify_insert on public.list_place_comments;
create trigger list_place_comments_notify_insert
after insert on public.list_place_comments
for each row
execute function public.notify_place_commented();

drop trigger if exists list_place_comment_likes_notify_insert on public.list_place_comment_likes;
create trigger list_place_comment_likes_notify_insert
after insert on public.list_place_comment_likes
for each row
execute function public.notify_place_comment_liked();
