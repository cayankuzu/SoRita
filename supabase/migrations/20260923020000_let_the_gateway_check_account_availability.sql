-- Since 20260830143000 only service_role may execute
-- public.check_account_availability, which is right: email presence must only
-- be queried by the auth gateway. But that wrapper ran with its caller's rights
-- and calls private.check_account_availability, which was granted to anon and
-- authenticated only, in a schema service_role has no usage on. Every username
-- check through the gateway has failed with "permission denied" since then, so
-- sign-up could not pass the username step and editing a profile reported the
-- user's own name as impossible to check.
--
-- The wrapper now runs with its owner's rights, as the private functions it
-- fronts already do, and stays executable by service_role alone. The private
-- function loses its anon and authenticated grants: nothing but the wrapper
-- calls it, and leaving them open kept a way around the gateway.

create or replace function public.check_account_availability(
  input_email text default null,
  input_username text default null,
  input_exclude_user_id uuid default null
)
returns table (
  email_available boolean,
  username_available boolean
)
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
begin
  return query
  select *
  from private.check_account_availability(input_email, input_username, input_exclude_user_id);
end;
$$;

revoke all on function public.check_account_availability(text, text, uuid)
from public, anon, authenticated;
grant execute on function public.check_account_availability(text, text, uuid)
to service_role;

revoke all on function private.check_account_availability(text, text, uuid)
from public, anon, authenticated;
