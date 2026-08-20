create extension if not exists pg_net;

do $$
begin
  create extension if not exists pg_cron with schema pg_catalog;
exception
  when insufficient_privilege or undefined_file then
    raise warning 'pg_cron could not be enabled; push receipts require an external call to private.run_push_delivery_worker()';
end
$$;

alter table public.user_push_tokens
  add column if not exists deactivated_at timestamptz,
  add column if not exists deactivation_reason text,
  add column if not exists last_receipt_at timestamptz;

create or replace function private.clear_push_token_deactivation()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
begin
  if new.is_active then
    new.deactivated_at := null;
    new.deactivation_reason := null;
  end if;

  return new;
end;
$$;

revoke all on function private.clear_push_token_deactivation() from public;

drop trigger if exists user_push_tokens_clear_deactivation on public.user_push_tokens;
create trigger user_push_tokens_clear_deactivation
before insert or update of is_active on public.user_push_tokens
for each row
execute function private.clear_push_token_deactivation();

create or replace function public.remove_all_user_push_tokens()
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if auth.uid() is null then
    raise exception 'Unauthorized';
  end if;

  delete from public.user_push_tokens
  where user_id = auth.uid();
end;
$$;

revoke all on function public.remove_all_user_push_tokens() from public;
grant execute on function public.remove_all_user_push_tokens() to authenticated;

create table if not exists private.push_delivery_jobs (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null references public.notifications (id) on delete cascade,
  push_token_id uuid not null references public.user_push_tokens (id) on delete cascade,
  recipient_user_id uuid not null,
  expo_push_token text not null,
  payload jsonb not null,
  status text not null default 'pending' check (
    status in (
      'pending',
      'sending',
      'retry_send',
      'awaiting_receipt',
      'checking_receipt',
      'retry_receipt',
      'delivered',
      'unregistered',
      'failed',
      'cancelled'
    )
  ),
  send_attempt_count smallint not null default 0 check (send_attempt_count >= 0),
  receipt_attempt_count smallint not null default 0 check (receipt_attempt_count >= 0),
  send_request_id bigint,
  ticket_id text,
  receipt_request_id bigint,
  next_attempt_at timestamptz not null default timezone('utc', now()),
  send_requested_at timestamptz,
  receipt_due_at timestamptz,
  receipt_requested_at timestamptz,
  completed_at timestamptz,
  last_error_code text,
  last_error_message text,
  expires_at timestamptz not null default (timezone('utc', now()) + interval '24 hours'),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (notification_id, push_token_id)
);

create index if not exists idx_push_delivery_jobs_send_due
on private.push_delivery_jobs (next_attempt_at, created_at)
where status in ('pending', 'retry_send');

create index if not exists idx_push_delivery_jobs_send_response
on private.push_delivery_jobs (send_request_id)
where status = 'sending';

create index if not exists idx_push_delivery_jobs_receipt_due
on private.push_delivery_jobs (receipt_due_at, created_at)
where status in ('awaiting_receipt', 'retry_receipt');

create index if not exists idx_push_delivery_jobs_receipt_response
on private.push_delivery_jobs (receipt_request_id)
where status = 'checking_receipt';

revoke all on table private.push_delivery_jobs from public, anon, authenticated;
grant select, insert, update, delete on table private.push_delivery_jobs to service_role;

create or replace function private.push_send_retry_delay(attempt_count integer)
returns interval
language sql
immutable
set search_path = pg_catalog
as $$
  select case
    when attempt_count <= 1 then interval '30 seconds'
    when attempt_count = 2 then interval '2 minutes'
    else interval '10 minutes'
  end;
$$;

create or replace function private.push_receipt_retry_delay(attempt_count integer)
returns interval
language sql
immutable
set search_path = pg_catalog
as $$
  select case
    when attempt_count <= 1 then interval '5 minutes'
    when attempt_count = 2 then interval '15 minutes'
    else interval '30 minutes'
  end;
$$;

revoke all on function private.push_send_retry_delay(integer) from public;
revoke all on function private.push_receipt_retry_delay(integer) from public;

create or replace function private.deactivate_unregistered_push_token(
  target_push_token_id uuid,
  target_token_snapshot text,
  target_reason text
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
begin
  update public.user_push_tokens
  set
    is_active = false,
    deactivated_at = timezone('utc', now()),
    deactivation_reason = left(coalesce(nullif(target_reason, ''), 'DeviceNotRegistered'), 120),
    last_receipt_at = timezone('utc', now()),
    updated_at = timezone('utc', now())
  where id = target_push_token_id
    and expo_push_token = target_token_snapshot;
end;
$$;

revoke all on function private.deactivate_unregistered_push_token(uuid, text, text) from public;

create or replace function private.dispatch_pending_push_jobs(batch_limit integer default 100)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public, private, net
as $$
declare
  target_job record;
  target_request_id bigint;
  dispatched_count integer := 0;
  normalized_limit integer := least(greatest(coalesce(batch_limit, 100), 1), 100);
  next_attempt_count integer;
begin
  update private.push_delivery_jobs as jobs
  set
    status = 'cancelled',
    completed_at = timezone('utc', now()),
    last_error_code = 'TokenOwnershipChanged',
    last_error_message = 'Push token is no longer active for the intended recipient.',
    updated_at = timezone('utc', now())
  where jobs.status in ('pending', 'retry_send')
    and jobs.next_attempt_at <= timezone('utc', now())
    and not exists (
      select 1
      from public.user_push_tokens as tokens
      where tokens.id = jobs.push_token_id
        and tokens.user_id = jobs.recipient_user_id
        and tokens.expo_push_token = jobs.expo_push_token
        and tokens.is_active = true
    );

  for target_job in
    select jobs.id, jobs.payload, jobs.send_attempt_count
    from private.push_delivery_jobs as jobs
    join public.user_push_tokens as tokens
      on tokens.id = jobs.push_token_id
     and tokens.user_id = jobs.recipient_user_id
     and tokens.expo_push_token = jobs.expo_push_token
     and tokens.is_active = true
    where jobs.status in ('pending', 'retry_send')
      and jobs.next_attempt_at <= timezone('utc', now())
      and jobs.expires_at > timezone('utc', now())
      and jobs.send_attempt_count < 4
    order by jobs.next_attempt_at, jobs.created_at
    for update of jobs skip locked
    limit normalized_limit
  loop
    next_attempt_count := target_job.send_attempt_count + 1;

    begin
      target_request_id := net.http_post(
        url := 'https://exp.host/--/api/v2/push/send',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Accept', 'application/json'
        ),
        body := target_job.payload
      );

      update private.push_delivery_jobs
      set
        status = 'sending',
        send_attempt_count = next_attempt_count,
        send_request_id = target_request_id,
        send_requested_at = timezone('utc', now()),
        last_error_code = null,
        last_error_message = null,
        updated_at = timezone('utc', now())
      where id = target_job.id;

      dispatched_count := dispatched_count + 1;
    exception
      when others then
        update private.push_delivery_jobs
        set
          status = case when next_attempt_count >= 4 then 'failed' else 'retry_send' end,
          send_attempt_count = next_attempt_count,
          next_attempt_at = timezone('utc', now()) + private.push_send_retry_delay(next_attempt_count),
          completed_at = case when next_attempt_count >= 4 then timezone('utc', now()) else null end,
          last_error_code = 'PgNetEnqueueError',
          last_error_message = left(sqlerrm, 500),
          updated_at = timezone('utc', now())
        where id = target_job.id;
    end;
  end loop;

  return dispatched_count;
end;
$$;

revoke all on function private.dispatch_pending_push_jobs(integer) from public, anon, authenticated;
grant execute on function private.dispatch_pending_push_jobs(integer) to service_role;

create or replace function private.process_push_send_responses(batch_limit integer default 250)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public, private, net
as $$
declare
  target_job record;
  response_payload jsonb;
  response_data jsonb;
  ticket_status text;
  ticket_id_value text;
  ticket_error text;
  ticket_message text;
  processed_count integer := 0;
  normalized_limit integer := least(greatest(coalesce(batch_limit, 250), 1), 1000);
begin
  for target_job in
    select
      jobs.id,
      jobs.push_token_id,
      jobs.expo_push_token,
      jobs.send_attempt_count,
      jobs.send_requested_at,
      responses.id as response_id,
      responses.status_code,
      responses.content,
      responses.timed_out,
      responses.error_msg
    from private.push_delivery_jobs as jobs
    left join net._http_response as responses
      on responses.id = jobs.send_request_id
    where jobs.status = 'sending'
      and (
        responses.id is not null
        or jobs.send_requested_at < timezone('utc', now()) - interval '2 minutes'
      )
    order by jobs.send_requested_at
    for update of jobs skip locked
    limit normalized_limit
  loop
    processed_count := processed_count + 1;

    if target_job.response_id is null then
      update private.push_delivery_jobs
      set
        status = case when target_job.send_attempt_count >= 4 then 'failed' else 'retry_send' end,
        send_request_id = null,
        next_attempt_at = timezone('utc', now()) + private.push_send_retry_delay(target_job.send_attempt_count),
        completed_at = case when target_job.send_attempt_count >= 4 then timezone('utc', now()) else null end,
        last_error_code = 'SendResponseTimeout',
        last_error_message = 'Expo send response was not available before the timeout.',
        updated_at = timezone('utc', now())
      where id = target_job.id;
      continue;
    end if;

    if coalesce(target_job.timed_out, false)
      or target_job.error_msg is not null
      or target_job.status_code = 429
      or target_job.status_code between 500 and 599
    then
      update private.push_delivery_jobs
      set
        status = case when target_job.send_attempt_count >= 4 then 'failed' else 'retry_send' end,
        next_attempt_at = timezone('utc', now()) + private.push_send_retry_delay(target_job.send_attempt_count),
        completed_at = case when target_job.send_attempt_count >= 4 then timezone('utc', now()) else null end,
        last_error_code = case
          when target_job.status_code = 429 then 'ExpoRateLimited'
          when coalesce(target_job.timed_out, false) then 'ExpoSendTimeout'
          else 'ExpoSendUnavailable'
        end,
        last_error_message = left(
          coalesce(target_job.error_msg, 'Expo send endpoint returned HTTP ' || coalesce(target_job.status_code::text, 'unknown')),
          500
        ),
        updated_at = timezone('utc', now())
      where id = target_job.id;
      continue;
    end if;

    if target_job.status_code < 200 or target_job.status_code >= 300 then
      update private.push_delivery_jobs
      set
        status = 'failed',
        completed_at = timezone('utc', now()),
        last_error_code = 'ExpoSendHttpError',
        last_error_message = left('Expo send endpoint returned HTTP ' || target_job.status_code::text, 500),
        updated_at = timezone('utc', now())
      where id = target_job.id;
      continue;
    end if;

    begin
      response_payload := target_job.content::jsonb;
    exception
      when others then
        response_payload := null;
    end;

    response_data := response_payload -> 'data';
    if jsonb_typeof(response_data) = 'array' then
      response_data := response_data -> 0;
    end if;

    ticket_status := response_data ->> 'status';
    ticket_id_value := response_data ->> 'id';
    ticket_error := response_data #>> '{details,error}';
    ticket_message := response_data ->> 'message';

    if ticket_status = 'ok' and nullif(ticket_id_value, '') is not null then
      update private.push_delivery_jobs
      set
        status = 'awaiting_receipt',
        ticket_id = ticket_id_value,
        receipt_due_at = timezone('utc', now()) + interval '15 minutes',
        last_error_code = null,
        last_error_message = null,
        updated_at = timezone('utc', now())
      where id = target_job.id;
      continue;
    end if;

    if ticket_error = 'DeviceNotRegistered' then
      perform private.deactivate_unregistered_push_token(
        target_job.push_token_id,
        target_job.expo_push_token,
        ticket_error
      );

      update private.push_delivery_jobs
      set
        status = 'unregistered',
        completed_at = timezone('utc', now()),
        last_error_code = ticket_error,
        last_error_message = left(coalesce(ticket_message, 'Expo rejected an unregistered device token.'), 500),
        updated_at = timezone('utc', now())
      where id = target_job.id;
    elsif ticket_error = 'MessageRateExceeded' and target_job.send_attempt_count < 4 then
      update private.push_delivery_jobs
      set
        status = 'retry_send',
        next_attempt_at = timezone('utc', now()) + private.push_send_retry_delay(target_job.send_attempt_count),
        last_error_code = ticket_error,
        last_error_message = left(coalesce(ticket_message, 'Expo rate-limited the device token.'), 500),
        updated_at = timezone('utc', now())
      where id = target_job.id;
    else
      update private.push_delivery_jobs
      set
        status = 'failed',
        completed_at = timezone('utc', now()),
        last_error_code = coalesce(nullif(ticket_error, ''), 'InvalidExpoTicket'),
        last_error_message = left(coalesce(ticket_message, 'Expo returned an invalid push ticket.'), 500),
        updated_at = timezone('utc', now())
      where id = target_job.id;
    end if;
  end loop;

  return processed_count;
end;
$$;

revoke all on function private.process_push_send_responses(integer) from public, anon, authenticated;
grant execute on function private.process_push_send_responses(integer) to service_role;

create or replace function private.request_due_push_receipts(batch_limit integer default 1000)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public, private, net
as $$
declare
  target_job_ids uuid[];
  target_ticket_ids text[];
  target_request_id bigint;
  normalized_limit integer := least(greatest(coalesce(batch_limit, 1000), 1), 1000);
begin
  with due_jobs as (
    select jobs.id, jobs.ticket_id
    from private.push_delivery_jobs as jobs
    where jobs.status in ('awaiting_receipt', 'retry_receipt')
      and jobs.receipt_due_at <= timezone('utc', now())
      and jobs.receipt_attempt_count < 4
      and jobs.ticket_id is not null
      and jobs.expires_at > timezone('utc', now())
    order by jobs.receipt_due_at, jobs.created_at
    for update skip locked
    limit normalized_limit
  )
  select array_agg(id), array_agg(ticket_id)
  into target_job_ids, target_ticket_ids
  from due_jobs;

  if coalesce(array_length(target_job_ids, 1), 0) = 0 then
    return 0;
  end if;

  begin
    target_request_id := net.http_post(
      url := 'https://exp.host/--/api/v2/push/getReceipts',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Accept', 'application/json'
      ),
      body := jsonb_build_object('ids', to_jsonb(target_ticket_ids))
    );

    update private.push_delivery_jobs
    set
      status = 'checking_receipt',
      receipt_attempt_count = receipt_attempt_count + 1,
      receipt_request_id = target_request_id,
      receipt_requested_at = timezone('utc', now()),
      updated_at = timezone('utc', now())
    where id = any(target_job_ids);
  exception
    when others then
      update private.push_delivery_jobs
      set
        status = case when receipt_attempt_count >= 3 then 'failed' else 'retry_receipt' end,
        receipt_attempt_count = receipt_attempt_count + 1,
        receipt_due_at = timezone('utc', now()) + private.push_receipt_retry_delay(receipt_attempt_count + 1),
        completed_at = case when receipt_attempt_count >= 3 then timezone('utc', now()) else null end,
        last_error_code = 'ReceiptEnqueueError',
        last_error_message = left(sqlerrm, 500),
        updated_at = timezone('utc', now())
      where id = any(target_job_ids);
  end;

  return coalesce(array_length(target_job_ids, 1), 0);
end;
$$;

revoke all on function private.request_due_push_receipts(integer) from public, anon, authenticated;
grant execute on function private.request_due_push_receipts(integer) to service_role;

create or replace function private.process_push_receipt_responses(request_limit integer default 20)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public, private, net
as $$
declare
  target_request record;
  target_job record;
  response_payload jsonb;
  receipt_data jsonb;
  receipt_status text;
  receipt_error text;
  receipt_message text;
  processed_count integer := 0;
  normalized_limit integer := least(greatest(coalesce(request_limit, 20), 1), 100);
begin
  for target_request in
    select
      jobs.receipt_request_id,
      min(jobs.receipt_requested_at) as receipt_requested_at,
      responses.id as response_id,
      responses.status_code,
      responses.content,
      responses.timed_out,
      responses.error_msg
    from private.push_delivery_jobs as jobs
    left join net._http_response as responses
      on responses.id = jobs.receipt_request_id
    where jobs.status = 'checking_receipt'
      and (
        responses.id is not null
        or jobs.receipt_requested_at < timezone('utc', now()) - interval '2 minutes'
      )
    group by
      jobs.receipt_request_id,
      responses.id,
      responses.status_code,
      responses.content,
      responses.timed_out,
      responses.error_msg
    order by min(jobs.receipt_requested_at)
    limit normalized_limit
  loop
    if target_request.response_id is null
      or coalesce(target_request.timed_out, false)
      or target_request.error_msg is not null
      or target_request.status_code = 429
      or target_request.status_code between 500 and 599
    then
      update private.push_delivery_jobs
      set
        status = case when receipt_attempt_count >= 4 then 'failed' else 'retry_receipt' end,
        receipt_request_id = null,
        receipt_due_at = timezone('utc', now()) + private.push_receipt_retry_delay(receipt_attempt_count),
        completed_at = case when receipt_attempt_count >= 4 then timezone('utc', now()) else null end,
        last_error_code = case
          when target_request.response_id is null then 'ReceiptResponseTimeout'
          when target_request.status_code = 429 then 'ExpoReceiptRateLimited'
          else 'ExpoReceiptUnavailable'
        end,
        last_error_message = left(
          coalesce(target_request.error_msg, 'Expo receipt response was unavailable.'),
          500
        ),
        updated_at = timezone('utc', now())
      where receipt_request_id = target_request.receipt_request_id
        and status = 'checking_receipt';
      continue;
    end if;

    if target_request.status_code < 200 or target_request.status_code >= 300 then
      update private.push_delivery_jobs
      set
        status = 'failed',
        completed_at = timezone('utc', now()),
        last_error_code = 'ExpoReceiptHttpError',
        last_error_message = left('Expo receipt endpoint returned HTTP ' || target_request.status_code::text, 500),
        updated_at = timezone('utc', now())
      where receipt_request_id = target_request.receipt_request_id
        and status = 'checking_receipt';
      continue;
    end if;

    begin
      response_payload := target_request.content::jsonb;
    exception
      when others then
        response_payload := null;
    end;

    for target_job in
      select
        jobs.id,
        jobs.push_token_id,
        jobs.expo_push_token,
        jobs.ticket_id,
        jobs.send_attempt_count,
        jobs.receipt_attempt_count
      from private.push_delivery_jobs as jobs
      where jobs.receipt_request_id = target_request.receipt_request_id
        and jobs.status = 'checking_receipt'
      order by jobs.created_at
      for update skip locked
    loop
      processed_count := processed_count + 1;
      receipt_data := response_payload #> array['data', target_job.ticket_id];

      if receipt_data is null then
        update private.push_delivery_jobs
        set
          status = case when target_job.receipt_attempt_count >= 4 then 'failed' else 'retry_receipt' end,
          receipt_request_id = null,
          receipt_due_at = timezone('utc', now()) + private.push_receipt_retry_delay(target_job.receipt_attempt_count),
          completed_at = case when target_job.receipt_attempt_count >= 4 then timezone('utc', now()) else null end,
          last_error_code = 'ReceiptNotReady',
          last_error_message = 'Expo has not produced a receipt for this ticket yet.',
          updated_at = timezone('utc', now())
        where id = target_job.id;
        continue;
      end if;

      receipt_status := receipt_data ->> 'status';
      receipt_error := receipt_data #>> '{details,error}';
      receipt_message := receipt_data ->> 'message';

      update public.user_push_tokens
      set
        last_receipt_at = timezone('utc', now()),
        updated_at = timezone('utc', now())
      where id = target_job.push_token_id
        and expo_push_token = target_job.expo_push_token;

      if receipt_status = 'ok' then
        update private.push_delivery_jobs
        set
          status = 'delivered',
          completed_at = timezone('utc', now()),
          last_error_code = null,
          last_error_message = null,
          updated_at = timezone('utc', now())
        where id = target_job.id;
      elsif receipt_error = 'DeviceNotRegistered' then
        perform private.deactivate_unregistered_push_token(
          target_job.push_token_id,
          target_job.expo_push_token,
          receipt_error
        );

        update private.push_delivery_jobs
        set
          status = 'unregistered',
          completed_at = timezone('utc', now()),
          last_error_code = receipt_error,
          last_error_message = left(coalesce(receipt_message, 'The device is no longer registered for push.'), 500),
          updated_at = timezone('utc', now())
        where id = target_job.id;
      elsif receipt_error = 'MessageRateExceeded' and target_job.send_attempt_count < 4 then
        update private.push_delivery_jobs
        set
          status = 'retry_send',
          ticket_id = null,
          receipt_request_id = null,
          receipt_due_at = null,
          next_attempt_at = timezone('utc', now()) + private.push_send_retry_delay(target_job.send_attempt_count),
          last_error_code = receipt_error,
          last_error_message = left(coalesce(receipt_message, 'The device message rate was exceeded.'), 500),
          updated_at = timezone('utc', now())
        where id = target_job.id;
      else
        update private.push_delivery_jobs
        set
          status = 'failed',
          completed_at = timezone('utc', now()),
          last_error_code = coalesce(nullif(receipt_error, ''), 'InvalidExpoReceipt'),
          last_error_message = left(coalesce(receipt_message, 'Expo returned a failed push receipt.'), 500),
          updated_at = timezone('utc', now())
        where id = target_job.id;
      end if;
    end loop;
  end loop;

  return processed_count;
end;
$$;

revoke all on function private.process_push_receipt_responses(integer) from public, anon, authenticated;
grant execute on function private.process_push_receipt_responses(integer) to service_role;

create or replace function private.run_push_delivery_worker()
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, private, net
as $$
begin
  if not pg_try_advisory_xact_lock(hashtextextended('sorita-push-delivery-worker', 0)) then
    return;
  end if;

  update private.push_delivery_jobs
  set
    status = 'failed',
    completed_at = timezone('utc', now()),
    last_error_code = 'DeliveryExpired',
    last_error_message = 'Push delivery exceeded its 24-hour lifetime.',
    updated_at = timezone('utc', now())
  where status not in ('delivered', 'unregistered', 'failed', 'cancelled')
    and expires_at <= timezone('utc', now());

  update private.push_delivery_jobs
  set
    status = 'failed',
    completed_at = timezone('utc', now()),
    last_error_code = 'ReceiptAttemptsExhausted',
    last_error_message = 'Expo receipt lookup reached its retry limit.',
    updated_at = timezone('utc', now())
  where status in ('awaiting_receipt', 'retry_receipt')
    and receipt_attempt_count >= 4;

  perform private.process_push_send_responses(500);
  perform private.process_push_receipt_responses(50);
  perform private.dispatch_pending_push_jobs(100);
  perform private.request_due_push_receipts(1000);

  delete from private.push_delivery_jobs
  where (
      status in ('delivered', 'cancelled')
      and completed_at < timezone('utc', now()) - interval '7 days'
    )
    or (
      status in ('unregistered', 'failed')
      and completed_at < timezone('utc', now()) - interval '30 days'
    );
end;
$$;

revoke all on function private.run_push_delivery_worker() from public, anon, authenticated;
grant execute on function private.run_push_delivery_worker() to service_role;

create or replace function private.dispatch_push_notification()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  target_actor_name text;
  target_push_title text;
  unread_badge_count integer := 0;
  target_token record;
  target_job_id uuid;
  target_payload jsonb;
begin
  if new.recipient_user_id is null then
    return new;
  end if;

  select name
  into target_actor_name
  from public.profiles
  where id = new.actor_user_id;

  target_push_title := nullif(trim(coalesce(new.push_title, '')), '');

  select count(*)
  into unread_badge_count
  from public.notifications
  where recipient_user_id = new.recipient_user_id
    and read = false;

  for target_token in
    select id, expo_push_token
    from public.user_push_tokens
    where user_id = new.recipient_user_id
      and is_active = true
    order by last_seen_at desc
  loop
    target_job_id := gen_random_uuid();
    target_payload := jsonb_build_object(
      'to', target_token.expo_push_token,
      'title', coalesce(target_push_title, target_actor_name, 'SoRita'),
      'body', new.message,
      'sound', 'default',
      'priority', 'high',
      'badge', greatest(unread_badge_count, 1),
      'interruptionLevel', 'active',
      'ttl', 86400,
      'data', jsonb_build_object(
        'notificationId', new.id,
        'deliveryId', target_job_id,
        'type', new.type,
        'userId', new.actor_user_id,
        'listId', new.list_id,
        'placeId', new.list_place_id
      )
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
      target_job_id,
      new.id,
      target_token.id,
      new.recipient_user_id,
      target_token.expo_push_token,
      target_payload
    )
    on conflict (notification_id, push_token_id) do nothing;
  end loop;

  begin
    perform private.dispatch_pending_push_jobs(100);
  exception
    when others then
      null;
  end;

  return new;
end;
$$;

revoke all on function private.dispatch_push_notification() from public, anon, authenticated;

drop trigger if exists notifications_dispatch_push on public.notifications;
create trigger notifications_dispatch_push
after insert on public.notifications
for each row
execute function private.dispatch_push_notification();

drop function if exists public.dispatch_push_notification();

do $$
declare
  existing_job_id bigint;
begin
  if to_regclass('cron.job') is null then
    raise warning 'pg_cron is unavailable; private.run_push_delivery_worker() must be invoked externally once per minute';
    return;
  end if;

  for existing_job_id in
    select jobid
    from cron.job
    where jobname = 'sorita-push-delivery-worker'
  loop
    perform cron.unschedule(existing_job_id);
  end loop;

  perform cron.schedule(
    'sorita-push-delivery-worker',
    '* * * * *',
    'select private.run_push_delivery_worker();'
  );
end
$$;
