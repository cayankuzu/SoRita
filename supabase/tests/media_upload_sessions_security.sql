begin;

create extension if not exists pgtap with schema extensions;
select plan(33);

select has_table(
  'private',
  'media_upload_sessions',
  'signed-upload state is kept in a private ledger'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'private.media_upload_sessions'::regclass),
  'signed-upload ledger enforces RLS'
);
select ok(
  not has_table_privilege('anon', 'private.media_upload_sessions', 'select'),
  'anonymous callers cannot read signed-upload sessions'
);
select ok(
  not has_table_privilege('authenticated', 'private.media_upload_sessions', 'select'),
  'authenticated callers cannot read signed-upload sessions'
);
select ok(
  not has_table_privilege('service_role', 'private.media_upload_sessions', 'select'),
  'service-role callers use constrained RPCs instead of raw session reads'
);
select ok(
  to_regprocedure(
    'public.begin_media_upload_session(uuid,uuid,text,text,text,text,text,bigint,uuid)'
  ) is not null,
  'initialization-bound begin-upload RPC has the expected signature'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.begin_media_upload_session(uuid,uuid,text,text,text,text,text,bigint,uuid)',
    'execute'
  ),
  'anonymous callers cannot begin signed uploads directly'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.begin_media_upload_session(uuid,uuid,text,text,text,text,text,bigint,uuid)',
    'execute'
  ),
  'authenticated callers cannot bypass the media Edge Function'
);
select ok(
  has_function_privilege(
    'service_role',
    'public.begin_media_upload_session(uuid,uuid,text,text,text,text,text,bigint,uuid)',
    'execute'
  ),
  'service role can begin signed uploads through the constrained RPC'
);
select ok(
  to_regprocedure('public.abort_media_upload_session_initialization(uuid,uuid,uuid,text)') is not null,
  'initialization abort RPC requires its issuance identifier'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.abort_media_upload_session_initialization(uuid,uuid,uuid,text)',
    'execute'
  ),
  'authenticated callers cannot cancel upload sessions directly'
);
select ok(
  has_function_privilege(
    'service_role',
    'public.abort_media_upload_session_initialization(uuid,uuid,uuid,text)',
    'execute'
  ),
  'service role can cancel only a matching initialization issuance'
);
select ok(
  to_regprocedure('public.complete_media_upload_session_finalize(uuid,uuid,uuid)') is not null,
  'finalize completion is lease-bound'
);
select ok(
  to_regprocedure('public.claim_media_upload_session_cleanup(uuid,uuid,uuid,integer)') is not null,
  'per-user cleanup claim is lease-bound'
);
select ok(
  to_regprocedure('public.list_stale_media_upload_sessions(integer)') is not null,
  'bounded stale-session inventory RPC exists'
);
select ok(
  to_regprocedure('public.claim_stale_media_upload_sessions(uuid,integer,integer)') is not null,
  'bounded automatic stale-session claim RPC exists'
);
select is(
  (
    select count(*)::integer
    from pg_trigger
    where not tgisinternal
      and tgrelid = 'public.profiles'::regclass
      and tgname = 'profiles_media_upload_reference_gate'
  ),
  1,
  'profile media writes are guarded by upload-session state'
);
select is(
  (
    select count(*)::integer
    from pg_trigger
    where not tgisinternal
      and tgrelid = 'public.list_place_photos'::regclass
      and tgname = 'list_place_photos_media_upload_reference_gate'
  ),
  1,
  'place media writes are guarded by upload-session state'
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
  '73000000-0000-4000-8000-000000000001',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'media-session@example.test',
  'test',
  timezone('utc', now()),
  '{"provider":"email","providers":["email"]}',
  '{"name":"Media Session","username":"media_session"}',
  timezone('utc', now()),
  timezone('utc', now())
);

select is(
  (
    select initialization_id
    from public.begin_media_upload_session(
      '73000000-0000-4000-8000-000000000010',
      '73000000-0000-4000-8000-000000000001',
      'place-media-private',
      '73000000-0000-4000-8000-000000000001/pending-public/place-media/reissue.png',
      'place-media',
      '73000000-0000-4000-8000-000000000001/reissue.png',
      'image/png',
      1024,
      '73000000-0000-4000-8000-000000000011'
    )
  ),
  '73000000-0000-4000-8000-000000000011'::uuid,
  'begin records the initialization issuance identifier'
);
select is(
  (
    select initialization_id
    from public.begin_media_upload_session(
      '73000000-0000-4000-8000-000000000010',
      '73000000-0000-4000-8000-000000000001',
      'place-media-private',
      '73000000-0000-4000-8000-000000000001/pending-public/place-media/reissue.png',
      'place-media',
      '73000000-0000-4000-8000-000000000001/reissue.png',
      'image/png',
      1024,
      '73000000-0000-4000-8000-000000000012'
    )
  ),
  '73000000-0000-4000-8000-000000000012'::uuid,
  'a signed URL reissue advances the initialization issuance identifier'
);
select is(
  public.abort_media_upload_session_initialization(
    '73000000-0000-4000-8000-000000000010',
    '73000000-0000-4000-8000-000000000001',
    '73000000-0000-4000-8000-000000000011',
    'old signed URL request failed'
  ),
  false,
  'a stale initialization cannot cancel a newer signed URL issuance'
);
select is(
  (
    select status
    from private.media_upload_sessions
    where session_id = '73000000-0000-4000-8000-000000000010'
  ),
  'pending',
  'the newer signed URL issuance remains pending'
);
select is(
  public.abort_media_upload_session_initialization(
    '73000000-0000-4000-8000-000000000010',
    '73000000-0000-4000-8000-000000000001',
    '73000000-0000-4000-8000-000000000012',
    'current signed URL request failed'
  ),
  true,
  'the current initialization can cancel its pending session'
);
select is(
  (
    select status
    from private.media_upload_sessions
    where session_id = '73000000-0000-4000-8000-000000000010'
  ),
  'cancelled',
  'a matching initialization moves the session to cancelled'
);
select is(
  (
    select claim_status
    from public.claim_media_upload_session_cleanup(
      '73000000-0000-4000-8000-000000000010',
      '73000000-0000-4000-8000-000000000001',
      '73000000-0000-4000-8000-000000000013',
      90
    )
  ),
  'claimed',
  'cleanup exclusively claims the cancelled session'
);
select is(
  (
    select claim_status
    from public.claim_media_upload_session_finalize(
      '73000000-0000-4000-8000-000000000010',
      '73000000-0000-4000-8000-000000000001',
      '73000000-0000-4000-8000-000000000014',
      90
    )
  ),
  'busy',
  'an active cleanup lease blocks finalization'
);
select throws_ok(
  $$select * from public.list_stale_media_upload_sessions(null)$$,
  'P0001',
  'invalid media upload cleanup limit',
  'a null stale-session limit cannot become an unbounded inventory'
);
select throws_ok(
  $$
    select *
    from public.claim_media_upload_session_cleanup(
      '73000000-0000-4000-8000-000000000010',
      '73000000-0000-4000-8000-000000000001',
      '73000000-0000-4000-8000-000000000015',
      null
    )
  $$,
  'P0001',
  'invalid media upload cleanup claim',
  'a null cleanup lease duration is rejected'
);

select lives_ok(
  $$
    select *
    from public.begin_media_upload_session(
      '73000000-0000-4000-8000-000000000020',
      '73000000-0000-4000-8000-000000000001',
      'place-media-private',
      '73000000-0000-4000-8000-000000000001/pending-public/place-media/normalization.png',
      'place-media',
      '73000000-0000-4000-8000-000000000001/normalization.png',
      'image/png',
      1024,
      '73000000-0000-4000-8000-000000000021'
    )
  $$,
  'a pending destination fixture is created'
);
select throws_ok(
  $$
    update public.profiles
    set profile_photo_url = E' \n sorita-storage://place-media/73000000-0000-4000-8000-000000000001/normalization.png\t'
    where id = '73000000-0000-4000-8000-000000000001'
  $$,
  '55000',
  'media upload destination is not referenceable',
  'control-character padding cannot bypass the pending-upload reference gate'
);
update private.media_upload_sessions
set
  status = 'finalized',
  finalized_at = timezone('utc', now()),
  next_cleanup_at = retire_after
where session_id = '73000000-0000-4000-8000-000000000020';
select lives_ok(
  $$
    update public.profiles
    set profile_photo_url = E' \n sorita-storage://place-media/73000000-0000-4000-8000-000000000001/normalization.png\t'
    where id = '73000000-0000-4000-8000-000000000001'
  $$,
  'a finalized destination can be referenced after the same normalization'
);
select is(
  (
    select profile_photo_url
    from public.profiles
    where id = '73000000-0000-4000-8000-000000000001'
  ),
  'sorita-storage://place-media/73000000-0000-4000-8000-000000000001/normalization.png',
  'the persisted profile reference is canonicalized'
);
update private.media_upload_sessions
set
  status = 'sweeping',
  cleanup_previous_status = 'finalized',
  cleanup_lease_id = '73000000-0000-4000-8000-000000000022',
  cleanup_lease_expires_at = timezone('utc', now()) + interval '5 minutes'
where session_id = '73000000-0000-4000-8000-000000000020';
select throws_ok(
  $$
    update public.profiles
    set cover_photo_url = 'sorita-storage://place-media/73000000-0000-4000-8000-000000000001/normalization.png'
    where id = '73000000-0000-4000-8000-000000000001'
  $$,
  '55000',
  'media upload destination is not referenceable',
  'an active cleanup lease fails new references closed'
);

select * from finish();
rollback;
