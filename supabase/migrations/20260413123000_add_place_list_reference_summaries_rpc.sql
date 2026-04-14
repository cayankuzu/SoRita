create or replace function public.get_place_list_reference_summaries(
  input_owner_id uuid,
  input_place_name text,
  input_lat double precision,
  input_lng double precision
)
returns table (
  list_id uuid,
  place_id uuid,
  list_name text,
  list_cover_image_url text,
  list_is_public boolean,
  list_updated_at timestamptz,
  place_added_at timestamptz,
  place_updated_at timestamptz,
  is_locked boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  viewer_id uuid := auth.uid();
begin
  if input_owner_id is null
    or nullif(trim(coalesce(input_place_name, '')), '') is null
    or input_lat is null
    or input_lng is null then
    return;
  end if;

  if viewer_id = input_owner_id then
    return query
    select
      lists.id,
      list_places.id,
      lists.name,
      lists.cover_image_url,
      lists.is_public,
      lists.updated_at,
      list_places.added_at,
      coalesce(list_places.updated_at, list_places.added_at),
      false
    from public.lists
    join public.list_places on list_places.list_id = lists.id
    where lists.owner_id = input_owner_id
      and lower(trim(list_places.name)) = lower(trim(input_place_name))
      and abs(list_places.lat - input_lat) < 0.00001
      and abs(list_places.lng - input_lng) < 0.00001
    order by coalesce(list_places.updated_at, list_places.added_at) desc, lists.updated_at desc;

    return;
  end if;

  return query
  with matching_rows as (
    select
      lists.id as list_id,
      list_places.id as place_id,
      lists.name as list_name,
      lists.cover_image_url as list_cover_image_url,
      lists.is_public as list_is_public,
      lists.updated_at as list_updated_at,
      list_places.added_at as place_added_at,
      coalesce(list_places.updated_at, list_places.added_at) as place_updated_at
    from public.lists
    join public.list_places on list_places.list_id = lists.id
    where lists.owner_id = input_owner_id
      and lower(trim(list_places.name)) = lower(trim(input_place_name))
      and abs(list_places.lat - input_lat) < 0.00001
      and abs(list_places.lng - input_lng) < 0.00001
  ),
  public_rows as (
    select
      matching_rows.list_id,
      matching_rows.place_id,
      matching_rows.list_name,
      matching_rows.list_cover_image_url,
      matching_rows.list_is_public,
      matching_rows.list_updated_at,
      matching_rows.place_added_at,
      matching_rows.place_updated_at,
      false as is_locked
    from matching_rows
    where matching_rows.list_is_public = true
  ),
  private_locked_rows as (
    select
      null::uuid as list_id,
      null::uuid as place_id,
      null::text as list_name,
      null::text as list_cover_image_url,
      false as list_is_public,
      matching_rows.list_updated_at,
      matching_rows.place_added_at,
      matching_rows.place_updated_at,
      true as is_locked
    from matching_rows
    where matching_rows.list_is_public = false
  )
  select *
  from public_rows
  union all
  select *
  from private_locked_rows
  where exists (select 1 from public_rows)
  order by place_updated_at desc, list_updated_at desc;
end;
$$;

revoke all on function public.get_place_list_reference_summaries(uuid, text, double precision, double precision) from public;
grant execute on function public.get_place_list_reference_summaries(uuid, text, double precision, double precision) to authenticated;
