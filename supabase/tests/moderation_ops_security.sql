begin;

create extension if not exists pgtap with schema extensions;
select plan(37);

select has_table('public', 'moderation_cases', 'moderation case ledger exists');
select has_table('public', 'moderation_case_events', 'moderation audit event ledger exists');
select ok(
  (select relrowsecurity from pg_class where oid = 'public.moderation_cases'::regclass),
  'moderation cases enforce RLS'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.moderation_case_events'::regclass),
  'moderation case events enforce RLS'
);
select ok(
  not has_table_privilege('anon', 'public.moderation_cases', 'select'),
  'anonymous users cannot inspect moderation cases'
);
select ok(
  not has_table_privilege('authenticated', 'public.moderation_cases', 'select'),
  'authenticated users cannot inspect moderation cases'
);
select ok(
  not has_table_privilege('authenticated', 'public.moderation_case_events', 'select'),
  'authenticated users cannot inspect moderation audit events'
);
select ok(
  has_table_privilege('service_role', 'public.moderation_cases', 'select'),
  'service role can inspect the minimum case queue'
);
select ok(
  has_table_privilege('service_role', 'public.moderation_case_events', 'select'),
  'service role can inspect the audit trail'
);
select ok(
  not has_table_privilege('service_role', 'public.moderation_cases', 'insert'),
  'service role cannot bypass the audited RPC with direct case inserts'
);
select ok(
  not has_table_privilege('service_role', 'public.moderation_case_events', 'update'),
  'service role cannot rewrite moderation audit events'
);
select ok(
  not has_table_privilege('service_role', 'public.moderation_reports', 'delete'),
  'service role cannot erase moderation reports and their case audit trail'
);
select ok(
  not has_table_privilege('service_role', 'public.moderation_reports', 'truncate'),
  'service role cannot truncate moderation reports and their case audit trail'
);
select ok(
  not has_table_privilege('anon', 'public.moderation_reports', 'delete'),
  'anonymous callers cannot delete moderation reports'
);
select ok(
  not has_table_privilege('anon', 'public.moderation_reports', 'truncate'),
  'anonymous callers cannot truncate moderation reports'
);
select ok(
  not has_table_privilege('authenticated', 'public.moderation_reports', 'delete'),
  'authenticated callers cannot delete moderation reports'
);
select ok(
  not has_table_privilege('authenticated', 'public.moderation_reports', 'truncate'),
  'authenticated callers cannot truncate moderation reports'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.moderation_transition_case(uuid,text,text,text,text,timestamp with time zone,text)',
    'execute'
  ),
  'authenticated users cannot operate moderation cases'
);
select ok(
  has_function_privilege(
    'service_role',
    'public.moderation_transition_case(uuid,text,text,text,text,timestamp with time zone,text)',
    'execute'
  ),
  'service role can use the audited moderation transition RPC'
);
select is(
  (
    select count(*)::integer
    from pg_trigger
    where not tgisinternal and tgname = 'moderation_reports_create_case'
  ),
  1,
  'report intake creates an internal moderation case'
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
values
  (
    '30000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'moderation-reporter@example.test',
    'test',
    timezone('utc', now()),
    '{"provider":"email","providers":["email"]}',
    '{"name":"Reporter","username":"moderation_reporter"}',
    timezone('utc', now()),
    timezone('utc', now())
  ),
  (
    '30000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'moderation-target@example.test',
    'test',
    timezone('utc', now()),
    '{"provider":"email","providers":["email"]}',
    '{"name":"Target","username":"moderation_target"}',
    timezone('utc', now()),
    timezone('utc', now())
  );

select throws_ok(
  $$
    insert into public.moderation_reports (
      legacy_report_key,
      report_type,
      reporter_user_id,
      reason,
      snapshot
    ) values (
      'missing-target:30000000-0000-0000-0000-000000000001',
      'user',
      '30000000-0000-0000-0000-000000000001',
      'Missing target probe',
      '{}'::jsonb
    )
  $$,
  '23514',
  'moderation_report_target_required',
  'new moderation reports cannot use the deletion-only all-null tombstone state'
);

insert into public.moderation_reports (
  id,
  legacy_report_key,
  report_type,
  reporter_user_id,
  target_user_id,
  reason,
  snapshot
)
values (
  '30000000-0000-0000-0000-000000000010',
  'user:30000000-0000-0000-0000-000000000001:30000000-0000-0000-0000-000000000002',
  'user',
  '30000000-0000-0000-0000-000000000001',
  '30000000-0000-0000-0000-000000000002',
  'Safety review',
  '{}'::jsonb
);

select is(
  (select count(*) from public.moderation_cases where report_id = '30000000-0000-0000-0000-000000000010'),
  1::bigint,
  'report insertion creates exactly one case'
);
select is(
  (select status from public.moderation_cases where report_id = '30000000-0000-0000-0000-000000000010'),
  'open',
  'new moderation cases start open'
);
select is(
  (
    select count(*)
    from public.moderation_case_events as event
    join public.moderation_cases as moderation_case on moderation_case.id = event.case_id
    where moderation_case.report_id = '30000000-0000-0000-0000-000000000010'
      and event.event_type = 'created'
  ),
  1::bigint,
  'report intake records one creation audit event'
);
select ok(
  (
    select not (event.metadata ?| array['email', 'details', 'snapshot', 'access_token', 'signed_url'])
    from public.moderation_case_events as event
    join public.moderation_cases as moderation_case on moderation_case.id = event.case_id
    where moderation_case.report_id = '30000000-0000-0000-0000-000000000010'
      and event.event_type = 'created'
  ),
  'audit metadata excludes sensitive report content'
);

-- Exercise the same JSON claim shape PostgREST installs for a service-role
-- request. A temporary authenticated grant below exists only inside this
-- rolled-back fixture so the function's own actor guard can also be tested.
set local role service_role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
select throws_ok(
  $$
    select public.moderation_transition_case(
      null,
      'review',
      'ops:test',
      'Actor guard probe',
      'actor-guard-service-0001'
    )
  $$,
  '22023',
  'case_id_required',
  'service-role JSON claims pass the moderator actor gate'
);
reset role;

grant execute on function public.moderation_transition_case(
  uuid, text, text, text, text, timestamptz, text
) to authenticated;
set local role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated"}', true);
select throws_ok(
  $$
    select public.moderation_transition_case(
      null,
      'review',
      'ops:test',
      'Actor guard probe',
      'actor-guard-user-0001'
    )
  $$,
  '42501',
  'moderation_operator_required',
  'authenticated JSON claims fail the moderator actor gate'
);
reset role;
select set_config('request.jwt.claims', '', true);

select is(
  (
    select status
    from public.moderation_transition_case(
      (select id from public.moderation_cases where report_id = '30000000-0000-0000-0000-000000000010'),
      'review',
      'ops:test',
      'Begin review',
      'test-review-0001'
    )
  ),
  'in_review',
  'review starts the case review lifecycle'
);
select is(
  (
    select revision
    from public.moderation_transition_case(
      (select id from public.moderation_cases where report_id = '30000000-0000-0000-0000-000000000010'),
      'review',
      'ops:test',
      'Begin review',
      'test-review-0001'
    )
  ),
  2::bigint,
  'replaying an idempotency key does not advance the case revision'
);
select throws_ok(
  $$
    select public.moderation_transition_case(
      (select id from public.moderation_cases where report_id = '30000000-0000-0000-0000-000000000010'),
      'review',
      'ops:test',
      'Different command under a reused key',
      'test-review-0001'
    )
  $$,
  '23505',
  'idempotency_key_reused',
  'an idempotency key cannot acknowledge a semantically different command'
);
select is(
  (
    select count(*)
    from public.moderation_case_events as event
    join public.moderation_cases as moderation_case on moderation_case.id = event.case_id
    where moderation_case.report_id = '30000000-0000-0000-0000-000000000010'
      and event.event_type = 'review_started'
  ),
  1::bigint,
  'idempotent review replay records one audit event'
);
select throws_ok(
  $$
    select public.moderation_transition_case(
      (select id from public.moderation_cases where report_id = '30000000-0000-0000-0000-000000000010'),
      'appeal',
      'ops:test',
      'Invalid early appeal',
      'test-appeal-invalid-0001',
      null,
      'evidence://appeal/invalid-state-probe'
    )
  $$,
  '22023',
  'invalid_moderation_transition',
  'invalid case transitions fail closed'
);
select is(
  (
    select status
    from public.moderation_transition_case(
      (select id from public.moderation_cases where report_id = '30000000-0000-0000-0000-000000000010'),
      'sanction',
      'ops:test',
      'Record separately enforced action',
      'test-sanction-0001',
      null,
      'evidence://sanction/test-0001'
    )
  ),
  'actioned',
  'sanction decisions require an external enforcement evidence reference'
);
select is(
  (
    select status
    from public.moderation_transition_case(
      (select id from public.moderation_cases where report_id = '30000000-0000-0000-0000-000000000010'),
      'appeal',
      'ops:test',
      'Record appeal received through support',
      'test-appeal-0001',
      null,
      'evidence://appeal/test-0001'
    )
  ),
  'appealed',
  'appeal intake is represented as an audited case transition'
);
select is(
  (
    select sla_policy_version
    from public.moderation_transition_case(
      (select id from public.moderation_cases where report_id = '30000000-0000-0000-0000-000000000010'),
      'set-sla',
      'ops:test',
      'Apply approved test SLA',
      'test-sla-0001',
      timezone('utc', now()) + interval '1 day',
      'test-policy-v1'
    )
  ),
  'test-policy-v1',
  'SLA deadline and policy version are explicitly assigned together'
);
select is(
  (
    select status
    from public.moderation_transition_case(
      (select id from public.moderation_cases where report_id = '30000000-0000-0000-0000-000000000010'),
      'close',
      'ops:test',
      'Review completed',
      'test-close-0001'
    )
  ),
  'closed',
  'reviewed cases can be closed through the audited RPC'
);
select is(
  (
    select count(*)
    from public.moderation_case_events as event
    join public.moderation_cases as moderation_case on moderation_case.id = event.case_id
    where moderation_case.report_id = '30000000-0000-0000-0000-000000000010'
  ),
  6::bigint,
  'the complete lifecycle has one immutable event per accepted operation'
);

select * from finish();
rollback;
