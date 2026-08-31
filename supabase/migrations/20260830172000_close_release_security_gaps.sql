-- Forward-only closure for privilege defaults and moderation/account-deletion
-- interactions discovered during the release-candidate adversarial review.

revoke all on function public.can_read_private_place_media(text, text, uuid)
from public, anon, authenticated;
grant execute on function public.can_read_private_place_media(text, text, uuid)
to service_role;

revoke all on function public.can_read_private_place_media_batch(text, text[], uuid)
from public, anon, authenticated;
grant execute on function public.can_read_private_place_media_batch(text, text[], uuid)
to service_role;

revoke all on table public.account_deletion_jobs from service_role;
grant select on table public.account_deletion_jobs to service_role;

revoke all on table public.moderation_reports
from public, anon, authenticated, service_role;
grant select on table public.moderation_reports to service_role;
grant insert (
  legacy_report_key,
  report_type,
  reporter_user_id,
  target_user_id,
  list_id,
  list_place_id,
  comment_id,
  reason,
  details,
  snapshot,
  email_delivery_status
) on public.moderation_reports to service_role;
grant update (
  email_delivery_status,
  email_delivery_error
) on public.moderation_reports to service_role;

alter table public.moderation_reports
  drop constraint if exists moderation_reports_reporter_user_id_fkey;
alter table public.moderation_reports
  alter column reporter_user_id drop not null;
alter table public.moderation_reports
  add constraint moderation_reports_reporter_user_id_fkey
  foreign key (reporter_user_id) references public.profiles (id) on delete set null;

alter table public.moderation_reports
  drop constraint if exists moderation_reports_target_check;
alter table public.moderation_reports
  add constraint moderation_reports_target_check
  check (
    (
      target_user_id is null
      and list_id is null
      and list_place_id is null
      and comment_id is null
    )
    or (
      report_type = 'user'
      and target_user_id is not null
      and list_id is null
      and list_place_id is null
      and comment_id is null
    )
    or (
      report_type = 'list'
      and target_user_id is null
      and list_id is not null
      and list_place_id is null
      and comment_id is null
    )
    or (
      report_type = 'place'
      and target_user_id is null
      and list_id is null
      and list_place_id is not null
      and comment_id is null
    )
    or (
      report_type = 'comment'
      and target_user_id is null
      and list_id is null
      and list_place_id is null
      and comment_id is not null
    )
  );

create or replace function public.normalize_moderation_report_fields()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.legacy_report_key := trim(new.legacy_report_key);
  new.reason := trim(new.reason);
  new.details := nullif(trim(coalesce(new.details, '')), '');
  new.email_delivery_error := nullif(trim(coalesce(new.email_delivery_error, '')), '');
  new.updated_at := timezone('utc', now());

  if tg_op = 'INSERT' and not (
    (
      new.report_type = 'user'
      and new.target_user_id is not null
      and new.list_id is null
      and new.list_place_id is null
      and new.comment_id is null
    )
    or (
      new.report_type = 'list'
      and new.target_user_id is null
      and new.list_id is not null
      and new.list_place_id is null
      and new.comment_id is null
    )
    or (
      new.report_type = 'place'
      and new.target_user_id is null
      and new.list_id is null
      and new.list_place_id is not null
      and new.comment_id is null
    )
    or (
      new.report_type = 'comment'
      and new.target_user_id is null
      and new.list_id is null
      and new.list_place_id is null
      and new.comment_id is not null
    )
  ) then
    raise exception using
      errcode = '23514',
      message = 'moderation_report_target_required';
  end if;

  if tg_op = 'UPDATE'
    and old.reporter_user_id is not null
    and new.reporter_user_id is null then
    new.legacy_report_key := 'tombstoned-reporter:' || new.id::text;
    new.details := null;
    new.snapshot := coalesce(new.snapshot, '{}'::jsonb) - 'reporter';
  end if;

  if tg_op = 'UPDATE' and (
    (old.target_user_id is not null and new.target_user_id is null)
    or (old.list_id is not null and new.list_id is null)
    or (old.list_place_id is not null and new.list_place_id is null)
    or (old.comment_id is not null and new.comment_id is null)
  ) then
    new.legacy_report_key := 'tombstoned-target:' || new.id::text;
    new.details := null;
    new.snapshot := jsonb_build_object(
      'targetType',
      new.report_type,
      'tombstoned',
      true
    );
  end if;

  if new.legacy_report_key = '' then
    raise exception 'Moderation report key is required';
  end if;

  if new.reason = '' then
    raise exception 'Moderation report reason is required';
  end if;

  return new;
end;
$$;

revoke all on function public.normalize_moderation_report_fields()
from public, anon, authenticated;
