-- Keep the auth-login guard status read concurrency-safe while avoiding an
-- ambiguous reference between the RETURNS TABLE output parameter and the
-- auth_login_guards.locked_until column.

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

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(hashed_email, 0)
  );

  delete from private.auth_login_guards as guards
  where guards.normalized_email = hashed_email
    and guards.locked_until is not null
    and guards.locked_until <= now_utc;

  select guards.*
  into guard_row
  from private.auth_login_guards as guards
  where guards.normalized_email = hashed_email;

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
