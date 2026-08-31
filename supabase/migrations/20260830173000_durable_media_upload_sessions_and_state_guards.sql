-- Close the remaining state-machine races and make signed media uploads
-- durable, owner-bound, retryable, and sweepable.

create or replace function public.get_auth_login_guard_status(input_email text)
returns table (
  failure_count integer,
  locked_until timestamptz,
  retry_after_seconds integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  hashed_email text := private.hash_security_identifier(
    nullif(private.normalize_email(input_email), '')
  );
  guard_row private.auth_login_guards%rowtype;
  now_utc timestamptz := timezone('utc', now());
begin
  if hashed_email is null then
    return;
  end if;

  -- Use the same per-identifier lock as record/clear. Without it, an expired
  -- status read could delete a fresh failure written by a concurrent request.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(hashed_email, 0)
  );

  delete from private.auth_login_guards
  where normalized_email = hashed_email
    and locked_until is not null
    and locked_until <= now_utc;

  select *
  into guard_row
  from private.auth_login_guards
  where normalized_email = hashed_email;

  if not found then
    return;
  end if;

  return query
  select
    guard_row.failure_count,
    guard_row.locked_until,
    case
      when guard_row.locked_until is null then 0
      else greatest(ceil(extract(epoch from guard_row.locked_until - now_utc))::integer, 1)
    end;
end;
$$;

revoke all on function public.get_auth_login_guard_status(text)
from public, anon, authenticated;
grant execute on function public.get_auth_login_guard_status(text) to service_role;

create or replace function private.enforce_list_place_provenance_immutability()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  source_place_name text;
  source_owner_id uuid;
  source_owner_name text;
  source_owner_avatar text;
  source_list_cleanup boolean := false;
  source_place_cleanup boolean := false;
  source_user_cleanup boolean := false;
begin
  if auth.uid() is null then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.source_list_id is null and new.source_place_id is null then
      -- Non-quoted places cannot smuggle attribution metadata that later
      -- participates in block/private-media authorization.
      new.source_place_name := null;
      new.source_user_avatar_url := null;
      new.source_user_id := null;
      new.source_user_name := null;
      return new;
    end if;

    if new.source_list_id is null or new.source_place_id is null then
      raise exception 'invalid place provenance' using errcode = '42501';
    end if;

    select
      places.name,
      lists.owner_id,
      profiles.name,
      profiles.profile_photo_url
    into
      source_place_name,
      source_owner_id,
      source_owner_name,
      source_owner_avatar
    from public.list_places places
    join public.lists lists on lists.id = places.list_id
    join public.profiles profiles on profiles.id = lists.owner_id
    where places.id = new.source_place_id
      and lists.id = new.source_list_id
      and private.can_view_list(lists.id);

    if not found then
      raise exception 'invalid or invisible place provenance' using errcode = '42501';
    end if;

    -- Derive every security-sensitive snapshot field from the authoritative
    -- visible source. Client-supplied source_* metadata is intentionally ignored.
    new.source_place_name := private.normalize_optional_text(source_place_name, 100);
    new.source_user_avatar_url := private.normalize_optional_media_url(source_owner_avatar);
    new.source_user_id := source_owner_id;
    new.source_user_name := private.normalize_optional_text(source_owner_name, 60);
    return new;
  end if;

  -- Referential ON DELETE SET NULL actions execute row triggers with the
  -- caller's JWT context. Permit only a nulling transition whose old parent is
  -- already gone; direct owner edits remain immutable.
  source_list_cleanup :=
    old.source_list_id is not null
    and new.source_list_id is null
    and not exists (
      select 1 from public.lists lists where lists.id = old.source_list_id
    );
  source_place_cleanup :=
    old.source_place_id is not null
    and new.source_place_id is null
    and not exists (
      select 1 from public.list_places places where places.id = old.source_place_id
    );
  source_user_cleanup :=
    old.source_user_id is not null
    and new.source_user_id is null
    and not exists (
      select 1 from public.profiles profiles where profiles.id = old.source_user_id
    );

  if (
    new.source_list_id is distinct from old.source_list_id
      and not source_list_cleanup
  ) or (
    new.source_place_id is distinct from old.source_place_id
      and not source_place_cleanup
  ) or (
    new.source_user_id is distinct from old.source_user_id
      and not source_user_cleanup
  ) or new.source_place_name is distinct from old.source_place_name
    or new.source_user_avatar_url is distinct from old.source_user_avatar_url
    or new.source_user_name is distinct from old.source_user_name then
    raise exception 'immutable place provenance' using errcode = '42501';
  end if;

  return new;
end;
$$;

revoke all on function private.enforce_list_place_provenance_immutability()
from public, anon, authenticated;

drop trigger if exists list_places_enforce_provenance_immutability on public.list_places;
create trigger list_places_enforce_provenance_immutability
before insert or update on public.list_places
for each row execute function private.enforce_list_place_provenance_immutability();

create or replace function public.record_account_deletion_step(
  p_user_id uuid,
  p_step text,
  p_error text default null,
  p_lease_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  job public.account_deletion_jobs%rowtype;
  now_utc timestamptz := timezone('utc', now());
  current_rank integer;
  target_rank integer;
begin
  if p_user_id is null or p_step not in (
    'requested',
    'storage_deleted',
    'notifications_deleted',
    'auth_delete_started',
    'completed',
    'failed'
  ) then
    raise exception 'invalid account deletion step';
  end if;

  select * into job
  from public.account_deletion_jobs
  where user_id = p_user_id
  for update;

  if not found then
    raise exception 'account deletion job was not initialized';
  end if;

  if job.status = 'completed' then
    if p_step = 'completed' then
      return;
    end if;
    raise exception 'completed account deletion job is terminal';
  end if;

  if p_lease_id is null
    or job.lease_id is distinct from p_lease_id
    or job.lease_expires_at is null
    or job.lease_expires_at <= now_utc then
    raise exception 'account deletion lease is not active';
  end if;

  if p_step <> 'failed' then
    current_rank := case job.last_completed_step
      when 'requested' then 0
      when 'storage_deleted' then 1
      when 'notifications_deleted' then 2
      when 'auth_delete_started' then 3
      when 'completed' then 4
      else -1
    end;
    target_rank := case p_step
      when 'requested' then 0
      when 'storage_deleted' then 1
      when 'notifications_deleted' then 2
      when 'auth_delete_started' then 3
      when 'completed' then 4
    end;

    if target_rank < current_rank or target_rank > current_rank + 1 then
      raise exception 'invalid account deletion step transition';
    end if;
  end if;

  update public.account_deletion_jobs
  set
    status = case
      when p_step = 'completed' then 'completed'
      when p_step = 'failed' then 'failed'
      else 'running'
    end,
    step = p_step,
    last_completed_step = case
      when p_step = 'failed' then last_completed_step
      else p_step
    end,
    last_error = case
      when p_step = 'failed' then left(coalesce(p_error, 'unknown'), 500)
      else null
    end,
    updated_at = now_utc,
    completed_at = case when p_step = 'completed' then now_utc else completed_at end,
    lease_id = case when p_step in ('failed', 'completed') then null else lease_id end,
    lease_expires_at = case when p_step in ('failed', 'completed') then null else lease_expires_at end
  where user_id = p_user_id;
end;
$$;

revoke all on function public.record_account_deletion_step(uuid, text, text, uuid)
from public, anon, authenticated;
grant execute on function public.record_account_deletion_step(uuid, text, text, uuid)
to service_role;

create or replace function public.renew_account_deletion_job_lease(
  p_user_id uuid,
  p_lease_id uuid,
  p_lease_seconds integer default 300
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  changed_count integer;
begin
  if p_user_id is null or p_lease_id is null
    or p_lease_seconds is null or p_lease_seconds not between 30 and 900 then
    raise exception 'invalid account deletion lease renewal';
  end if;

  update public.account_deletion_jobs jobs
  set
    lease_expires_at = timezone('utc', now()) + make_interval(secs => p_lease_seconds),
    updated_at = timezone('utc', now())
  where jobs.user_id = p_user_id
    and jobs.status = 'running'
    and jobs.lease_id = p_lease_id
    and jobs.lease_expires_at > timezone('utc', now());

  get diagnostics changed_count = row_count;
  return changed_count = 1;
end;
$$;

revoke all on function public.renew_account_deletion_job_lease(uuid, uuid, integer)
from public, anon, authenticated;
grant execute on function public.renew_account_deletion_job_lease(uuid, uuid, integer)
to service_role;

create or replace function public.is_account_deletion_job_completed(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.account_deletion_jobs jobs
    where jobs.user_id = p_user_id
      and jobs.status = 'completed'
      and jobs.step = 'completed'
      and jobs.last_completed_step = 'completed'
      and jobs.completed_at is not null
  );
$$;

revoke all on function public.is_account_deletion_job_completed(uuid)
from public, anon, authenticated;
grant execute on function public.is_account_deletion_job_completed(uuid)
to service_role;

create table if not exists private.media_upload_sessions (
  session_id uuid primary key,
  user_id uuid not null,
  upload_bucket text not null check (upload_bucket = 'place-media-private'),
  upload_path text not null,
  destination_bucket text not null check (
    destination_bucket in ('profile-media', 'place-media', 'place-media-private')
  ),
  destination_path text not null,
  content_type text not null check (length(content_type) between 3 and 128),
  expected_size_bytes bigint not null check (expected_size_bytes > 0),
  initialization_id uuid not null,
  status text not null default 'pending' check (
    status in (
      'pending',
      'finalizing',
      'finalized',
      'retained',
      'cancelled',
      'cleanup_pending',
      'sweeping',
      'cleanup_failed',
      'expired'
    )
  ),
  upload_url_expires_at timestamptz not null,
  finalize_deadline timestamptz not null,
  cleanup_after timestamptz not null,
  retire_after timestamptz not null,
  finalize_lease_id uuid,
  finalize_lease_expires_at timestamptz,
  cleanup_lease_id uuid,
  cleanup_lease_expires_at timestamptz,
  cleanup_previous_status text,
  next_cleanup_at timestamptz,
  finalized_at timestamptz,
  staging_cleaned_at timestamptz,
  last_error text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (upload_bucket, upload_path),
  unique (destination_bucket, destination_path),
  check (
    length(upload_path) between 1 and 512
    and upload_path ~ '^[A-Za-z0-9/_.,-]+$'
    and upload_path !~ '(^|/)\.\.(/|$)'
  ),
  check (
    length(destination_path) between 1 and 512
    and destination_path ~ '^[A-Za-z0-9/_.,-]+$'
    and destination_path !~ '(^|/)\.\.(/|$)'
  ),
  check (upload_url_expires_at <= finalize_deadline),
  check (finalize_deadline <= cleanup_after),
  check (cleanup_after < retire_after)
);

alter table private.media_upload_sessions enable row level security;
revoke all on table private.media_upload_sessions
from public, anon, authenticated, service_role;

create index if not exists idx_media_upload_sessions_owner_active
on private.media_upload_sessions (user_id, created_at)
where status in ('pending', 'finalizing');

create index if not exists idx_media_upload_sessions_stale_cleanup
on private.media_upload_sessions (
  coalesce(next_cleanup_at, cleanup_after),
  cleanup_lease_expires_at,
  created_at
)
where status in (
  'pending',
  'finalizing',
  'finalized',
  'cancelled',
  'cleanup_pending',
  'cleanup_failed',
  'sweeping'
);

create or replace function public.begin_media_upload_session(
  p_session_id uuid,
  p_user_id uuid,
  p_upload_bucket text,
  p_upload_path text,
  p_destination_bucket text,
  p_destination_path text,
  p_content_type text,
  p_expected_size_bytes bigint,
  p_initialization_id uuid
)
returns table (
  session_id uuid,
  session_status text,
  upload_bucket text,
  upload_path text,
  destination_bucket text,
  destination_path text,
  content_type text,
  expected_size_bytes bigint,
  initialization_id uuid,
  upload_url_expires_at timestamptz,
  finalize_deadline timestamptz,
  cleanup_after timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  existing private.media_upload_sessions%rowtype;
  now_utc timestamptz := timezone('utc', now());
begin
  if p_session_id is null or p_user_id is null or p_initialization_id is null
    or p_upload_bucket is null or p_upload_bucket <> 'place-media-private'
    or p_destination_bucket is null
    or p_destination_bucket not in ('profile-media', 'place-media', 'place-media-private')
    or p_expected_size_bytes is null or p_expected_size_bytes <= 0
    or p_content_type is null or length(p_content_type) not between 3 and 128
    or p_upload_path is null or length(p_upload_path) not between 1 and 512
    or p_destination_path is null or length(p_destination_path) not between 1 and 512
    or p_upload_path !~ '^[A-Za-z0-9/_.,-]+$'
    or p_destination_path !~ '^[A-Za-z0-9/_.,-]+$'
    or p_upload_path like '%..%'
    or p_destination_path like '%..%'
    or p_upload_path not like p_user_id::text || '/%'
    or p_destination_path not like p_user_id::text || '/%' then
    raise exception 'invalid media upload session';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_session_id::text, 31)
  );
  -- Serialize the per-user active-session quota across different session IDs.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_user_id::text, 32)
  );

  select * into existing
  from private.media_upload_sessions sessions
  where sessions.session_id = p_session_id
  for update;

  if found then
    if existing.user_id is distinct from p_user_id
      or existing.upload_bucket is distinct from p_upload_bucket
      or existing.upload_path is distinct from p_upload_path
      or existing.destination_bucket is distinct from p_destination_bucket
      or existing.destination_path is distinct from p_destination_path
      or existing.content_type is distinct from p_content_type
      or existing.expected_size_bytes is distinct from p_expected_size_bytes then
      raise exception 'media upload session conflict';
    end if;

    if existing.status <> 'pending'
      or existing.created_at <= now_utc - interval '24 hours' then
      raise exception 'media upload session cannot be reissued';
    end if;

    -- Storage signed-upload tokens are valid for two hours. Every reissue must
    -- atomically move the finalization and repeated-cleanup horizons forward.
    update private.media_upload_sessions sessions
    set
      upload_url_expires_at = now_utc + interval '2 hours',
      finalize_deadline = now_utc + interval '2 hours 15 minutes',
      cleanup_after = now_utc + interval '2 hours 15 minutes',
       retire_after = now_utc + interval '24 hours',
       initialization_id = p_initialization_id,
      next_cleanup_at = null,
      updated_at = now_utc
    where sessions.session_id = p_session_id
    returning * into existing;
  else
    if (
      select count(*)
      from private.media_upload_sessions sessions
      where sessions.user_id = p_user_id
        and sessions.status in ('pending', 'finalizing')
        and sessions.finalize_deadline > now_utc
    ) >= 64 then
      raise exception 'too many active media upload sessions';
    end if;

    insert into private.media_upload_sessions (
      session_id,
      user_id,
      upload_bucket,
      upload_path,
      destination_bucket,
      destination_path,
      content_type,
      expected_size_bytes,
      initialization_id,
      upload_url_expires_at,
      finalize_deadline,
      cleanup_after,
      retire_after
    ) values (
      p_session_id,
      p_user_id,
      p_upload_bucket,
      p_upload_path,
      p_destination_bucket,
      p_destination_path,
      p_content_type,
      p_expected_size_bytes,
      p_initialization_id,
      now_utc + interval '2 hours',
      now_utc + interval '2 hours 15 minutes',
      now_utc + interval '2 hours 15 minutes',
      now_utc + interval '24 hours'
    )
    returning * into existing;
  end if;

  return query select
    existing.session_id,
    existing.status,
    existing.upload_bucket,
    existing.upload_path,
    existing.destination_bucket,
    existing.destination_path,
    existing.content_type,
    existing.expected_size_bytes,
    existing.initialization_id,
    existing.upload_url_expires_at,
    existing.finalize_deadline,
    existing.cleanup_after;
end;
$$;

revoke all on function public.begin_media_upload_session(uuid, uuid, text, text, text, text, text, bigint, uuid)
from public, anon, authenticated;
grant execute on function public.begin_media_upload_session(uuid, uuid, text, text, text, text, text, bigint, uuid)
to service_role;

create or replace function public.abort_media_upload_session_initialization(
  p_session_id uuid,
  p_user_id uuid,
  p_initialization_id uuid,
  p_error text default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  changed_count integer;
begin
  update private.media_upload_sessions sessions
  set
    status = 'cancelled',
    next_cleanup_at = sessions.cleanup_after,
    last_error = left(nullif(coalesce(p_error, ''), ''), 500),
    updated_at = timezone('utc', now())
  where sessions.session_id = p_session_id
    and sessions.user_id = p_user_id
    and sessions.initialization_id = p_initialization_id
    and sessions.status = 'pending';

  get diagnostics changed_count = row_count;
  return changed_count = 1;
end;
$$;

revoke all on function public.abort_media_upload_session_initialization(uuid, uuid, uuid, text)
from public, anon, authenticated;
grant execute on function public.abort_media_upload_session_initialization(uuid, uuid, uuid, text)
to service_role;

create or replace function public.claim_media_upload_session_finalize(
  p_session_id uuid,
  p_user_id uuid,
  p_lease_id uuid,
  p_lease_seconds integer default 90
)
returns table (
  claim_status text,
  upload_bucket text,
  upload_path text,
  destination_bucket text,
  destination_path text,
  content_type text,
  expected_size_bytes bigint,
  lease_id uuid
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  session_row private.media_upload_sessions%rowtype;
  now_utc timestamptz := timezone('utc', now());
begin
  if p_session_id is null or p_user_id is null or p_lease_id is null
    or p_lease_seconds is null or p_lease_seconds not between 30 and 300 then
    raise exception 'invalid media upload finalize claim';
  end if;

  select * into session_row
  from private.media_upload_sessions sessions
  where sessions.session_id = p_session_id
    and sessions.user_id = p_user_id
  for update;

  if not found then
    raise exception 'media upload session not found';
  end if;

  if session_row.cleanup_lease_expires_at is not null
    and session_row.cleanup_lease_expires_at > now_utc then
    return query select
      'busy'::text,
      session_row.upload_bucket,
      session_row.upload_path,
      session_row.destination_bucket,
      session_row.destination_path,
      session_row.content_type,
      session_row.expected_size_bytes,
      null::uuid;
    return;
  end if;

  if session_row.status = 'finalized' then
    return query select
      'finalized'::text,
      session_row.upload_bucket,
      session_row.upload_path,
      session_row.destination_bucket,
      session_row.destination_path,
      session_row.content_type,
      session_row.expected_size_bytes,
      null::uuid;
    return;
  end if;

  if session_row.finalize_deadline <= now_utc
    or session_row.status in ('cancelled', 'sweeping', 'cleanup_failed', 'expired') then
    raise exception 'media upload session expired';
  end if;

  if session_row.status = 'finalizing'
    and session_row.finalize_lease_expires_at is not null
    and session_row.finalize_lease_expires_at > now_utc then
    return query select
      'busy'::text,
      session_row.upload_bucket,
      session_row.upload_path,
      session_row.destination_bucket,
      session_row.destination_path,
      session_row.content_type,
      session_row.expected_size_bytes,
      null::uuid;
    return;
  end if;

  update private.media_upload_sessions sessions
  set
    status = 'finalizing',
    finalize_lease_id = p_lease_id,
    finalize_lease_expires_at = now_utc + make_interval(secs => p_lease_seconds),
    last_error = null,
    updated_at = now_utc
  where sessions.session_id = p_session_id
  returning * into session_row;

  return query select
    'claimed'::text,
    session_row.upload_bucket,
    session_row.upload_path,
    session_row.destination_bucket,
    session_row.destination_path,
    session_row.content_type,
    session_row.expected_size_bytes,
    p_lease_id;
end;
$$;

revoke all on function public.claim_media_upload_session_finalize(uuid, uuid, uuid, integer)
from public, anon, authenticated;
grant execute on function public.claim_media_upload_session_finalize(uuid, uuid, uuid, integer)
to service_role;

create or replace function public.renew_media_upload_session_finalize(
  p_session_id uuid,
  p_user_id uuid,
  p_lease_id uuid,
  p_lease_seconds integer default 300
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  changed_count integer;
begin
  if p_lease_seconds is null or p_lease_seconds not between 30 and 300 then
    raise exception 'invalid media upload finalize lease';
  end if;

  update private.media_upload_sessions sessions
  set
    finalize_lease_expires_at = timezone('utc', now()) + make_interval(secs => p_lease_seconds),
    updated_at = timezone('utc', now())
  where sessions.session_id = p_session_id
    and sessions.user_id = p_user_id
    and sessions.status = 'finalizing'
    and sessions.finalize_lease_id = p_lease_id
    and sessions.finalize_lease_expires_at > timezone('utc', now());

  get diagnostics changed_count = row_count;
  return changed_count = 1;
end;
$$;

revoke all on function public.renew_media_upload_session_finalize(uuid, uuid, uuid, integer)
from public, anon, authenticated;
grant execute on function public.renew_media_upload_session_finalize(uuid, uuid, uuid, integer)
to service_role;

create or replace function public.complete_media_upload_session_finalize(
  p_session_id uuid,
  p_user_id uuid,
  p_lease_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  session_row private.media_upload_sessions%rowtype;
  changed_count integer;
begin
  select * into session_row
  from private.media_upload_sessions sessions
  where sessions.session_id = p_session_id
    and sessions.user_id = p_user_id
  for update;

  if not found then
    return false;
  end if;

  -- A response-loss retry is safe, but must be observational only. In
  -- particular, it must never erase a cleaner's active lease/reference gate.
  if session_row.status = 'finalized' then
    return true;
  end if;

  update private.media_upload_sessions sessions
  set
    status = 'finalized',
    finalized_at = coalesce(sessions.finalized_at, timezone('utc', now())),
    finalize_lease_id = null,
    finalize_lease_expires_at = null,
    -- Public uploads keep a mandatory post-token staging sweep even when the
    -- immediate delete succeeded; private destinations wait for reference
    -- reconciliation at the retirement horizon.
    next_cleanup_at = case
      when sessions.destination_bucket <> sessions.upload_bucket
        or sessions.destination_path <> sessions.upload_path
        then sessions.cleanup_after
      else sessions.retire_after
    end,
    last_error = null,
    updated_at = timezone('utc', now())
  where sessions.session_id = p_session_id
    and sessions.user_id = p_user_id
    and sessions.status = 'finalizing'
    and sessions.finalize_lease_id = p_lease_id
    and sessions.finalize_lease_expires_at > timezone('utc', now());

  get diagnostics changed_count = row_count;
  return changed_count = 1;
end;
$$;

revoke all on function public.complete_media_upload_session_finalize(uuid, uuid, uuid)
from public, anon, authenticated;
grant execute on function public.complete_media_upload_session_finalize(uuid, uuid, uuid)
to service_role;

create or replace function public.release_media_upload_session_finalize(
  p_session_id uuid,
  p_user_id uuid,
  p_lease_id uuid,
  p_error text default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  changed_count integer;
  now_utc timestamptz := timezone('utc', now());
begin
  update private.media_upload_sessions sessions
  set
    status = case when sessions.finalize_deadline > now_utc then 'pending' else 'cancelled' end,
    finalize_lease_id = null,
    finalize_lease_expires_at = null,
    last_error = left(nullif(coalesce(p_error, ''), ''), 500),
    updated_at = now_utc
  where sessions.session_id = p_session_id
    and sessions.user_id = p_user_id
    and sessions.status = 'finalizing'
    and sessions.finalize_lease_id = p_lease_id;

  get diagnostics changed_count = row_count;
  return changed_count = 1;
end;
$$;

revoke all on function public.release_media_upload_session_finalize(uuid, uuid, uuid, text)
from public, anon, authenticated;
grant execute on function public.release_media_upload_session_finalize(uuid, uuid, uuid, text)
to service_role;

create or replace function public.claim_media_upload_session_cleanup(
  p_session_id uuid,
  p_user_id uuid,
  p_lease_id uuid,
  p_lease_seconds integer default 90
)
returns table (
  claim_status text,
  upload_bucket text,
  upload_path text,
  destination_bucket text,
  destination_path text,
  cleanup_after timestamptz,
  lease_id uuid
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  session_row private.media_upload_sessions%rowtype;
  now_utc timestamptz := timezone('utc', now());
begin
  if p_session_id is null or p_user_id is null or p_lease_id is null
    or p_lease_seconds is null or p_lease_seconds not between 30 and 300 then
    raise exception 'invalid media upload cleanup claim';
  end if;

  select * into session_row
  from private.media_upload_sessions sessions
  where sessions.session_id = p_session_id
    and sessions.user_id = p_user_id
  for update;

  if not found then
    raise exception 'media upload session not found';
  end if;

  if session_row.status in ('retained', 'expired') then
    return query select
      'finalized'::text,
      session_row.upload_bucket,
      session_row.upload_path,
      session_row.destination_bucket,
      session_row.destination_path,
      session_row.cleanup_after,
      null::uuid;
    return;
  end if;

  if session_row.cleanup_lease_expires_at is not null
    and session_row.cleanup_lease_expires_at > now_utc then
    return query select
      'busy'::text,
      session_row.upload_bucket,
      session_row.upload_path,
      session_row.destination_bucket,
      session_row.destination_path,
      session_row.cleanup_after,
      null::uuid;
    return;
  end if;

  if session_row.status = 'finalizing'
    and session_row.finalize_lease_expires_at is not null
    and session_row.finalize_lease_expires_at > now_utc then
    return query select
      'busy'::text,
      session_row.upload_bucket,
      session_row.upload_path,
      session_row.destination_bucket,
      session_row.destination_path,
      session_row.cleanup_after,
      null::uuid;
    return;
  end if;

  update private.media_upload_sessions sessions
  set
    status = 'sweeping',
    cleanup_previous_status = coalesce(session_row.cleanup_previous_status, session_row.status),
    finalize_lease_id = null,
    finalize_lease_expires_at = null,
    cleanup_lease_id = p_lease_id,
    cleanup_lease_expires_at = now_utc + make_interval(secs => p_lease_seconds),
    updated_at = now_utc
  where sessions.session_id = p_session_id
  returning * into session_row;

  return query select
    'claimed'::text,
    session_row.upload_bucket,
    session_row.upload_path,
    session_row.destination_bucket,
    session_row.destination_path,
    session_row.cleanup_after,
    p_lease_id;
end;
$$;

revoke all on function public.claim_media_upload_session_cleanup(uuid, uuid, uuid, integer)
from public, anon, authenticated;
grant execute on function public.claim_media_upload_session_cleanup(uuid, uuid, uuid, integer)
to service_role;

create or replace function private.media_upload_destination_is_referenced(
  p_bucket text,
  p_path text
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  storage_uri text := 'sorita-storage://' || p_bucket || '/' || p_path;
  public_suffix text := '/storage/v1/object/public/' || p_bucket || '/' || p_path;
begin
  if p_bucket not in ('profile-media', 'place-media', 'place-media-private')
    or p_path is null or p_path = '' then
    return false;
  end if;

  return
    exists (
      select 1 from public.profiles profiles
      where profiles.profile_photo_url = storage_uri
        or profiles.cover_photo_url = storage_uri
        or right(coalesce(profiles.profile_photo_url, ''), length(public_suffix)) = public_suffix
        or right(coalesce(profiles.cover_photo_url, ''), length(public_suffix)) = public_suffix
    )
    or exists (
      select 1 from public.lists lists
      where lists.cover_image_url = storage_uri
        or right(coalesce(lists.cover_image_url, ''), length(public_suffix)) = public_suffix
    )
    or exists (
      select 1 from public.list_places places
      where places.menu_url = storage_uri
        or places.source_user_avatar_url = storage_uri
        or right(coalesce(places.menu_url, ''), length(public_suffix)) = public_suffix
        or right(coalesce(places.source_user_avatar_url, ''), length(public_suffix)) = public_suffix
    )
    or exists (
      select 1 from public.list_place_photos media
      where (media.storage_bucket = p_bucket and media.storage_path = p_path)
        or media.url = storage_uri
        or media.thumbnail_url = storage_uri
        or right(coalesce(media.url, ''), length(public_suffix)) = public_suffix
        or right(coalesce(media.thumbnail_url, ''), length(public_suffix)) = public_suffix
    );
end;
$$;

revoke all on function private.media_upload_destination_is_referenced(text, text)
from public, anon, authenticated, service_role;

create or replace function private.assert_media_upload_reference_ready(p_value text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  session_row private.media_upload_sessions%rowtype;
  normalized_value text := private.normalize_optional_media_url(p_value);
begin
  if normalized_value is null then
    return;
  end if;

  select sessions.* into session_row
  from private.media_upload_sessions sessions
  where normalized_value = 'sorita-storage://' || sessions.destination_bucket || '/' || sessions.destination_path
    or right(
      normalized_value,
      length('/storage/v1/object/public/' || sessions.destination_bucket || '/' || sessions.destination_path)
    ) = '/storage/v1/object/public/' || sessions.destination_bucket || '/' || sessions.destination_path
  order by sessions.created_at desc
  for update
  limit 1;

  if not found then
    return;
  end if;

  if session_row.status not in ('finalized', 'retained')
    or (
      session_row.cleanup_lease_expires_at is not null
      and session_row.cleanup_lease_expires_at > timezone('utc', now())
    ) then
    raise exception 'media upload destination is not referenceable' using errcode = '55000';
  end if;

  if session_row.destination_bucket = 'place-media-private'
    and auth.uid() is not null
    and session_row.user_id is distinct from auth.uid() then
    raise exception 'private media owner mismatch' using errcode = '42501';
  end if;
end;
$$;

revoke all on function private.assert_media_upload_reference_ready(text)
from public, anon, authenticated, service_role;

create or replace function private.enforce_media_upload_reference_gate()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_table_name = 'profiles' then
    perform private.assert_media_upload_reference_ready(new.profile_photo_url);
    perform private.assert_media_upload_reference_ready(new.cover_photo_url);
  elsif tg_table_name = 'lists' then
    perform private.assert_media_upload_reference_ready(new.cover_image_url);
  elsif tg_table_name = 'list_places' then
    perform private.assert_media_upload_reference_ready(new.menu_url);
    perform private.assert_media_upload_reference_ready(new.source_user_avatar_url);
  elsif tg_table_name = 'list_place_photos' then
    perform private.assert_media_upload_reference_ready(new.url);
    perform private.assert_media_upload_reference_ready(new.thumbnail_url);
    if new.storage_bucket is not null and new.storage_path is not null then
      perform private.assert_media_upload_reference_ready(
        'sorita-storage://' || new.storage_bucket || '/' || new.storage_path
      );
    end if;
  end if;
  return new;
end;
$$;

revoke all on function private.enforce_media_upload_reference_gate()
from public, anon, authenticated, service_role;

drop trigger if exists profiles_media_upload_reference_gate on public.profiles;
create trigger profiles_media_upload_reference_gate
before insert or update on public.profiles
for each row execute function private.enforce_media_upload_reference_gate();

drop trigger if exists lists_media_upload_reference_gate on public.lists;
create trigger lists_media_upload_reference_gate
before insert or update on public.lists
for each row execute function private.enforce_media_upload_reference_gate();

drop trigger if exists list_places_media_upload_reference_gate on public.list_places;
create trigger list_places_media_upload_reference_gate
before insert or update on public.list_places
for each row execute function private.enforce_media_upload_reference_gate();

drop trigger if exists list_place_photos_media_upload_reference_gate on public.list_place_photos;
create trigger list_place_photos_media_upload_reference_gate
before insert or update on public.list_place_photos
for each row execute function private.enforce_media_upload_reference_gate();

create or replace function public.list_stale_media_upload_sessions(p_limit integer default 100)
returns table (
  session_id uuid,
  user_id uuid,
  upload_bucket text,
  upload_path text,
  destination_bucket text,
  destination_path text,
  session_status text,
  cleanup_after timestamptz,
  retire_after timestamptz,
  destination_referenced boolean,
  delete_destination boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_limit is null or p_limit not between 1 and 500 then
    raise exception 'invalid media upload cleanup limit';
  end if;

  return query
  select
    sessions.session_id,
    sessions.user_id,
    sessions.upload_bucket,
    sessions.upload_path,
    sessions.destination_bucket,
    sessions.destination_path,
    sessions.status,
    sessions.cleanup_after,
    sessions.retire_after,
    private.media_upload_destination_is_referenced(
      sessions.destination_bucket,
      sessions.destination_path
    ),
    not private.media_upload_destination_is_referenced(
      sessions.destination_bucket,
      sessions.destination_path
    ) and (
      coalesce(sessions.cleanup_previous_status, sessions.status) <> 'finalized'
      or sessions.retire_after <= timezone('utc', now())
      )
  from private.media_upload_sessions sessions
  where sessions.status not in ('expired', 'retained')
    and sessions.cleanup_after <= timezone('utc', now())
    and coalesce(sessions.next_cleanup_at, sessions.cleanup_after) <= timezone('utc', now())
    and (
      sessions.status <> 'finalizing'
      or sessions.finalize_lease_expires_at is null
      or sessions.finalize_lease_expires_at <= timezone('utc', now())
    )
    and (
      sessions.cleanup_lease_expires_at is null
      or sessions.cleanup_lease_expires_at <= timezone('utc', now())
    )
  order by sessions.cleanup_after, sessions.session_id
  limit p_limit;
end;
$$;

revoke all on function public.list_stale_media_upload_sessions(integer)
from public, anon, authenticated;
grant execute on function public.list_stale_media_upload_sessions(integer)
to service_role;

create or replace function public.claim_stale_media_upload_sessions(
  p_lease_id uuid,
  p_limit integer default 100,
  p_lease_seconds integer default 90
)
returns table (
  session_id uuid,
  user_id uuid,
  upload_bucket text,
  upload_path text,
  destination_bucket text,
  destination_path text,
  cleanup_after timestamptz,
  retire_after timestamptz,
  previous_status text,
  destination_referenced boolean,
  delete_destination boolean,
  lease_id uuid
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_lease_id is null or p_limit is null or p_limit not between 1 and 500
    or p_lease_seconds is null or p_lease_seconds not between 30 and 300 then
    raise exception 'invalid media upload cleanup claim';
  end if;

  return query
  with candidates as (
    select
      sessions.session_id,
      coalesce(sessions.cleanup_previous_status, sessions.status) as previous_status,
      private.media_upload_destination_is_referenced(
        sessions.destination_bucket,
        sessions.destination_path
      ) as destination_referenced
    from private.media_upload_sessions sessions
    where sessions.status not in ('expired', 'retained')
      and sessions.cleanup_after <= timezone('utc', now())
      and coalesce(sessions.next_cleanup_at, sessions.cleanup_after) <= timezone('utc', now())
      and (
        sessions.status <> 'finalizing'
        or sessions.finalize_lease_expires_at is null
        or sessions.finalize_lease_expires_at <= timezone('utc', now())
      )
      and (
        sessions.cleanup_lease_expires_at is null
        or sessions.cleanup_lease_expires_at <= timezone('utc', now())
      )
    order by sessions.cleanup_after, sessions.session_id
    for update skip locked
    limit p_limit
  ), claimed as (
    update private.media_upload_sessions sessions
    set
      status = 'sweeping',
      finalize_lease_id = null,
      finalize_lease_expires_at = null,
      cleanup_previous_status = candidates.previous_status,
      cleanup_lease_id = p_lease_id,
      cleanup_lease_expires_at = timezone('utc', now()) + make_interval(secs => p_lease_seconds),
      updated_at = timezone('utc', now())
    from candidates
    where sessions.session_id = candidates.session_id
    returning
      sessions.*,
      candidates.previous_status,
      candidates.destination_referenced
  )
  select
    claimed.session_id,
    claimed.user_id,
    claimed.upload_bucket,
    claimed.upload_path,
    claimed.destination_bucket,
    claimed.destination_path,
    claimed.cleanup_after,
    claimed.retire_after,
    claimed.previous_status,
    claimed.destination_referenced,
    not claimed.destination_referenced and (
      claimed.previous_status <> 'finalized'
      or claimed.retire_after <= timezone('utc', now())
    ),
    p_lease_id
  from claimed;
end;
$$;

revoke all on function public.claim_stale_media_upload_sessions(uuid, integer, integer)
from public, anon, authenticated;
grant execute on function public.claim_stale_media_upload_sessions(uuid, integer, integer)
to service_role;

create or replace function public.renew_media_upload_session_cleanup(
  p_session_id uuid,
  p_lease_id uuid,
  p_lease_seconds integer default 300
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  changed_count integer;
begin
  if p_lease_seconds is null or p_lease_seconds not between 30 and 300 then
    raise exception 'invalid media upload cleanup lease';
  end if;

  update private.media_upload_sessions sessions
  set
    cleanup_lease_expires_at = timezone('utc', now()) + make_interval(secs => p_lease_seconds),
    updated_at = timezone('utc', now())
  where sessions.session_id = p_session_id
    and sessions.status = 'sweeping'
    and sessions.cleanup_lease_id = p_lease_id
    and sessions.cleanup_lease_expires_at > timezone('utc', now());

  get diagnostics changed_count = row_count;
  return changed_count = 1;
end;
$$;

revoke all on function public.renew_media_upload_session_cleanup(uuid, uuid, integer)
from public, anon, authenticated;
grant execute on function public.renew_media_upload_session_cleanup(uuid, uuid, integer)
to service_role;

create or replace function public.check_media_upload_session_cleanup_reference(
  p_session_id uuid,
  p_lease_id uuid,
  p_allow_unreferenced_destination_delete boolean default false
)
returns table (
  previous_status text,
  destination_referenced boolean,
  delete_destination boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  session_row private.media_upload_sessions%rowtype;
  was_referenced boolean;
  lifecycle_status text;
begin
  -- This is intentionally a separate RPC/snapshot after the claim committed.
  -- The active cleanup lease makes concurrent reference triggers fail closed.
  select sessions.* into session_row
  from private.media_upload_sessions sessions
  where sessions.session_id = p_session_id
    and sessions.status = 'sweeping'
    and sessions.cleanup_lease_id = p_lease_id
    and sessions.cleanup_lease_expires_at > timezone('utc', now())
  for update;

  if not found then
    raise exception 'media upload cleanup lease is not active';
  end if;

  lifecycle_status := coalesce(session_row.cleanup_previous_status, session_row.status);
  was_referenced := private.media_upload_destination_is_referenced(
    session_row.destination_bucket,
    session_row.destination_path
  );

  return query select
    lifecycle_status,
    was_referenced,
    not was_referenced and (
      lifecycle_status <> 'finalized'
      or coalesce(p_allow_unreferenced_destination_delete, false)
      or session_row.retire_after <= timezone('utc', now())
    );
end;
$$;

revoke all on function public.check_media_upload_session_cleanup_reference(uuid, uuid, boolean)
from public, anon, authenticated;
grant execute on function public.check_media_upload_session_cleanup_reference(uuid, uuid, boolean)
to service_role;

create or replace function public.complete_media_upload_session_cleanup(
  p_session_id uuid,
  p_lease_id uuid,
  p_success boolean,
  p_error text default null,
  p_automatic boolean default false,
  p_destination_retained boolean default false
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  changed_count integer;
  now_utc timestamptz := timezone('utc', now());
begin
  update private.media_upload_sessions sessions
  set
    status = case
      when not p_success then 'cleanup_failed'
      when not p_automatic then 'cleanup_pending'
      when sessions.cleanup_previous_status = 'finalized'
        and sessions.retire_after > now_utc then 'finalized'
      when sessions.cleanup_previous_status = 'finalized'
        and p_destination_retained then 'retained'
      when sessions.retire_after <= now_utc then 'expired'
      else 'cleanup_pending'
    end,
    cleanup_lease_id = null,
    cleanup_lease_expires_at = null,
    cleanup_previous_status = case
      when p_success then null
      else sessions.cleanup_previous_status
    end,
    next_cleanup_at = case
      when not p_success then greatest(sessions.cleanup_after, now_utc + interval '15 minutes')
      when not p_automatic then greatest(sessions.cleanup_after, now_utc + interval '30 minutes')
      when sessions.cleanup_previous_status = 'finalized'
        and sessions.retire_after > now_utc
        then least(sessions.retire_after, now_utc + interval '30 minutes')
      when sessions.retire_after <= now_utc then null
      else least(sessions.retire_after, now_utc + interval '30 minutes')
    end,
    staging_cleaned_at = case when p_success then now_utc else sessions.staging_cleaned_at end,
    last_error = case
      when p_success then null
      else left(coalesce(nullif(p_error, ''), 'storage cleanup failed'), 500)
    end,
    updated_at = now_utc
  where sessions.session_id = p_session_id
    and sessions.status = 'sweeping'
    and sessions.cleanup_lease_id = p_lease_id
    and sessions.cleanup_lease_expires_at > now_utc;

  get diagnostics changed_count = row_count;
  return changed_count = 1;
end;
$$;

revoke all on function public.complete_media_upload_session_cleanup(uuid, uuid, boolean, text, boolean, boolean)
from public, anon, authenticated;
grant execute on function public.complete_media_upload_session_cleanup(uuid, uuid, boolean, text, boolean, boolean)
to service_role;

create or replace function public.prune_media_upload_sessions(
  p_before timestamptz,
  p_limit integer default 500
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  removed_count integer;
begin
  if p_before is null
    or p_before > timezone('utc', now()) - interval '30 days'
    or p_limit is null
    or p_limit not between 1 and 1000 then
    raise exception 'invalid media upload prune boundary';
  end if;

  with candidates as (
    select sessions.session_id
    from private.media_upload_sessions sessions
    where sessions.status in ('expired', 'retained')
      and sessions.updated_at < p_before
    order by sessions.updated_at, sessions.session_id
    for update skip locked
    limit p_limit
  )
  delete from private.media_upload_sessions sessions
  using candidates
  where sessions.session_id = candidates.session_id;

  get diagnostics removed_count = row_count;
  return removed_count;
end;
$$;

revoke all on function public.prune_media_upload_sessions(timestamptz, integer)
from public, anon, authenticated;
grant execute on function public.prune_media_upload_sessions(timestamptz, integer)
to service_role;

comment on table private.media_upload_sessions is
  'Service-only ledger for deterministic signed uploads and post-token-expiry orphan cleanup.';
comment on function public.list_stale_media_upload_sessions(integer) is
  'Read-only dry-run inventory of upload sessions eligible for cleanup after the two-hour signed PUT token has expired.';
