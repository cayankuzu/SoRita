begin;

create extension if not exists pgtap with schema extensions;
select plan(6);

select ok(
  not has_function_privilege('anon', 'public.check_account_availability(text,text,uuid)', 'execute'),
  'anonymous callers cannot probe account availability directly'
);
select ok(
  not has_function_privilege('authenticated', 'public.check_account_availability(text,text,uuid)', 'execute'),
  'signed-in callers cannot probe account availability directly'
);
select ok(
  not has_function_privilege('anon', 'private.check_account_availability(text,text,uuid)', 'execute'),
  'anonymous callers cannot reach the private availability check'
);
select ok(
  not has_function_privilege('authenticated', 'private.check_account_availability(text,text,uuid)', 'execute'),
  'signed-in callers cannot reach the private availability check'
);

-- Holding the grant is not enough; the gateway role has to be able to run the
-- check end to end. A grant-only test passed while every call failed.
set local role service_role;
select lives_ok(
  $$ select * from public.check_account_availability(null, 'availability_probe_user', null) $$,
  'the auth gateway role can check a username'
);
select is(
  (select username_available from public.check_account_availability(null, 'availability_probe_user', null)),
  true,
  'an unused username reads as available'
);
reset role;

select * from finish();
rollback;
