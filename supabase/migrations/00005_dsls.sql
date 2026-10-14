-- 00005_dsls.sql
-- OUTCOME.md § DSL and § Pricing Rules. One DSL per horse per end date.
--
-- wholesale_monthly_per_percent is the single user-editable price input. The
-- retail figure and the 100% wholesale total are generated columns, so a
-- writer cannot store a second price. The retail expression is the listed
-- price rule: wholesale x 1.05 x 1.03, rounded up to the next whole dollar.
--
-- investor_split carries no default. 75% is the value an empty form shows and
-- is not a substitute for a horse's own split, so it is not written here.

create table public.dsls (
  id uuid primary key default gen_random_uuid(),
  horse_id uuid not null references public.horses (id),
  end_date date not null,
  term_start date not null,
  payment_model public.payment_model not null,
  close_style public.close_style not null,
  status public.status not null default 'coming_soon',
  published boolean not null default false,
  wholesale_monthly_per_percent numeric(10, 2) not null
    check (wholesale_monthly_per_percent > 0),
  retail_monthly_per_percent numeric(10, 2)
    generated always as (ceil(wholesale_monthly_per_percent * 1.05 * 1.03)) stored,
  wholesale_monthly_total numeric(10, 2)
    generated always as (wholesale_monthly_per_percent * 100.0) stored,
  investor_split numeric(5, 2)
    check (investor_split is null or (investor_split >= 50 and investor_split <= 85)),
  listed_stake numeric(5, 2) not null,
  min_stake numeric(5, 2) not null,
  step numeric(5, 2) not null,
  stake_remaining numeric(5, 2) not null
    check (stake_remaining >= 0 and stake_remaining <= listed_stake),
  distribution_schedule text,
  constraint dsls_horse_id_end_date_key unique (horse_id, end_date),
  constraint dsls_stake_shape_check check (
    min_stake > 0
    and step > 0
    and min_stake <= listed_stake
    and mod(listed_stake, step) = 0
  )
);

alter table public.dsls enable row level security;
