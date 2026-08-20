-- Complete-card read models compare owner-scoped place coordinates and names.
-- Match those exact immutable expressions so each per-card summary lookup uses
-- an index instead of repeatedly normalizing the full list_places table.
create index if not exists idx_list_places_complete_card_location
on public.list_places (
  round(lat::numeric, 5),
  round(lng::numeric, 5),
  lower(regexp_replace(trim(name), '\s+', ' ', 'g')),
  list_id
);
