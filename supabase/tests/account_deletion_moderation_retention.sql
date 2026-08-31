begin;

create extension if not exists pgtap with schema extensions;
select plan(9);

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
    '51000000-0000-4000-8000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'retention-reporter@example.test',
    'test',
    timezone('utc', now()),
    '{"provider":"email","providers":["email"]}',
    '{"name":"Retention Reporter","username":"retention_reporter"}',
    timezone('utc', now()),
    timezone('utc', now())
  ),
  (
    '52000000-0000-4000-8000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'retention-target@example.test',
    'test',
    timezone('utc', now()),
    '{"provider":"email","providers":["email"]}',
    '{"name":"Retention Target","username":"retention_target"}',
    timezone('utc', now()),
    timezone('utc', now())
  );

insert into public.moderation_reports (
  id,
  legacy_report_key,
  report_type,
  reporter_user_id,
  target_user_id,
  reason,
  details,
  snapshot
)
values (
  '53000000-0000-4000-8000-000000000003',
  'user:51000000-0000-4000-8000-000000000001:52000000-0000-4000-8000-000000000002',
  'user',
  '51000000-0000-4000-8000-000000000001',
  '52000000-0000-4000-8000-000000000002',
  'Spam',
  'Moderation-only details',
  jsonb_build_object(
    'reporter', jsonb_build_object('id', '51000000-0000-4000-8000-000000000001'),
    'targetUser', jsonb_build_object('id', '52000000-0000-4000-8000-000000000002'),
    'targetType', 'user'
  )
);

select is(
  (select count(*) from public.moderation_reports where id = '53000000-0000-4000-8000-000000000003'),
  1::bigint,
  'the report fixture exists'
);
select is(
  (select count(*) from public.moderation_cases where report_id = '53000000-0000-4000-8000-000000000003'),
  1::bigint,
  'report intake created an auditable case'
);
select lives_ok(
  $$delete from auth.users where id = '52000000-0000-4000-8000-000000000002'$$,
  'a reported target account can be deleted without a target-check deadlock'
);
select ok(
  (
    select target_user_id is null
      and list_id is null
      and list_place_id is null
      and comment_id is null
    from public.moderation_reports
    where id = '53000000-0000-4000-8000-000000000003'
  ),
  'target deletion leaves a valid target tombstone'
);
select ok(
  (
    select snapshot = '{"targetType":"user","tombstoned":true}'::jsonb
      and details is null
      and legacy_report_key = 'tombstoned-target:53000000-0000-4000-8000-000000000003'
    from public.moderation_reports
    where id = '53000000-0000-4000-8000-000000000003'
  ),
  'target deletion minimizes retained report evidence and removes target identifiers'
);
select lives_ok(
  $$delete from auth.users where id = '51000000-0000-4000-8000-000000000001'$$,
  'a reporter account can be deleted without cascading the audit trail'
);
select ok(
  (
    select reporter_user_id is null
      and not (snapshot ? 'reporter')
      and legacy_report_key = 'tombstoned-reporter:53000000-0000-4000-8000-000000000003'
    from public.moderation_reports
    where id = '53000000-0000-4000-8000-000000000003'
  ),
  'reporter deletion anonymizes direct reporter identifiers'
);
select is(
  (select count(*) from public.moderation_cases where report_id = '53000000-0000-4000-8000-000000000003'),
  1::bigint,
  'reporter deletion retains the moderation case'
);
select is(
  (
    select count(*)
    from public.moderation_case_events as event
    join public.moderation_cases as moderation_case on moderation_case.id = event.case_id
    where moderation_case.report_id = '53000000-0000-4000-8000-000000000003'
  ),
  1::bigint,
  'reporter deletion retains the append-only creation event'
);

select * from finish();
rollback;
