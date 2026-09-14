begin;

create extension if not exists pgtap with schema extensions;
select plan(32);

select is(
  (
    select count(*)::integer
    from pg_policies
    where schemaname = 'public'
      and policyname in (
        'moderation_sanction_blocks_list_like_writes',
        'moderation_sanction_blocks_place_like_writes',
        'moderation_sanction_blocks_comment_like_writes',
        'moderation_sanction_blocks_follow_request_writes',
        'moderation_sanction_blocks_place_media_writes'
      )
      and permissive = 'RESTRICTIVE'
  ),
  5,
  'every previously omitted engagement/media table has a restrictive sanction policy'
);

select is(
  (
    select count(*)::integer
    from pg_trigger
    where not tgisinternal
      and tgname = 'reject_sanctioned_actor_mutation'
  ),
  11,
  'the privileged-mutation invariant covers every user content and social table'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'private.upsert_list_place_with_media_implementation(jsonb,jsonb)',
    'execute'
  ),
  'the unguarded atomic place implementation is not an authenticated RPC'
);

select throws_ok(
  $$
    insert into auth.users (
      id, instance_id, aud, role, email, encrypted_password,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at
    ) values (
      '61000000-0000-4000-8000-000000000001',
      '00000000-0000-0000-0000-000000000000',
      'authenticated', 'authenticated', 'consent-less@example.test', 'test',
      '{"provider":"email","providers":["email"]}',
      '{"name":"Consent Less","username":"consent_less"}',
      timezone('utc', now()), timezone('utc', now())
    )
  $$,
  '22023',
  'legal_consent_version_required',
  'a direct signup without any legal metadata fails closed'
);

select throws_ok(
  $$
    insert into auth.users (
      id, instance_id, aud, role, email, encrypted_password,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at
    ) values (
      '61000000-0000-4000-8000-000000000002',
      '00000000-0000-0000-0000-000000000000',
      'authenticated', 'authenticated', 'missing-version@example.test', 'test',
      '{"provider":"email","providers":["email"]}',
      jsonb_build_object(
        'name', 'Missing Version',
        'username', 'missing_version',
        'legal_consent_documents', jsonb_build_array('community', 'kvkk', 'privacy', 'terms'),
        'legal_consent_at', timezone('utc', now())
      ),
      timezone('utc', now()), timezone('utc', now())
    )
  $$,
  '22023',
  'legal_consent_version_required',
  'partial consent metadata cannot omit the exact legal version'
);

select throws_ok(
  $$
    insert into auth.users (
      id, instance_id, aud, role, email, encrypted_password,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at
    ) values (
      '61000000-0000-4000-8000-000000000003',
      '00000000-0000-0000-0000-000000000000',
      'authenticated', 'authenticated', 'invalid-time@example.test', 'test',
      '{"provider":"email","providers":["email"]}',
      jsonb_build_object(
        'name', 'Invalid Time',
        'username', 'invalid_time',
        'legal_consent_version', '2026-09-08-terms-community-privacy',
        'legal_consent_documents', jsonb_build_array('community', 'kvkk', 'privacy', 'terms'),
        'legal_consent_at', 'not-a-timestamp'
      ),
      timezone('utc', now()), timezone('utc', now())
    )
  $$,
  '22023',
  'legal_consent_timestamp_invalid',
  'malformed consent timestamps fail with the stable consent error contract'
);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  (
    '62000000-0000-4000-8000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'compliance-viewer@example.test', 'test',
    timezone('utc', now()),
    '{"provider":"email","providers":["email"]}',
    jsonb_build_object(
      'name', 'Compliance Viewer',
      'username', 'compliance_viewer',
      'legal_consent_version', '2026-09-08-terms-community-privacy',
      'legal_consent_documents', jsonb_build_array('community', 'kvkk', 'privacy', 'terms'),
      'legal_consent_at', timezone('utc', now())
    ),
    timezone('utc', now()), timezone('utc', now())
  ),
  (
    '62000000-0000-4000-8000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'compliance-target@example.test', 'test',
    timezone('utc', now()),
    '{"provider":"email","providers":["email"]}',
    jsonb_build_object(
      'name', 'Compliance Target',
      'username', 'compliance_target',
      'legal_consent_version', '2026-09-08-terms-community-privacy',
      'legal_consent_documents', jsonb_build_array('community', 'kvkk', 'privacy', 'terms'),
      'legal_consent_at', timezone('utc', now())
    ),
    timezone('utc', now()), timezone('utc', now())
  ),
  (
    '62000000-0000-4000-8000-000000000003',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'compliance-third@example.test', 'test',
    timezone('utc', now()),
    '{"provider":"email","providers":["email"]}',
    jsonb_build_object(
      'name', 'Compliance Third',
      'username', 'compliance_third',
      'legal_consent_version', '2026-09-08-terms-community-privacy',
      'legal_consent_documents', jsonb_build_array('community', 'kvkk', 'privacy', 'terms'),
      'legal_consent_at', timezone('utc', now())
    ),
    timezone('utc', now()), timezone('utc', now())
  );

select is(
  (
    select count(*)
    from public.legal_consent_records
    where user_id in (
      '62000000-0000-4000-8000-000000000001',
      '62000000-0000-4000-8000-000000000002',
      '62000000-0000-4000-8000-000000000003'
    )
  ),
  3::bigint,
  'valid account fixtures each produce one exact legal-consent receipt'
);

insert into public.lists (id, owner_id, name, is_public)
values
  (
    '63000000-0000-4000-8000-000000000001',
    '62000000-0000-4000-8000-000000000001',
    'Viewer List One',
    true
  ),
  (
    '63000000-0000-4000-8000-000000000002',
    '62000000-0000-4000-8000-000000000001',
    'Viewer List Two',
    true
  ),
  (
    '63000000-0000-4000-8000-000000000003',
    '62000000-0000-4000-8000-000000000002',
    'Target List',
    true
  );

insert into public.list_places (
  id, list_id, created_by, name, lat, lng, source_user_id, source_place_name
)
values
  (
    '64000000-0000-4000-8000-000000000001',
    '63000000-0000-4000-8000-000000000001',
    '62000000-0000-4000-8000-000000000001',
    'Viewer Place One', 41.01, 29.01, null, null
  ),
  (
    '64000000-0000-4000-8000-000000000002',
    '63000000-0000-4000-8000-000000000002',
    '62000000-0000-4000-8000-000000000001',
    'Viewer Place Two', 41.02, 29.02, null, null
  ),
  (
    '64000000-0000-4000-8000-000000000003',
    '63000000-0000-4000-8000-000000000003',
    '62000000-0000-4000-8000-000000000002',
    'Target Quote', 41.03, 29.03,
    '62000000-0000-4000-8000-000000000001', 'Viewer Source'
  );

insert into public.list_place_comments (id, list_place_id, user_id, content)
values
  (
    '65000000-0000-4000-8000-000000000001',
    '64000000-0000-4000-8000-000000000001',
    '62000000-0000-4000-8000-000000000001',
    'Viewer comment one'
  ),
  (
    '65000000-0000-4000-8000-000000000002',
    '64000000-0000-4000-8000-000000000002',
    '62000000-0000-4000-8000-000000000001',
    'Viewer comment two'
  );

insert into public.list_place_photos (
  id, list_place_id, url, storage_bucket, storage_path, asset_owner_id,
  asset_state, uploaded_at
)
values (
  '66000000-0000-4000-8000-000000000001',
  '64000000-0000-4000-8000-000000000001',
  'sorita-storage://place-media-private/62000000-0000-4000-8000-000000000002/compliance/photo.jpg',
  'place-media-private',
  '62000000-0000-4000-8000-000000000002/compliance/photo.jpg',
  '62000000-0000-4000-8000-000000000002',
  'ready',
  timezone('utc', now())
);

insert into public.list_likes (list_id, user_id)
values (
  '63000000-0000-4000-8000-000000000001',
  '62000000-0000-4000-8000-000000000002'
);

insert into public.list_place_likes (list_place_id, user_id)
values (
  '64000000-0000-4000-8000-000000000001',
  '62000000-0000-4000-8000-000000000002'
);

insert into public.list_place_comment_likes (comment_id, user_id)
values (
  '65000000-0000-4000-8000-000000000001',
  '62000000-0000-4000-8000-000000000002'
);

insert into public.follow_requests (
  id, requester_id, target_user_id, status
)
values (
  '67000000-0000-4000-8000-000000000001',
  '62000000-0000-4000-8000-000000000001',
  '62000000-0000-4000-8000-000000000002',
  'pending'
);

insert into public.moderation_reports (
  id, legacy_report_key, report_type, reporter_user_id, target_user_id,
  reason, snapshot
)
values (
  '68000000-0000-4000-8000-000000000001',
  'user:62000000-0000-4000-8000-000000000001:62000000-0000-4000-8000-000000000002',
  'user',
  '62000000-0000-4000-8000-000000000001',
  '62000000-0000-4000-8000-000000000002',
  'Compliance sanction fixture',
  '{}'::jsonb
);

select is(
  (
    select status
    from public.moderation_transition_case(
      (
        select id from public.moderation_cases
        where report_id = '68000000-0000-4000-8000-000000000001'
      ),
      'review',
      'ops:compliance-test',
      'Review compliance fixture',
      'compliance-review-0001'
    )
  ),
  'in_review',
  'the compliance fixture enters review before enforcement'
);

select is(
  (
    select status
    from public.moderation_transition_case(
      (
        select id from public.moderation_cases
        where report_id = '68000000-0000-4000-8000-000000000001'
      ),
      'sanction',
      'ops:compliance-test',
      'Enforce compliance fixture',
      'compliance-sanction-0001',
      null,
      'evidence://compliance/sanction-0001'
    )
  ),
  'actioned',
  'the target account receives an active enforced sanction'
);

select set_config(
  'request.jwt.claims',
  '{"role":"authenticated","sub":"62000000-0000-4000-8000-000000000001"}',
  true
);
set local role authenticated;

select is(
  (select count(*) from public.list_likes where user_id = '62000000-0000-4000-8000-000000000002'),
  0::bigint,
  'a sanctioned user list-like is hidden'
);
select is(
  (select count(*) from public.list_place_likes where user_id = '62000000-0000-4000-8000-000000000002'),
  0::bigint,
  'a sanctioned user place-like is hidden'
);
select is(
  (select count(*) from public.list_place_comment_likes where user_id = '62000000-0000-4000-8000-000000000002'),
  0::bigint,
  'a sanctioned user comment-like is hidden'
);
select is(
  (select count(*) from public.follow_requests where id = '67000000-0000-4000-8000-000000000001'),
  0::bigint,
  'a follow request involving a sanctioned account is hidden'
);
select is(
  (select count(*) from public.list_place_photos where id = '66000000-0000-4000-8000-000000000001'),
  0::bigint,
  'media owned by a sanctioned account is hidden even on another user list'
);

reset role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
set local role service_role;

select is(
  public.can_read_private_place_media(
    'place-media-private',
    '62000000-0000-4000-8000-000000000002/compliance/photo.jpg',
    '62000000-0000-4000-8000-000000000001'
  ),
  false,
  'the service-role media signer cannot bypass sanctioned asset visibility'
);

reset role;
select set_config(
  'request.jwt.claims',
  '{"role":"authenticated","sub":"62000000-0000-4000-8000-000000000002"}',
  true
);
set local role authenticated;

select throws_ok(
  $$
    insert into public.list_likes (list_id, user_id)
    values (
      '63000000-0000-4000-8000-000000000002',
      '62000000-0000-4000-8000-000000000002'
    )
  $$,
  '42501',
  'active_moderation_sanction',
  'a sanctioned actor cannot directly add a list like'
);
select throws_ok(
  $$
    insert into public.list_place_likes (list_place_id, user_id)
    values (
      '64000000-0000-4000-8000-000000000002',
      '62000000-0000-4000-8000-000000000002'
    )
  $$,
  '42501',
  'active_moderation_sanction',
  'a sanctioned actor cannot directly add a place like'
);
select throws_ok(
  $$
    insert into public.list_place_comment_likes (comment_id, user_id)
    values (
      '65000000-0000-4000-8000-000000000002',
      '62000000-0000-4000-8000-000000000002'
    )
  $$,
  '42501',
  'active_moderation_sanction',
  'a sanctioned actor cannot directly add a comment like'
);
select throws_ok(
  $$
    insert into public.follow_requests (requester_id, target_user_id)
    values (
      '62000000-0000-4000-8000-000000000002',
      '62000000-0000-4000-8000-000000000003'
    )
  $$,
  '42501',
  'active_moderation_sanction',
  'a sanctioned actor cannot directly create a follow request'
);
select throws_ok(
  $$
    insert into public.list_place_photos (list_place_id, url)
    values (
      '64000000-0000-4000-8000-000000000003',
      'https://example.test/sanctioned-upload.jpg'
    )
  $$,
  '42501',
  'active_moderation_sanction',
  'a sanctioned actor cannot directly mutate place media'
);

select throws_ok(
  $$select public.toggle_list_place_like('64000000-0000-4000-8000-000000000002')$$,
  '42501',
  'active_moderation_sanction',
  'the privileged place-like toggle enforces the sanction'
);
select throws_ok(
  $$select public.toggle_list_place_comment_like('65000000-0000-4000-8000-000000000002')$$,
  '42501',
  'active_moderation_sanction',
  'the privileged comment-like toggle enforces the sanction'
);
select throws_ok(
  $$select public.respond_to_follow_request('67000000-0000-4000-8000-000000000001', 'accept')$$,
  '42501',
  'active_moderation_sanction',
  'the privileged follow-request response enforces the sanction'
);
select throws_ok(
  $$select public.upsert_list_place_with_media('{}'::jsonb, '[]'::jsonb)$$,
  '42501',
  'active_moderation_sanction',
  'the atomic place/media upsert enforces the sanction before payload handling'
);
select throws_ok(
  $$
    select public.create_place_quote_notification(
      '62000000-0000-4000-8000-000000000001',
      'quoted',
      '63000000-0000-4000-8000-000000000003',
      '64000000-0000-4000-8000-000000000003'
    )
  $$,
  '42501',
  'active_moderation_sanction',
  'the independently callable quote-notification mutation enforces the sanction'
);

reset role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
set local role service_role;

select throws_ok(
  $$
    select * from public.begin_media_upload_session(
      '69000000-0000-4000-8000-000000000001',
      '62000000-0000-4000-8000-000000000002',
      'place-media-private',
      '62000000-0000-4000-8000-000000000002/pending/compliance.jpg',
      'place-media-private',
      '62000000-0000-4000-8000-000000000002/compliance.jpg',
      'image/jpeg',
      1024,
      '69000000-0000-4000-8000-000000000002'
    )
  $$,
  '42501',
  'active_moderation_sanction',
  'media upload issuance rejects a sanctioned authenticated subject'
);

reset role;
select set_config('request.jwt.claims', '', true);

insert into public.personal_data_access_log (user_id, request_type, requested_at)
select
  '62000000-0000-4000-8000-000000000001',
  'export',
  timezone('utc', now()) - make_interval(secs => sequence_number)
from generate_series(1, 1001) as entries(sequence_number);

create temporary table compliance_export_fixture as
select public.build_personal_data_export(
  '62000000-0000-4000-8000-000000000001'
) as payload;

select is(
  (select (payload ->> 'collection_limit')::integer from compliance_export_fixture),
  1000,
  'the export retains a fixed per-collection row bound'
);
select ok(
  (
    select (payload -> 'truncated') ?& array[
      'lists',
      'places',
      'media',
      'comments',
      'list_likes',
      'place_likes',
      'comment_likes',
      'follows',
      'follow_requests',
      'blocks',
      'notifications_received',
      'push_registrations',
      'reports_submitted',
      'data_access_history'
    ]
    from compliance_export_fixture
  ),
  'every bounded export collection has a mirrored truncation entry'
);
select ok(
  (
    select (payload -> 'truncated' -> 'follows') ?& array['following', 'followers']
    from compliance_export_fixture
  ),
  'both independently bounded follow collections disclose truncation'
);
select is(
  (
    select jsonb_array_length(payload -> 'data_access_history')
    from compliance_export_fixture
  ),
  1000,
  'an oversized export collection is capped at exactly the published limit'
);
select is(
  (
    select (payload -> 'truncated' ->> 'data_access_history')::boolean
    from compliance_export_fixture
  ),
  true,
  'an oversized export collection explicitly reports that it was truncated'
);
select ok(
  (
    select not exists (
      select 1
      from jsonb_each(payload -> 'truncated') as entry(key, value)
      where entry.key <> 'follows'
        and jsonb_typeof(entry.value) <> 'boolean'
    )
    from compliance_export_fixture
  ),
  'all top-level collection truncation indicators are booleans'
);

select * from finish();
rollback;
