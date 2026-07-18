revoke select on table public.profiles from anon, authenticated;
grant select (
  id,
  name,
  username,
  is_public_account,
  bio,
  profile_photo_url,
  cover_photo_url,
  interests,
  created_at,
  updated_at
) on public.profiles to authenticated;
drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_select_authenticated" on public.profiles;
create policy "profiles_select_authenticated"
on public.profiles
for select
to authenticated
using (true);
create or replace view public.public_profile_summaries
with (security_invoker = true) as
select
  id,
  name,
  username,
  is_public_account,
  bio,
  profile_photo_url,
  cover_photo_url,
  interests,
  created_at,
  updated_at
from public.profiles;
revoke all on public.public_profile_summaries from public;
grant select on public.public_profile_summaries to authenticated;
revoke all on table public.request_nonces from anon, authenticated;
drop policy if exists "request_nonces_service_role_only" on public.request_nonces;
create policy "request_nonces_service_role_only"
on public.request_nonces
for all
to service_role
using (true)
with check (true);
