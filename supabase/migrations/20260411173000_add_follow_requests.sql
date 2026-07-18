create table if not exists public.follow_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles (id) on delete cascade,
  target_user_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  created_at timestamptz not null default timezone('utc', now()),
  responded_at timestamptz
);
alter table public.follow_requests
drop constraint if exists follow_requests_no_self_request;
alter table public.follow_requests
add constraint follow_requests_no_self_request
check (requester_id <> target_user_id);
create unique index if not exists idx_follow_requests_unique_pending
on public.follow_requests (requester_id, target_user_id)
where status = 'pending';
create index if not exists idx_follow_requests_target_status_created_at
on public.follow_requests (target_user_id, status, created_at desc);
create index if not exists idx_follow_requests_requester_status_created_at
on public.follow_requests (requester_id, status, created_at desc);
alter table public.follow_requests enable row level security;
drop policy if exists "follow_requests_select_related" on public.follow_requests;
create policy "follow_requests_select_related"
on public.follow_requests
for select
to authenticated
using (auth.uid() = requester_id or auth.uid() = target_user_id);
drop policy if exists "follow_requests_insert_self" on public.follow_requests;
create policy "follow_requests_insert_self"
on public.follow_requests
for insert
to authenticated
with check (auth.uid() = requester_id and requester_id <> target_user_id);
alter table public.notifications
add column if not exists follow_request_id uuid references public.follow_requests (id) on delete set null;
create index if not exists idx_notifications_follow_request_id
on public.notifications (follow_request_id);
alter table public.notifications
drop constraint if exists notifications_type_check;
alter table public.notifications
add constraint notifications_type_check
check (type in ('like', 'follow', 'follow_request', 'comment', 'place_added', 'list_liked'));
create or replace function public.notify_follow_created()
returns trigger
language plpgsql
security definer
set search_path = public
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
create or replace function public.notify_follow_request_created()
returns trigger
language plpgsql
security definer
set search_path = public
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
drop trigger if exists follow_requests_notify_insert on public.follow_requests;
create trigger follow_requests_notify_insert
after insert on public.follow_requests
for each row
execute function public.notify_follow_request_created();
create or replace function public.respond_to_follow_request(
  input_request_id uuid,
  input_decision text
)
returns text
language plpgsql
security definer
set search_path = public
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
revoke all on function public.respond_to_follow_request(uuid, text) from public;
grant execute on function public.respond_to_follow_request(uuid, text) to authenticated;
