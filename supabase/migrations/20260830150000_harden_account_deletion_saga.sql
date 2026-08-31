-- Make account deletion a lease-backed, resumable, service-role-only saga.

alter table public.account_deletion_jobs
  add column if not exists last_completed_step text,
  add column if not exists lease_id uuid,
  add column if not exists lease_expires_at timestamptz;

alter table public.account_deletion_jobs
  drop constraint if exists account_deletion_jobs_last_completed_step_check;
alter table public.account_deletion_jobs
  add constraint account_deletion_jobs_last_completed_step_check
  check (
    last_completed_step is null
    or last_completed_step in (
      'requested',
      'storage_deleted',
      'notifications_deleted',
      'auth_delete_started',
      'completed'
    )
  );

update public.account_deletion_jobs
set last_completed_step = case
  when step in (
    'requested',
    'storage_deleted',
    'notifications_deleted',
    'auth_delete_started',
    'completed'
  ) then step
  else 'requested'
end
where last_completed_step is null;

create index if not exists idx_account_deletion_jobs_recovery
on public.account_deletion_jobs (status, lease_expires_at, updated_at)
where status <> 'completed';

create or replace function public.claim_account_deletion_job(
  p_user_id uuid,
  p_lease_id uuid,
  p_lease_seconds integer default 300
)
returns table (
  claim_status text,
  last_completed_step text,
  retry_after_seconds integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  job public.account_deletion_jobs%rowtype;
  now_utc timestamptz := timezone('utc', now());
begin
  if p_user_id is null or p_lease_id is null or p_lease_seconds not between 30 and 900 then
    raise exception 'invalid account deletion claim';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_user_id::text, 17)
  );

  select * into job
  from public.account_deletion_jobs
  where user_id = p_user_id
  for update;

  if not found then
    insert into public.account_deletion_jobs (
      user_id,
      status,
      step,
      last_completed_step,
      attempt_count,
      requested_at,
      updated_at,
      lease_id,
      lease_expires_at
    ) values (
      p_user_id,
      'running',
      'requested',
      'requested',
      1,
      now_utc,
      now_utc,
      p_lease_id,
      now_utc + make_interval(secs => p_lease_seconds)
    );

    return query select 'claimed'::text, 'requested'::text, 0;
    return;
  end if;

  if job.status = 'completed' then
    return query select 'completed'::text, 'completed'::text, 0;
    return;
  end if;

  if job.status = 'running'
    and job.lease_id is not null
    and job.lease_expires_at is not null
    and job.lease_expires_at > now_utc then
    return query
    select
      'in_progress'::text,
      coalesce(job.last_completed_step, 'requested'),
      greatest(ceil(extract(epoch from job.lease_expires_at - now_utc))::integer, 1);
    return;
  end if;

  update public.account_deletion_jobs as jobs
  set
    status = 'running',
    step = coalesce(jobs.last_completed_step, 'requested'),
    attempt_count = jobs.attempt_count + 1,
    last_error = null,
    updated_at = now_utc,
    lease_id = p_lease_id,
    lease_expires_at = now_utc + make_interval(secs => p_lease_seconds)
  where user_id = p_user_id;

  return query
  select 'claimed'::text, coalesce(job.last_completed_step, 'requested'), 0;
end;
$$;

revoke all on function public.claim_account_deletion_job(uuid, uuid, integer)
from public, anon, authenticated;
grant execute on function public.claim_account_deletion_job(uuid, uuid, integer)
to service_role;

drop function if exists public.record_account_deletion_step(uuid, text, text);
create function public.record_account_deletion_step(
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

-- Reconcile the only post-auth-delete failure window. Storage and relational
-- cleanup have already completed before auth_delete_started is recorded.
create or replace function public.reconcile_deleted_account_jobs(p_limit integer default 100)
returns table (user_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_limit not between 1 and 500 then
    raise exception 'invalid reconciliation limit';
  end if;

  return query
  with candidates as (
    select jobs.user_id
    from public.account_deletion_jobs jobs
    where jobs.status <> 'completed'
      and jobs.last_completed_step = 'auth_delete_started'
      and (jobs.lease_expires_at is null or jobs.lease_expires_at <= timezone('utc', now()))
      and not exists (select 1 from auth.users where auth.users.id = jobs.user_id)
    order by jobs.updated_at
    for update skip locked
    limit p_limit
  )
  update public.account_deletion_jobs jobs
  set
    status = 'completed',
    step = 'completed',
    last_completed_step = 'completed',
    last_error = null,
    updated_at = timezone('utc', now()),
    completed_at = timezone('utc', now()),
    lease_id = null,
    lease_expires_at = null
  from candidates
  where jobs.user_id = candidates.user_id
  returning jobs.user_id;
end;
$$;

revoke all on function public.reconcile_deleted_account_jobs(integer)
from public, anon, authenticated;
grant execute on function public.reconcile_deleted_account_jobs(integer)
to service_role;

comment on function public.reconcile_deleted_account_jobs(integer) is
  'Service-role recovery for deletion jobs stranded after Auth user removal.';

revoke all on table public.account_deletion_jobs from service_role;
grant select on table public.account_deletion_jobs to service_role;
