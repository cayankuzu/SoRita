-- Compliance boundaries: consent evidence is accepted only by auth-gateway;
-- exports are assembled server-side and sanctions take effect in auth + RLS.

begin;

create table if not exists public.legal_consent_records (
  user_id uuid primary key references auth.users(id) on delete cascade,
  consent_version text not null check (consent_version = '2026-09-08-terms-community-privacy'),
  documents_accepted text[] not null check (documents_accepted = array['community', 'kvkk', 'privacy', 'terms']::text[]),
  accepted_at timestamptz not null,
  recorded_at timestamptz not null default timezone('utc', now()),
  check (
    accepted_at >= recorded_at - interval '24 hours'
    and accepted_at <= recorded_at + interval '5 minutes'
  )
);
alter table public.legal_consent_records enable row level security;
revoke all on table public.legal_consent_records from public, anon, authenticated, service_role;
grant select on table public.legal_consent_records to service_role;

create or replace function private.record_legal_consent()
returns trigger language plpgsql security definer set search_path = pg_catalog, public, private as $$
declare
  accepted_documents text[];
  accepted_at timestamptz;
begin
  -- Existing/imported accounts predate this consent contract. They are not
  -- retroactively represented as consenting; only an attempted consent claim
  -- is validated and durably recorded here.
  if not (new.raw_user_meta_data ? 'legal_consent_version')
    and not (new.raw_user_meta_data ? 'legal_consent_documents')
    and not (new.raw_user_meta_data ? 'legal_consent_at') then
    return new;
  end if;
  if new.raw_user_meta_data ->> 'legal_consent_version' <> '2026-09-08-terms-community-privacy' then
    raise exception using errcode = '22023', message = 'legal_consent_version_required';
  end if;
  if jsonb_typeof(new.raw_user_meta_data -> 'legal_consent_documents') <> 'array' then
    raise exception using errcode = '22023', message = 'legal_consent_documents_required';
  end if;
  select array_agg(value order by value) into accepted_documents
  from jsonb_array_elements_text(new.raw_user_meta_data -> 'legal_consent_documents') as document(value);
  if accepted_documents is distinct from array['community', 'kvkk', 'privacy', 'terms']::text[] then
    raise exception using errcode = '22023', message = 'legal_consent_documents_required';
  end if;
  accepted_at := nullif(new.raw_user_meta_data ->> 'legal_consent_at', '')::timestamptz;
  if accepted_at is null
    or accepted_at < timezone('utc', now()) - interval '24 hours'
    or accepted_at > timezone('utc', now()) + interval '5 minutes' then
    raise exception using errcode = '22023', message = 'legal_consent_timestamp_invalid';
  end if;
  insert into public.legal_consent_records (user_id, consent_version, documents_accepted, accepted_at)
  values (new.id, '2026-09-08-terms-community-privacy', accepted_documents, accepted_at)
  on conflict (user_id) do nothing;
  return new;
end;
$$;
revoke all on function private.record_legal_consent() from public, anon, authenticated, service_role;
drop trigger if exists auth_users_record_legal_consent on auth.users;
create trigger auth_users_record_legal_consent
after insert on auth.users for each row execute function private.record_legal_consent();

create table if not exists public.personal_data_access_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  request_type text not null check (request_type = 'export'),
  requested_at timestamptz not null default timezone('utc', now())
);
create index if not exists personal_data_access_log_user_requested_idx on public.personal_data_access_log(user_id, requested_at desc);
alter table public.personal_data_access_log enable row level security;
revoke all on table public.personal_data_access_log from public, anon, authenticated, service_role;
grant select on table public.personal_data_access_log to service_role;

create or replace function public.build_personal_data_export(p_user_id uuid)
returns jsonb language plpgsql security definer set search_path = pg_catalog, public, private as $$
declare
  actor_role text := coalesce(nullif(auth.jwt() ->> 'role', ''), case when session_user = 'postgres' then 'postgres' end, '');
  payload jsonb;
begin
  if actor_role not in ('service_role', 'postgres') or p_user_id is null then
    raise exception using errcode = '42501', message = 'personal_data_export_not_authorized';
  end if;
  insert into public.personal_data_access_log(user_id, request_type) values (p_user_id, 'export');
  select jsonb_build_object(
    'format_version', 2,
    'generated_at', timezone('utc', now()),
    'account', coalesce((
      select jsonb_build_object(
        'email', email,
        'phone', phone,
        'created_at', created_at,
        'updated_at', updated_at,
        'email_confirmed_at', email_confirmed_at,
        'phone_confirmed_at', phone_confirmed_at,
        'last_sign_in_at', last_sign_in_at
      )
      from auth.users
      where id = p_user_id
    ), '{}'::jsonb),
    'profile', coalesce((select to_jsonb(profile) - 'id' from public.profiles profile where profile.id = p_user_id), '{}'::jsonb),
    'legal_consent', coalesce((select jsonb_build_object('version', consent_version, 'documents', documents_accepted, 'accepted_at', accepted_at, 'recorded_at', recorded_at) from public.legal_consent_records where user_id = p_user_id), '{}'::jsonb),
    'lists', coalesce((select jsonb_agg(to_jsonb(item) - 'owner_id' order by item.created_at) from (select * from public.lists where owner_id = p_user_id order by created_at asc limit 1000) item), '[]'::jsonb),
    'places', coalesce((select jsonb_agg(to_jsonb(item) - 'created_by' order by item.added_at) from (select place.* from public.list_places place join public.lists list on list.id = place.list_id where list.owner_id = p_user_id or place.created_by = p_user_id order by place.added_at asc limit 1000) item), '[]'::jsonb),
    'media', coalesce((
      select jsonb_agg(to_jsonb(item) - 'asset_owner_id' order by item.created_at)
      from (
        select media.*
        from public.list_place_photos media
        join public.list_places place on place.id = media.list_place_id
        join public.lists list on list.id = place.list_id
        where media.asset_owner_id = p_user_id
          or place.created_by = p_user_id
          or list.owner_id = p_user_id
        order by media.created_at asc
        limit 1000
      ) item
    ), '[]'::jsonb),
    'comments', coalesce((select jsonb_agg(to_jsonb(item) - 'user_id' order by item.created_at) from (select * from public.list_place_comments where user_id = p_user_id order by created_at asc limit 1000) item), '[]'::jsonb),
    'list_likes', coalesce((select jsonb_agg(jsonb_build_object('list_id', list_id, 'created_at', created_at) order by created_at) from (select * from public.list_likes where user_id = p_user_id order by created_at asc limit 1000) item), '[]'::jsonb),
    'place_likes', coalesce((select jsonb_agg(jsonb_build_object('list_place_id', list_place_id, 'created_at', created_at) order by created_at) from (select * from public.list_place_likes where user_id = p_user_id order by created_at asc limit 1000) item), '[]'::jsonb),
    'comment_likes', coalesce((select jsonb_agg(jsonb_build_object('comment_id', comment_id, 'created_at', created_at) order by created_at) from (select * from public.list_place_comment_likes where user_id = p_user_id order by created_at asc limit 1000) item), '[]'::jsonb),
    'follows', jsonb_build_object(
      'following', coalesce((select jsonb_agg(jsonb_build_object('user_id', following_id, 'created_at', created_at) order by created_at) from (select * from public.user_follows where follower_id = p_user_id order by created_at asc limit 1000) item), '[]'::jsonb),
      'followers', coalesce((select jsonb_agg(jsonb_build_object('user_id', follower_id, 'created_at', created_at) order by created_at) from (select * from public.user_follows where following_id = p_user_id order by created_at asc limit 1000) item), '[]'::jsonb)
    ),
    'follow_requests', coalesce((select jsonb_agg(to_jsonb(item) - 'id' order by item.created_at) from (select * from public.follow_requests where requester_id = p_user_id or target_user_id = p_user_id order by created_at asc limit 1000) item), '[]'::jsonb),
    'blocks', coalesce((select jsonb_agg(jsonb_build_object('blocked_user_id', blocked_user_id, 'created_at', created_at) order by created_at) from public.user_blocks where blocker_user_id = p_user_id), '[]'::jsonb),
    'notifications_received', coalesce((select jsonb_agg(to_jsonb(item) - 'recipient_user_id' order by item.created_at) from (select * from public.notifications where recipient_user_id = p_user_id order by created_at asc limit 1000) item), '[]'::jsonb),
    'push_registrations', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'platform', platform,
          'is_active', is_active,
          'created_at', created_at,
          'updated_at', updated_at,
          'last_seen_at', last_seen_at
        )
        order by created_at
      )
      from public.user_push_tokens
      where user_id = p_user_id
    ), '[]'::jsonb),
    'reports_submitted', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'report_type', report_type, 'reason', reason, 'details', details, 'created_at', created_at) order by created_at) from (select * from public.moderation_reports where reporter_user_id = p_user_id order by created_at asc limit 1000) item), '[]'::jsonb),
    'data_access_history', coalesce((select jsonb_agg(jsonb_build_object('request_type', request_type, 'requested_at', requested_at) order by requested_at) from (select * from public.personal_data_access_log where user_id = p_user_id order by requested_at asc limit 1000) item), '[]'::jsonb),
    'collection_limit', 1000,
    'truncated', jsonb_build_object(
      'lists', exists(select 1 from public.lists where owner_id = p_user_id offset 1000 limit 1),
      'places', exists(select 1 from public.list_places place join public.lists list on list.id = place.list_id where list.owner_id = p_user_id or place.created_by = p_user_id offset 1000 limit 1),
      'comments', exists(select 1 from public.list_place_comments where user_id = p_user_id offset 1000 limit 1),
      'notifications_received', exists(select 1 from public.notifications where recipient_user_id = p_user_id offset 1000 limit 1),
      'reports_submitted', exists(select 1 from public.moderation_reports where reporter_user_id = p_user_id offset 1000 limit 1)
    )
  ) into payload;
  return payload;
end;
$$;
revoke all on function public.build_personal_data_export(uuid) from public, anon, authenticated;
grant execute on function public.build_personal_data_export(uuid) to service_role;

create table if not exists public.moderation_account_sanctions (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.moderation_cases(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete restrict,
  sanction_reference text not null check (sanction_reference ~ '^[A-Za-z0-9][A-Za-z0-9._:/#?=&+-]{0,239}$'),
  ban_generation uuid not null,
  previous_banned_until timestamptz,
  imposed_at timestamptz not null default timezone('utc', now()),
  revoked_at timestamptz,
  check (revoked_at is null or revoked_at >= imposed_at)
);
create unique index if not exists moderation_account_sanctions_one_active_case_idx
  on public.moderation_account_sanctions(case_id)
  where revoked_at is null;
create index if not exists moderation_account_sanctions_active_user_idx
  on public.moderation_account_sanctions(user_id, imposed_at, id)
  where revoked_at is null;
alter table public.moderation_account_sanctions enable row level security;
revoke all on table public.moderation_account_sanctions from public, anon, authenticated, service_role;
grant select on table public.moderation_account_sanctions to service_role;

create or replace function private.enforce_moderation_sanction()
returns trigger language plpgsql security definer set search_path = pg_catalog, public, private, auth as $$
declare
  target_id uuid;
  current_banned_until timestamptz;
  active_ban_generation uuid;
  active_previous_banned_until timestamptz;
  inserted_sanction_id uuid;
begin
  if new.event_type <> 'sanctioned' then return new; end if;
  select coalesce(report.target_user_id, list.owner_id, place.created_by, comment.user_id)
    into target_id
    from public.moderation_cases moderation_case
    join public.moderation_reports report on report.id = moderation_case.report_id
    left join public.lists list on list.id = report.list_id
    left join public.list_places place on place.id = report.list_place_id
    left join public.list_place_comments comment on comment.id = report.comment_id
   where moderation_case.id = new.case_id;
  if target_id is null then
    raise exception using errcode = '22023', message = 'sanction_target_unavailable';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('moderation-sanction:' || target_id::text, 0));
  select banned_until into current_banned_until from auth.users where id = target_id for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'sanction_target_unavailable';
  end if;

  select ban_generation, previous_banned_until
    into active_ban_generation, active_previous_banned_until
    from public.moderation_account_sanctions
   where user_id = target_id and revoked_at is null
   order by imposed_at asc, id asc
   limit 1;

  if active_ban_generation is null then
    active_ban_generation := gen_random_uuid();
    active_previous_banned_until := current_banned_until;
  end if;

  insert into public.moderation_account_sanctions(
    case_id,
    user_id,
    sanction_reference,
    ban_generation,
    previous_banned_until
  )
  values (
    new.case_id,
    target_id,
    new.reference,
    active_ban_generation,
    active_previous_banned_until
  )
  on conflict do nothing
  returning id into inserted_sanction_id;

  if inserted_sanction_id is not null then
    update auth.users set banned_until = 'infinity'::timestamptz where id = target_id;
  end if;
  return new;
end;
$$;
revoke all on function private.enforce_moderation_sanction() from public, anon, authenticated, service_role;
drop trigger if exists moderation_case_events_enforce_sanction on public.moderation_case_events;
create trigger moderation_case_events_enforce_sanction after insert on public.moderation_case_events for each row execute function private.enforce_moderation_sanction();

create or replace function private.has_active_moderation_sanction(p_user_id uuid)
returns boolean language sql stable security definer set search_path = pg_catalog, public, private as $$
  select exists(select 1 from public.moderation_account_sanctions where user_id = p_user_id and revoked_at is null)
$$;
revoke all on function private.has_active_moderation_sanction(uuid) from public, anon, authenticated, service_role;
grant execute on function private.has_active_moderation_sanction(uuid) to authenticated;

create or replace function private.list_owner_has_active_moderation_sanction(p_list_id uuid)
returns boolean language sql stable security definer set search_path = pg_catalog, public, private as $$
  select exists(
    select 1
      from public.lists
     where id = p_list_id
       and private.has_active_moderation_sanction(owner_id)
  )
$$;
revoke all on function private.list_owner_has_active_moderation_sanction(uuid) from public, anon, authenticated, service_role;
grant execute on function private.list_owner_has_active_moderation_sanction(uuid) to authenticated;

create or replace function private.list_place_has_active_moderation_sanction(p_list_place_id uuid)
returns boolean language sql stable security definer set search_path = pg_catalog, public, private as $$
  select exists(
    select 1
      from public.list_places
      join public.lists on lists.id = list_places.list_id
     where list_places.id = p_list_place_id
       and (
         private.has_active_moderation_sanction(lists.owner_id)
         or private.has_active_moderation_sanction(list_places.created_by)
       )
  )
$$;
revoke all on function private.list_place_has_active_moderation_sanction(uuid) from public, anon, authenticated, service_role;
grant execute on function private.list_place_has_active_moderation_sanction(uuid) to authenticated;

-- Restrictive policies are ANDed with all existing ownership policies, closing
-- an already-issued JWT's write path as soon as a sanction is recorded.
create policy moderation_sanction_blocks_profile_writes on public.profiles as restrictive for all to authenticated using (not private.has_active_moderation_sanction(auth.uid())) with check (not private.has_active_moderation_sanction(auth.uid()));
create policy moderation_sanction_blocks_list_writes on public.lists as restrictive for all to authenticated using (not private.has_active_moderation_sanction(auth.uid())) with check (not private.has_active_moderation_sanction(auth.uid()));
create policy moderation_sanction_blocks_place_writes on public.list_places as restrictive for all to authenticated using (not private.has_active_moderation_sanction(auth.uid())) with check (not private.has_active_moderation_sanction(auth.uid()));
create policy moderation_sanction_blocks_comment_writes on public.list_place_comments as restrictive for all to authenticated using (not private.has_active_moderation_sanction(auth.uid())) with check (not private.has_active_moderation_sanction(auth.uid()));
create policy moderation_sanction_blocks_follow_writes on public.user_follows as restrictive for all to authenticated using (not private.has_active_moderation_sanction(auth.uid())) with check (not private.has_active_moderation_sanction(auth.uid()));
create policy moderation_sanction_blocks_block_writes on public.user_blocks as restrictive for all to authenticated using (not private.has_active_moderation_sanction(auth.uid())) with check (not private.has_active_moderation_sanction(auth.uid()));

-- Sanctioned UGC and engagement are removed from every authenticated read
-- model immediately; a still-valid JWT cannot keep content visible.
create policy moderation_hides_sanctioned_profiles on public.profiles as restrictive for select to authenticated
  using (not private.has_active_moderation_sanction(id));
create policy moderation_hides_sanctioned_lists on public.lists as restrictive for select to authenticated
  using (not private.has_active_moderation_sanction(owner_id));
create policy moderation_hides_sanctioned_places on public.list_places as restrictive for select to authenticated
  using (
    not private.list_owner_has_active_moderation_sanction(list_id)
    and not private.has_active_moderation_sanction(created_by)
  );
create policy moderation_hides_sanctioned_place_media on public.list_place_photos as restrictive for select to authenticated
  using (not private.list_place_has_active_moderation_sanction(list_place_id));
create policy moderation_hides_sanctioned_comments on public.list_place_comments as restrictive for select to authenticated
  using (not private.has_active_moderation_sanction(user_id));
create policy moderation_hides_sanctioned_list_likes on public.list_likes as restrictive for select to authenticated
  using (not private.has_active_moderation_sanction(user_id));
create policy moderation_hides_sanctioned_place_likes on public.list_place_likes as restrictive for select to authenticated
  using (not private.has_active_moderation_sanction(user_id));
create policy moderation_hides_sanctioned_comment_likes on public.list_place_comment_likes as restrictive for select to authenticated
  using (not private.has_active_moderation_sanction(user_id));
create policy moderation_hides_sanctioned_follows on public.user_follows as restrictive for select to authenticated
  using (
    not private.has_active_moderation_sanction(follower_id)
    and not private.has_active_moderation_sanction(following_id)
  );
create policy moderation_hides_sanctioned_follow_requests on public.follow_requests as restrictive for select to authenticated
  using (
    not private.has_active_moderation_sanction(requester_id)
    and not private.has_active_moderation_sanction(target_user_id)
  );
create policy moderation_hides_sanctioned_notification_actors on public.notifications as restrictive for select to authenticated
  using (actor_user_id is null or not private.has_active_moderation_sanction(actor_user_id));

alter table public.moderation_case_events
  drop constraint moderation_case_events_type_check;
alter table public.moderation_case_events
  add constraint moderation_case_events_type_check
  check (event_type in (
    'created', 'review_started', 'sanctioned', 'closed', 'appealed',
    'reopened', 'sla_set', 'reinstated'
  ));

create or replace function public.reinstate_moderation_sanction(
  p_case_id uuid,
  p_operator_id text,
  p_reason text,
  p_idempotency_key text,
  p_reference text
)
returns public.moderation_cases
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_role text := coalesce(
    nullif(auth.jwt() ->> 'role', ''),
    case when session_user = 'postgres' then 'postgres' end,
    ''
  );
  current_case public.moderation_cases%rowtype;
  existing_event public.moderation_case_events%rowtype;
  active_sanction public.moderation_account_sanctions%rowtype;
  normalized_operator_id text := trim(coalesce(p_operator_id, ''));
  normalized_reason text := trim(coalesce(p_reason, ''));
  normalized_idempotency_key text := trim(coalesce(p_idempotency_key, ''));
  normalized_reference text := trim(coalesce(p_reference, ''));
  event_time timestamptz := timezone('utc', now());
begin
  if actor_role not in ('postgres', 'service_role') then
    raise exception using errcode = '42501', message = 'moderation_operator_required';
  end if;
  if p_case_id is null then
    raise exception using errcode = '22023', message = 'case_id_required';
  end if;
  if normalized_operator_id !~ '^[A-Za-z0-9][A-Za-z0-9._:/-]{0,119}$' then
    raise exception using errcode = '22023', message = 'operator_id_invalid';
  end if;
  if char_length(normalized_reason) not between 1 and 500 then
    raise exception using errcode = '22023', message = 'reason_invalid';
  end if;
  if normalized_idempotency_key !~ '^[A-Za-z0-9][A-Za-z0-9._:/-]{7,199}$' then
    raise exception using errcode = '22023', message = 'idempotency_key_invalid';
  end if;
  if normalized_reference !~ '^[A-Za-z0-9][A-Za-z0-9._:/#?=&+-]{0,239}$' then
    raise exception using errcode = '22023', message = 'reinstatement_reference_required';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_case_id::text, 0));
  select * into current_case
    from public.moderation_cases
   where id = p_case_id
   for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'moderation_case_not_found';
  end if;

  select * into existing_event
    from public.moderation_case_events
   where idempotency_key = normalized_idempotency_key;
  if found then
    if existing_event.case_id <> p_case_id
      or existing_event.event_type <> 'reinstated'
      or existing_event.operator_id <> normalized_operator_id
      or existing_event.reason <> normalized_reason
      or existing_event.reference is distinct from normalized_reference then
      raise exception using errcode = '23505', message = 'idempotency_key_reused';
    end if;
    return current_case;
  end if;

  if current_case.status <> 'appealed' then
    raise exception using errcode = '22023', message = 'invalid_moderation_transition';
  end if;

  select * into active_sanction
    from public.moderation_account_sanctions
   where case_id = p_case_id and revoked_at is null
   order by imposed_at desc, id desc
   limit 1
   for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'active_moderation_sanction_not_found';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('moderation-sanction:' || active_sanction.user_id::text, 0));
  update public.moderation_account_sanctions
     set revoked_at = event_time
   where id = active_sanction.id;

  if not exists (
    select 1
      from public.moderation_account_sanctions
     where user_id = active_sanction.user_id
       and revoked_at is null
  ) then
    update auth.users
       set banned_until = active_sanction.previous_banned_until
     where id = active_sanction.user_id;
  end if;

  update public.moderation_cases
     set status = 'closed',
         assigned_operator_id = normalized_operator_id,
         closed_at = event_time,
         revision = revision + 1,
         last_event_at = event_time,
         updated_at = event_time
   where id = p_case_id
   returning * into current_case;

  insert into public.moderation_case_events (
    case_id, event_type, from_status, to_status, operator_id, reason,
    reference, idempotency_key, metadata, created_at
  ) values (
    p_case_id, 'reinstated', 'appealed', 'closed', normalized_operator_id,
    normalized_reason, normalized_reference, normalized_idempotency_key,
    jsonb_build_object('sanction_revoked', true), event_time
  );

  return current_case;
end;
$$;

revoke all on function public.reinstate_moderation_sanction(uuid, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.reinstate_moderation_sanction(uuid, text, text, text, text)
  to service_role;

commit;
