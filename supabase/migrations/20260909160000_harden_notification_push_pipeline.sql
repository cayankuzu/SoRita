-- Keep notification creation authoritative and push delivery durable. The
-- trigger writes outbox rows and gives personal notifications a small,
-- notification-scoped pg_net kick; pg_cron (or the documented service-role
-- scheduler fallback) remains the owner of retries and bulk dispatch.

create or replace function private.is_valid_expo_push_token(input_token text)
returns boolean
language sql
immutable
parallel safe
set search_path = pg_catalog
as $$
  select
    input_token is not null
    and input_token = btrim(input_token)
    and char_length(input_token) <= 2048
    and (
      (
        left(input_token, char_length('ExponentPushToken[')) = 'ExponentPushToken['
        and right(input_token, 1) = ']'
        and char_length(input_token) > char_length('ExponentPushToken[]')
      )
      or (
        left(input_token, char_length('ExpoPushToken[')) = 'ExpoPushToken['
        and right(input_token, 1) = ']'
        and char_length(input_token) > char_length('ExpoPushToken[]')
      )
      -- The official Expo server SDK also recognizes legacy UUID tokens.
      or input_token ~* '^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$'
    );
$$;

revoke all on function private.is_valid_expo_push_token(text)
from public, anon, authenticated;

alter table public.user_push_tokens
drop constraint if exists user_push_tokens_expo_token_format;

alter table public.user_push_tokens
add constraint user_push_tokens_expo_token_format
check (private.is_valid_expo_push_token(expo_push_token)) not valid;

alter table public.user_push_tokens
validate constraint user_push_tokens_expo_token_format;

-- PostgreSQL implements ON DELETE SET NULL as an internal UPDATE of the child
-- row. Preserve the notification immutability boundary while allowing that
-- narrowly verified cleanup when a follow request is removed (including the
-- block cleanup path).
create or replace function private.enforce_client_update_invariants()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  follow_request_cleanup boolean := false;
begin
  if tg_table_schema = 'public' and tg_table_name = 'profiles' then
    if new.id is distinct from old.id
      or new.email is distinct from old.email
      or new.created_at is distinct from old.created_at then
      raise exception 'immutable profile field' using errcode = '42501';
    end if;
  elsif tg_table_schema = 'public' and tg_table_name = 'notifications' then
    follow_request_cleanup :=
      old.follow_request_id is not null
      and new.follow_request_id is null
      and not exists (
        select 1
        from public.follow_requests fr
        where fr.id = old.follow_request_id
      );

    if new.id is distinct from old.id
      or new.recipient_user_id is distinct from old.recipient_user_id
      or new.actor_user_id is distinct from old.actor_user_id
      or new.type is distinct from old.type
      or new.message is distinct from old.message
      or new.list_id is distinct from old.list_id
      or new.list_place_id is distinct from old.list_place_id
      or (
        new.follow_request_id is distinct from old.follow_request_id
        and not follow_request_cleanup
      )
      or new.push_title is distinct from old.push_title
      or new.created_at is distinct from old.created_at then
      raise exception 'only notification read state is client mutable' using errcode = '42501';
    end if;
  elsif tg_table_schema = 'public' and tg_table_name = 'list_places' then
    if tg_op = 'INSERT'
      and auth.uid() is not null
      and new.created_by is distinct from auth.uid() then
      raise exception 'place creator must match the authenticated writer' using errcode = '42501';
    elsif tg_op = 'UPDATE' and new.created_by is distinct from old.created_by then
      raise exception 'immutable place creator' using errcode = '42501';
    end if;
  elsif tg_table_schema = 'public' and tg_table_name = 'list_reports' then
    if new.id is distinct from old.id
      or new.list_id is distinct from old.list_id
      or new.reporter_user_id is distinct from old.reporter_user_id
      or new.created_at is distinct from old.created_at then
      raise exception 'immutable report ownership field' using errcode = '42501';
    end if;
  elsif tg_table_schema = 'public' and tg_table_name = 'list_place_reports' then
    if new.id is distinct from old.id
      or new.list_place_id is distinct from old.list_place_id
      or new.reporter_user_id is distinct from old.reporter_user_id
      or new.created_at is distinct from old.created_at then
      raise exception 'immutable report ownership field' using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function private.enforce_client_update_invariants()
from public, anon, authenticated;

-- Keep the legacy registration overload bounded and format checked during the
-- store-client adoption window. It remains a wrapper around this private RPC.
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

  normalized_token := btrim(coalesce(input_token, ''));
  normalized_platform := lower(btrim(coalesce(input_platform, '')));

  if not private.is_valid_expo_push_token(normalized_token) then
    raise exception 'Invalid push token';
  end if;

  if normalized_platform not in ('android', 'ios') then
    raise exception 'Invalid push platform';
  end if;

  -- A token is a device capability and can only route to the account that most
  -- recently registered it. Cascading deletes cancel the former owner's jobs.
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

revoke all on function private.upsert_user_push_token(text, text)
from public, anon, authenticated;
grant execute on function private.upsert_user_push_token(text, text)
to authenticated;

create or replace function public.upsert_user_push_token(
  input_token text,
  input_platform text,
  input_cleanup_secret text
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, private, extensions
as $$
declare
  normalized_token text;
  normalized_platform text;
  normalized_cleanup_secret text;
  cleanup_hash text;
begin
  if auth.uid() is null then
    raise exception 'Unauthorized';
  end if;

  normalized_token := btrim(coalesce(input_token, ''));
  normalized_platform := lower(btrim(coalesce(input_platform, '')));
  normalized_cleanup_secret := lower(btrim(coalesce(input_cleanup_secret, '')));

  if not private.is_valid_expo_push_token(normalized_token) then
    raise exception 'Invalid push token';
  end if;

  if normalized_platform not in ('android', 'ios') then
    raise exception 'Invalid push platform';
  end if;

  if normalized_cleanup_secret !~ '^[a-f0-9]{64}$' then
    raise exception 'Invalid push cleanup capability';
  end if;

  cleanup_hash := encode(digest(normalized_cleanup_secret, 'sha256'), 'hex');

  delete from public.user_push_tokens
  where expo_push_token = normalized_token
    and user_id <> auth.uid();

  insert into public.user_push_tokens (
    user_id,
    expo_push_token,
    platform,
    cleanup_secret_hash,
    is_active,
    last_seen_at
  )
  values (
    auth.uid(),
    normalized_token,
    normalized_platform,
    cleanup_hash,
    true,
    timezone('utc', now())
  )
  on conflict (expo_push_token) do update
  set
    user_id = auth.uid(),
    platform = excluded.platform,
    cleanup_secret_hash = excluded.cleanup_secret_hash,
    is_active = true,
    last_seen_at = timezone('utc', now()),
    updated_at = timezone('utc', now());
end;
$$;

revoke all on function public.upsert_user_push_token(text, text, text)
from public, anon, authenticated;
grant execute on function public.upsert_user_push_token(text, text, text)
to authenticated;

-- Natural source identifiers make trigger retries idempotent without merging
-- distinct user actions such as an unlike followed by a later re-like.
create unique index if not exists notifications_follow_request_event_unique
on public.notifications (follow_request_id)
where type = 'follow_request' and follow_request_id is not null;

create unique index if not exists notifications_place_quote_event_unique
on public.notifications (list_place_id)
where type = 'place_quote' and list_place_id is not null;

-- A known UUID must not let either side recreate a social edge after a block.
drop policy if exists "user_follows_insert_self" on public.user_follows;
create policy "user_follows_insert_self"
on public.user_follows
for insert
to authenticated
with check (
  follower_id = auth.uid()
  and follower_id <> following_id
  and not private.users_have_block_relation(follower_id, following_id)
);

drop policy if exists "follow_requests_insert_self" on public.follow_requests;
create policy "follow_requests_insert_self"
on public.follow_requests
for insert
to authenticated
with check (
  requester_id = auth.uid()
  and requester_id <> target_user_id
  and not private.users_have_block_relation(requester_id, target_user_id)
);

create or replace function private.notify_follow_request_created()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
begin
  if new.status <> 'pending'
    or new.requester_id = new.target_user_id
    or private.users_have_block_relation(new.requester_id, new.target_user_id) then
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
  )
  on conflict (follow_request_id)
    where type = 'follow_request' and follow_request_id is not null
  do nothing;

  return new;
end;
$$;

revoke all on function private.notify_follow_request_created()
from public, anon, authenticated;

drop trigger if exists follow_requests_notify_insert on public.follow_requests;
create trigger follow_requests_notify_insert
after insert on public.follow_requests
for each row
execute function private.notify_follow_request_created();

-- Quote attribution is derived by the provenance trigger before this AFTER
-- trigger runs. The client cannot select an arbitrary recipient or push body.
create or replace function private.notify_place_quote_created()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  target_actor_user_id uuid;
begin
  if new.source_user_id is null then
    return new;
  end if;

  select lists.owner_id
  into target_actor_user_id
  from public.lists
  where lists.id = new.list_id;

  if target_actor_user_id is null
    or target_actor_user_id = new.source_user_id
    or private.users_have_block_relation(target_actor_user_id, new.source_user_id) then
    return new;
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
    new.source_user_id,
    target_actor_user_id,
    'place_quote',
    format('"%s" mekanını kendi listesine alıntıladı', coalesce(new.source_place_name, 'Mekan')),
    new.list_id,
    new.id
  )
  on conflict (list_place_id)
    where type = 'place_quote' and list_place_id is not null
  do nothing;

  return new;
end;
$$;

revoke all on function private.notify_place_quote_created()
from public, anon, authenticated;

drop trigger if exists list_places_notify_quote_insert on public.list_places;
create trigger list_places_notify_quote_insert
after insert on public.list_places
for each row
execute function private.notify_place_quote_created();

-- Preserve the published RPC while turning it into an idempotent verifier and
-- fallback. This also covers quote rows created just before the trigger ships.
create or replace function public.create_place_quote_notification(
  input_recipient_user_id uuid,
  input_message text,
  input_list_id uuid default null,
  input_list_place_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  actor_user_id uuid := auth.uid();
  target_source_user_id uuid;
  target_source_place_name text;
begin
  if actor_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if input_recipient_user_id is null
    or input_list_id is null
    or input_list_place_id is null
    or nullif(btrim(coalesce(input_message, '')), '') is null
    or char_length(btrim(input_message)) > 500 then
    raise exception 'Invalid place quote notification' using errcode = '22023';
  end if;

  select
    list_places.source_user_id,
    list_places.source_place_name
  into
    target_source_user_id,
    target_source_place_name
  from public.list_places
  join public.lists on lists.id = list_places.list_id
  where list_places.id = input_list_place_id
    and list_places.list_id = input_list_id
    and lists.owner_id = actor_user_id;

  if not found then
    raise exception 'Place quote target is not owned by the actor'
      using errcode = '42501';
  end if;

  if target_source_user_id is null
    or target_source_user_id <> input_recipient_user_id then
    raise exception 'Place quote recipient does not match provenance'
      using errcode = '42501';
  end if;

  if actor_user_id = target_source_user_id
    or private.users_have_block_relation(actor_user_id, target_source_user_id) then
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
    target_source_user_id,
    actor_user_id,
    'place_quote',
    format('"%s" mekanını kendi listesine alıntıladı', coalesce(target_source_place_name, 'Mekan')),
    input_list_id,
    input_list_place_id
  )
  on conflict (list_place_id)
    where type = 'place_quote' and list_place_id is not null
  do nothing;
end;
$$;

revoke all on function public.create_place_quote_notification(uuid, text, uuid, uuid)
from public, anon, authenticated;
grant execute on function public.create_place_quote_notification(uuid, text, uuid, uuid)
to authenticated;

create or replace function private.dispatch_push_notification()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  target_actor_name text;
  target_push_title text;
  unread_badge_count integer := 0;
begin
  if new.recipient_user_id is null
    or new.read = true
    or (
      new.actor_user_id is not null
      and new.actor_user_id = new.recipient_user_id
    )
    or (
      new.actor_user_id is not null
      and private.users_have_block_relation(new.recipient_user_id, new.actor_user_id)
    ) then
    return new;
  end if;

  select profiles.name
  into target_actor_name
  from public.profiles
  where profiles.id = new.actor_user_id;

  target_push_title := nullif(btrim(coalesce(new.push_title, '')), '');

  select count(*)::integer
  into unread_badge_count
  from public.notifications
  where recipient_user_id = new.recipient_user_id
    and read = false;

  insert into private.push_delivery_jobs (
    id,
    notification_id,
    push_token_id,
    recipient_user_id,
    expo_push_token,
    payload
  )
  select
    targets.job_id,
    new.id,
    targets.push_token_id,
    new.recipient_user_id,
    targets.expo_push_token,
    jsonb_build_object(
      'to', targets.expo_push_token,
      'title', coalesce(target_push_title, target_actor_name, 'SoRita'),
      'body', new.message,
      'sound', 'default',
      'priority', 'high',
      'badge', greatest(unread_badge_count, 1),
      'interruptionLevel', 'active',
      'ttl', 86400,
      -- Retries preserve the same job payload. These keys coalesce an in-flight
      -- retry on both platforms and replace an already displayed Android copy.
      'collapseId', targets.job_id::text,
      'tag', targets.job_id::text,
      'data', jsonb_build_object(
        'notificationId', new.id,
        'deliveryId', targets.job_id,
        'type', new.type,
        'userId', new.actor_user_id,
        'listId', new.list_id,
        'placeId', new.list_place_id
      )
    )
  from (
    select
      user_push_tokens.id as push_token_id,
      user_push_tokens.expo_push_token,
      gen_random_uuid() as job_id
    from public.user_push_tokens
    where user_push_tokens.user_id = new.recipient_user_id
      and user_push_tokens.is_active = true
  ) as targets
  on conflict (notification_id, push_token_id) do nothing;

  -- pg_net queues requests transactionally and performs the actual network I/O
  -- after commit. Scope the latency kick to this personal notification and cap
  -- it so a broadcast fan-out cannot amplify row-trigger work. Any remaining
  -- jobs, and every retry/receipt, stay owned by the durable minute worker.
  if new.type <> 'system_announcement' then
    begin
      perform private.dispatch_push_jobs(10, new.id);
    exception
      when others then
        -- The outbox rows above are the reliability boundary. A kick failure
        -- must not roll back the user action; the scheduled worker retries it.
        null;
    end;
  end if;

  return new;
end;
$$;

revoke all on function private.dispatch_push_notification()
from public, anon, authenticated;

drop trigger if exists notifications_dispatch_push on public.notifications;
create trigger notifications_dispatch_push
after insert on public.notifications
for each row
execute function private.dispatch_push_notification();

-- Re-check notification eligibility at every send attempt. The optional
-- notification scope is used only by the bounded low-latency trigger kick.
create or replace function private.dispatch_push_jobs(
  batch_limit integer,
  input_notification_id uuid
)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public, private, net
as $$
declare
  target_job record;
  target_request_id bigint;
  dispatched_count integer := 0;
  normalized_limit integer := least(greatest(coalesce(batch_limit, 100), 1), 100);
  next_attempt_count integer;
begin
  update private.push_delivery_jobs as jobs
  set
    status = 'cancelled',
    completed_at = timezone('utc', now()),
    last_error_code = 'DeliveryNoLongerEligible',
    last_error_message = 'Push delivery is no longer eligible for its recipient.',
    updated_at = timezone('utc', now())
  where jobs.status in ('pending', 'retry_send')
    and jobs.next_attempt_at <= timezone('utc', now())
    and (
      input_notification_id is null
      or jobs.notification_id = input_notification_id
    )
    and (
      not exists (
        select 1
        from public.user_push_tokens as tokens
        where tokens.id = jobs.push_token_id
          and tokens.user_id = jobs.recipient_user_id
          and tokens.expo_push_token = jobs.expo_push_token
          and tokens.is_active = true
      )
      or not exists (
        select 1
        from public.notifications as notifications
        where notifications.id = jobs.notification_id
          and notifications.recipient_user_id = jobs.recipient_user_id
          and notifications.read = false
          and (
            notifications.actor_user_id is null
            or (
              notifications.actor_user_id <> notifications.recipient_user_id
              and not private.users_have_block_relation(
                notifications.recipient_user_id,
                notifications.actor_user_id
              )
            )
          )
      )
    );

  for target_job in
    select jobs.id, jobs.payload, jobs.send_attempt_count
    from private.push_delivery_jobs as jobs
    join public.user_push_tokens as tokens
      on tokens.id = jobs.push_token_id
     and tokens.user_id = jobs.recipient_user_id
     and tokens.expo_push_token = jobs.expo_push_token
     and tokens.is_active = true
    join public.notifications as notifications
      on notifications.id = jobs.notification_id
     and notifications.recipient_user_id = jobs.recipient_user_id
     and notifications.read = false
    where jobs.status in ('pending', 'retry_send')
      and jobs.next_attempt_at <= timezone('utc', now())
      and jobs.expires_at > timezone('utc', now())
      and jobs.send_attempt_count < 4
      and (
        input_notification_id is null
        or jobs.notification_id = input_notification_id
      )
      and (
        notifications.actor_user_id is null
        or (
          notifications.actor_user_id <> notifications.recipient_user_id
          and not private.users_have_block_relation(
            notifications.recipient_user_id,
            notifications.actor_user_id
          )
        )
      )
    order by jobs.next_attempt_at, jobs.created_at
    for update of jobs skip locked
    limit normalized_limit
  loop
    next_attempt_count := target_job.send_attempt_count + 1;

    begin
      target_request_id := net.http_post(
        url := 'https://exp.host/--/api/v2/push/send',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Accept', 'application/json'
        ),
        body := target_job.payload
      );

      update private.push_delivery_jobs
      set
        status = 'sending',
        send_attempt_count = next_attempt_count,
        send_request_id = target_request_id,
        send_requested_at = timezone('utc', now()),
        last_error_code = null,
        last_error_message = null,
        updated_at = timezone('utc', now())
      where id = target_job.id;

      dispatched_count := dispatched_count + 1;
    exception
      when others then
        update private.push_delivery_jobs
        set
          status = case when next_attempt_count >= 4 then 'failed' else 'retry_send' end,
          send_attempt_count = next_attempt_count,
          next_attempt_at = timezone('utc', now()) + private.push_send_retry_delay(next_attempt_count),
          completed_at = case when next_attempt_count >= 4 then timezone('utc', now()) else null end,
          last_error_code = 'PgNetEnqueueError',
          last_error_message = left(sqlerrm, 500),
          updated_at = timezone('utc', now())
        where id = target_job.id;
    end;
  end loop;

  return dispatched_count;
end;
$$;

revoke all on function private.dispatch_push_jobs(integer, uuid)
from public, anon, authenticated, service_role;

-- Preserve the worker/scheduler contract used by pg_cron and the operational
-- service-role fallback while keeping the scoping primitive private to trigger
-- execution.
create or replace function private.dispatch_pending_push_jobs(batch_limit integer default 100)
returns integer
language sql
security definer
set search_path = pg_catalog, private
as $$
  select private.dispatch_push_jobs(batch_limit, null::uuid);
$$;

revoke all on function private.dispatch_pending_push_jobs(integer)
from public, anon, authenticated;
grant execute on function private.dispatch_pending_push_jobs(integer)
to service_role;
