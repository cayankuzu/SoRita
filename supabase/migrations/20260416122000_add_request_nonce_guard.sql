create table if not exists public.request_nonces (
  nonce text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  function_name text not null,
  device_id text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists request_nonces_expires_at_idx
  on public.request_nonces (expires_at);

alter table public.request_nonces enable row level security;
