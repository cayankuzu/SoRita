-- Keep distributed replay and rate-limit enforcement while removing global
-- expiry deletes from every request. Indexed cleanup runs deterministically on
-- roughly one out of every 256 newly inserted security rows.
create or replace function private.cleanup_expired_edge_security_rows()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  cleanup_key text;
begin
  if tg_table_schema = 'public' and tg_table_name = 'request_nonces' then
    cleanup_key := new.nonce;
  elsif tg_table_schema = 'private' and tg_table_name = 'edge_rate_limits' then
    cleanup_key := new.scope || ':' || new.identifier || ':' || new.bucket_start::text;
  else
    return new;
  end if;

  if (hashtextextended(cleanup_key, 0) & 255::bigint) <> 0 then
    return new;
  end if;

  if tg_table_schema = 'public' then
    delete from public.request_nonces
    where expires_at <= now();
  else
    delete from private.edge_rate_limits
    where expires_at <= now();
  end if;

  return new;
end;
$$;

revoke all on function private.cleanup_expired_edge_security_rows() from public, anon, authenticated;
grant execute on function private.cleanup_expired_edge_security_rows() to service_role;

drop trigger if exists request_nonces_cleanup_expired on public.request_nonces;
create trigger request_nonces_cleanup_expired
after insert on public.request_nonces
for each row execute function private.cleanup_expired_edge_security_rows();

drop trigger if exists edge_rate_limits_cleanup_expired on private.edge_rate_limits;
create trigger edge_rate_limits_cleanup_expired
after insert on private.edge_rate_limits
for each row execute function private.cleanup_expired_edge_security_rows();

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

revoke all on function public.enforce_edge_rate_limit(text, text, integer, integer)
from public, anon, authenticated;
grant execute on function public.enforce_edge_rate_limit(text, text, integer, integer)
to service_role;
