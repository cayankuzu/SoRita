create or replace view public.public_profile_summaries as
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

drop policy if exists "profiles_select_authenticated" on public.profiles;
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
on public.profiles
for select
to authenticated
using (auth.uid() = id);
