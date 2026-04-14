create or replace function public.can_manage_list_place(target_list_place_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.list_places
    join public.lists on lists.id = list_places.list_id
    where list_places.id = target_list_place_id
      and lists.owner_id = auth.uid()
  );
$$;

revoke all on function public.can_manage_list_place(uuid) from public;
grant execute on function public.can_manage_list_place(uuid) to authenticated;

drop policy if exists "list_place_photos_modify_own_list" on public.list_place_photos;

drop policy if exists "list_place_photos_insert_own_list" on public.list_place_photos;
create policy "list_place_photos_insert_own_list"
on public.list_place_photos
for insert
to authenticated
with check (public.can_manage_list_place(list_place_id));

drop policy if exists "list_place_photos_update_own_list" on public.list_place_photos;
create policy "list_place_photos_update_own_list"
on public.list_place_photos
for update
to authenticated
using (public.can_manage_list_place(list_place_id))
with check (public.can_manage_list_place(list_place_id));

drop policy if exists "list_place_photos_delete_own_list" on public.list_place_photos;
create policy "list_place_photos_delete_own_list"
on public.list_place_photos
for delete
to authenticated
using (public.can_manage_list_place(list_place_id));
