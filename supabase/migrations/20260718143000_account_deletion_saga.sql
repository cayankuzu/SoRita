create table if not exists public.account_deletion_jobs (
  user_id uuid primary key,
  status text not null check (status in ('running', 'failed', 'completed')),
  step text not null,
  attempt_count integer not null default 1 check (attempt_count > 0),
  last_error text,
  requested_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  completed_at timestamptz
);

alter table public.account_deletion_jobs enable row level security;
revoke all on public.account_deletion_jobs from public, anon, authenticated;
grant select, insert, update on public.account_deletion_jobs to service_role;

create or replace function public.record_account_deletion_step(
  p_user_id uuid,
  p_step text,
  p_error text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
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

  if p_step = 'requested' then
    insert into public.account_deletion_jobs (
      user_id,
      status,
      step,
      attempt_count,
      last_error,
      requested_at,
      updated_at,
      completed_at
    )
    values (
      p_user_id,
      'running',
      p_step,
      1,
      null,
      timezone('utc', now()),
      timezone('utc', now()),
      null
    )
    on conflict (user_id) do update
    set
      status = 'running',
      step = excluded.step,
      attempt_count = public.account_deletion_jobs.attempt_count + 1,
      last_error = null,
      updated_at = excluded.updated_at,
      completed_at = null;
    return;
  end if;

  update public.account_deletion_jobs
  set
    status = case
      when p_step = 'completed' then 'completed'
      when p_step = 'failed' then 'failed'
      else 'running'
    end,
    step = p_step,
    last_error = case when p_step = 'failed' then left(coalesce(p_error, 'unknown'), 500) else null end,
    updated_at = timezone('utc', now()),
    completed_at = case when p_step = 'completed' then timezone('utc', now()) else null end
  where user_id = p_user_id;

  if not found then
    raise exception 'account deletion job was not initialized';
  end if;
end;
$$;

revoke all on function public.record_account_deletion_step(uuid, text, text) from public, anon, authenticated;
grant execute on function public.record_account_deletion_step(uuid, text, text) to service_role;

comment on table public.account_deletion_jobs is
  'Idempotent, service-role-only ledger for recoverable account deletion steps.';
