-- Repair migration drift: the private place-media bucket was added to an
-- already-applied migration, so existing remote projects never created it.
insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'place-media-private',
  'place-media-private',
  false,
  140313800,
  array[
    'image/heic',
    'image/jpeg',
    'image/png',
    'image/webp',
    'video/3gpp',
    'video/mp4',
    'video/quicktime',
    'video/webm',
    'video/x-m4v'
  ]::text[]
)
on conflict (id) do update
set
  name = excluded.name,
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
