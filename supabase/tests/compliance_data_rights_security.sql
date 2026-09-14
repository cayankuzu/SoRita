begin;

create extension if not exists pgtap with schema extensions;
select plan(20);

select has_table('public', 'legal_consent_records', 'legal consent receipts are durable');
select has_table('public', 'personal_data_access_log', 'personal-data access has an audit ledger');
select ok(
  (select relrowsecurity from pg_class where oid = 'public.legal_consent_records'::regclass),
  'legal consent receipts enforce RLS'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.personal_data_access_log'::regclass),
  'personal-data access logs enforce RLS'
);
select ok(
  not has_table_privilege('anon', 'public.legal_consent_records', 'select'),
  'anonymous callers cannot inspect consent receipts'
);
select ok(
  not has_table_privilege('authenticated', 'public.legal_consent_records', 'select'),
  'authenticated callers cannot enumerate consent receipts'
);
select ok(
  has_table_privilege('service_role', 'public.legal_consent_records', 'select'),
  'service role can inspect consent evidence for approved operations'
);
select ok(
  not has_function_privilege('authenticated', 'public.build_personal_data_export(uuid)', 'execute'),
  'authenticated callers cannot bypass the personal-data Edge Function'
);
select ok(
  has_function_privilege('service_role', 'public.build_personal_data_export(uuid)', 'execute'),
  'service role can assemble an authenticated subject export'
);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  '40000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'data-rights@example.test',
  'test',
  timezone('utc', now()),
  '{"provider":"email","providers":["email"]}',
  jsonb_build_object(
    'name', 'Data Rights User',
    'username', 'data_rights_user',
    'legal_consent_version', '2026-09-08-terms-community-privacy',
    'legal_consent_documents', jsonb_build_array('terms', 'community', 'privacy', 'kvkk'),
    'legal_consent_at', timezone('utc', now())
  ),
  timezone('utc', now()),
  timezone('utc', now())
);

select is(
  (select count(*) from public.legal_consent_records where user_id = '40000000-0000-0000-0000-000000000001'),
  1::bigint,
  'registration creates exactly one consent receipt'
);
select is(
  (select consent_version from public.legal_consent_records where user_id = '40000000-0000-0000-0000-000000000001'),
  '2026-09-08-terms-community-privacy',
  'consent receipt records the exact legal bundle version'
);
select is(
  (select documents_accepted from public.legal_consent_records where user_id = '40000000-0000-0000-0000-000000000001'),
  array['community', 'kvkk', 'privacy', 'terms']::text[],
  'consent receipt canonicalizes and records every required document'
);

select throws_ok(
  $$
    insert into auth.users (
      id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at
    ) values (
      '40000000-0000-0000-0000-000000000002',
      '00000000-0000-0000-0000-000000000000',
      'authenticated', 'authenticated', 'old-consent@example.test', 'test',
      timezone('utc', now()), '{"provider":"email","providers":["email"]}',
      jsonb_build_object(
        'name', 'Old Consent', 'username', 'old_consent_user',
        'legal_consent_version', '2026-09-08-terms-community-privacy',
        'legal_consent_documents', jsonb_build_array('community', 'kvkk', 'privacy', 'terms'),
        'legal_consent_at', timezone('utc', now()) - interval '25 hours'
      ),
      timezone('utc', now()), timezone('utc', now())
    )
  $$,
  '22023',
  'legal_consent_timestamp_invalid',
  'stale client consent timestamps fail closed'
);
select throws_ok(
  $$
    insert into auth.users (
      id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at
    ) values (
      '40000000-0000-0000-0000-000000000003',
      '00000000-0000-0000-0000-000000000000',
      'authenticated', 'authenticated', 'future-consent@example.test', 'test',
      timezone('utc', now()), '{"provider":"email","providers":["email"]}',
      jsonb_build_object(
        'name', 'Future Consent', 'username', 'future_consent_user',
        'legal_consent_version', '2026-09-08-terms-community-privacy',
        'legal_consent_documents', jsonb_build_array('community', 'kvkk', 'privacy', 'terms'),
        'legal_consent_at', timezone('utc', now()) + interval '6 minutes'
      ),
      timezone('utc', now()), timezone('utc', now())
    )
  $$,
  '22023',
  'legal_consent_timestamp_invalid',
  'future client consent timestamps fail closed'
);
select throws_ok(
  $$
    insert into auth.users (
      id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at
    ) values (
      '40000000-0000-0000-0000-000000000004',
      '00000000-0000-0000-0000-000000000000',
      'authenticated', 'authenticated', 'partial-consent@example.test', 'test',
      timezone('utc', now()), '{"provider":"email","providers":["email"]}',
      jsonb_build_object(
        'name', 'Partial Consent', 'username', 'partial_consent_user',
        'legal_consent_version', '2026-09-08-terms-community-privacy',
        'legal_consent_documents', jsonb_build_array('kvkk', 'privacy', 'terms'),
        'legal_consent_at', timezone('utc', now())
      ),
      timezone('utc', now()), timezone('utc', now())
    )
  $$,
  '22023',
  'legal_consent_documents_required',
  'partial legal bundles cannot be represented as consent'
);

create temporary table personal_export_fixture as
select public.build_personal_data_export('40000000-0000-0000-0000-000000000001') as payload;

select is(
  (select (payload ->> 'format_version')::integer from personal_export_fixture),
  2,
  'personal-data export uses the complete versioned contract'
);
select ok(
  (select payload ?& array['account', 'profile', 'legal_consent', 'lists', 'places', 'media', 'comments', 'follows', 'notifications_received', 'reports_submitted'] from personal_export_fixture),
  'personal-data export covers account, content, social, notification and report domains'
);
select ok(
  (select jsonb_typeof(payload -> 'truncated') = 'object' from personal_export_fixture),
  'bounded collections explicitly disclose truncation state'
);
select ok(
  (select payload::text not like '%expo_push_token%' from personal_export_fixture),
  'the export never exposes reusable push credentials'
);
select is(
  (select count(*) from public.personal_data_access_log where user_id = '40000000-0000-0000-0000-000000000001'),
  1::bigint,
  'export assembly creates one auditable data-access record'
);

select * from finish();
rollback;
