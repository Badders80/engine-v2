-- 00017_checkout_reservations.sql
-- B6: no oversell.
--
-- The stake is taken out of `dsls.stake_remaining` when Checkout opens, not
-- when the webhook lands. That makes two concurrent buyers unable to buy the
-- same last percent: the second conditional UPDATE finds no row.
--
-- The hold lapses after the TTL in `checkout_sessions.expires_at`. Expiry
-- returns the stake, and runs from a cron and lazily on the next Checkout.
-- The webhook's own decrement survives only as a backstop for a hold that
-- expired while the buyer was on Stripe's page.

-- 1. Reserve. One transaction: decrement, then insert the binding row that
--    everything else addresses.
create or replace function public.reserve_checkout_stake(
  p_dsl_id uuid,
  p_account_id uuid,
  p_printed_name text,
  p_email text,
  p_horse_legal_name text,
  p_stake numeric,
  p_amount_nzd numeric,
  p_executed_date date,
  p_pds_markdown text,
  p_sa_markdown text,
  p_pds_hash text,
  p_sa_hash text,
  p_ttl_seconds integer default 300
) returns public.checkout_sessions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_remaining numeric(5, 2);
  v_row public.checkout_sessions;
begin
  update public.dsls
     set stake_remaining = stake_remaining - p_stake
   where id = p_dsl_id
     and status = 'available'
     and published
     and stake_remaining >= p_stake
  returning stake_remaining into v_remaining;

  if not found then
    raise exception 'no stake available on dsl %', p_dsl_id using errcode = '23514';
  end if;

  insert into public.checkout_sessions
    (dsl_id, account_id, printed_name, email, horse_legal_name, stake, amount_nzd,
     executed_date, pds_markdown, sa_markdown, pds_hash, sa_hash, expires_at)
  values
    (p_dsl_id, p_account_id, p_printed_name, p_email, p_horse_legal_name, p_stake,
     p_amount_nzd, p_executed_date, p_pds_markdown, p_sa_markdown, p_pds_hash,
     p_sa_hash, now() + make_interval(secs => greatest(p_ttl_seconds, 1)))
  returning * into v_row;

  return v_row;
end;
$$;

-- 2. Release one hold. Returns 1 when this call released it, 0 when the row
--    was already completed or expired — so a late call cannot double-credit.
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
     set status = p_terminal, closed_at = now()
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

-- 3. Expire every overdue hold. The cron and the lazy Checkout call both use
--    this; both are safe to run concurrently because the UPDATE takes the
--    row and the status check makes each hold releasable exactly once.
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
       set status = 'expired', closed_at = now()
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

-- 4. The webhook backstop: a conditional decrement for a hold that lapsed
--    while the money still arrived. Returns the new `stake_remaining`, and
--    raises when there is not enough left — never overdraws.
create or replace function public.sell_stake_atomically(
  p_dsl_id uuid,
  p_stake numeric
) returns numeric
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_remaining numeric(5, 2);
begin
  update public.dsls
     set stake_remaining = stake_remaining - p_stake,
         status = case
                    when stake_remaining - p_stake = 0 then 'fully_allocated'::public.status
                    else status
                  end
   where id = p_dsl_id
     and status = 'available'
     and stake_remaining >= p_stake
  returning stake_remaining into v_remaining;

  if not found then
    raise exception 'no stake available on dsl %', p_dsl_id using errcode = '23514';
  end if;

  return v_remaining;
end;
$$;

-- Only the engine's service role runs these. They are SECURITY DEFINER, so
-- the grant is the fence.
revoke execute on function public.reserve_checkout_stake(
  uuid, uuid, text, text, text, numeric, numeric, date, text, text, text, text, integer
) from public, anon, authenticated;
revoke execute on function public.release_checkout_stake(uuid, text) from public, anon, authenticated;
revoke execute on function public.expire_checkout_stakes() from public, anon, authenticated;
revoke execute on function public.sell_stake_atomically(uuid, numeric) from public, anon, authenticated;

grant execute on function public.reserve_checkout_stake(
  uuid, uuid, text, text, text, numeric, numeric, date, text, text, text, text, integer
) to service_role;
grant execute on function public.release_checkout_stake(uuid, text) to service_role;
grant execute on function public.expire_checkout_stakes() to service_role;
grant execute on function public.sell_stake_atomically(uuid, numeric) to service_role;
