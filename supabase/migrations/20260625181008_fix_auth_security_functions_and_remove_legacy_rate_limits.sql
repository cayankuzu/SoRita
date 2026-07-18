drop function if exists public.cleanup_expired_rate_limits();
drop table if exists public.rate_limits;
create or replace function public.enforce_edge_rate_limit(
  input_scope text,
  input_identifier text,
  input_window_seconds integer,
  input_max_requests integer
)
returns table (
  allowed boolean,
  remaining integer,
  retry_after_seconds integer
)
language plpgsql
security definer
set search_path = public, private
as $$
declare
  normalized_scope text;
  normalized_identifier text;
  now_utc timestamptz := timezone('utc', now());
  bucket timestamptz;
  bucket_expires_at timestamptz;
  next_count integer;
begin
  normalized_scope := nullif(private.strip_control_chars(input_scope), '');
  normalized_identifier := nullif(private.strip_control_chars(input_identifier), '');

  if normalized_scope is null or normalized_identifier is null then
    raise exception 'Rate limit scope and identifier are required';
  end if;

  if input_window_seconds <= 0 or input_max_requests <= 0 then
    raise exception 'Rate limit window and max requests must be positive';
  end if;

  delete from private.edge_rate_limits
  where private.edge_rate_limits.expires_at <= now_utc;

  bucket := to_timestamp(
    floor(extract(epoch from now_utc) / input_window_seconds) * input_window_seconds
  );
  bucket_expires_at := bucket + make_interval(secs => input_window_seconds);

  insert into private.edge_rate_limits (
    scope,
    identifier,
    bucket_start,
    expires_at,
    request_count
  )
  values (
    normalized_scope,
    normalized_identifier,
    bucket,
    bucket_expires_at,
    1
  )
  on conflict (scope, identifier, bucket_start)
  do update
  set
    expires_at = excluded.expires_at,
    request_count = private.edge_rate_limits.request_count + 1
  returning request_count into next_count;

  return query
  select
    next_count <= input_max_requests,
    greatest(input_max_requests - next_count, 0),
    greatest(ceil(extract(epoch from bucket_expires_at - now_utc))::integer, 1);
end;
$$;
revoke all on function public.enforce_edge_rate_limit(text, text, integer, integer) from public, anon, authenticated;
grant execute on function public.enforce_edge_rate_limit(text, text, integer, integer) to service_role;
create or replace function public.get_auth_login_guard_status(input_email text)
returns table (
  failure_count integer,
  locked_until timestamptz,
  retry_after_seconds integer
)
language plpgsql
security definer
set search_path = public, private
as $$
declare
  normalized_input_email text := nullif(private.normalize_email(input_email), '');
  guard_row private.auth_login_guards%rowtype;
  now_utc timestamptz := timezone('utc', now());
begin
  if normalized_input_email is null then
    return;
  end if;

  delete from private.auth_login_guards
  where private.auth_login_guards.locked_until is not null
    and private.auth_login_guards.locked_until <= now_utc
    and coalesce(
      private.auth_login_guards.last_failed_at,
      private.auth_login_guards.first_failed_at,
      now_utc
    ) <= now_utc - interval '1 day';

  select *
  into guard_row
  from private.auth_login_guards
  where private.auth_login_guards.normalized_email = normalized_input_email;

  if not found then
    return;
  end if;

  if guard_row.locked_until is not null and guard_row.locked_until <= now_utc then
    delete from private.auth_login_guards
    where private.auth_login_guards.normalized_email = normalized_input_email;
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
revoke all on function public.get_auth_login_guard_status(text) from public, anon, authenticated;
grant execute on function public.get_auth_login_guard_status(text) to service_role;
create or replace function public.record_auth_login_failure(
  input_email text,
  lockout_threshold integer default 5,
  lockout_minutes integer default 15,
  failure_window_minutes integer default 15
)
returns table (
  failure_count integer,
  locked_until timestamptz,
  retry_after_seconds integer
)
language plpgsql
security definer
set search_path = public, private
as $$
declare
  normalized_input_email text := nullif(private.normalize_email(input_email), '');
  existing_row private.auth_login_guards%rowtype;
  next_failure_count integer;
  next_first_failed_at timestamptz;
  next_last_failed_at timestamptz := timezone('utc', now());
  next_locked_until timestamptz;
begin
  if normalized_input_email is null then
    raise exception 'Normalized email is required';
  end if;

  if lockout_threshold <= 0 or lockout_minutes <= 0 or failure_window_minutes <= 0 then
    raise exception 'Auth lockout configuration must be positive';
  end if;

  select *
  into existing_row
  from private.auth_login_guards
  where private.auth_login_guards.normalized_email = normalized_input_email
  for update;

  if found
    and existing_row.locked_until is not null
    and existing_row.locked_until > next_last_failed_at then
    return query
    select
      existing_row.failure_count,
      existing_row.locked_until,
      greatest(ceil(extract(epoch from existing_row.locked_until - next_last_failed_at))::integer, 1);
    return;
  end if;

  if not found
    or existing_row.first_failed_at is null
    or existing_row.first_failed_at <= next_last_failed_at - make_interval(mins => failure_window_minutes) then
    next_failure_count := 1;
    next_first_failed_at := next_last_failed_at;
  else
    next_failure_count := existing_row.failure_count + 1;
    next_first_failed_at := existing_row.first_failed_at;
  end if;

  if next_failure_count >= lockout_threshold then
    next_locked_until := next_last_failed_at + make_interval(mins => lockout_minutes);
  else
    next_locked_until := null;
  end if;

  insert into private.auth_login_guards (
    normalized_email,
    failure_count,
    first_failed_at,
    last_failed_at,
    locked_until
  )
  values (
    normalized_input_email,
    next_failure_count,
    next_first_failed_at,
    next_last_failed_at,
    next_locked_until
  )
  on conflict (normalized_email)
  do update
  set
    failure_count = excluded.failure_count,
    first_failed_at = excluded.first_failed_at,
    last_failed_at = excluded.last_failed_at,
    locked_until = excluded.locked_until;

  return query
  select
    next_failure_count,
    next_locked_until,
    case
      when next_locked_until is null then 0
      else greatest(ceil(extract(epoch from next_locked_until - next_last_failed_at))::integer, 1)
    end;
end;
$$;
revoke all on function public.record_auth_login_failure(text, integer, integer, integer) from public, anon, authenticated;
grant execute on function public.record_auth_login_failure(text, integer, integer, integer) to service_role;
create or replace function public.clear_auth_login_failures(input_email text)
returns void
language plpgsql
security definer
set search_path = public, private
as $$
declare
  normalized_input_email text := nullif(private.normalize_email(input_email), '');
begin
  if normalized_input_email is null then
    return;
  end if;

  delete from private.auth_login_guards
  where private.auth_login_guards.normalized_email = normalized_input_email;
end;
$$;
revoke all on function public.clear_auth_login_failures(text) from public, anon, authenticated;
grant execute on function public.clear_auth_login_failures(text) to service_role;
