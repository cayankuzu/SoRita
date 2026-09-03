-- Push hardening is forward-only. It adds revocation capabilities, canonical
-- broadcast claims, an append-only delivery DLQ, and an explicit scheduler
-- health contract without changing the frozen notification type set.

-- Older environments installed pgcrypto in public, while Supabase normally
-- keeps it in extensions. Keep both layouts forward-compatible rather than
-- assuming a specific extension schema.
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

alter table public.user_push_tokens
  add column if not exists cleanup_secret_hash text;

alter table public.user_push_tokens
  drop constraint if exists user_push_tokens_cleanup_secret_hash_format;

alter table public.user_push_tokens
  add constraint user_push_tokens_cleanup_secret_hash_format
  check (
    cleanup_secret_hash is null
    or cleanup_secret_hash ~ '^[a-f0-9]{64}$'
  );

-- Token registration and removal are RPC-only. In particular, do not leave a
-- table-level SELECT grant that could expose cleanup capability hashes through
-- the legacy "select own token" policy.
revoke all on table public.user_push_tokens from anon, authenticated;

-- New clients bind a high-entropy, local-only cleanup capability hash to each
-- token. The raw cleanup capability is never retained in Postgres. Keep the
-- existing two-argument overload during the binary adoption window so a store
-- client released before this migration can still refresh its token. Those
-- legacy rows remain removable through the authenticated removal RPC; only the
-- new overload enables anonymous capability-based cleanup.

create function public.upsert_user_push_token(
  input_token text,
  input_platform text,
  input_cleanup_secret text
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
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

  normalized_token := trim(coalesce(input_token, ''));
  normalized_platform := lower(trim(coalesce(input_platform, '')));
  normalized_cleanup_secret := lower(trim(coalesce(input_cleanup_secret, '')));

  if normalized_token = '' or length(normalized_token) > 2048 then
    raise exception 'Invalid push token';
  end if;

  if normalized_platform not in ('android', 'ios') then
    raise exception 'Invalid push platform';
  end if;

  if normalized_cleanup_secret !~ '^[a-f0-9]{64}$' then
    raise exception 'Invalid push cleanup capability';
  end if;

  cleanup_hash := encode(digest(normalized_cleanup_secret, 'sha256'), 'hex');

  -- A physical token can only belong to one account. Deleting the prior row
  -- also cancels its pending delivery jobs through the existing FK cascade.
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

revoke all on function public.upsert_user_push_token(text, text, text) from public;
grant execute on function public.upsert_user_push_token(text, text, text) to authenticated;

-- This is a deliberately narrow, anonymous revocation capability for a
-- interrupted logout. It can only delete the exact token whose SHA-256
-- capability hash matches; it does not return token, user, or delivery data.
create or replace function public.revoke_push_token_with_cleanup_secret(
  input_token text,
  input_cleanup_secret text
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  normalized_token text;
  normalized_cleanup_secret text;
  cleanup_hash text;
  removed_count integer;
begin
  normalized_token := trim(coalesce(input_token, ''));
  normalized_cleanup_secret := lower(trim(coalesce(input_cleanup_secret, '')));

  if normalized_token = ''
    or length(normalized_token) > 2048
    or normalized_cleanup_secret !~ '^[a-f0-9]{64}$' then
    return false;
  end if;

  cleanup_hash := encode(digest(normalized_cleanup_secret, 'sha256'), 'hex');

  delete from public.user_push_tokens
  where expo_push_token = normalized_token
    and cleanup_secret_hash = cleanup_hash;

  get diagnostics removed_count = row_count;

  if removed_count > 0 then
    return true;
  end if;

  -- An already-deleted token is a successful, idempotent cleanup. A still
  -- present token with a different hash is kept pending on the device.
  return not exists (
    select 1
    from public.user_push_tokens
    where expo_push_token = normalized_token
  );
end;
$$;

revoke all on function public.revoke_push_token_with_cleanup_secret(text, text)
from public;
grant execute on function public.revoke_push_token_with_cleanup_secret(text, text)
to anon, authenticated;

create table if not exists private.system_broadcast_requests (
  idempotency_key uuid primary key,
  request_hash text not null check (request_hash ~ '^[a-f0-9]{64}$'),
  recipient_count integer not null check (recipient_count >= 0),
  created_at timestamptz not null default timezone('utc', now())
);

alter table private.system_broadcast_requests enable row level security;
revoke all on table private.system_broadcast_requests from public, anon, authenticated, service_role;

-- Keep the four-argument service-role overload for the previous Edge Function
-- deployment during the expand/migrate/contract window. New deployments use
-- the five-argument canonical-hash overload below. A later, separately
-- reviewed migration may retire the legacy overload after adoption evidence.

create function public.insert_system_broadcast_notifications(
  p_idempotency_key uuid,
  p_message text,
  p_push_title text,
  p_recipient_user_ids uuid[],
  p_request_hash text
)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  inserted_count integer := 0;
  normalized_request_hash text;
  stored_request_hash text;
  normalized_recipient_count integer;
begin
  if auth.role() <> 'service_role' then
    raise insufficient_privilege using message = 'service_role required';
  end if;

  if p_idempotency_key is null
    or nullif(btrim(coalesce(p_message, '')), '') is null
    or nullif(btrim(coalesce(p_push_title, '')), '') is null then
    raise invalid_parameter_value using message = 'Invalid broadcast payload';
  end if;

  normalized_request_hash := lower(btrim(coalesce(p_request_hash, '')));
  if normalized_request_hash !~ '^[a-f0-9]{64}$' then
    raise invalid_parameter_value using message = 'Invalid broadcast request hash';
  end if;

  normalized_recipient_count := cardinality(coalesce(p_recipient_user_ids, array[]::uuid[]));

  -- The no-op conflict update serializes reuse of an idempotency key and lets
  -- us reject a body or resolved-audience mismatch atomically.
  insert into private.system_broadcast_requests as requests (
    idempotency_key,
    request_hash,
    recipient_count
  )
  values (
    p_idempotency_key,
    normalized_request_hash,
    normalized_recipient_count
  )
  on conflict (idempotency_key) do update
  set request_hash = requests.request_hash
  returning request_hash into stored_request_hash;

  if stored_request_hash <> normalized_request_hash then
    raise exception 'idempotency_key_payload_mismatch' using errcode = 'P0001';
  end if;

  with claimed_recipients as (
    insert into private.system_broadcast_deliveries (
      idempotency_key,
      recipient_user_id
    )
    select p_idempotency_key, recipient_user_id
    from unnest(coalesce(p_recipient_user_ids, array[]::uuid[]))
      as recipient(recipient_user_id)
    where recipient_user_id is not null
    on conflict (idempotency_key, recipient_user_id) do nothing
    returning recipient_user_id
  ), inserted_notifications as (
    insert into public.notifications (
      actor_user_id,
      message,
      push_title,
      read,
      recipient_user_id,
      type
    )
    select
      null,
      btrim(p_message),
      btrim(p_push_title),
      false,
      recipient_user_id,
      'system_announcement'
    from claimed_recipients
    returning id
  )
  select count(*)::integer
  into inserted_count
  from inserted_notifications;

  return inserted_count;
end;
$$;

revoke all on function public.insert_system_broadcast_notifications(uuid, text, text, uuid[], text)
from public, anon, authenticated;
grant execute on function public.insert_system_broadcast_notifications(uuid, text, text, uuid[], text)
to service_role;

create table if not exists private.push_delivery_dead_letters (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null,
  notification_id uuid references public.notifications(id) on delete set null,
  recipient_user_id uuid references auth.users(id) on delete set null,
  terminal_status text not null check (terminal_status in ('failed', 'unregistered')),
  failure_code text not null check (failure_code ~ '^[A-Za-z0-9_.:-]{1,120}$'),
  send_attempt_count smallint not null check (send_attempt_count >= 0),
  receipt_attempt_count smallint not null check (receipt_attempt_count >= 0),
  occurred_at timestamptz not null default timezone('utc', now()),
  expires_at timestamptz not null default (timezone('utc', now()) + interval '90 days')
);

create index if not exists idx_push_delivery_dead_letters_occurred_at
  on private.push_delivery_dead_letters (occurred_at desc);

create index if not exists idx_push_delivery_dead_letters_job_id
  on private.push_delivery_dead_letters (job_id, occurred_at desc);

alter table private.push_delivery_dead_letters enable row level security;
revoke all on table private.push_delivery_dead_letters from public, anon, authenticated, service_role;

create or replace function private.capture_push_delivery_dead_letter()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, private
as $$
declare
  normalized_code text;
begin
  if new.status not in ('failed', 'unregistered')
    or old.status is not distinct from new.status then
    return new;
  end if;

  normalized_code := regexp_replace(
    coalesce(nullif(new.last_error_code, ''), 'UnknownPushDeliveryFailure'),
    '[^A-Za-z0-9_.:-]',
    '',
    'g'
  );
  normalized_code := left(coalesce(nullif(normalized_code, ''), 'UnknownPushDeliveryFailure'), 120);

  insert into private.push_delivery_dead_letters (
    job_id,
    notification_id,
    recipient_user_id,
    terminal_status,
    failure_code,
    send_attempt_count,
    receipt_attempt_count,
    occurred_at
  )
  values (
    new.id,
    new.notification_id,
    new.recipient_user_id,
    new.status,
    normalized_code,
    new.send_attempt_count,
    new.receipt_attempt_count,
    coalesce(new.completed_at, timezone('utc', now()))
  );

  return new;
end;
$$;

revoke all on function private.capture_push_delivery_dead_letter() from public, anon, authenticated;

drop trigger if exists push_delivery_jobs_capture_dead_letter on private.push_delivery_jobs;
create trigger push_delivery_jobs_capture_dead_letter
after update of status on private.push_delivery_jobs
for each row
execute function private.capture_push_delivery_dead_letter();

-- Preserve an audit entry for terminal records that predate this migration.
insert into private.push_delivery_dead_letters (
  job_id,
  notification_id,
  recipient_user_id,
  terminal_status,
  failure_code,
  send_attempt_count,
  receipt_attempt_count,
  occurred_at
)
select
  jobs.id,
  jobs.notification_id,
  jobs.recipient_user_id,
  jobs.status,
  left(
    coalesce(
      nullif(regexp_replace(coalesce(jobs.last_error_code, ''), '[^A-Za-z0-9_.:-]', '', 'g'), ''),
      'UnknownPushDeliveryFailure'
    ),
    120
  ),
  jobs.send_attempt_count,
  jobs.receipt_attempt_count,
  coalesce(jobs.completed_at, jobs.updated_at, timezone('utc', now()))
from private.push_delivery_jobs as jobs
where jobs.status in ('failed', 'unregistered')
  and not exists (
    select 1
    from private.push_delivery_dead_letters as existing
    where existing.job_id = jobs.id
      and existing.terminal_status = jobs.status
      and existing.occurred_at = coalesce(jobs.completed_at, jobs.updated_at, timezone('utc', now()))
  );

create table if not exists private.push_delivery_requeue_audits (
  id uuid primary key default gen_random_uuid(),
  dead_letter_id uuid not null references private.push_delivery_dead_letters(id) on delete cascade,
  job_id uuid not null,
  requeue_key uuid not null,
  outcome text not null check (outcome in ('requeued', 'not_requeueable')),
  created_at timestamptz not null default timezone('utc', now()),
  unique (dead_letter_id, requeue_key)
);

alter table private.push_delivery_requeue_audits enable row level security;
revoke all on table private.push_delivery_requeue_audits from public, anon, authenticated, service_role;

create or replace function public.requeue_push_delivery_dead_letter(
  p_dead_letter_id uuid,
  p_requeue_key uuid
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  target_dead_letter private.push_delivery_dead_letters%rowtype;
  target_job private.push_delivery_jobs%rowtype;
  already_recorded_outcome text;
  requeueable boolean := false;
begin
  if auth.role() <> 'service_role' then
    raise insufficient_privilege using message = 'service_role required';
  end if;

  if p_dead_letter_id is null or p_requeue_key is null then
    raise invalid_parameter_value using message = 'dead letter and requeue keys are required';
  end if;

  select outcome
  into already_recorded_outcome
  from private.push_delivery_requeue_audits
  where dead_letter_id = p_dead_letter_id
    and requeue_key = p_requeue_key;

  if found then
    return already_recorded_outcome = 'requeued';
  end if;

  select *
  into target_dead_letter
  from private.push_delivery_dead_letters
  where id = p_dead_letter_id;

  if not found then
    raise invalid_parameter_value using message = 'push delivery dead letter was not found';
  end if;

  select *
  into target_job
  from private.push_delivery_jobs
  where id = target_dead_letter.job_id
  for update;

  if found
    and target_job.status = 'failed'
    and exists (
      select 1
      from public.user_push_tokens as tokens
      where tokens.id = target_job.push_token_id
        and tokens.user_id = target_job.recipient_user_id
        and tokens.expo_push_token = target_job.expo_push_token
        and tokens.is_active = true
    ) then
    requeueable := true;
  end if;

  insert into private.push_delivery_requeue_audits (
    dead_letter_id,
    job_id,
    requeue_key,
    outcome
  )
  values (
    target_dead_letter.id,
    target_dead_letter.job_id,
    p_requeue_key,
    case when requeueable then 'requeued' else 'not_requeueable' end
  );

  if not requeueable then
    return false;
  end if;

  update private.push_delivery_jobs
  set
    status = 'pending',
    send_attempt_count = 0,
    receipt_attempt_count = 0,
    send_request_id = null,
    ticket_id = null,
    receipt_request_id = null,
    send_requested_at = null,
    receipt_due_at = null,
    receipt_requested_at = null,
    completed_at = null,
    last_error_code = null,
    last_error_message = null,
    next_attempt_at = timezone('utc', now()),
    expires_at = timezone('utc', now()) + interval '24 hours',
    updated_at = timezone('utc', now())
  where id = target_job.id;

  return true;
end;
$$;

revoke all on function public.requeue_push_delivery_dead_letter(uuid, uuid)
from public, anon, authenticated;
grant execute on function public.requeue_push_delivery_dead_letter(uuid, uuid)
to service_role;

create or replace function private.prune_push_delivery_dead_letters(
  p_limit integer default 500
)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, private
as $$
declare
  deleted_count integer := 0;
  normalized_limit integer := least(greatest(coalesce(p_limit, 500), 1), 1000);
begin
  with expired as (
    select id
    from private.push_delivery_dead_letters
    where expires_at <= timezone('utc', now())
    order by expires_at
    limit normalized_limit
    for update skip locked
  ), deleted as (
    delete from private.push_delivery_dead_letters
    where id in (select id from expired)
    returning id
  )
  select count(*)::integer into deleted_count from deleted;

  return deleted_count;
end;
$$;

revoke all on function private.prune_push_delivery_dead_letters(integer)
from public, anon, authenticated;

create table if not exists private.push_delivery_worker_health (
  worker_name text primary key check (worker_name = 'sorita-push-delivery-worker'),
  last_started_at timestamptz,
  last_completed_at timestamptz,
  last_failed_at timestamptz,
  last_status text not null default 'never' check (last_status in ('never', 'running', 'healthy', 'failed')),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table private.push_delivery_worker_health enable row level security;
revoke all on table private.push_delivery_worker_health from public, anon, authenticated, service_role;

create or replace function private.run_push_delivery_worker_with_health()
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, private, net
as $$
begin
  insert into private.push_delivery_worker_health (
    worker_name,
    last_started_at,
    last_status,
    updated_at
  )
  values (
    'sorita-push-delivery-worker',
    timezone('utc', now()),
    'running',
    timezone('utc', now())
  )
  on conflict (worker_name) do update
  set
    last_started_at = excluded.last_started_at,
    last_status = 'running',
    updated_at = excluded.updated_at;

  begin
    perform private.run_push_delivery_worker();
    perform private.prune_push_delivery_dead_letters(500);

    update private.push_delivery_worker_health
    set
      last_completed_at = timezone('utc', now()),
      last_status = 'healthy',
      updated_at = timezone('utc', now())
    where worker_name = 'sorita-push-delivery-worker';
  exception
    when others then
      update private.push_delivery_worker_health
      set
        last_failed_at = timezone('utc', now()),
        last_status = 'failed',
        updated_at = timezone('utc', now())
      where worker_name = 'sorita-push-delivery-worker';
      -- Do not re-raise here: that would roll back the only durable failure
      -- signal. Schedulers alarm from the explicit health contract below.
      return;
  end;
end;
$$;

revoke all on function private.run_push_delivery_worker_with_health()
from public, anon, authenticated;
grant execute on function private.run_push_delivery_worker_with_health() to service_role;

-- This public wrapper is service-role-only so an approved external scheduler
-- can satisfy the same one-minute contract when pg_cron is unavailable.
create or replace function public.run_push_delivery_worker_for_scheduler()
returns void
language plpgsql
security definer
set search_path = pg_catalog, private
as $$
begin
  if auth.role() <> 'service_role' then
    raise insufficient_privilege using message = 'service_role required';
  end if;

  perform private.run_push_delivery_worker_with_health();
end;
$$;

revoke all on function public.run_push_delivery_worker_for_scheduler()
from public, anon, authenticated;
grant execute on function public.run_push_delivery_worker_for_scheduler()
to service_role;

create or replace function public.get_push_delivery_scheduler_health()
returns table (
  scheduler_mode text,
  healthy boolean,
  last_started_at timestamptz,
  last_completed_at timestamptz,
  last_failed_at timestamptz,
  pending_job_count bigint,
  dead_letter_count bigint
)
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  health private.push_delivery_worker_health%rowtype;
  cron_available boolean := to_regclass('cron.job') is not null;
begin
  if auth.role() <> 'service_role' then
    raise insufficient_privilege using message = 'service_role required';
  end if;

  select * into health
  from private.push_delivery_worker_health
  where worker_name = 'sorita-push-delivery-worker';

  return query
  select
    case when cron_available then 'pg_cron' else 'external_required' end,
    coalesce(
      health.last_status = 'healthy'
        and health.last_completed_at >= timezone('utc', now()) - interval '2 minutes',
      false
    ),
    health.last_started_at,
    health.last_completed_at,
    health.last_failed_at,
    (select count(*) from private.push_delivery_jobs where status in ('pending', 'retry_send', 'sending', 'awaiting_receipt', 'checking_receipt', 'retry_receipt')),
    (select count(*) from private.push_delivery_dead_letters where expires_at > timezone('utc', now()));
end;
$$;

revoke all on function public.get_push_delivery_scheduler_health()
from public, anon, authenticated;
grant execute on function public.get_push_delivery_scheduler_health()
to service_role;

do $$
declare
  existing_job_id bigint;
begin
  if to_regclass('cron.job') is null then
    raise warning 'pg_cron is unavailable; invoke public.run_push_delivery_worker_for_scheduler() with service_role once per minute and monitor public.get_push_delivery_scheduler_health()';
    return;
  end if;

  for existing_job_id in
    select jobid
    from cron.job
    where jobname = 'sorita-push-delivery-worker'
  loop
    perform cron.unschedule(existing_job_id);
  end loop;

  perform cron.schedule(
    'sorita-push-delivery-worker',
    '* * * * *',
    'select private.run_push_delivery_worker_with_health();'
  );
end
$$;
