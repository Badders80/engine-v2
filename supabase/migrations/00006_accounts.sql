-- 00006_accounts.sql
-- OUTCOME.md § Rows, accounts. Created at signup. The primary key is the
-- Supabase Auth user, so checkout does not create another profile.

create table public.accounts (
  id uuid primary key references auth.users (id),
  full_name text not null,
  email text unique not null,
  kyc_status public.kyc_status not null default 'unverified',
  created_at timestamptz default now()
);

alter table public.accounts enable row level security;
