-- Close the remaining database-side compliance gaps without changing the
-- published client contracts. Consent is fail-closed, sanctions are enforced
-- below RLS as well as in privileged RPCs, and bounded exports disclose every
-- collection that can be truncated.

begin;

create or replace function private.record_legal_consent()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  user_metadata jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  accepted_documents text[];
  accepted_at timestamptz;
begin
  -- auth.users is the final signup boundary. A caller that bypasses the
  -- auth-gateway must not be able to create a consent-less account.
  if jsonb_typeof(user_metadata) is distinct from 'object'
    or (user_metadata ->> 'legal_consent_version') is distinct from
      '2026-09-08-terms-community-privacy' then
    raise exception using
      errcode = '22023',
      message = 'legal_consent_version_required';
  end if;

  if jsonb_typeof(user_metadata -> 'legal_consent_documents') is distinct from 'array' then
    raise exception using
      errcode = '22023',
      message = 'legal_consent_documents_required';
  end if;

  begin
    select array_agg(document.value order by document.value)
      into accepted_documents
      from jsonb_array_elements_text(
        user_metadata -> 'legal_consent_documents'
      ) as document(value);
  exception
    when data_exception then
      raise exception using
        errcode = '22023',
        message = 'legal_consent_documents_required';
  end;

  if accepted_documents is distinct from
    array['community', 'kvkk', 'privacy', 'terms']::text[] then
    raise exception using
      errcode = '22023',
      message = 'legal_consent_documents_required';
  end if;

  begin
    accepted_at := nullif(user_metadata ->> 'legal_consent_at', '')::timestamptz;
  exception
    when invalid_datetime_format or datetime_field_overflow then
      raise exception using
        errcode = '22023',
        message = 'legal_consent_timestamp_invalid';
  end;

  if accepted_at is null
    or accepted_at < timezone('utc', now()) - interval '24 hours'
    or accepted_at > timezone('utc', now()) + interval '5 minutes' then
    raise exception using
      errcode = '22023',
      message = 'legal_consent_timestamp_invalid';
  end if;

  insert into public.legal_consent_records (
    user_id,
    consent_version,
    documents_accepted,
    accepted_at
  ) values (
    new.id,
    '2026-09-08-terms-community-privacy',
    accepted_documents,
    accepted_at
  );

  return new;
end;
$$;

revoke all on function private.record_legal_consent()
from public, anon, authenticated, service_role;

-- Keep the visibility helpers safe when they are reached from RLS policies or
-- from SECURITY DEFINER routines. These helpers are intentionally fail-closed
-- for both a sanctioned viewer and sanctioned content provenance.
create or replace function private.can_manage_list_place(target_list_place_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, private
as $$
  select not private.has_active_moderation_sanction(auth.uid())
    and exists (
      select 1
        from public.list_places
        join public.lists on lists.id = list_places.list_id
       where list_places.id = target_list_place_id
         and lists.owner_id = auth.uid()
         and not private.has_active_moderation_sanction(lists.owner_id)
    );
$$;

revoke all on function private.can_manage_list_place(uuid) from public;
grant execute on function private.can_manage_list_place(uuid) to authenticated;

create or replace function private.can_view_list(target_list_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, private
as $$
  select not private.has_active_moderation_sanction(auth.uid())
    and exists (
      select 1
        from public.lists
       where lists.id = target_list_id
         and (lists.is_public or lists.owner_id = auth.uid())
         and not private.has_active_moderation_sanction(lists.owner_id)
         and (
           lists.owner_id = auth.uid()
           or not private.users_have_block_relation(auth.uid(), lists.owner_id)
         )
    );
$$;

revoke all on function private.can_view_list(uuid) from public;
grant execute on function private.can_view_list(uuid) to authenticated;

create or replace function private.can_view_list_place(target_list_place_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, private
as $$
  select not private.has_active_moderation_sanction(auth.uid())
    and exists (
      select 1
        from public.list_places
        join public.lists on lists.id = list_places.list_id
       where list_places.id = target_list_place_id
         and private.can_view_list(lists.id)
         and not private.has_active_moderation_sanction(list_places.created_by)
         and not private.has_active_moderation_sanction(list_places.source_user_id)
         and (
           list_places.created_by is null
           or list_places.created_by = auth.uid()
           or not private.users_have_block_relation(auth.uid(), list_places.created_by)
         )
         and (
           list_places.source_user_id is null
           or list_places.source_user_id = auth.uid()
           or not private.users_have_block_relation(auth.uid(), list_places.source_user_id)
         )
    );
$$;

revoke all on function private.can_view_list_place(uuid) from public;
grant execute on function private.can_view_list_place(uuid) to authenticated;

create or replace function private.can_view_list_place_comment(target_comment_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, private
as $$
  select not private.has_active_moderation_sanction(auth.uid())
    and exists (
      select 1
        from public.list_place_comments
       where list_place_comments.id = target_comment_id
         and private.can_view_list_place(list_place_comments.list_place_id)
         and not private.has_active_moderation_sanction(list_place_comments.user_id)
         and (
           list_place_comments.user_id = auth.uid()
           or not private.users_have_block_relation(auth.uid(), list_place_comments.user_id)
         )
    );
$$;

revoke all on function private.can_view_list_place_comment(uuid) from public;
grant execute on function private.can_view_list_place_comment(uuid) to authenticated;

create or replace function private.list_place_has_active_moderation_sanction(
  p_list_place_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, private
as $$
  select exists (
    select 1
      from public.list_places
      join public.lists on lists.id = list_places.list_id
     where list_places.id = p_list_place_id
       and (
         private.has_active_moderation_sanction(lists.owner_id)
         or private.has_active_moderation_sanction(list_places.created_by)
         or private.has_active_moderation_sanction(list_places.source_user_id)
       )
  );
$$;

revoke all on function private.list_place_has_active_moderation_sanction(uuid)
from public, anon, authenticated, service_role;
grant execute on function private.list_place_has_active_moderation_sanction(uuid)
to authenticated;

drop policy if exists moderation_sanction_blocks_list_like_writes
on public.list_likes;
create policy moderation_sanction_blocks_list_like_writes
on public.list_likes
as restrictive
for all
to authenticated
using (not private.has_active_moderation_sanction(auth.uid()))
with check (not private.has_active_moderation_sanction(auth.uid()));

drop policy if exists moderation_sanction_blocks_place_like_writes
on public.list_place_likes;
create policy moderation_sanction_blocks_place_like_writes
on public.list_place_likes
as restrictive
for all
to authenticated
using (not private.has_active_moderation_sanction(auth.uid()))
with check (not private.has_active_moderation_sanction(auth.uid()));

drop policy if exists moderation_sanction_blocks_comment_like_writes
on public.list_place_comment_likes;
create policy moderation_sanction_blocks_comment_like_writes
on public.list_place_comment_likes
as restrictive
for all
to authenticated
using (not private.has_active_moderation_sanction(auth.uid()))
with check (not private.has_active_moderation_sanction(auth.uid()));

drop policy if exists moderation_sanction_blocks_follow_request_writes
on public.follow_requests;
create policy moderation_sanction_blocks_follow_request_writes
on public.follow_requests
as restrictive
for all
to authenticated
using (not private.has_active_moderation_sanction(auth.uid()))
with check (not private.has_active_moderation_sanction(auth.uid()));

drop policy if exists moderation_sanction_blocks_place_media_writes
on public.list_place_photos;
create policy moderation_sanction_blocks_place_media_writes
on public.list_place_photos
as restrictive
for all
to authenticated
using (not private.has_active_moderation_sanction(auth.uid()))
with check (not private.has_active_moderation_sanction(auth.uid()));

drop policy if exists moderation_hides_sanctioned_place_media
on public.list_place_photos;
create policy moderation_hides_sanctioned_place_media
on public.list_place_photos
as restrictive
for select
to authenticated
using (
  not private.has_active_moderation_sanction(asset_owner_id)
  and not private.list_place_has_active_moderation_sanction(list_place_id)
);

-- RLS does not constrain table owners. A row trigger makes the same invariant
-- apply to every privileged routine reached with an authenticated user's JWT.
create or replace function private.reject_sanctioned_actor_mutation()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, private
as $$
begin
  if private.has_active_moderation_sanction(auth.uid()) then
    raise exception using
      errcode = '42501',
      message = 'active_moderation_sanction';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke all on function private.reject_sanctioned_actor_mutation()
from public, anon, authenticated, service_role;

do $do$
declare
  target_table regclass;
  trigger_name text;
begin
  foreach target_table in array array[
    'public.profiles'::regclass,
    'public.lists'::regclass,
    'public.list_places'::regclass,
    'public.list_place_photos'::regclass,
    'public.list_likes'::regclass,
    'public.list_place_likes'::regclass,
    'public.list_place_comments'::regclass,
    'public.list_place_comment_likes'::regclass,
    'public.user_follows'::regclass,
    'public.follow_requests'::regclass,
    'public.user_blocks'::regclass
  ] loop
    trigger_name := 'reject_sanctioned_actor_mutation';
    execute format('drop trigger if exists %I on %s', trigger_name, target_table);
    execute format(
      'create trigger %I before insert or update or delete on %s '
      'for each row execute function private.reject_sanctioned_actor_mutation()',
      trigger_name,
      target_table
    );
  end loop;
end;
$do$;

-- The three compact privileged social implementations receive an explicit
-- entry guard in addition to the table invariant above. This keeps failures
-- deterministic even when a toggle would otherwise find no matching row.
create or replace function private.toggle_list_place_like(target_place_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'Authentication required'
      using errcode = '28000';
  end if;

  if private.has_active_moderation_sanction(current_user_id) then
    raise exception using
      errcode = '42501',
      message = 'active_moderation_sanction';
  end if;

  if not private.can_view_list_place(target_place_id) then
    raise exception 'Place is not visible'
      using errcode = '42501';
  end if;

  delete from public.list_place_likes
   where list_place_id = target_place_id
     and user_id = current_user_id;

  if found then
    return;
  end if;

  insert into public.list_place_likes (list_place_id, user_id)
  values (target_place_id, current_user_id)
  on conflict (list_place_id, user_id) do nothing;
end;
$$;

revoke all on function private.toggle_list_place_like(uuid) from public;
grant execute on function private.toggle_list_place_like(uuid) to authenticated;

create or replace function private.toggle_list_place_comment_like(target_comment_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'Authentication required'
      using errcode = '28000';
  end if;

  if private.has_active_moderation_sanction(current_user_id) then
    raise exception using
      errcode = '42501',
      message = 'active_moderation_sanction';
  end if;

  if not private.can_view_list_place_comment(target_comment_id) then
    raise exception 'Comment is not visible'
      using errcode = '42501';
  end if;

  delete from public.list_place_comment_likes
   where comment_id = target_comment_id
     and user_id = current_user_id;

  if found then
    return;
  end if;

  insert into public.list_place_comment_likes (comment_id, user_id)
  values (target_comment_id, current_user_id)
  on conflict (comment_id, user_id) do nothing;
end;
$$;

revoke all on function private.toggle_list_place_comment_like(uuid) from public;
grant execute on function private.toggle_list_place_comment_like(uuid) to authenticated;

create or replace function private.respond_to_follow_request(
  input_request_id uuid,
  input_decision text
)
returns text
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  current_user_id uuid := auth.uid();
  target_request public.follow_requests%rowtype;
  normalized_decision text;
begin
  if current_user_id is null then
    raise exception 'Authentication required'
      using errcode = '28000';
  end if;

  if private.has_active_moderation_sanction(current_user_id) then
    raise exception using
      errcode = '42501',
      message = 'active_moderation_sanction';
  end if;

  normalized_decision := lower(trim(coalesce(input_decision, '')));
  if normalized_decision not in ('accept', 'reject') then
    raise exception 'Invalid follow request decision';
  end if;

  select *
    into target_request
    from public.follow_requests
   where id = input_request_id
     and target_user_id = current_user_id
     and status = 'pending'
   for update;

  if not found then
    raise exception 'Follow request not found';
  end if;

  update public.follow_requests
     set status = case
       when normalized_decision = 'accept' then 'accepted'
       else 'rejected'
     end,
         responded_at = timezone('utc', now())
   where id = target_request.id;

  if normalized_decision = 'accept' then
    insert into public.user_follows (follower_id, following_id)
    values (target_request.requester_id, target_request.target_user_id)
    on conflict (follower_id, following_id) do nothing;
  end if;

  update public.notifications
     set read = true
   where follow_request_id = target_request.id
     and recipient_user_id = current_user_id;

  return case
    when normalized_decision = 'accept' then 'accepted'
    else 'rejected'
  end;
end;
$$;

revoke all on function private.respond_to_follow_request(uuid, text) from public;
grant execute on function private.respond_to_follow_request(uuid, text) to authenticated;

-- The atomic upsert body is intentionally retained by OID as a private,
-- non-executable implementation. The published signature becomes the sole
-- guarded entrypoint, avoiding a second copy of the large transaction body.
alter function public.upsert_list_place_with_media(jsonb, jsonb)
set schema private;
alter function private.upsert_list_place_with_media(jsonb, jsonb)
rename to upsert_list_place_with_media_implementation;
revoke all on function private.upsert_list_place_with_media_implementation(jsonb, jsonb)
from public, anon, authenticated, service_role;

create function public.upsert_list_place_with_media(
  p_place jsonb,
  p_media jsonb default '[]'::jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if private.has_active_moderation_sanction(auth.uid()) then
    raise exception using
      errcode = '42501',
      message = 'active_moderation_sanction';
  end if;

  perform private.upsert_list_place_with_media_implementation(p_place, p_media);
end;
$$;

revoke all on function public.upsert_list_place_with_media(jsonb, jsonb)
from public, anon, authenticated, service_role;
grant execute on function public.upsert_list_place_with_media(jsonb, jsonb)
to authenticated;

-- A quote-notification fallback is independently callable and therefore needs
-- the same actor gate even though fresh quoted places are already blocked.
alter function public.create_place_quote_notification(uuid, text, uuid, uuid)
set schema private;
alter function private.create_place_quote_notification(uuid, text, uuid, uuid)
rename to create_place_quote_notification_implementation;
revoke all on function private.create_place_quote_notification_implementation(
  uuid, text, uuid, uuid
)
from public, anon, authenticated, service_role;

create function public.create_place_quote_notification(
  input_recipient_user_id uuid,
  input_message text,
  input_list_id uuid default null,
  input_list_place_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if private.has_active_moderation_sanction(auth.uid()) then
    raise exception using
      errcode = '42501',
      message = 'active_moderation_sanction';
  end if;

  perform private.create_place_quote_notification_implementation(
    input_recipient_user_id,
    input_message,
    input_list_id,
    input_list_place_id
  );
end;
$$;

revoke all on function public.create_place_quote_notification(uuid, text, uuid, uuid)
from public, anon, authenticated, service_role;
grant execute on function public.create_place_quote_notification(uuid, text, uuid, uuid)
to authenticated;

-- media-assets is a service-role caller but supplies the authenticated subject
-- explicitly. Deny new or reissued upload capacity for a sanctioned subject;
-- cancellation and cleanup remain available.
alter function public.begin_media_upload_session(
  uuid, uuid, text, text, text, text, text, bigint, uuid
)
set schema private;
alter function private.begin_media_upload_session(
  uuid, uuid, text, text, text, text, text, bigint, uuid
)
rename to begin_media_upload_session_implementation;
revoke all on function private.begin_media_upload_session_implementation(
  uuid, uuid, text, text, text, text, text, bigint, uuid
)
from public, anon, authenticated, service_role;

create function public.begin_media_upload_session(
  p_session_id uuid,
  p_user_id uuid,
  p_upload_bucket text,
  p_upload_path text,
  p_destination_bucket text,
  p_destination_path text,
  p_content_type text,
  p_expected_size_bytes bigint,
  p_initialization_id uuid
)
returns table (
  session_id uuid,
  session_status text,
  upload_bucket text,
  upload_path text,
  destination_bucket text,
  destination_path text,
  content_type text,
  expected_size_bytes bigint,
  initialization_id uuid,
  upload_url_expires_at timestamptz,
  finalize_deadline timestamptz,
  cleanup_after timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if private.has_active_moderation_sanction(p_user_id) then
    raise exception using
      errcode = '42501',
      message = 'active_moderation_sanction';
  end if;

  return query
  select implementation.*
    from private.begin_media_upload_session_implementation(
      p_session_id,
      p_user_id,
      p_upload_bucket,
      p_upload_path,
      p_destination_bucket,
      p_destination_path,
      p_content_type,
      p_expected_size_bytes,
      p_initialization_id
    ) as implementation;
end;
$$;

revoke all on function public.begin_media_upload_session(
  uuid, uuid, text, text, text, text, text, bigint, uuid
)
from public, anon, authenticated, service_role;
grant execute on function public.begin_media_upload_session(
  uuid, uuid, text, text, text, text, text, bigint, uuid
)
to service_role;

-- Signed private-media reads are another privileged RLS bypass. The batch
-- authorizer delegates to this routine, so one fail-closed check covers both.
create or replace function public.can_read_private_place_media(
  p_bucket text,
  p_path text,
  p_viewer_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, private
as $$
  with requested as (
    select
      nullif(trim(coalesce(p_bucket, '')), '') as bucket,
      regexp_replace(trim(coalesce(p_path, '')), '^/+', '') as path
  ),
  media_rows as (
    select
      lists.owner_id,
      lists.is_public,
      list_places.created_by,
      list_places.source_user_id,
      list_place_photos.asset_owner_id
    from requested
    join public.list_place_photos
      on list_place_photos.asset_state = 'ready'
      and (
        (
          list_place_photos.storage_bucket = requested.bucket
          and list_place_photos.storage_path = requested.path
        )
        or list_place_photos.url =
          'sorita-storage://' || requested.bucket || '/' || requested.path
        or list_place_photos.thumbnail_url =
          'sorita-storage://' || requested.bucket || '/' || requested.path
      )
    join public.list_places on list_places.id = list_place_photos.list_place_id
    join public.lists on lists.id = list_places.list_id
  ),
  list_cover_rows as (
    select
      lists.owner_id,
      lists.is_public
    from requested
    join public.lists
      on lists.cover_image_url =
        'sorita-storage://' || requested.bucket || '/' || requested.path
      and split_part(requested.path, '/', 1) = lists.owner_id::text
  )
  select coalesce((
    select case
      when p_viewer_id is null then false
      when private.has_active_moderation_sanction(p_viewer_id) then false
      when requested.bucket <> 'place-media-private' then false
      when char_length(requested.path) not between 1 and 512 then false
      when requested.path !~ '^[a-zA-Z0-9/_.,-]+$' then false
      when requested.path ~ '(^|/)\.\.(/|$)' then false
      when split_part(requested.path, '/', 1) = p_viewer_id::text then true
      else
        exists (
          select 1
          from media_rows
          where (media_rows.owner_id = p_viewer_id or media_rows.is_public)
            and not private.has_active_moderation_sanction(media_rows.owner_id)
            and not private.has_active_moderation_sanction(media_rows.created_by)
            and not private.has_active_moderation_sanction(media_rows.source_user_id)
            and not private.has_active_moderation_sanction(media_rows.asset_owner_id)
            and (
              media_rows.owner_id = p_viewer_id
              or not private.users_have_block_relation(
                p_viewer_id,
                media_rows.owner_id
              )
            )
            and (
              media_rows.created_by is null
              or media_rows.created_by = p_viewer_id
              or not private.users_have_block_relation(
                p_viewer_id,
                media_rows.created_by
              )
            )
            and (
              media_rows.source_user_id is null
              or media_rows.source_user_id = p_viewer_id
              or not private.users_have_block_relation(
                p_viewer_id,
                media_rows.source_user_id
              )
            )
        )
        or exists (
          select 1
          from list_cover_rows
          where (list_cover_rows.owner_id = p_viewer_id or list_cover_rows.is_public)
            and not private.has_active_moderation_sanction(list_cover_rows.owner_id)
            and (
              list_cover_rows.owner_id = p_viewer_id
              or not private.users_have_block_relation(
                p_viewer_id,
                list_cover_rows.owner_id
              )
            )
        )
    end
    from requested
  ), false);
$$;

revoke all on function public.can_read_private_place_media(text, text, uuid)
from public, anon, authenticated, service_role;
grant execute on function public.can_read_private_place_media(text, text, uuid)
to service_role;

create or replace function public.build_personal_data_export(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  actor_role text := coalesce(
    nullif(auth.jwt() ->> 'role', ''),
    case when session_user = 'postgres' then 'postgres' end,
    ''
  );
  payload jsonb;
begin
  if actor_role not in ('service_role', 'postgres') or p_user_id is null then
    raise exception using
      errcode = '42501',
      message = 'personal_data_export_not_authorized';
  end if;

  insert into public.personal_data_access_log (user_id, request_type)
  values (p_user_id, 'export');

  select jsonb_build_object(
    'format_version', 2,
    'generated_at', timezone('utc', now()),
    'account', coalesce((
      select jsonb_build_object(
        'email', auth_user.email,
        'phone', auth_user.phone,
        'created_at', auth_user.created_at,
        'updated_at', auth_user.updated_at,
        'email_confirmed_at', auth_user.email_confirmed_at,
        'phone_confirmed_at', auth_user.phone_confirmed_at,
        'last_sign_in_at', auth_user.last_sign_in_at
      )
      from auth.users as auth_user
      where auth_user.id = p_user_id
    ), '{}'::jsonb),
    'profile', coalesce((
      select to_jsonb(profile) - 'id'
      from public.profiles as profile
      where profile.id = p_user_id
    ), '{}'::jsonb),
    'legal_consent', coalesce((
      select jsonb_build_object(
        'version', consent.consent_version,
        'documents', consent.documents_accepted,
        'accepted_at', consent.accepted_at,
        'recorded_at', consent.recorded_at
      )
      from public.legal_consent_records as consent
      where consent.user_id = p_user_id
    ), '{}'::jsonb),
    'lists', coalesce((
      select jsonb_agg(to_jsonb(item) - 'owner_id' order by item.created_at, item.id)
      from (
        select *
        from public.lists
        where owner_id = p_user_id
        order by created_at, id
        limit 1000
      ) as item
    ), '[]'::jsonb),
    'places', coalesce((
      select jsonb_agg(to_jsonb(item) - 'created_by' order by item.added_at, item.id)
      from (
        select place.*
        from public.list_places as place
        join public.lists as list on list.id = place.list_id
        where list.owner_id = p_user_id or place.created_by = p_user_id
        order by place.added_at, place.id
        limit 1000
      ) as item
    ), '[]'::jsonb),
    'media', coalesce((
      select jsonb_agg(to_jsonb(item) - 'asset_owner_id' order by item.created_at, item.id)
      from (
        select media.*
        from public.list_place_photos as media
        join public.list_places as place on place.id = media.list_place_id
        join public.lists as list on list.id = place.list_id
        where media.asset_owner_id = p_user_id
          or place.created_by = p_user_id
          or list.owner_id = p_user_id
        order by media.created_at, media.id
        limit 1000
      ) as item
    ), '[]'::jsonb),
    'comments', coalesce((
      select jsonb_agg(to_jsonb(item) - 'user_id' order by item.created_at, item.id)
      from (
        select *
        from public.list_place_comments
        where user_id = p_user_id
        order by created_at, id
        limit 1000
      ) as item
    ), '[]'::jsonb),
    'list_likes', coalesce((
      select jsonb_agg(
        jsonb_build_object('list_id', item.list_id, 'created_at', item.created_at)
        order by item.created_at, item.list_id
      )
      from (
        select *
        from public.list_likes
        where user_id = p_user_id
        order by created_at, list_id
        limit 1000
      ) as item
    ), '[]'::jsonb),
    'place_likes', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'list_place_id', item.list_place_id,
          'created_at', item.created_at
        )
        order by item.created_at, item.list_place_id
      )
      from (
        select *
        from public.list_place_likes
        where user_id = p_user_id
        order by created_at, list_place_id
        limit 1000
      ) as item
    ), '[]'::jsonb),
    'comment_likes', coalesce((
      select jsonb_agg(
        jsonb_build_object('comment_id', item.comment_id, 'created_at', item.created_at)
        order by item.created_at, item.comment_id
      )
      from (
        select *
        from public.list_place_comment_likes
        where user_id = p_user_id
        order by created_at, comment_id
        limit 1000
      ) as item
    ), '[]'::jsonb),
    'follows', jsonb_build_object(
      'following', coalesce((
        select jsonb_agg(
          jsonb_build_object('user_id', item.following_id, 'created_at', item.created_at)
          order by item.created_at, item.following_id
        )
        from (
          select *
          from public.user_follows
          where follower_id = p_user_id
          order by created_at, following_id
          limit 1000
        ) as item
      ), '[]'::jsonb),
      'followers', coalesce((
        select jsonb_agg(
          jsonb_build_object('user_id', item.follower_id, 'created_at', item.created_at)
          order by item.created_at, item.follower_id
        )
        from (
          select *
          from public.user_follows
          where following_id = p_user_id
          order by created_at, follower_id
          limit 1000
        ) as item
      ), '[]'::jsonb)
    ),
    'follow_requests', coalesce((
      select jsonb_agg(to_jsonb(item) - 'id' order by item.created_at, item.id)
      from (
        select *
        from public.follow_requests
        where requester_id = p_user_id or target_user_id = p_user_id
        order by created_at, id
        limit 1000
      ) as item
    ), '[]'::jsonb),
    'blocks', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'blocked_user_id', item.blocked_user_id,
          'created_at', item.created_at
        )
        order by item.created_at, item.blocked_user_id
      )
      from (
        select *
        from public.user_blocks
        where blocker_user_id = p_user_id
        order by created_at, blocked_user_id
        limit 1000
      ) as item
    ), '[]'::jsonb),
    'notifications_received', coalesce((
      select jsonb_agg(
        to_jsonb(item) - 'recipient_user_id'
        order by item.created_at, item.id
      )
      from (
        select *
        from public.notifications
        where recipient_user_id = p_user_id
        order by created_at, id
        limit 1000
      ) as item
    ), '[]'::jsonb),
    'push_registrations', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'platform', item.platform,
          'is_active', item.is_active,
          'created_at', item.created_at,
          'updated_at', item.updated_at,
          'last_seen_at', item.last_seen_at
        )
        order by item.created_at, item.id
      )
      from (
        select *
        from public.user_push_tokens
        where user_id = p_user_id
        order by created_at, id
        limit 1000
      ) as item
    ), '[]'::jsonb),
    'reports_submitted', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', item.id,
          'report_type', item.report_type,
          'reason', item.reason,
          'details', item.details,
          'created_at', item.created_at
        )
        order by item.created_at, item.id
      )
      from (
        select *
        from public.moderation_reports
        where reporter_user_id = p_user_id
        order by created_at, id
        limit 1000
      ) as item
    ), '[]'::jsonb),
    'data_access_history', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'request_type', item.request_type,
          'requested_at', item.requested_at
        )
        order by item.requested_at, item.id
      )
      from (
        select *
        from public.personal_data_access_log
        where user_id = p_user_id
        order by requested_at, id
        limit 1000
      ) as item
    ), '[]'::jsonb),
    'collection_limit', 1000,
    'truncated', jsonb_build_object(
      'lists', exists(
        select 1 from public.lists
        where owner_id = p_user_id
        offset 1000 limit 1
      ),
      'places', exists(
        select 1
        from public.list_places as place
        join public.lists as list on list.id = place.list_id
        where list.owner_id = p_user_id or place.created_by = p_user_id
        offset 1000 limit 1
      ),
      'media', exists(
        select 1
        from public.list_place_photos as media
        join public.list_places as place on place.id = media.list_place_id
        join public.lists as list on list.id = place.list_id
        where media.asset_owner_id = p_user_id
          or place.created_by = p_user_id
          or list.owner_id = p_user_id
        offset 1000 limit 1
      ),
      'comments', exists(
        select 1 from public.list_place_comments
        where user_id = p_user_id
        offset 1000 limit 1
      ),
      'list_likes', exists(
        select 1 from public.list_likes
        where user_id = p_user_id
        offset 1000 limit 1
      ),
      'place_likes', exists(
        select 1 from public.list_place_likes
        where user_id = p_user_id
        offset 1000 limit 1
      ),
      'comment_likes', exists(
        select 1 from public.list_place_comment_likes
        where user_id = p_user_id
        offset 1000 limit 1
      ),
      'follows', jsonb_build_object(
        'following', exists(
          select 1 from public.user_follows
          where follower_id = p_user_id
          offset 1000 limit 1
        ),
        'followers', exists(
          select 1 from public.user_follows
          where following_id = p_user_id
          offset 1000 limit 1
        )
      ),
      'follow_requests', exists(
        select 1 from public.follow_requests
        where requester_id = p_user_id or target_user_id = p_user_id
        offset 1000 limit 1
      ),
      'blocks', exists(
        select 1 from public.user_blocks
        where blocker_user_id = p_user_id
        offset 1000 limit 1
      ),
      'notifications_received', exists(
        select 1 from public.notifications
        where recipient_user_id = p_user_id
        offset 1000 limit 1
      ),
      'push_registrations', exists(
        select 1 from public.user_push_tokens
        where user_id = p_user_id
        offset 1000 limit 1
      ),
      'reports_submitted', exists(
        select 1 from public.moderation_reports
        where reporter_user_id = p_user_id
        offset 1000 limit 1
      ),
      'data_access_history', exists(
        select 1 from public.personal_data_access_log
        where user_id = p_user_id
        offset 1000 limit 1
      )
    )
  ) into payload;

  return payload;
end;
$$;

revoke all on function public.build_personal_data_export(uuid)
from public, anon, authenticated;
grant execute on function public.build_personal_data_export(uuid)
to service_role;

commit;
