create table if not exists public.user_blocks (
  blocker_user_id uuid not null references public.profiles (id) on delete cascade,
  blocked_user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (blocker_user_id, blocked_user_id),
  constraint user_blocks_no_self_block check (blocker_user_id <> blocked_user_id)
);

create table if not exists public.user_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_user_id uuid not null references public.profiles (id) on delete cascade,
  target_user_id uuid not null references public.profiles (id) on delete cascade,
  reason text not null check (char_length(trim(reason)) between 1 and 160),
  created_at timestamptz not null default timezone('utc', now()),
  constraint user_reports_no_self_report check (reporter_user_id <> target_user_id),
  constraint user_reports_unique_report unique (reporter_user_id, target_user_id)
);

create index if not exists idx_user_blocks_blocked_user_id
on public.user_blocks (blocked_user_id);

create index if not exists idx_user_reports_target_user_id
on public.user_reports (target_user_id, created_at desc);

alter table public.user_blocks enable row level security;
alter table public.user_reports enable row level security;

drop policy if exists "user_blocks_select_related" on public.user_blocks;
create policy "user_blocks_select_related"
on public.user_blocks
for select
to authenticated
using (auth.uid() = blocker_user_id or auth.uid() = blocked_user_id);

drop policy if exists "user_blocks_insert_self" on public.user_blocks;
create policy "user_blocks_insert_self"
on public.user_blocks
for insert
to authenticated
with check (auth.uid() = blocker_user_id and blocker_user_id <> blocked_user_id);

drop policy if exists "user_blocks_delete_self" on public.user_blocks;
create policy "user_blocks_delete_self"
on public.user_blocks
for delete
to authenticated
using (auth.uid() = blocker_user_id);

drop policy if exists "user_reports_select_own" on public.user_reports;
create policy "user_reports_select_own"
on public.user_reports
for select
to authenticated
using (auth.uid() = reporter_user_id);

drop policy if exists "user_reports_insert_self" on public.user_reports;
create policy "user_reports_insert_self"
on public.user_reports
for insert
to authenticated
with check (auth.uid() = reporter_user_id and reporter_user_id <> target_user_id);

create or replace function public.users_have_block_relation(user_a uuid, user_b uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_blocks
    where (blocker_user_id = user_a and blocked_user_id = user_b)
       or (blocker_user_id = user_b and blocked_user_id = user_a)
  );
$$;

revoke all on function public.users_have_block_relation(uuid, uuid) from public;
grant execute on function public.users_have_block_relation(uuid, uuid) to authenticated;

create or replace function public.handle_user_block()
returns trigger
language plpgsql
security definer
set search_path = public
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

drop trigger if exists user_blocks_handle_insert on public.user_blocks;
create trigger user_blocks_handle_insert
after insert on public.user_blocks
for each row
execute function public.handle_user_block();

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

  if public.users_have_block_relation(target_recipient_user_id, target_actor_user_id) then
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
