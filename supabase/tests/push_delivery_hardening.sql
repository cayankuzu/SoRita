begin;

create extension if not exists pgtap with schema extensions;
select plan(32);

select has_table('private', 'push_delivery_dead_letters', 'push delivery dead-letter table exists');
select ok(
  not exists (
    select 1
    from information_schema.columns
    where table_schema = 'private'
      and table_name = 'push_delivery_dead_letters'
      and column_name in ('payload', 'last_error_message', 'provider_response')
  ),
  'dead-letter rows exclude raw payload and provider-error content'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'private.push_delivery_dead_letters'::regclass),
  'dead-letter rows enforce RLS'
);
select ok(
  not has_table_privilege('authenticated', 'private.push_delivery_dead_letters', 'select'),
  'authenticated users cannot inspect dead-letter rows'
);
select ok(
  not has_table_privilege('service_role', 'private.push_delivery_dead_letters', 'delete'),
  'service role cannot erase dead-letter rows directly'
);
select has_table('private', 'push_delivery_requeue_audits', 'controlled requeue audit table exists');
select ok(
  not has_table_privilege('service_role', 'private.push_delivery_requeue_audits', 'delete'),
  'service role cannot erase controlled requeue audit rows directly'
);
select ok(
  exists (
    select 1
    from pg_trigger
    where tgname = 'push_delivery_jobs_capture_dead_letter'
      and tgrelid = 'private.push_delivery_jobs'::regclass
      and not tgisinternal
  ),
  'terminal delivery jobs are captured by the dead-letter trigger'
);

select ok(
  to_regprocedure('public.upsert_user_push_token(text,text,text)') is not null,
  'push token upsert requires a cleanup capability'
);
select ok(
  to_regprocedure('public.upsert_user_push_token(text,text)') is not null,
  'the previous push-token registration overload remains available during binary adoption'
);
select ok(
  to_regprocedure('public.revoke_push_token_with_cleanup_secret(text,text)') is not null,
  'anonymous cleanup-capability revocation RPC exists'
);
select has_column(
  'public',
  'user_push_tokens',
  'cleanup_secret_hash',
  'only the cleanup capability hash is stored with a push token'
);
select ok(
  not has_column_privilege('authenticated', 'public.user_push_tokens', 'cleanup_secret_hash', 'select'),
  'authenticated clients cannot read cleanup capability hashes'
);

insert into auth.users (
  id,
  instance_id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
values (
  '30000000-0000-0000-0000-000000000003',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'push-hardening@example.test',
  'test',
  timezone('utc', now()),
  '{"provider":"email","providers":["email"]}',
  '{"name":"Push Hardening","username":"push_hardening"}',
  timezone('utc', now()),
  timezone('utc', now())
);

select set_config('request.jwt.claim.sub', '30000000-0000-0000-0000-000000000003', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;
select lives_ok(
  $$
    select public.upsert_user_push_token(
      'ExponentPushToken[pgtap-legacy-registration]',
      'android'
    )
  $$,
  'a previous store client can still register against the expanded schema'
);
select lives_ok(
  $$
    select public.upsert_user_push_token(
      'ExponentPushToken[pgtap-cleanup-capability]',
      'android',
      repeat('a', 64)
    )
  $$,
  'an authenticated client can bind a cleanup-capable push token'
);
reset role;

select set_config('request.jwt.claim.role', 'anon', true);
set local role anon;
select is(
  public.revoke_push_token_with_cleanup_secret(
    'ExponentPushToken[pgtap-cleanup-capability]',
    repeat('b', 64)
  ),
  false,
  'a mismatched cleanup capability cannot revoke a token'
);
select is(
  public.revoke_push_token_with_cleanup_secret(
    'ExponentPushToken[pgtap-cleanup-capability]',
    repeat('a', 64)
  ),
  true,
  'the exact cleanup capability can revoke the token anonymously'
);
select is(
  public.revoke_push_token_with_cleanup_secret(
    'ExponentPushToken[pgtap-cleanup-capability]',
    repeat('a', 64)
  ),
  true,
  'cleanup revocation remains idempotent after a network retry'
);
reset role;

select ok(
  to_regprocedure('public.insert_system_broadcast_notifications(uuid,text,text,uuid[],text)') is not null,
  'canonical-hash system broadcast RPC exists'
);
select ok(
  to_regprocedure('public.insert_system_broadcast_notifications(uuid,text,text,uuid[])') is not null,
  'the previous broadcast Edge Function overload remains available during deployment adoption'
);
select set_config('request.jwt.claim.role', 'service_role', true);
set local role service_role;
select is(
  public.insert_system_broadcast_notifications(
    '32222222-2222-4222-8222-222222222222',
    'PGTAP legacy broadcast message',
    'SoRita',
    array['30000000-0000-0000-0000-000000000003']::uuid[]
  ),
  1,
  'the previous broadcast deployment remains compatible with the expanded schema'
);
select is(
  public.insert_system_broadcast_notifications(
    '31111111-1111-4111-8111-111111111111',
    'PGTAP broadcast message',
    'SoRita',
    array['30000000-0000-0000-0000-000000000003']::uuid[],
    repeat('c', 64)
  ),
  1,
  'the first canonical broadcast request creates one notification'
);
select is(
  public.insert_system_broadcast_notifications(
    '31111111-1111-4111-8111-111111111111',
    'PGTAP broadcast message',
    'SoRita',
    array['30000000-0000-0000-0000-000000000003']::uuid[],
    repeat('c', 64)
  ),
  0,
  'a repeated canonical broadcast request is idempotent'
);
select throws_ok(
  $$
    select public.insert_system_broadcast_notifications(
      '31111111-1111-4111-8111-111111111111',
      'changed body',
      'SoRita',
      array['30000000-0000-0000-0000-000000000003']::uuid[],
      repeat('d', 64)
    )
  $$,
  'P0001',
  'idempotency_key_payload_mismatch',
  'a reused broadcast key with a changed canonical request is rejected'
);
reset role;

select ok(
  to_regprocedure('public.requeue_push_delivery_dead_letter(uuid,uuid)') is not null,
  'controlled dead-letter requeue RPC exists'
);
select ok(
  has_function_privilege(
    'service_role',
    'public.requeue_push_delivery_dead_letter(uuid,uuid)',
    'execute'
  ),
  'only service role can invoke the controlled requeue RPC'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.requeue_push_delivery_dead_letter(uuid,uuid)',
    'execute'
  ),
  'authenticated users cannot invoke controlled delivery requeue'
);
select ok(
  to_regprocedure('public.run_push_delivery_worker_for_scheduler()') is not null,
  'external scheduler runner contract exists'
);
select ok(
  to_regprocedure('public.get_push_delivery_scheduler_health()') is not null,
  'scheduler health contract exists'
);
select ok(
  has_function_privilege(
    'service_role',
    'public.get_push_delivery_scheduler_health()',
    'execute'
  ),
  'service role can read scheduler health'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.get_push_delivery_scheduler_health()',
    'execute'
  ),
  'authenticated users cannot read scheduler health'
);

select set_config('request.jwt.claim.role', 'service_role', true);
set local role service_role;
select lives_ok(
  $$ select * from public.get_push_delivery_scheduler_health() $$,
  'scheduler health endpoint is callable before the first worker run'
);
reset role;

select * from finish();
rollback;
