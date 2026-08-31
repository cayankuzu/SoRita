-- Forward-only hardening for identifier privacy, atomic auth lockouts, and
-- client-writable column boundaries. Supabase remains the source of truth.

create or replace function private.hash_security_identifier(input_value text)
returns text
language sql
immutable
strict
parallel safe
set search_path = ''
as $$
  select pg_catalog.encode(
    pg_catalog.sha256(pg_catalog.convert_to(input_value, 'UTF8')),
    'hex'
  );
$$;

revoke all on function private.hash_security_identifier(text)
from public, anon, authenticated;
grant execute on function private.hash_security_identifier(text) to service_role;

-- These tables contain short-lived security metadata, not product data. Hash
-- existing values in-place so a rollout never leaves raw identifiers behind.
update private.edge_rate_limits
set identifier = private.hash_security_identifier(identifier)
where identifier !~ '^[0-9a-f]{64}$';

update private.auth_login_guards
set normalized_email = private.hash_security_identifier(normalized_email)
where normalized_email !~ '^[0-9a-f]{64}$';

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
set search_path = ''
as $$
declare
  normalized_scope text;
  hashed_identifier text;
  now_utc timestamptz := timezone('utc', now());
  bucket timestamptz;
  bucket_expires_at timestamptz;
  next_count integer;
begin
  normalized_scope := nullif(private.strip_control_chars(input_scope), '');
  hashed_identifier := private.hash_security_identifier(
    nullif(private.strip_control_chars(input_identifier), '')
  );

  if normalized_scope is null or hashed_identifier is null then
    raise exception 'Rate limit scope and identifier are required';
  end if;

  if input_window_seconds <= 0 or input_max_requests <= 0 then
    raise exception 'Rate limit window and max requests must be positive';
  end if;

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
    hashed_identifier,
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

revoke all on function public.enforce_edge_rate_limit(text, text, integer, integer)
from public, anon, authenticated;
grant execute on function public.enforce_edge_rate_limit(text, text, integer, integer)
to service_role;

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

  select *
  into guard_row
  from private.auth_login_guards
  where normalized_email = hashed_email;

  if not found then
    return;
  end if;

  if guard_row.locked_until is not null and guard_row.locked_until <= now_utc then
    delete from private.auth_login_guards where normalized_email = hashed_email;
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
set search_path = ''
as $$
declare
  hashed_email text := private.hash_security_identifier(
    nullif(private.normalize_email(input_email), '')
  );
  existing_row private.auth_login_guards%rowtype;
  next_failure_count integer;
  next_first_failed_at timestamptz;
  next_last_failed_at timestamptz := timezone('utc', now());
  next_locked_until timestamptz;
begin
  if hashed_email is null then
    raise exception 'Normalized email is required';
  end if;

  if lockout_threshold <= 0 or lockout_minutes <= 0 or failure_window_minutes <= 0 then
    raise exception 'Auth lockout configuration must be positive';
  end if;

  -- Serialize both existing and first-write paths. SELECT FOR UPDATE alone does
  -- not lock a row that does not exist yet.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(hashed_email, 0)
  );

  select *
  into existing_row
  from private.auth_login_guards
  where normalized_email = hashed_email
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

  next_locked_until := case
    when next_failure_count >= lockout_threshold
      then next_last_failed_at + make_interval(mins => lockout_minutes)
    else null
  end;

  insert into private.auth_login_guards (
    normalized_email,
    failure_count,
    first_failed_at,
    last_failed_at,
    locked_until
  )
  values (
    hashed_email,
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

revoke all on function public.record_auth_login_failure(text, integer, integer, integer)
from public, anon, authenticated;
grant execute on function public.record_auth_login_failure(text, integer, integer, integer)
to service_role;

create or replace function public.clear_auth_login_failures(input_email text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  hashed_email text := private.hash_security_identifier(
    nullif(private.normalize_email(input_email), '')
  );
begin
  if hashed_email is null then
    return;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(hashed_email, 0)
  );
  delete from private.auth_login_guards where normalized_email = hashed_email;
end;
$$;

revoke all on function public.clear_auth_login_failures(text)
from public, anon, authenticated;
grant execute on function public.clear_auth_login_failures(text) to service_role;

-- Email presence must only be queried by the service-role auth gateway.
revoke all on function public.check_account_availability(text, text, uuid)
from public, anon, authenticated;
grant execute on function public.check_account_availability(text, text, uuid)
to service_role;

-- Prefer column privileges for the two broad UPDATE policies. Triggers below
-- are defense in depth and protect alternate SQL clients as well.
revoke update on table public.profiles from authenticated;
grant update (
  name,
  username,
  is_public_account,
  bio,
  profile_photo_url,
  cover_photo_url,
  interests
) on table public.profiles to authenticated;

revoke update on table public.notifications from authenticated;
grant update (read) on table public.notifications to authenticated;

create or replace function private.enforce_client_update_invariants()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_table_schema = 'public' and tg_table_name = 'profiles' then
    if new.id is distinct from old.id
      or new.email is distinct from old.email
      or new.created_at is distinct from old.created_at then
      raise exception 'immutable profile field' using errcode = '42501';
    end if;
  elsif tg_table_schema = 'public' and tg_table_name = 'notifications' then
    if new.id is distinct from old.id
      or new.recipient_user_id is distinct from old.recipient_user_id
      or new.actor_user_id is distinct from old.actor_user_id
      or new.type is distinct from old.type
      or new.message is distinct from old.message
      or new.list_id is distinct from old.list_id
      or new.list_place_id is distinct from old.list_place_id
      or new.follow_request_id is distinct from old.follow_request_id
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

drop trigger if exists profiles_enforce_client_update_invariants on public.profiles;
create trigger profiles_enforce_client_update_invariants
before update on public.profiles
for each row execute function private.enforce_client_update_invariants();

drop trigger if exists notifications_enforce_client_update_invariants on public.notifications;
create trigger notifications_enforce_client_update_invariants
before update on public.notifications
for each row execute function private.enforce_client_update_invariants();

drop trigger if exists list_places_enforce_client_update_invariants on public.list_places;
create trigger list_places_enforce_client_update_invariants
before insert or update on public.list_places
for each row execute function private.enforce_client_update_invariants();

drop trigger if exists list_reports_enforce_client_update_invariants on public.list_reports;
create trigger list_reports_enforce_client_update_invariants
before update on public.list_reports
for each row execute function private.enforce_client_update_invariants();

drop trigger if exists list_place_reports_enforce_client_update_invariants on public.list_place_reports;
create trigger list_place_reports_enforce_client_update_invariants
before update on public.list_place_reports
for each row execute function private.enforce_client_update_invariants();
