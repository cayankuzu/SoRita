create table if not exists public.list_reports (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.lists (id) on delete cascade,
  reporter_user_id uuid not null references public.profiles (id) on delete cascade,
  reason text not null check (char_length(trim(reason)) between 1 and 160),
  created_at timestamptz not null default timezone('utc', now()),
  constraint list_reports_unique_report unique (list_id, reporter_user_id)
);

create table if not exists public.list_place_reports (
  id uuid primary key default gen_random_uuid(),
  list_place_id uuid not null references public.list_places (id) on delete cascade,
  reporter_user_id uuid not null references public.profiles (id) on delete cascade,
  reason text not null check (char_length(trim(reason)) between 1 and 160),
  created_at timestamptz not null default timezone('utc', now()),
  constraint list_place_reports_unique_report unique (list_place_id, reporter_user_id)
);

create index if not exists idx_list_reports_list_id
on public.list_reports (list_id, created_at desc);

create index if not exists idx_list_place_reports_place_id
on public.list_place_reports (list_place_id, created_at desc);

alter table public.list_reports enable row level security;
alter table public.list_place_reports enable row level security;

drop policy if exists "list_reports_select_own" on public.list_reports;
create policy "list_reports_select_own"
on public.list_reports
for select
to authenticated
using (reporter_user_id = auth.uid());

drop policy if exists "list_reports_insert_self" on public.list_reports;
create policy "list_reports_insert_self"
on public.list_reports
for insert
to authenticated
with check (reporter_user_id = auth.uid());

drop policy if exists "list_reports_update_self" on public.list_reports;
create policy "list_reports_update_self"
on public.list_reports
for update
to authenticated
using (reporter_user_id = auth.uid())
with check (reporter_user_id = auth.uid());

drop policy if exists "list_place_reports_select_own" on public.list_place_reports;
create policy "list_place_reports_select_own"
on public.list_place_reports
for select
to authenticated
using (reporter_user_id = auth.uid());

drop policy if exists "list_place_reports_insert_self" on public.list_place_reports;
create policy "list_place_reports_insert_self"
on public.list_place_reports
for insert
to authenticated
with check (reporter_user_id = auth.uid());

drop policy if exists "list_place_reports_update_self" on public.list_place_reports;
create policy "list_place_reports_update_self"
on public.list_place_reports
for update
to authenticated
using (reporter_user_id = auth.uid())
with check (reporter_user_id = auth.uid());
