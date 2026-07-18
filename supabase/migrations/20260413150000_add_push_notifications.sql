create extension if not exists pg_net;
create table if not exists public.user_push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  expo_push_token text not null unique,
  platform text not null check (platform in ('android', 'ios')),
  is_active boolean not null default true,
  last_seen_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);
create index if not exists idx_user_push_tokens_user_id_active
on public.user_push_tokens (user_id, is_active, last_seen_at desc);
alter table public.user_push_tokens enable row level security;
drop policy if exists "user_push_tokens_select_own" on public.user_push_tokens;
create policy "user_push_tokens_select_own"
on public.user_push_tokens
for select
to authenticated
using (auth.uid() = user_id);
drop trigger if exists user_push_tokens_touch_updated_at on public.user_push_tokens;
create trigger user_push_tokens_touch_updated_at
before update on public.user_push_tokens
for each row
execute function public.touch_updated_at();
create or replace function public.upsert_user_push_token(
  input_token text,
  input_platform text
)
returns void
language plpgsql
security definer
set search_path = public
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
revoke all on function public.upsert_user_push_token(text, text) from public;
grant execute on function public.upsert_user_push_token(text, text) to authenticated;
create or replace function public.remove_user_push_token(
  input_token text
)
returns void
language plpgsql
security definer
set search_path = public
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
revoke all on function public.remove_user_push_token(text) from public;
grant execute on function public.remove_user_push_token(text) to authenticated;
create or replace function public.dispatch_push_notification()
returns trigger
language plpgsql
security definer
set search_path = public
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
drop trigger if exists notifications_dispatch_push on public.notifications;
create trigger notifications_dispatch_push
after insert on public.notifications
for each row
execute function public.dispatch_push_notification();
