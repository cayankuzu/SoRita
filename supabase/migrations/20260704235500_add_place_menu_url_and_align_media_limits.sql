alter table public.list_places
add column if not exists menu_url text;

update public.list_places
set menu_url = nullif(btrim(menu_url), '')
where menu_url is not null;

alter table public.list_places
drop constraint if exists list_places_menu_url_format_check;

alter table public.list_places
add constraint list_places_menu_url_format_check
check (
  menu_url is null
  or (
    char_length(menu_url) <= 2048
    and menu_url ~ '^https://[^[:space:]]+$'
  )
);

update storage.buckets
set
  file_size_limit = 271043500,
  allowed_mime_types = array[
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
where id = 'place-media';
