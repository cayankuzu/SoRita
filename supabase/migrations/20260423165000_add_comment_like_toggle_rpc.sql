create or replace function public.toggle_list_place_comment_like(target_comment_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'Authentication required'
      using errcode = '28000';
  end if;

  if not public.can_view_list_place_comment(target_comment_id) then
    raise exception 'Comment is not visible'
      using errcode = '42501';
  end if;

  delete from public.list_place_comment_likes
  where comment_id = target_comment_id
    and user_id = current_user_id;

  if found then
    return;
  end if;

  insert into public.list_place_comment_likes (comment_id, user_id)
  values (target_comment_id, current_user_id)
  on conflict (comment_id, user_id) do nothing;
end;
$$;
revoke all on function public.toggle_list_place_comment_like(uuid) from public;
grant execute on function public.toggle_list_place_comment_like(uuid) to authenticated;
