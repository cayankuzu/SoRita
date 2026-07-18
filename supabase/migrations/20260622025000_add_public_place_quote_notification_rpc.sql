create or replace function public.create_place_quote_notification(
  input_recipient_user_id uuid,
  input_message text,
  input_list_id uuid default null,
  input_list_place_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  actor_user_id uuid;
begin
  actor_user_id := auth.uid();

  if actor_user_id is null then
    raise exception 'Authentication required';
  end if;

  perform private.create_notification(
    input_recipient_user_id,
    actor_user_id,
    'place_quote',
    input_message,
    input_list_id,
    input_list_place_id
  );
end;
$$;
revoke all on function public.create_place_quote_notification(uuid, text, uuid, uuid) from public;
grant execute on function public.create_place_quote_notification(uuid, text, uuid, uuid) to authenticated;
