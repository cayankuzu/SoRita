begin;

create extension if not exists pgtap with schema extensions;
select plan(6);

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
    '71000000-0000-4000-8000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'comment-owner@example.test',
    'test',
    timezone('utc', now()),
    '{"provider":"email","providers":["email"]}',
    jsonb_build_object(
      'name', 'Liste Sahibi',
      'username', 'liste_sahibi',
      'legal_consent_version', '2026-09-08-terms-community-privacy',
      'legal_consent_documents', jsonb_build_array('community', 'kvkk', 'privacy', 'terms'),
      'legal_consent_at', timezone('utc', now())
    ),
    timezone('utc', now()),
    timezone('utc', now())
  ),
  (
    '71000000-0000-4000-8000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'comment-replier@example.test',
    'test',
    timezone('utc', now()),
    '{"provider":"email","providers":["email"]}',
    jsonb_build_object(
      'name', 'Yanıtlayan',
      'username', 'yanitlayan',
      'legal_consent_version', '2026-09-08-terms-community-privacy',
      'legal_consent_documents', jsonb_build_array('community', 'kvkk', 'privacy', 'terms'),
      'legal_consent_at', timezone('utc', now())
    ),
    timezone('utc', now()),
    timezone('utc', now())
  );

insert into public.lists (id, owner_id, name, is_public)
values (
  '72000000-0000-4000-8000-000000000001',
  '71000000-0000-4000-8000-000000000001',
  'Kafeler',
  true
);

insert into public.list_places (id, list_id, created_by, name, lat, lng)
values (
  '73000000-0000-4000-8000-000000000001',
  '72000000-0000-4000-8000-000000000001',
  '71000000-0000-4000-8000-000000000001',
  'Kloft',
  41.01,
  29.01
);

insert into public.list_place_comments (id, list_place_id, user_id, parent_comment_id, content, created_at)
values
  (
    '74000000-0000-4000-8000-000000000001',
    '73000000-0000-4000-8000-000000000001',
    '71000000-0000-4000-8000-000000000001',
    null,
    'Kedileri çok güler yüzlü.',
    timezone('utc', now()) - interval '2 minutes'
  ),
  (
    '74000000-0000-4000-8000-000000000002',
    '73000000-0000-4000-8000-000000000001',
    '71000000-0000-4000-8000-000000000002',
    '74000000-0000-4000-8000-000000000001',
    'Katılıyorum.',
    timezone('utc', now()) - interval '1 minute'
  );

select set_config('request.jwt.claim.sub', '71000000-0000-4000-8000-000000000002', true);
set local role authenticated;

select is(
  (
    select count(*)::integer
    from public.place_comment_threads_page('73000000-0000-4000-8000-000000000001')
  ),
  2,
  'a thread page returns the comment and its reply'
);

select is(
  (
    select author_name
    from public.place_comment_threads_page('73000000-0000-4000-8000-000000000001')
    where id = '74000000-0000-4000-8000-000000000001'
  ),
  'Liste Sahibi',
  'each comment carries its author name, so the sheet needs no user download'
);

select is(
  (
    select author_username
    from public.place_comment_threads_page('73000000-0000-4000-8000-000000000001')
    where id = '74000000-0000-4000-8000-000000000002'
  ),
  'yanitlayan',
  'a reply carries its own author username'
);

select is(
  (
    select array_agg(id order by ordinality)::text
    from public.place_comment_threads_page('73000000-0000-4000-8000-000000000001')
      with ordinality
  ),
  '{74000000-0000-4000-8000-000000000001,74000000-0000-4000-8000-000000000002}',
  'the comment comes before its reply'
);

reset role;

select ok(
  has_function_privilege('authenticated', 'public.place_comment_threads_page(uuid, timestamptz, uuid, integer)', 'execute'),
  'signed-in viewers can read comment threads'
);

select ok(
  not has_function_privilege('anon', 'public.place_comment_threads_page(uuid, timestamptz, uuid, integer)', 'execute'),
  'signed-out callers cannot read comment threads'
);

select * from finish();
rollback;
