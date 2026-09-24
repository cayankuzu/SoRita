begin;

create extension if not exists pgtap with schema extensions;
select plan(12);

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
select
  fixture.id,
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  fixture.email,
  'test',
  timezone('utc', now()),
  '{"provider":"email","providers":["email"]}',
  jsonb_build_object(
    'name', fixture.name,
    'username', fixture.username,
    'legal_consent_version', '2026-09-08-terms-community-privacy',
    'legal_consent_documents', jsonb_build_array('community', 'kvkk', 'privacy', 'terms'),
    'legal_consent_at', timezone('utc', now())
  ),
  timezone('utc', now()),
  timezone('utc', now())
from (
  values
    ('81000000-0000-4000-8000-000000000001'::uuid, 'search-viewer@example.test', 'Arayan', 'arayan'),
    ('81000000-0000-4000-8000-000000000002'::uuid, 'search-followed@example.test', 'Takip Edilen', 'takip_edilen'),
    ('81000000-0000-4000-8000-000000000003'::uuid, 'search-stranger@example.test', 'Yabancı', 'yabanci'),
    ('81000000-0000-4000-8000-000000000004'::uuid, 'search-private@example.test', 'Kahveci Deniz', 'kahveci_deniz')
) as fixture(id, email, name, username);

update public.profiles
set is_public_account = false
where id = '81000000-0000-4000-8000-000000000004';

insert into public.user_follows (follower_id, following_id)
values ('81000000-0000-4000-8000-000000000001', '81000000-0000-4000-8000-000000000002');

insert into public.lists (id, owner_id, name, description, is_public, updated_at)
values
  (
    '82000000-0000-4000-8000-000000000001',
    '81000000-0000-4000-8000-000000000002',
    'Kahve Durağı',
    null,
    true,
    timezone('utc', now()) - interval '1 day'
  ),
  (
    '82000000-0000-4000-8000-000000000002',
    '81000000-0000-4000-8000-000000000003',
    'Hafta sonu',
    'Kahve ve tatlı durakları',
    true,
    timezone('utc', now())
  ),
  (
    '82000000-0000-4000-8000-000000000003',
    '81000000-0000-4000-8000-000000000001',
    'Kahvecilerim',
    null,
    true,
    timezone('utc', now())
  );

insert into public.list_places (id, list_id, created_by, name, lat, lng, category, categories)
values (
  '83000000-0000-4000-8000-000000000001',
  '82000000-0000-4000-8000-000000000002',
  '81000000-0000-4000-8000-000000000003',
  'Mola',
  41.02,
  29.02,
  'cafe',
  array['cafe']
);

select set_config('request.jwt.claim.sub', '81000000-0000-4000-8000-000000000001', true);
set local role authenticated;

select ok(
  exists (
    select 1 from public.explore_page('lists', 'kahve', null, null, 20)
    where item_id = '82000000-0000-4000-8000-000000000001'
  ),
  'a search finds a list by someone the viewer follows'
);

select ok(
  not exists (
    select 1 from public.explore_page('lists', '', null, null, 20)
    where item_id = '82000000-0000-4000-8000-000000000001'
  ),
  'browsing without a query still leaves followed people to the home feed'
);

select ok(
  exists (
    select 1 from public.explore_page('lists', 'kahve', null, null, 20)
    where item_id = '82000000-0000-4000-8000-000000000003'
  ),
  'a search finds the viewer''s own public list'
);

select ok(
  (
    select rank from public.explore_page('lists', 'kahve', null, null, 20)
    where item_id = '82000000-0000-4000-8000-000000000001'
  ) > (
    select rank from public.explore_page('lists', 'kahve', null, null, 20)
    where item_id = '82000000-0000-4000-8000-000000000002'
  ),
  'a name starting with the query outranks a newer description match'
);

select ok(
  exists (
    select 1 from public.explore_page('places', 'kafe', null, null, 20)
    where item_id = '83000000-0000-4000-8000-000000000001'
  ),
  'a place is found by its category''s Turkish label'
);

select ok(
  exists (
    select 1 from public.explore_page('places', 'cafe', null, null, 20)
    where item_id = '83000000-0000-4000-8000-000000000001'
  ),
  'a place is still found by its category key'
);

select ok(
  exists (
    select 1 from public.explore_page('users', 'kahveci', null, null, 20)
    where item_id = '81000000-0000-4000-8000-000000000004'
  ),
  'people search finds a private account'
);

select ok(
  exists (
    select 1 from public.explore_page('users', 'takip', null, null, 20)
    where item_id = '81000000-0000-4000-8000-000000000002'
  ),
  'people search finds someone the viewer follows'
);

select ok(
  not exists (
    select 1 from public.explore_page('users', '', null, null, 20)
    where item_id in (
      '81000000-0000-4000-8000-000000000002',
      '81000000-0000-4000-8000-000000000004'
    )
  ),
  'people suggestions still leave out followed and private accounts'
);

select is(
  (select count(*)::integer from public.explore_page('lists', 'ka', null, null, 20)),
  0,
  'two characters are not searched; the app asks for a third'
);

reset role;

select ok(
  not has_function_privilege(
    'anon',
    'public.explore_page(text, text, double precision, uuid, integer)',
    'execute'
  ),
  'signed-out callers cannot search Explore'
);

select ok(
  not has_function_privilege(
    'anon',
    'private.place_category_search_text(text, text[])',
    'execute'
  ),
  'signed-out callers cannot call the category search helper'
);

select * from finish();
rollback;
