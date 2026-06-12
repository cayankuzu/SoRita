create extension if not exists pgcrypto;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique,
  name text not null,
  username text not null unique,
  is_public_account boolean not null default true,
  bio text,
  profile_photo_url text,
  cover_photo_url text,
  interests text[] not null default '{}'::text[],
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.profiles
  add column if not exists email text,
  add column if not exists name text,
  add column if not exists username text,
  add column if not exists is_public_account boolean default true,
  add column if not exists bio text,
  add column if not exists profile_photo_url text,
  add column if not exists cover_photo_url text,
  add column if not exists interests text[] default '{}'::text[],
  add column if not exists created_at timestamptz default timezone('utc', now()),
  add column if not exists updated_at timestamptz default timezone('utc', now());

alter table public.profiles alter column is_public_account set default true;
alter table public.profiles alter column interests set default '{}'::text[];
alter table public.profiles alter column created_at set default timezone('utc', now());
alter table public.profiles alter column updated_at set default timezone('utc', now());

update public.profiles
set
  is_public_account = coalesce(is_public_account, true),
  interests = coalesce(interests, '{}'::text[]),
  created_at = coalesce(created_at, timezone('utc', now())),
  updated_at = coalesce(updated_at, timezone('utc', now()))
where
  is_public_account is null
  or interests is null
  or created_at is null
  or updated_at is null;

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at
before update on public.profiles
for each row
execute function public.touch_updated_at();

create or replace function public.resolve_profile_username(raw_username text, fallback_user_id uuid)
returns text
language plpgsql
set search_path = public
as $$
declare
  normalized_username text;
begin
  normalized_username := lower(
    regexp_replace(coalesce(trim(raw_username), ''), '[^a-zA-Z0-9_]', '', 'g')
  );

  if char_length(normalized_username) < 3 then
    normalized_username := 'user_' || left(fallback_user_id::text, 8);
  end if;

  if exists (
    select 1
    from public.profiles
    where username = normalized_username
      and id <> fallback_user_id
  ) then
    normalized_username := left(normalized_username, 24) || '_' || left(fallback_user_id::text, 8);
  end if;

  return normalized_username;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  next_name text;
  next_username text;
  next_interests text[];
begin
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

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('profile-media', 'profile-media', true, 5242880, array['image/png', 'image/jpeg', 'image/webp', 'image/heic']),
  ('place-media', 'place-media', true, 7340032, array['image/png', 'image/jpeg', 'image/webp', 'image/heic'])
on conflict (id) do update
set
  name = excluded.name,
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.request_nonces (
  nonce text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  function_name text not null,
  device_id text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists request_nonces_expires_at_idx
  on public.request_nonces (expires_at);

alter table public.request_nonces enable row level security;

do $$
declare
  target_user record;
  next_name text;
  next_username text;
  next_interests text[];
begin
  for target_user in
    select
      u.id,
      u.email,
      u.raw_user_meta_data
    from auth.users u
    left join public.profiles p on p.id = u.id
    where p.id is null
    order by u.created_at nulls first, u.id
  loop
    next_name := coalesce(
      nullif(trim(target_user.raw_user_meta_data ->> 'name'), ''),
      split_part(coalesce(target_user.email, ''), '@', 1),
      'Yeni Kullanici'
    );

    next_username := public.resolve_profile_username(
      coalesce(
        nullif(trim(target_user.raw_user_meta_data ->> 'username'), ''),
        regexp_replace(split_part(coalesce(target_user.email, ''), '@', 1), '[^a-zA-Z0-9_]', '', 'g'),
        'user_' || left(target_user.id::text, 8)
      ),
      target_user.id
    );

    next_interests := case
      when jsonb_typeof(target_user.raw_user_meta_data -> 'interests') = 'array'
        then array(select jsonb_array_elements_text(target_user.raw_user_meta_data -> 'interests'))
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
      target_user.id,
      coalesce(target_user.email, ''),
      next_name,
      next_username,
      true,
      nullif(target_user.raw_user_meta_data ->> 'bio', ''),
      next_interests,
      nullif(target_user.raw_user_meta_data ->> 'profile_photo_url', ''),
      nullif(target_user.raw_user_meta_data ->> 'cover_photo_url', '')
    )
    on conflict (id) do nothing;
  end loop;
end
$$;

update public.profiles p
set
  email = coalesce(nullif(p.email, ''), u.email, 'user_' || left(p.id::text, 8) || '@placeholder.invalid'),
  name = coalesce(
    nullif(trim(p.name), ''),
    nullif(trim(u.raw_user_meta_data ->> 'name'), ''),
    split_part(coalesce(u.email, ''), '@', 1),
    'Yeni Kullanici'
  ),
  username = case
    when nullif(trim(p.username), '') is not null then lower(p.username)
    else public.resolve_profile_username(
      coalesce(
        nullif(trim(u.raw_user_meta_data ->> 'username'), ''),
        regexp_replace(split_part(coalesce(u.email, ''), '@', 1), '[^a-zA-Z0-9_]', '', 'g'),
        'user_' || left(p.id::text, 8)
      ),
      p.id
    )
  end,
  is_public_account = coalesce(p.is_public_account, true),
  bio = coalesce(p.bio, nullif(u.raw_user_meta_data ->> 'bio', '')),
  interests = coalesce(
    p.interests,
    case
      when jsonb_typeof(u.raw_user_meta_data -> 'interests') = 'array'
        then array(select jsonb_array_elements_text(u.raw_user_meta_data -> 'interests'))
      else '{}'::text[]
    end
  ),
  profile_photo_url = coalesce(
    p.profile_photo_url,
    nullif(u.raw_user_meta_data ->> 'profile_photo_url', '')
  ),
  cover_photo_url = coalesce(
    p.cover_photo_url,
    nullif(u.raw_user_meta_data ->> 'cover_photo_url', '')
  ),
  created_at = coalesce(p.created_at, timezone('utc', now())),
  updated_at = timezone('utc', now())
from auth.users u
where u.id = p.id
  and (
    p.email is null
    or p.email = ''
    or p.name is null
    or trim(p.name) = ''
    or p.username is null
    or trim(p.username) = ''
    or p.is_public_account is null
    or p.interests is null
    or p.created_at is null
  );
