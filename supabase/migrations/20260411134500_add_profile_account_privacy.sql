alter table public.profiles
add column if not exists is_public_account boolean;

update public.profiles
set is_public_account = true
where is_public_account is null;

alter table public.profiles
alter column is_public_account set default true;

alter table public.profiles
alter column is_public_account set not null;
