-- Moderation stays an internal operational workflow. Reports remain the intake
-- record; cases and append-only events add lifecycle, SLA and audit metadata
-- without exposing a moderator UI or a new client-facing API.
create table if not exists public.moderation_cases (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null unique references public.moderation_reports (id) on delete cascade,
  status text not null default 'open',
  assigned_operator_id text,
  sla_due_at timestamptz,
  sla_policy_version text,
  sanction_reference text,
  closed_at timestamptz,
  revision bigint not null default 1,
  last_event_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint moderation_cases_status_check
    check (status in ('open', 'in_review', 'actioned', 'appealed', 'closed')),
  constraint moderation_cases_operator_length_check
    check (
      assigned_operator_id is null or
      assigned_operator_id ~ '^[A-Za-z0-9][A-Za-z0-9._:/-]{0,119}$'
    ),
  constraint moderation_cases_sla_pair_check
    check ((sla_due_at is null) = (sla_policy_version is null)),
  constraint moderation_cases_sla_policy_length_check
    check (
      sla_policy_version is null or
      sla_policy_version ~ '^[A-Za-z0-9][A-Za-z0-9._:/-]{0,119}$'
    ),
  constraint moderation_cases_sanction_reference_length_check
    check (
      sanction_reference is null or
      sanction_reference ~ '^[A-Za-z0-9][A-Za-z0-9._:/#?=&+-]{0,239}$'
    ),
  constraint moderation_cases_revision_check check (revision > 0)
);

create table if not exists public.moderation_case_events (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.moderation_cases (id) on delete cascade,
  event_type text not null,
  from_status text,
  to_status text not null,
  operator_id text not null,
  reason text not null,
  reference text,
  idempotency_key text not null unique,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  constraint moderation_case_events_type_check
    check (event_type in ('created', 'review_started', 'sanctioned', 'closed', 'appealed', 'reopened', 'sla_set')),
  constraint moderation_case_events_from_status_check
    check (from_status is null or from_status in ('open', 'in_review', 'actioned', 'appealed', 'closed')),
  constraint moderation_case_events_to_status_check
    check (to_status in ('open', 'in_review', 'actioned', 'appealed', 'closed')),
  constraint moderation_case_events_operator_length_check
    check (operator_id ~ '^[A-Za-z0-9][A-Za-z0-9._:/-]{0,119}$'),
  constraint moderation_case_events_reason_length_check
    check (char_length(trim(reason)) between 1 and 500),
  constraint moderation_case_events_reference_length_check
    check (reference is null or reference ~ '^[A-Za-z0-9][A-Za-z0-9._:/#?=&+-]{0,239}$'),
  constraint moderation_case_events_idempotency_length_check
    check (idempotency_key ~ '^[A-Za-z0-9][A-Za-z0-9._:/-]{7,199}$'),
  constraint moderation_case_events_metadata_object_check
    check (jsonb_typeof(metadata) = 'object'),
  constraint moderation_case_events_metadata_minimized_check
    check (not (metadata ?| array[
      'access_token', 'details', 'email', 'location', 'message', 'precise_location',
      'refresh_token', 'signed_url', 'snapshot'
    ]))
);

create index if not exists idx_moderation_cases_status_event
  on public.moderation_cases (status, last_event_at asc, id);

create index if not exists idx_moderation_cases_sla_open
  on public.moderation_cases (sla_due_at asc, id)
  where status <> 'closed' and sla_due_at is not null;

create index if not exists idx_moderation_case_events_case_created
  on public.moderation_case_events (case_id, created_at asc, id);

alter table public.moderation_cases enable row level security;
alter table public.moderation_case_events enable row level security;

revoke all on table public.moderation_cases from public, anon, authenticated, service_role;
revoke all on table public.moderation_case_events from public, anon, authenticated, service_role;
grant select on table public.moderation_cases to service_role;
grant select on table public.moderation_case_events to service_role;

create or replace function private.create_moderation_case_for_report()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_case_id uuid;
  event_time timestamptz := timezone('utc', now());
begin
  insert into public.moderation_cases (
    report_id,
    last_event_at,
    created_at,
    updated_at
  )
  values (
    new.id,
    event_time,
    event_time,
    event_time
  )
  on conflict (report_id) do nothing
  returning id into new_case_id;

  if new_case_id is null then
    select id
      into new_case_id
      from public.moderation_cases
     where report_id = new.id;
  end if;

  insert into public.moderation_case_events (
    case_id,
    event_type,
    from_status,
    to_status,
    operator_id,
    reason,
    idempotency_key,
    metadata,
    created_at
  )
  values (
    new_case_id,
    'created',
    null,
    'open',
    'system:report-intake',
    'Report accepted by the existing moderation intake.',
    'report-created:' || new.id::text,
    jsonb_build_object('report_type', new.report_type),
    event_time
  )
  on conflict (idempotency_key) do nothing;

  return new;
end;
$$;

revoke all on function private.create_moderation_case_for_report() from public, anon, authenticated, service_role;

drop trigger if exists moderation_reports_create_case on public.moderation_reports;
create trigger moderation_reports_create_case
after insert on public.moderation_reports
for each row execute function private.create_moderation_case_for_report();

-- Backfill one internal case and one creation event for every report that
-- predates this migration. No user content is copied into the audit event.
insert into public.moderation_cases (
  report_id,
  last_event_at,
  created_at,
  updated_at
)
select
  report.id,
  report.created_at,
  report.created_at,
  greatest(report.created_at, report.updated_at)
from public.moderation_reports as report
on conflict (report_id) do nothing;

insert into public.moderation_case_events (
  case_id,
  event_type,
  from_status,
  to_status,
  operator_id,
  reason,
  idempotency_key,
  metadata,
  created_at
)
select
  moderation_case.id,
  'created',
  null,
  moderation_case.status,
  'system:migration-backfill',
  'Existing report attached to the audited moderation workflow.',
  'report-created:' || moderation_case.report_id::text,
  jsonb_build_object('report_type', report.report_type),
  moderation_case.created_at
from public.moderation_cases as moderation_case
join public.moderation_reports as report on report.id = moderation_case.report_id
on conflict (idempotency_key) do nothing;

create or replace function public.moderation_transition_case(
  p_case_id uuid,
  p_action text,
  p_operator_id text,
  p_reason text,
  p_idempotency_key text,
  p_sla_due_at timestamptz default null,
  p_reference text default null
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
  normalized_action text := lower(trim(coalesce(p_action, '')));
  normalized_operator_id text := trim(coalesce(p_operator_id, ''));
  normalized_reason text := trim(coalesce(p_reason, ''));
  normalized_idempotency_key text := trim(coalesce(p_idempotency_key, ''));
  normalized_reference text := nullif(trim(coalesce(p_reference, '')), '');
  previous_status text;
  next_status text;
  next_event_type text;
  expected_event_type text;
  expected_event_metadata jsonb := '{}'::jsonb;
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
  if normalized_reference is not null and
     normalized_reference !~ '^[A-Za-z0-9][A-Za-z0-9._:/#?=&+-]{0,239}$' then
    raise exception using errcode = '22023', message = 'reference_invalid';
  end if;

  expected_event_type := case normalized_action
    when 'review' then 'review_started'
    when 'sanction' then 'sanctioned'
    when 'close' then 'closed'
    when 'appeal' then 'appealed'
    when 'reopen' then 'reopened'
    when 'set-sla' then 'sla_set'
    else null
  end;
  if expected_event_type is null then
    raise exception using errcode = '22023', message = 'unsupported_moderation_action';
  end if;
  if normalized_action = 'sanction' and normalized_reference is null then
    raise exception using errcode = '22023', message = 'sanction_reference_required';
  end if;
  if normalized_action = 'appeal' and normalized_reference is null then
    raise exception using errcode = '22023', message = 'appeal_reference_required';
  end if;
  if normalized_action = 'set-sla' then
    if p_sla_due_at is null or normalized_reference is null then
      raise exception using errcode = '22023', message = 'sla_metadata_required';
    end if;
    expected_event_metadata := jsonb_build_object(
      'sla_due_at', to_jsonb(p_sla_due_at),
      'sla_policy_version', normalized_reference
    );
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_case_id::text, 0));

  select *
    into current_case
    from public.moderation_cases
   where id = p_case_id
   for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'moderation_case_not_found';
  end if;

  select *
    into existing_event
    from public.moderation_case_events
   where idempotency_key = normalized_idempotency_key;

  if found then
    if existing_event.case_id <> p_case_id
      or existing_event.event_type <> expected_event_type
      or existing_event.operator_id <> normalized_operator_id
      or existing_event.reason <> normalized_reason
      or existing_event.reference is distinct from normalized_reference
      or existing_event.metadata <> expected_event_metadata then
      raise exception using errcode = '23505', message = 'idempotency_key_reused';
    end if;
    return current_case;
  end if;

  previous_status := current_case.status;
  next_status := previous_status;

  case normalized_action
    when 'review' then
      if current_case.status not in ('open', 'appealed') then
        raise exception using errcode = '22023', message = 'invalid_moderation_transition';
      end if;
      next_status := 'in_review';
      next_event_type := 'review_started';
    when 'sanction' then
      if current_case.status not in ('open', 'in_review', 'appealed') then
        raise exception using errcode = '22023', message = 'invalid_moderation_transition';
      end if;
      next_status := 'actioned';
      next_event_type := 'sanctioned';
    when 'close' then
      if current_case.status not in ('open', 'in_review', 'actioned', 'appealed') then
        raise exception using errcode = '22023', message = 'invalid_moderation_transition';
      end if;
      next_status := 'closed';
      next_event_type := 'closed';
    when 'appeal' then
      if current_case.status not in ('actioned', 'closed') then
        raise exception using errcode = '22023', message = 'invalid_moderation_transition';
      end if;
      next_status := 'appealed';
      next_event_type := 'appealed';
    when 'reopen' then
      if current_case.status <> 'closed' then
        raise exception using errcode = '22023', message = 'invalid_moderation_transition';
      end if;
      next_status := 'in_review';
      next_event_type := 'reopened';
    when 'set-sla' then
      next_event_type := 'sla_set';
    else
      raise exception using errcode = '22023', message = 'unsupported_moderation_action';
  end case;

  update public.moderation_cases
     set status = next_status,
         assigned_operator_id = normalized_operator_id,
         sla_due_at = case when normalized_action = 'set-sla' then p_sla_due_at else sla_due_at end,
         sla_policy_version = case when normalized_action = 'set-sla' then normalized_reference else sla_policy_version end,
         sanction_reference = case when normalized_action = 'sanction' then normalized_reference else sanction_reference end,
         closed_at = case
           when next_status = 'closed' then event_time
           when current_case.status = 'closed' and next_status <> 'closed' then null
           else closed_at
         end,
         revision = revision + 1,
         last_event_at = event_time,
         updated_at = event_time
   where id = p_case_id
   returning * into current_case;

  insert into public.moderation_case_events (
    case_id,
    event_type,
    from_status,
    to_status,
    operator_id,
    reason,
    reference,
    idempotency_key,
    metadata,
    created_at
  )
  values (
    p_case_id,
    next_event_type,
    previous_status,
    next_status,
    normalized_operator_id,
    normalized_reason,
    normalized_reference,
    normalized_idempotency_key,
    expected_event_metadata,
    event_time
  );

  return current_case;
end;
$$;

revoke all on function public.moderation_transition_case(uuid, text, text, text, text, timestamptz, text)
  from public, anon, authenticated;
grant execute on function public.moderation_transition_case(uuid, text, text, text, text, timestamptz, text)
  to service_role;
