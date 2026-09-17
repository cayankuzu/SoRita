-- Liking a place has been failing in production: the app calls
-- public.toggle_list_place_like and PostgREST answers PGRST202, because only the
-- private implementation exists there. Recreate the public wrapper beside it,
-- with the same posture as the comment-like wrapper: the caller's own rights,
-- delegating the privileged work to the private security-definer function.
create or replace function public.toggle_list_place_like(target_place_id uuid)
returns void
language plpgsql
security invoker
set search_path = pg_catalog, public, private
as $$
begin
  perform private.toggle_list_place_like(target_place_id);
end;
$$;

revoke all on function public.toggle_list_place_like(uuid) from public;
grant execute on function public.toggle_list_place_like(uuid) to authenticated;

notify pgrst, 'reload schema';
