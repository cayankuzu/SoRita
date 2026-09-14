-- Extend the already-deployed Worker-origin replay ledger for the new,
-- authenticated personal-data export route. Keep the database allowlist in
-- lockstep with the Worker and Edge Function origin-verification allowlists.

begin;

alter table private.cloudflare_origin_nonces
  drop constraint if exists cloudflare_origin_nonces_function_name_check;

alter table private.cloudflare_origin_nonces
  add constraint cloudflare_origin_nonces_function_name_check
  check (
    function_name in (
      'auth-gateway',
      'delete-user',
      'maps-geocoding',
      'media-assets',
      'moderation-reports',
      'personal-data'
    )
  );

create or replace function public.claim_cloudflare_origin_nonce(
  input_nonce text,
  input_function_name text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_nonce uuid;
  inserted_nonce uuid;
begin
  if input_function_name not in (
    'auth-gateway',
    'delete-user',
    'maps-geocoding',
    'media-assets',
    'moderation-reports',
    'personal-data'
  ) then
    raise exception 'invalid Cloudflare origin function';
  end if;

  begin
    normalized_nonce := input_nonce::uuid;
  exception when invalid_text_representation then
    raise exception 'invalid Cloudflare origin nonce';
  end;

  insert into private.cloudflare_origin_nonces (
    nonce,
    function_name,
    expires_at
  ) values (
    normalized_nonce,
    input_function_name,
    timezone('utc', now()) + interval '5 minutes'
  )
  on conflict (nonce) do nothing
  returning nonce into inserted_nonce;

  return inserted_nonce is not null;
end;
$$;

revoke all on function public.claim_cloudflare_origin_nonce(text, text)
from public, anon, authenticated;
grant execute on function public.claim_cloudflare_origin_nonce(text, text)
to service_role;

commit;
