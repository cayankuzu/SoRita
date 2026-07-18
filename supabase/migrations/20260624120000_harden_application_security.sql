create table if not exists private.edge_rate_limits (
  scope text not null,
  identifier text not null,
  bucket_start timestamptz not null,
  expires_at timestamptz not null,
  request_count integer not null default 0,
  primary key (scope, identifier, bucket_start)
);
revoke all on table private.edge_rate_limits from public, anon, authenticated;
create index if not exists idx_edge_rate_limits_expires_at
  on private.edge_rate_limits (expires_at);
create table if not exists private.auth_login_guards (
  normalized_email text primary key,
  failure_count integer not null default 0,
  first_failed_at timestamptz,
  last_failed_at timestamptz,
  locked_until timestamptz
);
revoke all on table private.auth_login_guards from public, anon, authenticated;
create index if not exists idx_auth_login_guards_locked_until
  on private.auth_login_guards (locked_until);
create or replace function private.strip_control_chars(value text)
returns text
language sql
immutable
as $$
  select trim(regexp_replace(coalesce(value, ''), '[[:cntrl:]]', '', 'g'));
$$;
create or replace function private.clamp_text(value text, max_length integer)
returns text
language sql
immutable
as $$
  select left(private.strip_control_chars(value), greatest(max_length, 0));
$$;
create or replace function private.normalize_optional_text(value text, max_length integer)
returns text
language sql
immutable
as $$
  select nullif(private.clamp_text(value, max_length), '');
$$;
create or replace function private.normalize_required_text(value text, max_length integer)
returns text
language sql
immutable
as $$
  select private.clamp_text(value, max_length);
$$;
create or replace function private.normalize_username(value text)
returns text
language sql
immutable
as $$
  select lower(
    regexp_replace(
      private.strip_control_chars(value),
      '[^a-zA-Z0-9_]',
      '',
      'g'
    )
  );
$$;
create or replace function private.normalize_email(value text)
returns text
language sql
immutable
as $$
  select lower(private.strip_control_chars(value));
$$;
create or replace function private.normalize_text_array(
  input_values text[],
  max_items integer default 12,
  max_item_length integer default 64
)
returns text[]
language sql
immutable
as $$
  select coalesce(
    array(
      select normalized
      from (
        select normalized, min(ord) as min_ord
        from (
          select
            nullif(private.clamp_text(value, max_item_length), '') as normalized,
            ord
          from unnest(coalesce(input_values, '{}'::text[])) with ordinality as raw(value, ord)
        ) normalized_values
        where normalized is not null
        group by normalized
        order by min(ord)
        limit greatest(max_items, 0)
      ) deduped
      order by min_ord
    ),
    '{}'::text[]
  );
$$;
create or replace function public.enforce_edge_rate_limit(
  input_scope text,
  input_identifier text,
  input_window_seconds integer,
  input_max_requests integer
)
returns table (
  allowed boolean,
  remaining integer,
  retry_after_seconds integer
)
language plpgsql
security definer
set search_path = public, private
as $$
declare
  normalized_scope text;
  normalized_identifier text;
  now_utc timestamptz := timezone('utc', now());
  bucket timestamptz;
  expires_at timestamptz;
  next_count integer;
begin
  normalized_scope := nullif(private.strip_control_chars(input_scope), '');
  normalized_identifier := nullif(private.strip_control_chars(input_identifier), '');

  if normalized_scope is null or normalized_identifier is null then
    raise exception 'Rate limit scope and identifier are required';
  end if;

  if input_window_seconds <= 0 or input_max_requests <= 0 then
    raise exception 'Rate limit window and max requests must be positive';
  end if;

  delete from private.edge_rate_limits
  where expires_at <= now_utc;

  bucket := to_timestamp(
    floor(extract(epoch from now_utc) / input_window_seconds) * input_window_seconds
  );
  expires_at := bucket + make_interval(secs => input_window_seconds);

  insert into private.edge_rate_limits (
    scope,
    identifier,
    bucket_start,
    expires_at,
    request_count
  )
  values (
    normalized_scope,
    normalized_identifier,
    bucket,
    expires_at,
    1
  )
  on conflict (scope, identifier, bucket_start)
  do update
  set
    expires_at = excluded.expires_at,
    request_count = private.edge_rate_limits.request_count + 1
  returning request_count into next_count;

  return query
  select
    next_count <= input_max_requests,
    greatest(input_max_requests - next_count, 0),
    greatest(ceil(extract(epoch from expires_at - now_utc))::integer, 1);
end;
$$;
revoke all on function public.enforce_edge_rate_limit(text, text, integer, integer) from public, anon, authenticated;
grant execute on function public.enforce_edge_rate_limit(text, text, integer, integer) to service_role;
create or replace function public.get_auth_login_guard_status(input_email text)
returns table (
  failure_count integer,
  locked_until timestamptz,
  retry_after_seconds integer
)
language plpgsql
security definer
set search_path = public, private
as $$
declare
  normalized_email text := nullif(private.normalize_email(input_email), '');
  guard_row private.auth_login_guards%rowtype;
  now_utc timestamptz := timezone('utc', now());
begin
  if normalized_email is null then
    return;
  end if;

  delete from private.auth_login_guards
  where locked_until is not null
    and locked_until <= now_utc
    and coalesce(last_failed_at, first_failed_at, now_utc) <= now_utc - interval '1 day';

  select *
  into guard_row
  from private.auth_login_guards
  where private.auth_login_guards.normalized_email = normalized_email;

  if not found then
    return;
  end if;

  if guard_row.locked_until is not null and guard_row.locked_until <= now_utc then
    delete from private.auth_login_guards
    where private.auth_login_guards.normalized_email = normalized_email;
    return;
  end if;

  return query
  select
    guard_row.failure_count,
    guard_row.locked_until,
    case
      when guard_row.locked_until is null then 0
      else greatest(ceil(extract(epoch from guard_row.locked_until - now_utc))::integer, 1)
    end;
end;
$$;
revoke all on function public.get_auth_login_guard_status(text) from public, anon, authenticated;
grant execute on function public.get_auth_login_guard_status(text) to service_role;
create or replace function public.record_auth_login_failure(
  input_email text,
  lockout_threshold integer default 5,
  lockout_minutes integer default 15,
  failure_window_minutes integer default 15
)
returns table (
  failure_count integer,
  locked_until timestamptz,
  retry_after_seconds integer
)
language plpgsql
security definer
set search_path = public, private
as $$
declare
  normalized_email text := nullif(private.normalize_email(input_email), '');
  existing_row private.auth_login_guards%rowtype;
  next_failure_count integer;
  next_first_failed_at timestamptz;
  next_last_failed_at timestamptz := timezone('utc', now());
  next_locked_until timestamptz;
begin
  if normalized_email is null then
    raise exception 'Normalized email is required';
  end if;

  if lockout_threshold <= 0 or lockout_minutes <= 0 or failure_window_minutes <= 0 then
    raise exception 'Auth lockout configuration must be positive';
  end if;

  select *
  into existing_row
  from private.auth_login_guards
  where private.auth_login_guards.normalized_email = normalized_email
  for update;

  if found
    and existing_row.locked_until is not null
    and existing_row.locked_until > next_last_failed_at then
    return query
    select
      existing_row.failure_count,
      existing_row.locked_until,
      greatest(ceil(extract(epoch from existing_row.locked_until - next_last_failed_at))::integer, 1);
    return;
  end if;

  if not found
    or existing_row.first_failed_at is null
    or existing_row.first_failed_at <= next_last_failed_at - make_interval(mins => failure_window_minutes) then
    next_failure_count := 1;
    next_first_failed_at := next_last_failed_at;
  else
    next_failure_count := existing_row.failure_count + 1;
    next_first_failed_at := existing_row.first_failed_at;
  end if;

  if next_failure_count >= lockout_threshold then
    next_locked_until := next_last_failed_at + make_interval(mins => lockout_minutes);
  else
    next_locked_until := null;
  end if;

  insert into private.auth_login_guards (
    normalized_email,
    failure_count,
    first_failed_at,
    last_failed_at,
    locked_until
  )
  values (
    normalized_email,
    next_failure_count,
    next_first_failed_at,
    next_last_failed_at,
    next_locked_until
  )
  on conflict (normalized_email)
  do update
  set
    failure_count = excluded.failure_count,
    first_failed_at = excluded.first_failed_at,
    last_failed_at = excluded.last_failed_at,
    locked_until = excluded.locked_until;

  return query
  select
    next_failure_count,
    next_locked_until,
    case
      when next_locked_until is null then 0
      else greatest(ceil(extract(epoch from next_locked_until - next_last_failed_at))::integer, 1)
    end;
end;
$$;
revoke all on function public.record_auth_login_failure(text, integer, integer, integer) from public, anon, authenticated;
grant execute on function public.record_auth_login_failure(text, integer, integer, integer) to service_role;
create or replace function public.clear_auth_login_failures(input_email text)
returns void
language plpgsql
security definer
set search_path = public, private
as $$
declare
  normalized_email text := nullif(private.normalize_email(input_email), '');
begin
  if normalized_email is null then
    return;
  end if;

  delete from private.auth_login_guards
  where private.auth_login_guards.normalized_email = normalized_email;
end;
$$;
revoke all on function public.clear_auth_login_failures(text) from public, anon, authenticated;
grant execute on function public.clear_auth_login_failures(text) to service_role;
create or replace function public.normalize_profile_fields()
returns trigger
language plpgsql
set search_path = public, private
as $$
begin
  new.email := private.normalize_email(new.email);
  new.name := private.normalize_required_text(new.name, 60);
  new.username := private.normalize_username(new.username);
  new.bio := private.normalize_optional_text(new.bio, 150);
  new.interests := private.normalize_text_array(new.interests, 20, 40);

  if char_length(new.name) < 2 then
    raise exception 'Profile name must be at least 2 characters long';
  end if;

  if char_length(new.email) < 3 or new.email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Profile email is invalid';
  end if;

  if new.username !~ '^[a-z0-9_]{3,30}$' then
    raise exception 'Profile username must be 3-30 lowercase letters, numbers, or underscores';
  end if;

  return new;
end;
$$;
create or replace function public.normalize_list_fields()
returns trigger
language plpgsql
set search_path = public, private
as $$
begin
  new.name := private.normalize_required_text(new.name, 100);
  new.description := private.normalize_optional_text(new.description, 300);
  new.emoji := private.normalize_optional_text(new.emoji, 8);

  if char_length(new.name) < 1 then
    raise exception 'List name is required';
  end if;

  return new;
end;
$$;
create or replace function public.normalize_list_place_fields()
returns trigger
language plpgsql
set search_path = public, private
as $$
begin
  new.name := private.normalize_required_text(new.name, 100);
  new.title := private.normalize_optional_text(new.title, 100);
  new.address := private.normalize_optional_text(new.address, 150);
  new.notes := private.normalize_optional_text(new.notes, 300);
  new.category := private.normalize_optional_text(new.category, 40);
  new.categories := private.normalize_text_array(new.categories, 12, 40);
  new.best_time := private.normalize_optional_text(new.best_time, 40);
  new.best_times := private.normalize_text_array(new.best_times, 8, 40);
  new.atmosphere := private.normalize_text_array(new.atmosphere, 12, 40);
  new.special_features := private.normalize_text_array(new.special_features, 12, 40);

  if char_length(new.name) < 1 then
    raise exception 'Place name is required';
  end if;

  if new.lat < -90 or new.lat > 90 then
    raise exception 'Place latitude is out of range';
  end if;

  if new.lng < -180 or new.lng > 180 then
    raise exception 'Place longitude is out of range';
  end if;

  return new;
end;
$$;
create or replace function public.normalize_place_comment_fields()
returns trigger
language plpgsql
set search_path = public, private
as $$
begin
  new.content := private.normalize_required_text(new.content, 300);

  if char_length(new.content) < 1 then
    raise exception 'Comment content is required';
  end if;

  return new;
end;
$$;
create or replace function public.normalize_report_reason_fields()
returns trigger
language plpgsql
set search_path = public, private
as $$
begin
  new.reason := private.normalize_required_text(new.reason, 160);

  if char_length(new.reason) < 1 then
    raise exception 'Report reason is required';
  end if;

  return new;
end;
$$;
update public.profiles
set
  email = private.normalize_email(email),
  name = private.normalize_required_text(name, 60),
  username = private.normalize_username(username),
  bio = private.normalize_optional_text(bio, 150),
  interests = private.normalize_text_array(interests, 20, 40);
update public.lists
set
  name = private.normalize_required_text(name, 100),
  description = private.normalize_optional_text(description, 300),
  emoji = private.normalize_optional_text(emoji, 8);
update public.list_places
set
  name = private.normalize_required_text(name, 100),
  title = private.normalize_optional_text(title, 100),
  address = private.normalize_optional_text(address, 150),
  notes = private.normalize_optional_text(notes, 300),
  category = private.normalize_optional_text(category, 40),
  categories = private.normalize_text_array(categories, 12, 40),
  best_time = private.normalize_optional_text(best_time, 40),
  best_times = private.normalize_text_array(best_times, 8, 40),
  atmosphere = private.normalize_text_array(atmosphere, 12, 40),
  special_features = private.normalize_text_array(special_features, 12, 40);
update public.list_place_comments
set content = private.normalize_required_text(content, 300);
update public.user_reports
set reason = private.normalize_required_text(reason, 160);
update public.list_reports
set reason = private.normalize_required_text(reason, 160);
update public.list_place_reports
set reason = private.normalize_required_text(reason, 160);
update public.list_place_comment_reports
set reason = private.normalize_required_text(reason, 160);
drop trigger if exists profiles_normalize_security_fields on public.profiles;
create trigger profiles_normalize_security_fields
before insert or update on public.profiles
for each row
execute function public.normalize_profile_fields();
drop trigger if exists lists_normalize_security_fields on public.lists;
create trigger lists_normalize_security_fields
before insert or update on public.lists
for each row
execute function public.normalize_list_fields();
drop trigger if exists list_places_normalize_security_fields on public.list_places;
create trigger list_places_normalize_security_fields
before insert or update on public.list_places
for each row
execute function public.normalize_list_place_fields();
drop trigger if exists list_place_comments_normalize_security_fields on public.list_place_comments;
create trigger list_place_comments_normalize_security_fields
before insert or update on public.list_place_comments
for each row
execute function public.normalize_place_comment_fields();
drop trigger if exists user_reports_normalize_security_fields on public.user_reports;
create trigger user_reports_normalize_security_fields
before insert or update on public.user_reports
for each row
execute function public.normalize_report_reason_fields();
drop trigger if exists list_reports_normalize_security_fields on public.list_reports;
create trigger list_reports_normalize_security_fields
before insert or update on public.list_reports
for each row
execute function public.normalize_report_reason_fields();
drop trigger if exists list_place_reports_normalize_security_fields on public.list_place_reports;
create trigger list_place_reports_normalize_security_fields
before insert or update on public.list_place_reports
for each row
execute function public.normalize_report_reason_fields();
drop trigger if exists list_place_comment_reports_normalize_security_fields on public.list_place_comment_reports;
create trigger list_place_comment_reports_normalize_security_fields
before insert or update on public.list_place_comment_reports
for each row
execute function public.normalize_report_reason_fields();
alter table public.profiles
drop constraint if exists profiles_name_min_length_check;
alter table public.profiles
add constraint profiles_name_length_check
check (char_length(name) between 2 and 60);
alter table public.profiles
drop constraint if exists profiles_username_format_check;
alter table public.profiles
add constraint profiles_username_format_check
check (username ~ '^[a-z0-9_]{3,30}$');
alter table public.profiles
drop constraint if exists profiles_bio_length_check;
alter table public.profiles
add constraint profiles_bio_length_check
check (bio is null or char_length(bio) <= 150);
alter table public.profiles
drop constraint if exists profiles_email_format_check;
alter table public.profiles
add constraint profiles_email_format_check
check (email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$');
alter table public.lists
drop constraint if exists lists_name_length_check;
alter table public.lists
add constraint lists_name_length_check
check (char_length(name) between 1 and 100);
alter table public.lists
drop constraint if exists lists_description_length_check;
alter table public.lists
add constraint lists_description_length_check
check (description is null or char_length(description) <= 300);
alter table public.list_places
drop constraint if exists list_places_name_length_check;
alter table public.list_places
add constraint list_places_name_length_check
check (char_length(name) between 1 and 100);
alter table public.list_places
drop constraint if exists list_places_title_length_check;
alter table public.list_places
add constraint list_places_title_length_check
check (title is null or char_length(title) <= 100);
alter table public.list_places
drop constraint if exists list_places_address_length_check;
alter table public.list_places
add constraint list_places_address_length_check
check (address is null or char_length(address) <= 150);
alter table public.list_places
drop constraint if exists list_places_notes_length_check;
alter table public.list_places
add constraint list_places_notes_length_check
check (notes is null or char_length(notes) <= 300);
alter table public.list_places
drop constraint if exists list_places_lat_lng_range_check;
alter table public.list_places
add constraint list_places_lat_lng_range_check
check (lat between -90 and 90 and lng between -180 and 180);
alter table public.list_place_comments
drop constraint if exists list_place_comments_content_check;
alter table public.list_place_comments
add constraint list_place_comments_content_check
check (char_length(content) between 1 and 300);
alter table public.user_reports
drop constraint if exists user_reports_reason_check;
alter table public.user_reports
add constraint user_reports_reason_check
check (char_length(reason) between 1 and 160);
alter table public.list_reports
drop constraint if exists list_reports_reason_check;
alter table public.list_reports
add constraint list_reports_reason_check
check (char_length(reason) between 1 and 160);
alter table public.list_place_reports
drop constraint if exists list_place_reports_reason_check;
alter table public.list_place_reports
add constraint list_place_reports_reason_check
check (char_length(reason) between 1 and 160);
alter table public.list_place_comment_reports
drop constraint if exists list_place_comment_reports_reason_check;
alter table public.list_place_comment_reports
add constraint list_place_comment_reports_reason_check
check (char_length(reason) between 1 and 160);
