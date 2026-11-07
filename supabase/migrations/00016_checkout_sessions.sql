-- 00016_checkout_sessions.sql
-- B5: bind the quote to the delivered document.
--
-- One row per Checkout attempt, written before Stripe is called. It freezes
-- everything the buyer was shown — the price, the stake, the executed date,
-- and both compiled documents with their hashes — so the webhook reads a
-- record instead of re-deriving one from live DSL state.
--
-- The row is also the handle the reservation in 00017 uses, and the amount
-- reconciliation in B4 compares Stripe's `amount_total` against
-- `amount_nzd` here.

create table public.checkout_sessions (
  id uuid primary key default gen_random_uuid(),
  stripe_session_id text unique,
  dsl_id uuid not null references public.dsls (id),
  account_id uuid not null references public.accounts (id),
  printed_name text not null,
  email text not null,
  horse_legal_name text not null,
  stake numeric(5, 2) not null check (stake > 0),
  amount_nzd numeric(10, 2) not null check (amount_nzd > 0),
  executed_date date not null,
  pds_markdown text not null,
  sa_markdown text not null,
  pds_hash text not null,
  sa_hash text not null,
  -- open       : created, Stripe may or may not exist yet
  -- completed  : the webhook wrote the sale from this row
  -- expired    : the hold lapsed; stock returned
  -- released   : Checkout failed before Stripe returned a session
  -- paid_unfulfilled : Stripe took the money but the sale was refused; a human must act
  status text not null default 'open'
    check (status in ('open', 'completed', 'expired', 'released', 'paid_unfulfilled')),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  closed_at timestamptz
);

create index checkout_sessions_open_by_dsl
  on public.checkout_sessions (dsl_id)
  where status = 'open';

create index checkout_sessions_open_by_expiry
  on public.checkout_sessions (expires_at)
  where status = 'open';

alter table public.checkout_sessions enable row level security;

-- The sale now points at the document that was delivered, and records what
-- Stripe actually charged, not what we think it should have charged.
alter table public.sales
  add column checkout_session_id uuid references public.checkout_sessions (id),
  add column stripe_amount_total numeric(10, 2),
  add column stripe_currency text;
