begin;

create extension if not exists pgtap with schema extensions;
select plan(12);

select has_table(
  'private',
  'cloudflare_origin_nonces',
  'Cloudflare origin replay nonces have a private ledger'
);
select ok(
  (
    select relrowsecurity
    from pg_class
    where oid = 'private.cloudflare_origin_nonces'::regclass
  ),
  'Cloudflare origin replay ledger enforces RLS'
);
select ok(
  not has_table_privilege('anon', 'private.cloudflare_origin_nonces', 'select'),
  'anonymous callers cannot inspect origin nonces'
);
select ok(
  not has_table_privilege('authenticated', 'private.cloudflare_origin_nonces', 'select'),
  'authenticated callers cannot inspect origin nonces'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.claim_cloudflare_origin_nonce(text,text)',
    'execute'
  ),
  'anonymous callers cannot claim origin nonces'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.claim_cloudflare_origin_nonce(text,text)',
    'execute'
  ),
  'authenticated callers cannot claim origin nonces'
);
select ok(
  has_function_privilege(
    'service_role',
    'public.claim_cloudflare_origin_nonce(text,text)',
    'execute'
  ),
  'service role can atomically claim origin nonces'
);
select ok(
  public.claim_cloudflare_origin_nonce(
    '30000000-0000-4000-8000-000000000003',
    'auth-gateway'
  ),
  'the first origin nonce claim succeeds'
);
select ok(
  not public.claim_cloudflare_origin_nonce(
    '30000000-0000-4000-8000-000000000003',
    'auth-gateway'
  ),
  'a replayed origin nonce claim fails closed'
);
select is(
  (
    select count(*)::integer
    from pg_trigger
    where not tgisinternal
      and tgrelid = 'private.cloudflare_origin_nonces'::regclass
      and tgname = 'cloudflare_origin_nonces_cleanup_expired'
  ),
  1,
  'origin nonce expiry has an amortized cleanup trigger'
);
select throws_ok(
  $$
    select public.claim_cloudflare_origin_nonce(
      '40000000-0000-4000-8000-000000000004',
      'unprotected-function'
    )
  $$,
  'P0001',
  'invalid Cloudflare origin function',
  'unknown origin function names are rejected'
);
select throws_ok(
  $$
    select public.claim_cloudflare_origin_nonce(
      'not-a-uuid',
      'auth-gateway'
    )
  $$,
  'P0001',
  'invalid Cloudflare origin nonce',
  'malformed origin nonces are rejected'
);

select * from finish();
rollback;
