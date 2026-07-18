alter table public.list_places
  add column if not exists source_list_id uuid references public.lists(id) on delete set null,
  add column if not exists source_place_id uuid references public.list_places(id) on delete set null,
  add column if not exists source_place_name text,
  add column if not exists source_user_avatar_url text,
  add column if not exists source_user_id uuid references public.profiles(id) on delete set null,
  add column if not exists source_user_name text;
create index if not exists idx_list_places_source_list_id
on public.list_places (source_list_id);
create index if not exists idx_list_places_source_place_id
on public.list_places (source_place_id);
create index if not exists idx_list_places_source_user_id
on public.list_places (source_user_id);
do $$
declare
  notifications_constraint_name text;
begin
  select con.conname
  into notifications_constraint_name
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  join pg_namespace ns on ns.oid = rel.relnamespace
  where ns.nspname = 'public'
    and rel.relname = 'notifications'
    and con.contype = 'c'
    and pg_get_constraintdef(con.oid) ilike '%type in%';

  if notifications_constraint_name is not null then
    execute format(
      'alter table public.notifications drop constraint %I',
      notifications_constraint_name
    );
  end if;
end
$$;
alter table public.notifications
drop constraint if exists notifications_type_check;
alter table public.notifications
add constraint notifications_type_check
check (
  type in (
    'like',
    'follow',
    'follow_request',
    'comment',
    'place_added',
    'place_quote',
    'list_liked',
    'comment_like',
    'comment_reply'
  )
);
