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
  name text not null check (char_length(trim(name)) >= 2),
  username text not null unique check (username = lower(username)),
  bio text,
  profile_photo_url text,
  cover_photo_url text,
  interests text[] not null default '{}',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);
create table if not exists public.lists (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  description text,
  emoji text,
  cover_image_url text,
  is_public boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);
create table if not exists public.list_places (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.lists (id) on delete cascade,
  created_by uuid references public.profiles (id) on delete set null,
  name text not null,
  title text,
  lat double precision not null,
  lng double precision not null,
  address text,
  notes text,
  rating numeric(2,1) check (rating is null or (rating >= 0 and rating <= 5)),
  category text,
  categories text[] not null default '{}',
  student_discount boolean not null default false,
  price_range integer,
  price_min integer,
  price_max integer,
  best_time text,
  best_times text[] not null default '{}',
  atmosphere text[] not null default '{}',
  special_features text[] not null default '{}',
  added_at timestamptz not null default timezone('utc', now())
);
create table if not exists public.list_place_photos (
  id uuid primary key default gen_random_uuid(),
  list_place_id uuid not null references public.list_places (id) on delete cascade,
  url text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default timezone('utc', now())
);
create table if not exists public.list_likes (
  list_id uuid not null references public.lists (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (list_id, user_id)
);
create table if not exists public.user_follows (
  follower_id uuid not null references public.profiles (id) on delete cascade,
  following_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (follower_id, following_id),
  constraint user_follows_no_self_follow check (follower_id <> following_id)
);
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_user_id uuid not null references public.profiles (id) on delete cascade,
  actor_user_id uuid references public.profiles (id) on delete cascade,
  type text not null check (type in ('like', 'follow', 'comment', 'place_added', 'list_liked')),
  message text not null,
  list_id uuid references public.lists (id) on delete cascade,
  list_place_id uuid references public.list_places (id) on delete cascade,
  read boolean not null default false,
  created_at timestamptz not null default timezone('utc', now())
);
create index if not exists idx_lists_owner_id on public.lists (owner_id);
create index if not exists idx_lists_public_updated_at on public.lists (is_public, updated_at desc);
create index if not exists idx_list_places_list_id on public.list_places (list_id);
create index if not exists idx_list_place_photos_place_id on public.list_place_photos (list_place_id, sort_order);
create index if not exists idx_list_likes_user_id on public.list_likes (user_id);
create index if not exists idx_user_follows_following_id on public.user_follows (following_id);
create index if not exists idx_notifications_recipient_created_at on public.notifications (recipient_user_id, created_at desc);
drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at
before update on public.profiles
for each row
execute function public.touch_updated_at();
drop trigger if exists lists_touch_updated_at on public.lists;
create trigger lists_touch_updated_at
before update on public.lists
for each row
execute function public.touch_updated_at();
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  next_name text;
  next_username text;
begin
  next_name := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'name'), ''),
    split_part(coalesce(new.email, ''), '@', 1),
    'Yeni Kullanici'
  );

  next_username := lower(
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'username'), ''),
      regexp_replace(split_part(coalesce(new.email, ''), '@', 1), '[^a-zA-Z0-9_]', '', 'g'),
      'user_' || left(new.id::text, 8)
    )
  );

  insert into public.profiles (
    id,
    email,
    name,
    username,
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
    nullif(new.raw_user_meta_data ->> 'bio', ''),
    case
      when jsonb_typeof(new.raw_user_meta_data -> 'interests') = 'array'
        then array(select jsonb_array_elements_text(new.raw_user_meta_data -> 'interests'))
      else '{}'
    end,
    nullif(new.raw_user_meta_data ->> 'profile_photo_url', ''),
    nullif(new.raw_user_meta_data ->> 'cover_photo_url', '')
  )
  on conflict (id) do update
  set
    email = excluded.email,
    name = excluded.name,
    username = excluded.username,
    bio = excluded.bio,
    interests = excluded.interests,
    profile_photo_url = excluded.profile_photo_url,
    cover_photo_url = excluded.cover_photo_url,
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
on conflict (id) do nothing;
alter table public.profiles enable row level security;
alter table public.lists enable row level security;
alter table public.list_places enable row level security;
alter table public.list_place_photos enable row level security;
alter table public.list_likes enable row level security;
alter table public.user_follows enable row level security;
alter table public.notifications enable row level security;
drop policy if exists "profiles_select_authenticated" on public.profiles;
create policy "profiles_select_authenticated"
on public.profiles
for select
to authenticated
using (true);
drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
on public.profiles
for insert
to authenticated
with check (auth.uid() = id);
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles
for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);
drop policy if exists "lists_select_visible" on public.lists;
create policy "lists_select_visible"
on public.lists
for select
to authenticated
using (is_public or owner_id = auth.uid());
drop policy if exists "lists_insert_own" on public.lists;
create policy "lists_insert_own"
on public.lists
for insert
to authenticated
with check (owner_id = auth.uid());
drop policy if exists "lists_update_own" on public.lists;
create policy "lists_update_own"
on public.lists
for update
to authenticated
using (owner_id = auth.uid())
with check (owner_id = auth.uid());
drop policy if exists "lists_delete_own" on public.lists;
create policy "lists_delete_own"
on public.lists
for delete
to authenticated
using (owner_id = auth.uid());
drop policy if exists "list_places_select_visible" on public.list_places;
create policy "list_places_select_visible"
on public.list_places
for select
to authenticated
using (
  exists (
    select 1
    from public.lists
    where lists.id = list_places.list_id
      and (lists.is_public or lists.owner_id = auth.uid())
  )
);
drop policy if exists "list_places_modify_own_list" on public.list_places;
create policy "list_places_modify_own_list"
on public.list_places
for all
to authenticated
using (
  exists (
    select 1
    from public.lists
    where lists.id = list_places.list_id
      and lists.owner_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.lists
    where lists.id = list_places.list_id
      and lists.owner_id = auth.uid()
  )
);
drop policy if exists "list_place_photos_select_visible" on public.list_place_photos;
create policy "list_place_photos_select_visible"
on public.list_place_photos
for select
to authenticated
using (
  exists (
    select 1
    from public.list_places
    join public.lists on lists.id = list_places.list_id
    where list_places.id = list_place_photos.list_place_id
      and (lists.is_public or lists.owner_id = auth.uid())
  )
);
drop policy if exists "list_place_photos_modify_own_list" on public.list_place_photos;
create policy "list_place_photos_modify_own_list"
on public.list_place_photos
for all
to authenticated
using (
  exists (
    select 1
    from public.list_places
    join public.lists on lists.id = list_places.list_id
    where list_places.id = list_place_photos.list_place_id
      and lists.owner_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.list_places
    join public.lists on lists.id = list_places.list_id
    where list_places.id = list_place_photos.list_place_id
      and lists.owner_id = auth.uid()
  )
);
drop policy if exists "list_likes_select_authenticated" on public.list_likes;
create policy "list_likes_select_authenticated"
on public.list_likes
for select
to authenticated
using (true);
drop policy if exists "list_likes_insert_self" on public.list_likes;
create policy "list_likes_insert_self"
on public.list_likes
for insert
to authenticated
with check (user_id = auth.uid());
drop policy if exists "list_likes_delete_self" on public.list_likes;
create policy "list_likes_delete_self"
on public.list_likes
for delete
to authenticated
using (user_id = auth.uid());
drop policy if exists "user_follows_select_authenticated" on public.user_follows;
create policy "user_follows_select_authenticated"
on public.user_follows
for select
to authenticated
using (true);
drop policy if exists "user_follows_insert_self" on public.user_follows;
create policy "user_follows_insert_self"
on public.user_follows
for insert
to authenticated
with check (follower_id = auth.uid());
drop policy if exists "user_follows_delete_self" on public.user_follows;
create policy "user_follows_delete_self"
on public.user_follows
for delete
to authenticated
using (follower_id = auth.uid());
drop policy if exists "notifications_select_recipient" on public.notifications;
create policy "notifications_select_recipient"
on public.notifications
for select
to authenticated
using (recipient_user_id = auth.uid());
drop policy if exists "notifications_update_recipient" on public.notifications;
create policy "notifications_update_recipient"
on public.notifications
for update
to authenticated
using (recipient_user_id = auth.uid())
with check (recipient_user_id = auth.uid());
drop policy if exists "profile_media_public_read" on storage.objects;
create policy "profile_media_public_read"
on storage.objects
for select
to authenticated
using (bucket_id = 'profile-media');
drop policy if exists "profile_media_owner_write" on storage.objects;
create policy "profile_media_owner_write"
on storage.objects
for all
to authenticated
using (bucket_id = 'profile-media' and auth.uid()::text = (storage.foldername(name))[1])
with check (bucket_id = 'profile-media' and auth.uid()::text = (storage.foldername(name))[1]);
drop policy if exists "place_media_public_read" on storage.objects;
create policy "place_media_public_read"
on storage.objects
for select
to authenticated
using (bucket_id = 'place-media');
drop policy if exists "place_media_owner_write" on storage.objects;
create policy "place_media_owner_write"
on storage.objects
for all
to authenticated
using (bucket_id = 'place-media' and auth.uid()::text = (storage.foldername(name))[1])
with check (bucket_id = 'place-media' and auth.uid()::text = (storage.foldername(name))[1]);
