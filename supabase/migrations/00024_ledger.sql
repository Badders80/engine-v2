-- 00024_ledger.sql
-- Rules: R-SALE-01..06, R-ALLOC-01, R-ALLOC-03, R-TERM-01, R-TERM-02, R-UNIT-01.
--
-- Chunk 4, Phase A. The ledger reads a frozen snapshot; the sale is written
-- once, atomically, and can never be edited or removed.
--
-- Four things land here:
--
--   U18  `sales` stores the executed terms. A later edit to the DSL cannot
--        change what an investor bought.
--   U19  `dsls` gains the manual close columns.
--   U20  `checkout_sessions.stake_returned_at` says whether a hold's stake is
--        still out of the listing. Null means still held; set means release
--        or expiry put it back.
--   H6   `record_sale_atomically` writes the sale and claims the hold in one
--        transaction, and `sales` refuses UPDATE, DELETE and TRUNCATE.
--
-- U21 (sale-time start and remaining-month pricing) is implemented in
-- `engine/src/lib/purchase.ts`; the function below derives the same start,
-- month count and effective model from the stored facts, because the
-- snapshot must not depend on a caller's arithmetic.

-- ---------------------------------------------------------------------------
-- U18: the sale snapshot.
--
-- The columns are nullable because Phase A ships before the webhook calls
-- `record_sale_atomically`. The all-or-nothing check refuses a half-written
-- snapshot, and a legacy row (every column null) still passes. Phase B's
-- writer always fills all fifteen.
-- ---------------------------------------------------------------------------

alter table public.sales
  add column wholesale_monthly_per_percent numeric(10, 2),
  add column retail_monthly_per_percent numeric(10, 2),
  add column investor_split numeric(5, 2),
  add column listed_stake numeric(5, 2),
  add column min_stake numeric(5, 2),
  add column step numeric(5, 2),
  add column end_date date,
  add column payment_model_at_sale public.payment_model,
  add column close_style public.close_style,
  add column distribution_schedule text,
  add column term_start date,
  add column term_end date,
  add column term_months integer,
  add column trainer_id uuid references public.parties (id),
  add column owner_id uuid references public.parties (id);

alter table public.sales
  add constraint sales_snapshot_all_or_nothing check (
    num_nonnulls(
      wholesale_monthly_per_percent, retail_monthly_per_percent, investor_split,
      listed_stake, min_stake, step, end_date, payment_model_at_sale,
      close_style, distribution_schedule, term_start, term_end, term_months,
      trainer_id, owner_id
    ) in (0, 15)
  );

alter table public.sales
  add constraint sales_term_shape check (
    term_start is null
    or (term_start = date_trunc('month', term_start)::date
        and term_end is not null
        and term_months >= 1)
  );

comment on column public.sales.payment_model_at_sale is
  'The model actually charged: upfront when the listing is upfront or 5 months or less remained at sale (ruling 25).';
comment on column public.sales.term_start is
  'First day of the calendar month the investor bought in. The listing itself carries no start.';
comment on column public.sales.term_months is
  'Remaining full calendar months from term_start to term_end, inclusive.';

create index sales_by_dsl on public.sales (dsl_id);
create index sales_by_term_end on public.sales (term_end);

-- ---------------------------------------------------------------------------
-- U19: the manual close.
-- ---------------------------------------------------------------------------

alter table public.dsls
  add column closed_at timestamptz,
  add column closed_reason text,
  add column closed_by text;

comment on column public.dsls.closed_at is
  'Set by the manual close. A closed listing is sold no further.';

-- ---------------------------------------------------------------------------
-- U20: was the hold's stake returned?
--
-- Null = the stake is still out of the listing (an open hold, or a
-- `paid_unfulfilled` row whose money is held). Set = release or expiry put it
-- back, so it contributes nothing to open capacity.
-- The cap-table identity, in horse points:
--   listed = sold + open holds + held paid_unfulfilled + remaining.
-- ---------------------------------------------------------------------------

alter table public.checkout_sessions
  add column stake_returned_at timestamptz;

comment on column public.checkout_sessions.stake_returned_at is
  'Null while the stake is still held; set when release or expiry returned it (U20).';

create index checkout_sessions_held_by_dsl
  on public.checkout_sessions (dsl_id)
  where status in ('open', 'paid_unfulfilled') and stake_returned_at is null;

-- ---------------------------------------------------------------------------
-- The two returning functions now record that the stake went back.
-- `create or replace` keeps their existing grants.
-- ---------------------------------------------------------------------------

create or replace function public.release_checkout_stake(
  p_checkout_id uuid,
  p_terminal text default 'released'
) returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.checkout_sessions;
begin
  if p_terminal not in ('released', 'expired') then
    raise exception 'release_checkout_stake: % is not a releasing status', p_terminal
      using errcode = '23514';
  end if;

  update public.checkout_sessions
     set status = p_terminal, closed_at = now(), stake_returned_at = now()
   where id = p_checkout_id
     and status = 'open'
  returning * into v_row;

  if v_row.id is null then
    return 0;
  end if;

  update public.dsls
     set stake_remaining = least(listed_stake, stake_remaining + v_row.stake)
   where id = v_row.dsl_id;

  return 1;
end;
$$;

create or replace function public.expire_checkout_stakes()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.checkout_sessions;
  v_count integer := 0;
begin
  for v_row in
    update public.checkout_sessions
       set status = 'expired', closed_at = now(), stake_returned_at = now()
     where status = 'open'
       and expires_at <= now()
    returning *
  loop
    update public.dsls
       set stake_remaining = least(listed_stake, stake_remaining + v_row.stake)
     where id = v_row.dsl_id;
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- H6: one transaction writes the sale and claims the hold.
--
-- Contract:
--   * idempotent by `sales.stripe_session_id` — a replay returns the sale;
--   * the checkout row and the DSL row are locked, in that order, so two
--     webhooks and the close action serialise;
--   * amount, currency and hold status are validated here, not trusted from
--     the caller;
--   * only an `open` hold may become a sale. A released or expired hold means
--     the money arrived after the stock went back: no sale, the checkout is
--     marked `paid_unfulfilled`, and the caller alerts the founder;
--   * the snapshot comes from the DSL and the checkout row, never from the
--     caller, so a caller cannot inflate a rate or a term.
--
-- Returns one row: `outcome` is 'sale_written', 'idempotent_replay' or
-- 'paid_unfulfilled'; `sale` is the written row (null when refused); `reason`
-- carries the refusal text for the founder alert.
-- ---------------------------------------------------------------------------

create or replace function public.record_sale_atomically(
  p_checkout_id uuid,
  p_stripe_session_id text,
  p_stripe_amount_total_cents integer,
  p_stripe_currency text,
  p_stripe_identity_id text default null
)
returns table (outcome text, sale public.sales, reason text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_checkout public.checkout_sessions;
  v_dsl public.dsls;
  v_existing public.sales;
  v_sale public.sales;
  v_term_start date;
  v_term_months integer;
  v_model public.payment_model;
  v_expected_cents numeric;
  v_expected_amount numeric(10, 2);
  v_sold numeric(5, 2);
  v_reason text;
begin
  if p_stripe_session_id is null or btrim(p_stripe_session_id) = '' then
    raise exception 'record_sale_atomically: a Stripe session id is required'
      using errcode = '23514';
  end if;

  -- 1. Resolve and lock the checkout row. The lock is the serialisation
  --    point for a replayed webhook and for a concurrent claim.
  if p_checkout_id is not null then
    select c.* into v_checkout
      from public.checkout_sessions c
     where c.id = p_checkout_id
       for update;
  end if;

  if v_checkout.id is null then
    select c.* into v_checkout
      from public.checkout_sessions c
     where c.stripe_session_id = p_stripe_session_id
       for update;
  end if;

  -- 2. Idempotency, read after the lock so a replay sees the committed sale.
  select s.* into v_existing
    from public.sales s
   where s.stripe_session_id = p_stripe_session_id;

  if v_existing.id is not null then
    return query select 'idempotent_replay'::text, v_existing, null::text;
    return;
  end if;

  -- 3. Nothing bound: the money is real, but no contract can be written.
  if v_checkout.id is null then
    return query select
      'paid_unfulfilled'::text,
      null::public.sales,
      'no checkout session is bound to this Stripe session; no sale was written'::text;
    return;
  end if;

  if v_checkout.status = 'completed' then
    return query select
      'paid_unfulfilled'::text,
      null::public.sales,
      format('checkout %s is already completed but no sale records this Stripe session', v_checkout.id);
    return;
  end if;

  if v_checkout.status = 'paid_unfulfilled' then
    return query select
      'paid_unfulfilled'::text,
      null::public.sales,
      format('checkout %s is already marked paid_unfulfilled', v_checkout.id);
    return;
  end if;

  -- 4. Money checks. A wrong currency or amount is never a sale.
  v_reason := null;

  if p_stripe_currency is null or lower(btrim(p_stripe_currency)) <> 'nzd' then
    v_reason := format(
      'checkout %s was charged in %s, not nzd; no sale was written',
      v_checkout.id, coalesce(p_stripe_currency, 'no currency')
    );
  elsif p_stripe_amount_total_cents is null
        or p_stripe_amount_total_cents <> round(v_checkout.amount_nzd * 100)::integer then
    v_reason := format(
      'checkout %s: Stripe reports %s cents but the bound quote is %s cents; no sale was written',
      v_checkout.id,
      coalesce(p_stripe_amount_total_cents::text, 'no amount'),
      round(v_checkout.amount_nzd * 100)::integer
    );
  end if;

  if v_reason is not null then
    update public.checkout_sessions
       set status = 'paid_unfulfilled', closed_at = coalesce(closed_at, now())
     where id = v_checkout.id
       and status in ('open', 'expired', 'released');

    return query select 'paid_unfulfilled'::text, null::public.sales, v_reason;
    return;
  end if;

  -- 5. Only an open hold may become a sale. A released or expired hold has
  --    already returned its stake; the money arrived too late.
  if v_checkout.status <> 'open' then
    v_reason := format(
      'checkout %s is %s: its stake was returned before the money arrived; no sale was written',
      v_checkout.id, v_checkout.status
    );

    update public.checkout_sessions
       set status = 'paid_unfulfilled', closed_at = coalesce(closed_at, now())
     where id = v_checkout.id
       and status in ('expired', 'released');

    return query select 'paid_unfulfilled'::text, null::public.sales, v_reason;
    return;
  end if;

  -- 6. Lock the DSL and read the terms the sale freezes.
  select d.* into v_dsl
    from public.dsls d
   where d.id = v_checkout.dsl_id
     for update;

  if v_dsl.id is null then
    v_reason := format('dsl %s does not exist; no sale was written', v_checkout.dsl_id);
    update public.checkout_sessions
       set status = 'paid_unfulfilled', closed_at = coalesce(closed_at, now())
     where id = v_checkout.id and status = 'open';
    return query select 'paid_unfulfilled'::text, null::public.sales, v_reason;
    return;
  end if;

  if v_dsl.closed_at is not null then
    v_reason := format('dsl %s is closed; no sale was written', v_dsl.id);
    update public.checkout_sessions
       set status = 'paid_unfulfilled', closed_at = coalesce(closed_at, now())
     where id = v_checkout.id and status = 'open';
    return query select 'paid_unfulfilled'::text, null::public.sales, v_reason;
    return;
  end if;

  if v_dsl.status not in ('available', 'fully_allocated') then
    v_reason := format(
      'dsl %s is %s and cannot be sold; no sale was written', v_dsl.id, v_dsl.status
    );
    update public.checkout_sessions
       set status = 'paid_unfulfilled', closed_at = coalesce(closed_at, now())
     where id = v_checkout.id and status = 'open';
    return query select 'paid_unfulfilled'::text, null::public.sales, v_reason;
    return;
  end if;

  -- 7. The stake. The hold already took it out of the listing, but a sale
  --    that would take the listing past its own total is still refused.
  select coalesce(sum(s.stake), 0) into v_sold
    from public.sales s
   where s.dsl_id = v_dsl.id;

  if v_sold + v_checkout.stake > v_dsl.listed_stake then
    v_reason := format(
      'dsl %s has %s%% already sold and no stake remains for this %s%% sale; no sale was written',
      v_dsl.id, v_sold, v_checkout.stake
    );
    update public.checkout_sessions
       set status = 'paid_unfulfilled', closed_at = coalesce(closed_at, now())
     where id = v_checkout.id and status = 'open';
    return query select 'paid_unfulfilled'::text, null::public.sales, v_reason;
    return;
  end if;

  -- 8. U21: the sale-time start and the remaining whole months.
  v_term_start := date_trunc('month', v_checkout.executed_date)::date;
  v_term_months := public.dsl_term_months(v_term_start, v_dsl.end_date);

  if v_term_months is null or v_term_months < 1 then
    v_reason := format(
      'dsl %s ends %s, before the sale month %s; no sale was written',
      v_dsl.id, v_dsl.end_date, to_char(v_term_start, 'YYYY-MM')
    );
    update public.checkout_sessions
       set status = 'paid_unfulfilled', closed_at = coalesce(closed_at, now())
     where id = v_checkout.id and status = 'open';
    return query select 'paid_unfulfilled'::text, null::public.sales, v_reason;
    return;
  end if;

  -- Ruling 25: the model actually charged is upfront when the listing is
  -- upfront or when five months or less remain.
  v_model := case
    when v_dsl.payment_model = 'upfront' or v_term_months <= 5 then 'upfront'::public.payment_model
    else 'subscription_float'::public.payment_model
  end;

  -- The bound quote must be the initial payment the executed terms imply.
  v_expected_cents := round(
    v_dsl.retail_monthly_per_percent
    * v_checkout.stake
    * case when v_model = 'upfront' then v_term_months else 5 end
    * 100
  );
  v_expected_amount := round(v_expected_cents / 100, 2);

  if round(v_checkout.amount_nzd * 100) <> v_expected_cents then
    v_reason := format(
      'checkout %s binds $%s but the executed terms price $%s; no sale was written',
      v_checkout.id, v_checkout.amount_nzd, v_expected_amount
    );
    update public.checkout_sessions
       set status = 'paid_unfulfilled', closed_at = coalesce(closed_at, now())
     where id = v_checkout.id and status = 'open';
    return query select 'paid_unfulfilled'::text, null::public.sales, v_reason;
    return;
  end if;

  -- 9. The sale itself. Every stored term is copied from the DSL row or the
  --    bound checkout row; none of it comes from the caller.
  insert into public.sales (
    dsl_id, user_id, printed_name, email, stake, amount,
    stripe_session_id, stripe_identity_id, checkout_session_id,
    stripe_amount_total, stripe_currency,
    pds_markdown, sa_markdown, pds_hash, sa_hash,
    wholesale_monthly_per_percent, retail_monthly_per_percent, investor_split,
    listed_stake, min_stake, step, end_date,
    payment_model_at_sale, close_style, distribution_schedule,
    term_start, term_end, term_months, trainer_id, owner_id
  ) values (
    v_dsl.id, v_checkout.account_id, v_checkout.printed_name, v_checkout.email,
    v_checkout.stake, v_checkout.amount_nzd,
    p_stripe_session_id, p_stripe_identity_id, v_checkout.id,
    v_expected_cents / 100, lower(btrim(p_stripe_currency)),
    v_checkout.pds_markdown, v_checkout.sa_markdown, v_checkout.pds_hash, v_checkout.sa_hash,
    v_dsl.wholesale_monthly_per_percent, v_dsl.retail_monthly_per_percent, v_dsl.investor_split,
    v_dsl.listed_stake, v_dsl.min_stake, v_dsl.step, v_dsl.end_date,
    v_model, v_dsl.close_style, v_dsl.distribution_schedule,
    v_term_start, v_dsl.end_date, v_term_months, v_dsl.trainer_id, v_dsl.owner_id
  )
  returning * into v_sale;

  -- 10. Claim the hold and complete the checkout.
  update public.checkout_sessions
     set status = 'completed', closed_at = now()
   where id = v_checkout.id
     and status = 'open';

  if not found then
    raise exception 'checkout % was claimed concurrently', v_checkout.id
      using errcode = '40001';
  end if;

  -- 11. The listing's terminal state follows its remaining stake, not the
  --     caller's claim about it.
  update public.dsls
     set status = case
                    when stake_remaining = 0 and status = 'available'
                      then 'fully_allocated'::public.status
                    else status
                  end
   where id = v_dsl.id;

  return query select 'sale_written'::text, v_sale, null::text;
end;
$$;

comment on function public.record_sale_atomically(uuid, text, integer, text, text) is
  'Writes the sale snapshot and claims the hold in one transaction (H6). service_role only.';

-- ---------------------------------------------------------------------------
-- The manual close.
--
-- Sweeps this listing's stale holds first, then refuses while any open or
-- paid_unfulfilled checkout exists. A paid_unfulfilled row blocks whether its
-- stake is held or was returned: money was taken without a sale either way.
-- ---------------------------------------------------------------------------

create or replace function public.close_dsl(
  p_dsl_id uuid,
  p_reason text,
  p_closed_by text
) returns public.dsls
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_dsl public.dsls;
  v_row public.checkout_sessions;
  v_held integer;
  v_returned integer;
begin
  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'close_dsl: a reason is required' using errcode = '23514';
  end if;
  if p_closed_by is null or btrim(p_closed_by) = '' then
    raise exception 'close_dsl: a closer is required' using errcode = '23514';
  end if;

  select d.* into v_dsl
    from public.dsls d
   where d.id = p_dsl_id
     for update;

  if v_dsl.id is null then
    raise exception 'dsl % does not exist', p_dsl_id using errcode = '23503';
  end if;

  if v_dsl.closed_at is not null then
    raise exception 'dsl % is already closed', p_dsl_id using errcode = '23514';
  end if;

  if v_dsl.status not in ('available', 'fully_allocated') then
    raise exception 'dsl % is % and cannot be closed; only an available or fully allocated listing closes',
      p_dsl_id, v_dsl.status using errcode = '23514';
  end if;

  -- Sweep the stale holds for this listing only: expiry returns the stake.
  for v_row in
    update public.checkout_sessions
       set status = 'expired', closed_at = now(), stake_returned_at = now()
     where dsl_id = p_dsl_id
       and status = 'open'
       and expires_at <= now()
    returning *
  loop
    update public.dsls
       set stake_remaining = least(listed_stake, stake_remaining + v_row.stake)
     where id = v_row.dsl_id;
  end loop;

  select count(*) filter (where c.stake_returned_at is null),
         count(*) filter (where c.stake_returned_at is not null)
    into v_held, v_returned
    from public.checkout_sessions c
   where c.dsl_id = p_dsl_id
     and c.status in ('open', 'paid_unfulfilled');

  if v_held + v_returned > 0 then
    raise exception
      'dsl % cannot be closed: % held and % returned open or paid_unfulfilled checkout(s) exist',
      p_dsl_id, v_held, v_returned
      using errcode = '23514';
  end if;

  update public.dsls
     set status = 'completed',
         closed_at = now(),
         closed_reason = p_reason,
         closed_by = p_closed_by
   where id = p_dsl_id
  returning * into v_dsl;

  return v_dsl;
end;
$$;

-- ---------------------------------------------------------------------------
-- H6: append-only in fact.
--
-- The trigger fires for every role, including the owner; the revokes remove
-- the privileges from every API role. INSERT and SELECT stay.
-- ---------------------------------------------------------------------------

comment on table public.sales is 'Append-only sale record (H6).';

create or replace function public.refuse_sales_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'sales is append-only: % is refused', tg_op
    using errcode = '55000';
  return null;
end;
$$;

drop trigger if exists sales_refuse_mutation on public.sales;
create trigger sales_refuse_mutation
  before update or delete on public.sales
  for each row
  execute function public.refuse_sales_mutation();

drop trigger if exists sales_refuse_truncate on public.sales;
create trigger sales_refuse_truncate
  before truncate on public.sales
  for each statement
  execute function public.refuse_sales_mutation();

revoke update, delete, truncate on public.sales
  from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Grants: the two SECURITY DEFINER functions are for the engine only.
-- ---------------------------------------------------------------------------

revoke execute on function public.record_sale_atomically(uuid, text, integer, text, text)
  from public, anon, authenticated;
revoke execute on function public.close_dsl(uuid, text, text)
  from public, anon, authenticated;

grant execute on function public.record_sale_atomically(uuid, text, integer, text, text)
  to service_role;
grant execute on function public.close_dsl(uuid, text, text)
  to service_role;
