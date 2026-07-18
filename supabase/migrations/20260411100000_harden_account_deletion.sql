delete from public.notifications
where actor_user_id is not null
  and actor_user_id not in (select id from public.profiles);
alter table public.notifications
drop constraint if exists notifications_actor_user_id_fkey;
alter table public.notifications
add constraint notifications_actor_user_id_fkey
foreign key (actor_user_id)
references public.profiles (id)
on delete cascade;
