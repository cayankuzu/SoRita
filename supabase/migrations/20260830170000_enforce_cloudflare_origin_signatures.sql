-- Fail-closed, replay-safe Worker-to-Supabase origin authentication. The
-- runtime switch remains disabled until the gateway binary cutover is proven;
-- when enabled, direct calls to the five selected functions are rejected.

create table if not exists private.cloudflare_origin_nonces (
  nonce uuid primary key,
  function_name text not null check (
    function_name in (
      'auth-gateway',
      'delete-user',
      'maps-geocoding',
      'media-assets',
      'moderation-reports'
    )
  ),
  expires_at timestamptz not null,
  created_at timestamptz not null default timezone('utc', now())
);

alter table private.cloudflare_origin_nonces enable row level security;

create index if not exists cloudflare_origin_nonces_expires_at_idx
on private.cloudflare_origin_nonces (expires_at);

revoke all on table private.cloudflare_origin_nonces from public, anon, authenticated;

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
    'moderation-reports'
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

create or replace function private.cleanup_expired_edge_security_rows()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  cleanup_key text;
begin
  if tg_table_schema = 'public' and tg_table_name = 'request_nonces' then
    cleanup_key := new.nonce;
  elsif tg_table_schema = 'private' and tg_table_name = 'edge_rate_limits' then
    cleanup_key := new.scope || ':' || new.identifier || ':' || new.bucket_start::text;
  elsif tg_table_schema = 'private' and tg_table_name = 'cloudflare_origin_nonces' then
    cleanup_key := new.nonce::text;
  else
    return new;
  end if;

  if (pg_catalog.hashtextextended(cleanup_key, 0) & 255::bigint) <> 0 then
    return new;
  end if;

  if tg_table_schema = 'public' then
    delete from public.request_nonces where expires_at <= pg_catalog.now();
  elsif tg_table_name = 'edge_rate_limits' then
    delete from private.edge_rate_limits where expires_at <= pg_catalog.now();
  else
    delete from private.cloudflare_origin_nonces where expires_at <= pg_catalog.now();
  end if;

  return new;
end;
$$;

revoke all on function private.cleanup_expired_edge_security_rows()
from public, anon, authenticated;
grant execute on function private.cleanup_expired_edge_security_rows()
to service_role;

drop trigger if exists cloudflare_origin_nonces_cleanup_expired
on private.cloudflare_origin_nonces;
create trigger cloudflare_origin_nonces_cleanup_expired
after insert on private.cloudflare_origin_nonces
for each row execute function private.cleanup_expired_edge_security_rows();
