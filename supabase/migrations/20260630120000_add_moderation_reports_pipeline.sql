create table if not exists public.moderation_reports (
  id uuid primary key default gen_random_uuid(),
  legacy_report_key text not null unique,
  report_type text not null,
  reporter_user_id uuid not null references public.profiles (id) on delete cascade,
  target_user_id uuid references public.profiles (id) on delete set null,
  list_id uuid references public.lists (id) on delete set null,
  list_place_id uuid references public.list_places (id) on delete set null,
  comment_id uuid references public.list_place_comments (id) on delete set null,
  reason text not null,
  details text,
  snapshot jsonb not null default '{}'::jsonb,
  email_delivery_status text not null default 'pending',
  email_delivery_error text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint moderation_reports_report_type_check
    check (report_type in ('user', 'list', 'place', 'comment')),
  constraint moderation_reports_reason_length_check
    check (char_length(trim(reason)) between 1 and 160),
  constraint moderation_reports_details_length_check
    check (details is null or char_length(trim(details)) <= 2000),
  constraint moderation_reports_email_status_check
    check (email_delivery_status in ('pending', 'sent', 'failed')),
  constraint moderation_reports_target_check
    check (
      (report_type = 'user' and target_user_id is not null and list_id is null and list_place_id is null and comment_id is null) or
      (report_type = 'list' and list_id is not null and list_place_id is null and comment_id is null) or
      (report_type = 'place' and list_place_id is not null and comment_id is null) or
      (report_type = 'comment' and comment_id is not null)
    )
);

create index if not exists idx_moderation_reports_report_type_created_at
  on public.moderation_reports (report_type, created_at desc);

create index if not exists idx_moderation_reports_email_status_created_at
  on public.moderation_reports (email_delivery_status, created_at desc);

create index if not exists idx_moderation_reports_reporter_created_at
  on public.moderation_reports (reporter_user_id, created_at desc);

alter table public.moderation_reports enable row level security;

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

  if new.legacy_report_key = '' then
    raise exception 'Moderation report key is required';
  end if;

  if new.reason = '' then
    raise exception 'Moderation report reason is required';
  end if;

  return new;
end;
$$;

drop trigger if exists moderation_reports_normalize_fields on public.moderation_reports;
create trigger moderation_reports_normalize_fields
before insert or update on public.moderation_reports
for each row
execute function public.normalize_moderation_report_fields();
