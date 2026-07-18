alter table public.list_places
add column if not exists updated_at timestamptz not null default timezone('utc', now());
update public.list_places
set updated_at = coalesce(updated_at, added_at, timezone('utc', now()));
drop trigger if exists list_places_touch_updated_at on public.list_places;
create trigger list_places_touch_updated_at
before update on public.list_places
for each row
execute function public.touch_updated_at();
