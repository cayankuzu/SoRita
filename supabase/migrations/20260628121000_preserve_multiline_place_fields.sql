create or replace function private.normalize_multiline_optional_text(
  value text,
  max_length integer
)
returns text
language plpgsql
immutable
as $$
declare
  normalized text;
begin
  normalized := replace(replace(coalesce(value, ''), E'\r\n', E'\n'), E'\r', E'\n');
  normalized := regexp_replace(
    normalized,
    E'[\\x00-\\x08\\x0B\\x0C\\x0E-\\x1F\\x7F]',
    '',
    'g'
  );
  normalized := trim(normalized);
  normalized := left(normalized, greatest(max_length, 0));

  return nullif(normalized, '');
end;
$$;

create or replace function public.normalize_list_fields()
returns trigger
language plpgsql
set search_path = public, private
as $$
begin
  new.name := private.normalize_required_text(new.name, 100);
  new.description := private.normalize_multiline_optional_text(new.description, 300);
  new.emoji := private.normalize_optional_text(new.emoji, 8);

  if char_length(new.name) < 1 then
    raise exception 'List name is required';
  end if;

  return new;
end;
$$;

create or replace function public.normalize_list_place_fields()
returns trigger
language plpgsql
set search_path = public, private
as $$
begin
  new.name := private.normalize_required_text(new.name, 100);
  new.title := private.normalize_multiline_optional_text(new.title, 200);
  new.address := private.normalize_optional_text(new.address, 150);
  new.notes := private.normalize_multiline_optional_text(new.notes, 500);
  new.category := private.normalize_optional_text(new.category, 40);
  new.categories := private.normalize_text_array(new.categories, 12, 40);
  new.best_time := private.normalize_optional_text(new.best_time, 40);
  new.best_times := private.normalize_text_array(new.best_times, 8, 40);
  new.atmosphere := private.normalize_text_array(new.atmosphere, 12, 40);
  new.special_features := private.normalize_text_array(new.special_features, 12, 40);

  if char_length(new.name) < 1 then
    raise exception 'Place name is required';
  end if;

  if new.lat < -90 or new.lat > 90 then
    raise exception 'Place latitude is out of range';
  end if;

  if new.lng < -180 or new.lng > 180 then
    raise exception 'Place longitude is out of range';
  end if;

  return new;
end;
$$;

update public.lists
set description = private.normalize_multiline_optional_text(description, 300);

update public.list_places
set
  title = private.normalize_multiline_optional_text(title, 200),
  notes = private.normalize_multiline_optional_text(notes, 500);

alter table public.list_places
drop constraint if exists list_places_title_length_check;

alter table public.list_places
add constraint list_places_title_length_check
check (title is null or char_length(title) <= 200);

alter table public.list_places
drop constraint if exists list_places_notes_length_check;

alter table public.list_places
add constraint list_places_notes_length_check
check (notes is null or char_length(notes) <= 500);
