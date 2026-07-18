alter table public.list_place_photos
  add column if not exists media_type text,
  add column if not exists mime_type text,
  add column if not exists duration_ms integer,
  add column if not exists thumbnail_url text,
  add column if not exists width integer,
  add column if not exists height integer;
update public.list_place_photos
set media_type = 'photo'
where coalesce(trim(media_type), '') = '';
alter table public.list_place_photos
  alter column media_type set default 'photo',
  alter column media_type set not null;
alter table public.list_place_photos
  drop constraint if exists list_place_photos_media_type_check;
alter table public.list_place_photos
  add constraint list_place_photos_media_type_check
  check (media_type in ('photo', 'video'));
alter table public.list_place_photos
  drop constraint if exists list_place_photos_duration_ms_check;
alter table public.list_place_photos
  add constraint list_place_photos_duration_ms_check
  check (duration_ms is null or (duration_ms > 0 and duration_ms <= 180000));
alter table public.list_place_photos
  drop constraint if exists list_place_photos_dimensions_check;
alter table public.list_place_photos
  add constraint list_place_photos_dimensions_check
  check (
    (width is null or width > 0)
    and (height is null or height > 0)
  );
create index if not exists idx_list_place_photos_media_type
  on public.list_place_photos (media_type);
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'place-media',
  'place-media',
  true,
  157286400,
  array[
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/heic',
    'video/mp4',
    'video/quicktime',
    'video/x-m4v',
    'video/3gpp',
    'video/webm'
  ]
)
on conflict (id) do update
set
  name = excluded.name,
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
