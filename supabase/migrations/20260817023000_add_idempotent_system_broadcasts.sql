create table if not exists private.system_broadcast_deliveries (
  idempotency_key uuid not null,
  recipient_user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (idempotency_key, recipient_user_id)
);

alter table private.system_broadcast_deliveries enable row level security;

revoke all on table private.system_broadcast_deliveries from public, anon, authenticated;
grant select, insert on table private.system_broadcast_deliveries to service_role;

create index if not exists system_broadcast_deliveries_created_at_idx
  on private.system_broadcast_deliveries (created_at);

create or replace function public.insert_system_broadcast_notifications(
  p_idempotency_key uuid,
  p_message text,
  p_push_title text,
  p_recipient_user_ids uuid[]
)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  inserted_count integer := 0;
begin
  if auth.role() <> 'service_role' then
    raise insufficient_privilege using message = 'service_role required';
  end if;

  if p_idempotency_key is null
    or nullif(btrim(coalesce(p_message, '')), '') is null
    or nullif(btrim(coalesce(p_push_title, '')), '') is null then
    raise invalid_parameter_value using message = 'Invalid broadcast payload';
  end if;

  with claimed_recipients as (
    insert into private.system_broadcast_deliveries (
      idempotency_key,
      recipient_user_id
    )
    select p_idempotency_key, recipient_user_id
    from unnest(coalesce(p_recipient_user_ids, array[]::uuid[]))
      as recipient(recipient_user_id)
    where recipient_user_id is not null
    on conflict (idempotency_key, recipient_user_id) do nothing
    returning recipient_user_id
  ), inserted_notifications as (
    insert into public.notifications (
      actor_user_id,
      message,
      push_title,
      read,
      recipient_user_id,
      type
    )
    select
      null,
      btrim(p_message),
      btrim(p_push_title),
      false,
      recipient_user_id,
      'system_announcement'
    from claimed_recipients
    returning id
  )
  select count(*)::integer
  into inserted_count
  from inserted_notifications;

  return inserted_count;
end;
$$;

revoke all on function public.insert_system_broadcast_notifications(uuid, text, text, uuid[])
  from public, anon, authenticated;
grant execute on function public.insert_system_broadcast_notifications(uuid, text, text, uuid[])
  to service_role;
