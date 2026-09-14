begin;

create extension if not exists pgtap with schema extensions;
select plan(40);

select ok(
  to_regprocedure('private.is_valid_expo_push_token(text)') is not null,
  'Expo push token validation is centralized in a private helper'
);
select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.user_push_tokens'::regclass
      and conname = 'user_push_tokens_expo_token_format'
      and convalidated
  ),
  'stored push tokens have a validated format constraint'
);
select ok(
  position(
    'http_post' in lower(pg_get_functiondef('private.dispatch_push_notification()'::regprocedure))
  ) = 0,
  'the notification row trigger keeps provider HTTP implementation out of the row callback'
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
    '41000000-0000-4000-8000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'push-pipeline-recipient@example.test',
    'test',
    timezone('utc', now()),
    '{"provider":"email","providers":["email"]}',
    jsonb_build_object(
      'name', 'Pipeline Recipient',
      'username', 'pipeline_recipient',
      'legal_consent_version', '2026-09-08-terms-community-privacy',
      'legal_consent_documents', jsonb_build_array('community', 'kvkk', 'privacy', 'terms'),
      'legal_consent_at', timezone('utc', now())
    ),
    timezone('utc', now()),
    timezone('utc', now())
  ),
  (
    '41000000-0000-4000-8000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'push-pipeline-actor@example.test',
    'test',
    timezone('utc', now()),
    '{"provider":"email","providers":["email"]}',
    jsonb_build_object(
      'name', 'Pipeline Actor',
      'username', 'pipeline_actor',
      'legal_consent_version', '2026-09-08-terms-community-privacy',
      'legal_consent_documents', jsonb_build_array('community', 'kvkk', 'privacy', 'terms'),
      'legal_consent_at', timezone('utc', now())
    ),
    timezone('utc', now()),
    timezone('utc', now())
  ),
  (
    '41000000-0000-4000-8000-000000000003',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'push-pipeline-blocked@example.test',
    'test',
    timezone('utc', now()),
    '{"provider":"email","providers":["email"]}',
    jsonb_build_object(
      'name', 'Pipeline Blocked',
      'username', 'pipeline_blocked',
      'legal_consent_version', '2026-09-08-terms-community-privacy',
      'legal_consent_documents', jsonb_build_array('community', 'kvkk', 'privacy', 'terms'),
      'legal_consent_at', timezone('utc', now())
    ),
    timezone('utc', now()),
    timezone('utc', now())
  ),
  (
    '41000000-0000-4000-8000-000000000004',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'push-pipeline-other@example.test',
    'test',
    timezone('utc', now()),
    '{"provider":"email","providers":["email"]}',
    jsonb_build_object(
      'name', 'Pipeline Other',
      'username', 'pipeline_other',
      'legal_consent_version', '2026-09-08-terms-community-privacy',
      'legal_consent_documents', jsonb_build_array('community', 'kvkk', 'privacy', 'terms'),
      'legal_consent_at', timezone('utc', now())
    ),
    timezone('utc', now()),
    timezone('utc', now())
  );

select set_config('request.jwt.claim.sub', '41000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;
select throws_ok(
  $$select public.upsert_user_push_token('not-an-expo-token', 'android')$$,
  'P0001',
  'Invalid push token',
  'the legacy registration RPC rejects malformed provider tokens'
);
select throws_ok(
  $$
    select public.upsert_user_push_token(
      'not-an-expo-token',
      'android',
      repeat('a', 64)
    )
  $$,
  'P0001',
  'Invalid push token',
  'cleanup-capable registration rejects malformed provider tokens'
);
reset role;

insert into public.user_push_tokens (
  id,
  user_id,
  expo_push_token,
  platform,
  is_active
)
values
  (
    '42000000-0000-4000-8000-000000000001',
    '41000000-0000-4000-8000-000000000001',
    'ExponentPushToken[pipeline-recipient-android]',
    'android',
    true
  ),
  (
    '42000000-0000-4000-8000-000000000002',
    '41000000-0000-4000-8000-000000000001',
    'ExpoPushToken[pipeline_recipient_ios]',
    'ios',
    true
  ),
  (
    '42000000-0000-4000-8000-000000000003',
    '41000000-0000-4000-8000-000000000001',
    'ExponentPushToken[pipeline-recipient-inactive]',
    'android',
    false
  );

insert into public.notifications (
  recipient_user_id,
  actor_user_id,
  type,
  message
)
select
  '41000000-0000-4000-8000-000000000001',
  case
    when notification_type = 'system_announcement' then null
    else '41000000-0000-4000-8000-000000000002'::uuid
  end,
  notification_type,
  'pipeline type:' || notification_type
from unnest(array[
  'like',
  'follow',
  'follow_request',
  'comment',
  'place_added',
  'place_quote',
  'list_liked',
  'comment_like',
  'comment_reply',
  'system_announcement'
]::text[]) as notification_types(notification_type);

select is(
  (
    select count(*)
    from private.push_delivery_jobs
    join public.notifications on notifications.id = push_delivery_jobs.notification_id
    where notifications.message like 'pipeline type:%'
  ),
  20::bigint,
  'every supported notification type creates one job for each active account device'
);
select ok(
  (
    select bool_and(job_count = 2)
    from (
      select notifications.id, count(push_delivery_jobs.id) as job_count
      from public.notifications
      left join private.push_delivery_jobs
        on push_delivery_jobs.notification_id = notifications.id
      where notifications.message like 'pipeline type:%'
      group by notifications.id
    ) as notification_jobs
  ),
  'each eligible notification has complete active-token fan-out'
);
select is(
  (
    select count(*)
    from private.push_delivery_jobs
    where push_token_id = '42000000-0000-4000-8000-000000000003'
  ),
  0::bigint,
  'inactive device tokens never receive outbox jobs'
);
select ok(
  not exists (
    select 1
    from private.push_delivery_jobs
    join public.notifications on notifications.id = push_delivery_jobs.notification_id
    where notifications.message like 'pipeline type:%'
      and (
        (
          notifications.type = 'system_announcement'
          and (
            push_delivery_jobs.status <> 'pending'
            or push_delivery_jobs.send_request_id is not null
          )
        )
        or (
          notifications.type <> 'system_announcement'
          and (
            push_delivery_jobs.status <> 'sending'
            or push_delivery_jobs.send_request_id is null
          )
        )
      )
  ),
  'personal jobs get a scoped immediate kick while broadcast jobs remain cron-driven'
);
select ok(
  not exists (
    select 1
    from private.push_delivery_jobs
    join public.notifications on notifications.id = push_delivery_jobs.notification_id
    where notifications.message like 'pipeline type:%'
      and push_delivery_jobs.payload #>> '{data,deliveryId}' <> push_delivery_jobs.id::text
  ),
  'payload delivery IDs match durable job IDs'
);
select ok(
  not exists (
    select 1
    from private.push_delivery_jobs
    join public.notifications on notifications.id = push_delivery_jobs.notification_id
    where notifications.message like 'pipeline type:%'
      and push_delivery_jobs.payload ->> 'collapseId' <> push_delivery_jobs.id::text
  ),
  'retry payloads use the stable job ID as their cross-platform collapse ID'
);
select ok(
  not exists (
    select 1
    from private.push_delivery_jobs
    join public.notifications on notifications.id = push_delivery_jobs.notification_id
    where notifications.message like 'pipeline type:%'
      and push_delivery_jobs.payload ->> 'tag' <> push_delivery_jobs.id::text
  ),
  'retry payloads replace an already displayed Android copy by stable tag'
);

insert into public.notifications (
  recipient_user_id,
  actor_user_id,
  type,
  message,
  read
)
values (
  '41000000-0000-4000-8000-000000000001',
  '41000000-0000-4000-8000-000000000002',
  'comment',
  'pipeline initially read',
  true
);
select is(
  (
    select count(*)
    from private.push_delivery_jobs
    join public.notifications on notifications.id = push_delivery_jobs.notification_id
    where notifications.message = 'pipeline initially read'
  ),
  0::bigint,
  'an initially read notification does not enqueue remote push'
);

insert into public.notifications (
  recipient_user_id,
  actor_user_id,
  type,
  message
)
values (
  '41000000-0000-4000-8000-000000000001',
  '41000000-0000-4000-8000-000000000001',
  'comment',
  'pipeline self event'
);
select is(
  (
    select count(*)
    from private.push_delivery_jobs
    join public.notifications on notifications.id = push_delivery_jobs.notification_id
    where notifications.message = 'pipeline self event'
  ),
  0::bigint,
  'self notifications cannot enqueue remote push'
);

insert into public.user_blocks (blocker_user_id, blocked_user_id)
values (
  '41000000-0000-4000-8000-000000000001',
  '41000000-0000-4000-8000-000000000003'
);

insert into public.notifications (
  id,
  recipient_user_id,
  actor_user_id,
  type,
  message
)
values (
  '43000000-0000-4000-8000-000000000001',
  '41000000-0000-4000-8000-000000000001',
  '41000000-0000-4000-8000-000000000003',
  'comment',
  'pipeline blocked event'
);
select is(
  (
    select count(*)
    from private.push_delivery_jobs
    where notification_id = '43000000-0000-4000-8000-000000000001'
  ),
  0::bigint,
  'a committed block relation prevents notification fan-out'
);

update private.push_delivery_jobs
set next_attempt_at = timezone('utc', now()) + interval '1 day';

insert into public.notifications (
  id,
  recipient_user_id,
  actor_user_id,
  type,
  message
)
values (
  '43000000-0000-4000-8000-000000000002',
  '41000000-0000-4000-8000-000000000001',
  null,
  'system_announcement',
  'pipeline read before cron dispatch'
);
update public.notifications
set read = true
where id = '43000000-0000-4000-8000-000000000002';
select is(
  private.dispatch_pending_push_jobs(100),
  0,
  'the worker does not send a notification marked read before cron dispatch'
);
select is(
  (
    select count(*)
    from private.push_delivery_jobs
    where notification_id = '43000000-0000-4000-8000-000000000002'
      and status = 'cancelled'
  ),
  2::bigint,
  'read-before-dispatch notification jobs are terminally cancelled'
);

insert into private.push_delivery_jobs (
  id,
  notification_id,
  push_token_id,
  recipient_user_id,
  expo_push_token,
  payload
)
values (
  '44000000-0000-4000-8000-000000000001',
  '43000000-0000-4000-8000-000000000001',
  '42000000-0000-4000-8000-000000000001',
  '41000000-0000-4000-8000-000000000001',
  'ExponentPushToken[pipeline-recipient-android]',
  '{"to":"ExponentPushToken[pipeline-recipient-android]"}'::jsonb
);
select is(
  private.dispatch_pending_push_jobs(100),
  0,
  'the worker does not send a legacy job that violates block eligibility'
);
select is(
  (
    select status
    from private.push_delivery_jobs
    where id = '44000000-0000-4000-8000-000000000001'
  ),
  'cancelled',
  'the worker terminally cancels an ineligible legacy job'
);

select set_config('request.jwt.claim.sub', '41000000-0000-4000-8000-000000000003', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;
select throws_ok(
  $$
    insert into public.user_follows (follower_id, following_id)
    values (
      '41000000-0000-4000-8000-000000000003',
      '41000000-0000-4000-8000-000000000001'
    )
  $$,
  '42501',
  'new row violates row-level security policy for table "user_follows"',
  'blocked users cannot recreate a follow edge with a known UUID'
);
select throws_ok(
  $$
    insert into public.follow_requests (requester_id, target_user_id)
    values (
      '41000000-0000-4000-8000-000000000003',
      '41000000-0000-4000-8000-000000000001'
    )
  $$,
  '42501',
  'new row violates row-level security policy for table "follow_requests"',
  'blocked users cannot create a follow request with a known UUID'
);
reset role;

insert into public.follow_requests (
  id,
  requester_id,
  target_user_id
)
values (
  '45000000-0000-4000-8000-000000000001',
  '41000000-0000-4000-8000-000000000003',
  '41000000-0000-4000-8000-000000000001'
);
select is(
  (
    select count(*)
    from public.notifications
    where follow_request_id = '45000000-0000-4000-8000-000000000001'
  ),
  0::bigint,
  'the follow-request trigger independently suppresses a blocked source row'
);

insert into public.follow_requests (
  id,
  requester_id,
  target_user_id
)
values (
  '45000000-0000-4000-8000-000000000002',
  '41000000-0000-4000-8000-000000000002',
  '41000000-0000-4000-8000-000000000001'
);
select is(
  (
    select count(*)
    from public.notifications
    where follow_request_id = '45000000-0000-4000-8000-000000000002'
      and recipient_user_id = '41000000-0000-4000-8000-000000000001'
      and actor_user_id = '41000000-0000-4000-8000-000000000002'
  ),
  1::bigint,
  'follow-request notification attribution is derived from its source row'
);
select is(
  (
    select count(*)
    from private.push_delivery_jobs
    join public.notifications on notifications.id = push_delivery_jobs.notification_id
    where notifications.follow_request_id = '45000000-0000-4000-8000-000000000002'
  ),
  2::bigint,
  'an eligible follow request fans out to every active recipient device'
);
select throws_ok(
  $$
    insert into public.notifications (
      recipient_user_id,
      actor_user_id,
      type,
      message,
      follow_request_id
    )
    values (
      '41000000-0000-4000-8000-000000000001',
      '41000000-0000-4000-8000-000000000002',
      'follow_request',
      'duplicate source notification',
      '45000000-0000-4000-8000-000000000002'
    )
  $$,
  '23505',
  'duplicate key value violates unique constraint "notifications_follow_request_event_unique"',
  'a follow-request source can create at most one notification'
);

insert into public.lists (id, owner_id, name, is_public)
values
  (
    '46000000-0000-4000-8000-000000000001',
    '41000000-0000-4000-8000-000000000001',
    'Pipeline Source List',
    true
  ),
  (
    '46000000-0000-4000-8000-000000000002',
    '41000000-0000-4000-8000-000000000002',
    'Pipeline Destination List',
    true
  );

select set_config('request.jwt.claim.sub', '41000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;
insert into public.list_places (
  id,
  list_id,
  created_by,
  name,
  lat,
  lng
)
values (
  '47000000-0000-4000-8000-000000000001',
  '46000000-0000-4000-8000-000000000001',
  '41000000-0000-4000-8000-000000000001',
  'Kaynak Mekan',
  41.0,
  29.0
);
reset role;

select set_config('request.jwt.claim.sub', '41000000-0000-4000-8000-000000000002', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;
insert into public.list_places (
  id,
  list_id,
  created_by,
  source_list_id,
  source_place_id,
  source_user_id,
  source_place_name,
  name,
  lat,
  lng
)
values (
  '47000000-0000-4000-8000-000000000002',
  '46000000-0000-4000-8000-000000000002',
  '41000000-0000-4000-8000-000000000002',
  '46000000-0000-4000-8000-000000000001',
  '47000000-0000-4000-8000-000000000001',
  '41000000-0000-4000-8000-000000000004',
  'Forged Name',
  'Quoted Place',
  41.1,
  29.1
);
reset role;

select is(
  (
    select count(*)
    from public.notifications
    where type = 'place_quote'
      and list_place_id = '47000000-0000-4000-8000-000000000002'
      and list_id = '46000000-0000-4000-8000-000000000002'
      and recipient_user_id = '41000000-0000-4000-8000-000000000001'
      and actor_user_id = '41000000-0000-4000-8000-000000000002'
  ),
  1::bigint,
  'quote notification attribution comes from authoritative place provenance'
);
select is(
  (
    select count(*)
    from private.push_delivery_jobs
    join public.notifications on notifications.id = push_delivery_jobs.notification_id
    where notifications.type = 'place_quote'
      and notifications.list_place_id = '47000000-0000-4000-8000-000000000002'
  ),
  2::bigint,
  'an authoritative quote notification fans out to every active device'
);
select is(
  (
    select message
    from public.notifications
    where type = 'place_quote'
      and list_place_id = '47000000-0000-4000-8000-000000000002'
  ),
  '"Kaynak Mekan" mekanını kendi listesine alıntıladı',
  'quote notification content is server derived'
);

select set_config('request.jwt.claim.sub', '41000000-0000-4000-8000-000000000002', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;
select lives_ok(
  $$
    select public.create_place_quote_notification(
      '41000000-0000-4000-8000-000000000001',
      'client supplied content must not win',
      '46000000-0000-4000-8000-000000000002',
      '47000000-0000-4000-8000-000000000002'
    )
  $$,
  'a valid place-quote RPC retry is accepted idempotently'
);
select throws_ok(
  $$
    select public.create_place_quote_notification(
      '41000000-0000-4000-8000-000000000004',
      'forged recipient',
      '46000000-0000-4000-8000-000000000002',
      '47000000-0000-4000-8000-000000000002'
    )
  $$,
  '42501',
  'Place quote recipient does not match provenance',
  'the public quote RPC rejects a forged recipient'
);
reset role;

select is(
  (
    select count(*)
    from public.notifications
    where type = 'place_quote'
      and list_place_id = '47000000-0000-4000-8000-000000000002'
  ),
  1::bigint,
  'RPC retries cannot duplicate the quote notification'
);
select is(
  (
    select message
    from public.notifications
    where type = 'place_quote'
      and list_place_id = '47000000-0000-4000-8000-000000000002'
  ),
  '"Kaynak Mekan" mekanını kendi listesine alıntıladı',
  'RPC retries cannot replace canonical content with a client message'
);

select lives_ok(
  $$
    insert into public.user_blocks (blocker_user_id, blocked_user_id)
    values (
      '41000000-0000-4000-8000-000000000002',
      '41000000-0000-4000-8000-000000000001'
    )
  $$,
  'blocking succeeds when an existing follow-request FK requires internal cleanup'
);
select is(
  (
    select count(*)
    from public.notifications
    where type = 'place_quote'
      and list_place_id = '47000000-0000-4000-8000-000000000002'
  ),
  0::bigint,
  'blocking removes the quote notification and its delivery jobs'
);

select set_config('request.jwt.claim.sub', '41000000-0000-4000-8000-000000000002', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;
select lives_ok(
  $$
    select public.create_place_quote_notification(
      '41000000-0000-4000-8000-000000000001',
      'must remain suppressed',
      '46000000-0000-4000-8000-000000000002',
      '47000000-0000-4000-8000-000000000002'
    )
  $$,
  'a blocked quote retry is a client-safe no-op'
);
reset role;
select is(
  (
    select count(*)
    from public.notifications
    where type = 'place_quote'
      and list_place_id = '47000000-0000-4000-8000-000000000002'
  ),
  0::bigint,
  'a blocked quote retry cannot recreate notification or push state'
);

select ok(
  exists (
    select 1
    from pg_trigger
    where tgrelid = 'public.notifications'::regclass
      and tgname = 'notifications_dispatch_push'
      and not tgisinternal
  ),
  'the durable notification-to-push trigger remains installed'
);
select ok(
  exists (
    select 1
    from pg_trigger
    where tgrelid = 'public.list_places'::regclass
      and tgname = 'list_places_notify_quote_insert'
      and not tgisinternal
  ),
  'quoted place creation has an authoritative notification trigger'
);
select ok(
  exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and indexname = 'notifications_follow_request_event_unique'
  ),
  'follow-request source notification idempotency is indexed'
);
select ok(
  exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and indexname = 'notifications_place_quote_event_unique'
  ),
  'place-quote source notification idempotency is indexed'
);

select * from finish();
rollback;
