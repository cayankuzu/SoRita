begin;

create extension if not exists pgtap with schema extensions;
select plan(2);

-- A data migration switches the guard off for its own statements; this makes
-- sure no migration ever leaves it that way.
select is(
  (
    select tgenabled::text
    from pg_trigger
    where tgname = 'notifications_enforce_client_update_invariants'
      and tgrelid = 'public.notifications'::regclass
  ),
  'O',
  'the notification update guard is enabled after every migration'
);

select is(
  (
    select count(*)::int
    from pg_trigger
    where tgrelid = 'public.notifications'::regclass
      and not tgisinternal
      and tgenabled = 'D'
  ),
  0,
  'no notification trigger is left disabled'
);

select * from finish();
rollback;
