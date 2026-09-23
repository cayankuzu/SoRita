begin;

create extension if not exists pgtap with schema extensions;
select plan(3);

select ok(
  exists (
    select 1
    from pg_proc
    where proname = 'profile_summary'
      and pronamespace = 'public'::regnamespace
      and 'gallery_count' = any(proargnames)
  ),
  'the profile summary reports how many places carry media'
);

select ok(
  has_function_privilege('authenticated', 'public.profile_summary(uuid)', 'execute'),
  'signed-in viewers can read a profile summary'
);

select ok(
  has_function_privilege('anon', 'public.profile_summary(uuid)', 'execute'),
  'the recreated summary keeps its anonymous grant'
);

select * from finish();
rollback;
