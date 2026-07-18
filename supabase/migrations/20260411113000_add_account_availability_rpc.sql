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
set search_path = public
as $$
begin
  return query
  select
    case
      when nullif(trim(coalesce(input_email, '')), '') is null then true
      else not exists (
        select 1
        from public.profiles
        where lower(email) = lower(trim(input_email))
          and (input_exclude_user_id is null or id <> input_exclude_user_id)
      )
      and not exists (
        select 1
        from auth.users
        where lower(email) = lower(trim(input_email))
          and (input_exclude_user_id is null or id <> input_exclude_user_id)
      )
    end,
    case
      when nullif(trim(coalesce(input_username, '')), '') is null then true
      else not exists (
        select 1
        from public.profiles
        where username = lower(trim(input_username))
          and (input_exclude_user_id is null or id <> input_exclude_user_id)
      )
    end;
end;
$$;
revoke all on function public.check_account_availability(text, text, uuid) from public;
grant execute on function public.check_account_availability(text, text, uuid) to anon;
grant execute on function public.check_account_availability(text, text, uuid) to authenticated;
