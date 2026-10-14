-- 00007_sales.sql
-- OUTCOME.md § Sale. A sale freezes the compiled PDS and the SA, including
-- their hashes, so a later edit to the horse does not change a sold document.
-- The webhook is what writes this row.

create table public.sales (
  id uuid primary key default gen_random_uuid(),
  dsl_id uuid not null references public.dsls (id),
  user_id uuid not null references public.accounts (id),
  printed_name text not null,
  email text not null,
  stake numeric(5, 2) not null check (stake > 0),
  amount numeric(10, 2) not null check (amount > 0),
  stripe_session_id text unique not null,
  stripe_identity_id text,
  pds_markdown text not null,
  sa_markdown text not null,
  pds_hash text not null,
  sa_hash text not null,
  created_at timestamptz default now()
);

alter table public.sales enable row level security;
