begin;

create extension if not exists pgtap with schema extensions;
select plan(19);

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

select has_index('public', 'list_place_comments', 'idx_comments_place_top_level_keyset', 'top-level comments use a keyset index');
select has_index('public', 'list_place_comments', 'idx_comments_parent_keyset', 'comment replies use a parent keyset index');
select has_index('public', 'notifications', 'idx_notifications_recipient_unread', 'unread count uses a partial recipient index');
select has_index('public', 'list_place_photos', 'idx_place_media_storage_ref_ready', 'private media storage refs are indexed');
select has_index('public', 'list_place_photos', 'idx_place_media_url_ready', 'private media URLs are indexed');
select has_index('public', 'list_place_photos', 'idx_place_media_thumbnail_url_ready', 'private media thumbnail URLs are indexed');

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

insert into public.lists (id, owner_id, name, is_public)
values
  ('10000000-0000-0000-0000-000000000011', '10000000-0000-0000-0000-000000000001', 'Private A', false),
  ('10000000-0000-0000-0000-000000000012', '10000000-0000-0000-0000-000000000001', 'Public A', true);

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
