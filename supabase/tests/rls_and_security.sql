begin;

create extension if not exists pgtap with schema extensions;
select plan(57);

select has_table('public', 'account_deletion_jobs', 'account deletion ledger exists');
select ok(
  (select relrowsecurity from pg_class where oid = 'public.account_deletion_jobs'::regclass),
  'account deletion ledger enforces RLS'
);
select ok(
  not has_table_privilege('authenticated', 'public.account_deletion_jobs', 'select'),
  'authenticated users cannot inspect deletion jobs'
);
select ok(
  has_table_privilege('service_role', 'public.account_deletion_jobs', 'select'),
  'service role can process deletion jobs'
);
select ok(
  not has_table_privilege('service_role', 'public.account_deletion_jobs', 'insert'),
  'service role cannot forge deletion jobs outside the lease RPCs'
);
select ok(
  not has_table_privilege('service_role', 'public.account_deletion_jobs', 'update'),
  'service role cannot bypass deletion leases with direct updates'
);
select ok(
  not has_table_privilege('service_role', 'public.account_deletion_jobs', 'delete'),
  'service role cannot erase deletion audit state'
);
select ok(
  not has_table_privilege('service_role', 'public.account_deletion_jobs', 'truncate'),
  'service role cannot truncate deletion audit state'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.can_read_private_place_media(text,text,uuid)',
    'execute'
  ),
  'private media scalar authorization is not client callable'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.can_read_private_place_media_batch(text,text[],uuid)',
    'execute'
  ),
  'private media authorization batch is not client callable'
);
select ok(
  has_function_privilege(
    'service_role',
    'public.can_read_private_place_media_batch(text,text[],uuid)',
    'execute'
  ),
  'private media authorization batch is service callable'
);
select ok(
  to_regprocedure('private.hash_security_identifier(text)') is not null,
  'security identifiers have a one-way hash helper'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.check_account_availability(text,text,uuid)',
    'execute'
  ),
  'anonymous clients cannot enumerate account availability directly'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.check_account_availability(text,text,uuid)',
    'execute'
  ),
  'authenticated clients cannot bypass the auth gateway for availability'
);
select ok(
  has_function_privilege(
    'service_role',
    'public.check_account_availability(text,text,uuid)',
    'execute'
  ),
  'the service-role auth gateway can check availability'
);
select ok(
  not has_column_privilege('authenticated', 'public.profiles', 'email', 'update'),
  'profile email is not client mutable'
);
select ok(
  has_column_privilege('authenticated', 'public.profiles', 'name', 'update'),
  'existing profile name edits remain allowed'
);
select ok(
  has_column_privilege('authenticated', 'public.notifications', 'read', 'update'),
  'recipients can still mark notifications read'
);
select ok(
  not has_column_privilege('authenticated', 'public.notifications', 'message', 'update'),
  'recipients cannot rewrite notification content'
);
select is(
  (
    select count(*)::integer
    from pg_trigger
    where not tgisinternal
      and tgname in (
        'profiles_enforce_client_update_invariants',
        'notifications_enforce_client_update_invariants',
        'list_places_enforce_client_update_invariants',
        'list_reports_enforce_client_update_invariants',
        'list_place_reports_enforce_client_update_invariants'
      )
  ),
  5,
  'client-owned rows have immutable ownership-field triggers'
);
select is(
  char_length(private.hash_security_identifier('raw@example.test')),
  64,
  'security identifier hashes are SHA-256 hex values'
);
select is(
  (
    select allowed
    from public.enforce_edge_rate_limit('test:hash', 'raw@example.test', 60, 2)
  ),
  true,
  'persistent rate limiting accepts a valid request'
);
select is(
  (select count(*) from private.edge_rate_limits where identifier = 'raw@example.test'),
  0::bigint,
  'persistent rate limiting never stores the raw identifier'
);
select is(
  (
    select count(*)
    from private.edge_rate_limits
    where identifier = private.hash_security_identifier('raw@example.test')
  ),
  1::bigint,
  'persistent rate limiting stores only the identifier hash'
);
select is(
  (
    select failure_count
    from public.record_auth_login_failure('guard@example.test', 5, 15, 15)
  ),
  1,
  'the first auth failure is recorded atomically'
);
select is(
  (select count(*) from private.auth_login_guards where normalized_email = 'guard@example.test'),
  0::bigint,
  'login guards never store the canonical email'
);
select is(
  (
    select count(*)
    from private.auth_login_guards
    where normalized_email = private.hash_security_identifier('guard@example.test')
  ),
  1::bigint,
  'login guards store only the canonical email hash'
);
select ok(
  has_function_privilege(
    'authenticated',
    'public.place_comment_threads_page(uuid,timestamptz,uuid,integer)',
    'execute'
  ),
  'comment read model is authenticated callable'
);
select is(
  (
    select count(*)::integer
    from pg_proc
    join pg_namespace on pg_namespace.oid = pg_proc.pronamespace
    where pg_namespace.nspname in ('public', 'private')
      and pg_proc.prosecdef
      and not exists (
        select 1
        from unnest(coalesce(pg_proc.proconfig, array[]::text[])) setting
        where setting like 'search_path=%'
      )
  ),
  0,
  'all security definer functions pin search_path'
);

select ok(
  to_regprocedure('public.contains_objectionable_content(text)') is not null,
  'server-side objectionable-content predicate exists'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.contains_objectionable_content(text)',
    'execute'
  ),
  'moderation predicate is not directly client callable'
);
select ok(
  public.contains_objectionable_content('o r o s p u'),
  'moderation detects whitespace-obfuscated expressions'
);
select ok(
  not public.contains_objectionable_content('Sıcak kahve ve güzel müzik'),
  'moderation keeps ordinary Turkish copy valid'
);
select is(
  (
    select count(*)::integer
    from pg_trigger
    where not tgisinternal
      and tgname in (
        'profiles_enforce_safe_ugc',
        'lists_enforce_safe_ugc',
        'list_places_enforce_safe_ugc',
        'list_place_comments_enforce_safe_ugc'
      )
  ),
  4,
  'all public UGC write tables enforce moderation'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'private.cleanup_expired_edge_security_rows()',
    'execute'
  ),
  'security-row cleanup is not client callable'
);
select is(
  (
    select count(*)::integer
    from pg_trigger
    where not tgisinternal
      and tgname in (
        'request_nonces_cleanup_expired',
        'edge_rate_limits_cleanup_expired'
      )
  ),
  2,
  'nonce and rate-limit expiry use amortized cleanup triggers'
);

select has_index('public', 'list_place_comments', 'idx_comments_place_top_level_keyset', 'top-level comments use a keyset index');
select has_index('public', 'list_place_comments', 'idx_comments_parent_keyset', 'comment replies use a parent keyset index');
select has_index('public', 'notifications', 'idx_notifications_recipient_unread', 'unread count uses a partial recipient index');
select has_index('public', 'list_place_photos', 'idx_place_media_storage_ref_ready', 'private media storage refs are indexed');
select has_index('public', 'list_place_photos', 'idx_place_media_url_ready', 'private media URLs are indexed');
select has_index('public', 'list_place_photos', 'idx_place_media_thumbnail_url_ready', 'private media thumbnail URLs are indexed');
select has_index('public', 'lists', 'idx_lists_cover_image_url', 'private list cover authorization uses an indexed storage URI');
select has_index(
  'public',
  'list_places',
  'idx_list_places_complete_card_location',
  'complete-card location summaries use a normalized lookup index'
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
    '10000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'rls-a@example.test',
    'test',
    timezone('utc', now()),
    '{"provider":"email","providers":["email"]}',
    '{"name":"RLS A","username":"rls_a"}',
    timezone('utc', now()),
    timezone('utc', now())
  ),
  (
    '20000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'rls-b@example.test',
    'test',
    timezone('utc', now()),
    '{"provider":"email","providers":["email"]}',
    '{"name":"RLS B","username":"rls_b"}',
    timezone('utc', now()),
    timezone('utc', now())
  );

select throws_ok(
  $$
    insert into public.lists (owner_id, name, is_public)
    values ('10000000-0000-0000-0000-000000000001', 'o r o s p u', true)
  $$,
  '22023',
  'objectionable_content',
  'database rejects objectionable UGC from a bypassing client'
);

insert into public.lists (id, owner_id, name, is_public, cover_image_url)
values
  (
    '10000000-0000-0000-0000-000000000011',
    '10000000-0000-0000-0000-000000000001',
    'Private A',
    false,
    'sorita-storage://place-media-private/10000000-0000-0000-0000-000000000001/10000000-0000-0000-0000-000000000011/cover-private.jpg'
  ),
  (
    '10000000-0000-0000-0000-000000000012',
    '10000000-0000-0000-0000-000000000001',
    'Public A',
    true,
    'sorita-storage://place-media-private/10000000-0000-0000-0000-000000000001/10000000-0000-0000-0000-000000000012/cover-public.jpg'
  );

select throws_ok(
  $$
    insert into public.lists (owner_id, name, is_public, cover_image_url)
    values (
      '10000000-0000-0000-0000-000000000001',
      'Private public-bucket cover',
      false,
      'sorita-storage://place-media/legacy-public-cover.jpg'
    )
  $$,
  '23514',
  'private list cover must use private storage',
  'a private list cannot retain a public-bucket cover'
);
select throws_ok(
  $$
    insert into public.lists (owner_id, name, is_public, cover_image_url)
    values (
      '10000000-0000-0000-0000-000000000001',
      'Private cross-owner cover',
      false,
      'sorita-storage://place-media-private/20000000-0000-0000-0000-000000000002/forged.jpg'
    )
  $$,
  '42501',
  'private list cover path must be owner scoped',
  'a private list cannot authorize another owner path'
);
select throws_ok(
  $$
    update public.lists
    set cover_image_url = 'sorita-storage://place-media-private/20000000-0000-0000-0000-000000000002/forged-public.jpg'
    where id = '10000000-0000-0000-0000-000000000012'
  $$,
  '42501',
  'private list cover path must be owner scoped',
  'a public list cannot authorize another owner private path'
);

select ok(
  public.can_read_private_place_media(
    'place-media-private',
    '10000000-0000-0000-0000-000000000001/10000000-0000-0000-0000-000000000011/cover-private.jpg',
    '10000000-0000-0000-0000-000000000001'
  ),
  'a list owner can read the private storage cover of a private list'
);
select ok(
  not public.can_read_private_place_media(
    'place-media-private',
    '10000000-0000-0000-0000-000000000001/10000000-0000-0000-0000-000000000011/cover-private.jpg',
    '20000000-0000-0000-0000-000000000002'
  ),
  'another user cannot read a private list cover'
);
select ok(
  public.can_read_private_place_media(
    'place-media-private',
    '10000000-0000-0000-0000-000000000001/10000000-0000-0000-0000-000000000012/cover-public.jpg',
    '20000000-0000-0000-0000-000000000002'
  ),
  'an authenticated reader can read a public list private-storage cover'
);

-- Exercise row visibility independently from the API grants installed outside
-- this transactional pgTAP fixture. The final rollback removes these grants.
grant select on public.lists, public.notifications to authenticated;

select set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000002', true);
set local role authenticated;
select is((select count(*) from public.lists where id = '10000000-0000-0000-0000-000000000011'), 0::bigint, 'user B cannot read user A private list');
select is((select count(*) from public.lists where id = '10000000-0000-0000-0000-000000000012'), 1::bigint, 'user B can read user A public list');
reset role;

insert into public.user_blocks (blocker_user_id, blocked_user_id)
values ('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002');

select ok(
  not public.can_read_private_place_media(
    'place-media-private',
    '10000000-0000-0000-0000-000000000001/10000000-0000-0000-0000-000000000012/cover-public.jpg',
    '20000000-0000-0000-0000-000000000002'
  ),
  'a block relation denies the public list cover signed read'
);

set local role authenticated;
select is((select count(*) from public.lists where id = '10000000-0000-0000-0000-000000000012'), 0::bigint, 'block relation hides public list from user B');
reset role;

insert into public.notifications (recipient_user_id, actor_user_id, type, message)
values (
  '20000000-0000-0000-0000-000000000002',
  null,
  'follow',
  'RLS notification'
);

select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
set local role authenticated;
select is((select count(*) from public.notifications where message = 'RLS notification'), 0::bigint, 'user A cannot read user B notification');
reset role;

select set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000002', true);
set local role authenticated;
select is((select count(*) from public.notifications where message = 'RLS notification'), 1::bigint, 'user B can read own notification');
reset role;

select * from finish();
rollback;
