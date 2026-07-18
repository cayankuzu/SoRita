create or replace function private.is_email_confirmed_account(input_user_id uuid)
returns boolean
language sql
security definer
stable
set search_path = pg_catalog, auth
as $$
  select exists (
    select 1
    from auth.users
    where id = input_user_id
      and email_confirmed_at is not null
  );
$$;

revoke all on function private.is_email_confirmed_account(uuid) from public;
grant execute on function private.is_email_confirmed_account(uuid) to authenticated;

create or replace view public.public_profile_summaries
with (security_invoker = true) as
select
  id,
  name,
  username,
  is_public_account,
  bio,
  profile_photo_url,
  cover_photo_url,
  interests,
  created_at,
  updated_at
from public.profiles
where private.is_email_confirmed_account(id);

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  next_name text;
  next_username text;
  next_interests text[];
begin
  if new.email_confirmed_at is null then
    return new;
  end if;

  next_name := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'name'), ''),
    split_part(coalesce(new.email, ''), '@', 1),
    'Yeni Kullanici'
  );

  next_username := public.resolve_profile_username(
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'username'), ''),
      regexp_replace(split_part(coalesce(new.email, ''), '@', 1), '[^a-zA-Z0-9_]', '', 'g'),
      'user_' || left(new.id::text, 8)
    ),
    new.id
  );

  next_interests := case
    when jsonb_typeof(new.raw_user_meta_data -> 'interests') = 'array'
      then array(select jsonb_array_elements_text(new.raw_user_meta_data -> 'interests'))
    else '{}'::text[]
  end;

  insert into public.profiles (
    id,
    email,
    name,
    username,
    is_public_account,
    bio,
    interests,
    profile_photo_url,
    cover_photo_url
  )
  values (
    new.id,
    coalesce(new.email, ''),
    next_name,
    next_username,
    true,
    nullif(new.raw_user_meta_data ->> 'bio', ''),
    next_interests,
    nullif(new.raw_user_meta_data ->> 'profile_photo_url', ''),
    nullif(new.raw_user_meta_data ->> 'cover_photo_url', '')
  )
  on conflict (id) do update
  set
    email = excluded.email,
    name = coalesce(nullif(trim(public.profiles.name), ''), excluded.name),
    username = coalesce(nullif(trim(public.profiles.username), ''), excluded.username),
    is_public_account = coalesce(public.profiles.is_public_account, excluded.is_public_account),
    bio = coalesce(public.profiles.bio, excluded.bio),
    interests = coalesce(public.profiles.interests, excluded.interests),
    profile_photo_url = coalesce(public.profiles.profile_photo_url, excluded.profile_photo_url),
    cover_photo_url = coalesce(public.profiles.cover_photo_url, excluded.cover_photo_url),
    updated_at = timezone('utc', now());

  return new;
end;
$$;

revoke all on function private.handle_new_user() from public;

drop trigger if exists on_auth_user_email_confirmed on auth.users;
create trigger on_auth_user_email_confirmed
after update of email_confirmed_at on auth.users
for each row
when (old.email_confirmed_at is null and new.email_confirmed_at is not null)
execute function private.handle_new_user();

delete from public.profiles p
using auth.users u
where u.id = p.id
  and u.email_confirmed_at is null;

insert into public.profiles (
  id,
  email,
  name,
  username,
  is_public_account,
  bio,
  interests,
  profile_photo_url,
  cover_photo_url
)
select
  u.id,
  coalesce(u.email, ''),
  coalesce(
    nullif(trim(u.raw_user_meta_data ->> 'name'), ''),
    split_part(coalesce(u.email, ''), '@', 1),
    'Yeni Kullanici'
  ),
  public.resolve_profile_username(
    coalesce(
      nullif(trim(u.raw_user_meta_data ->> 'username'), ''),
      regexp_replace(split_part(coalesce(u.email, ''), '@', 1), '[^a-zA-Z0-9_]', '', 'g'),
      'user_' || left(u.id::text, 8)
    ),
    u.id
  ),
  true,
  nullif(u.raw_user_meta_data ->> 'bio', ''),
  case
    when jsonb_typeof(u.raw_user_meta_data -> 'interests') = 'array'
      then array(select jsonb_array_elements_text(u.raw_user_meta_data -> 'interests'))
    else '{}'::text[]
  end,
  nullif(u.raw_user_meta_data ->> 'profile_photo_url', ''),
  nullif(u.raw_user_meta_data ->> 'cover_photo_url', '')
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null
  and u.email_confirmed_at is not null;
