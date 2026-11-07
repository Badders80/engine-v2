-- 00018_checkout_hold_ten_minutes.sql
-- The hold is ten minutes, not five (founder ruling, 2026-11-07).
--
-- Stripe Identity is a document photo plus liveness, and it is the step that
-- does not fit in five minutes. A hold that lapses mid-verification is still
-- recoverable — the webhook's backstop decrements atomically — but it takes a
-- path nobody wants a real buyer on.
--
-- The default is removed rather than retuned: two sources for the hold is the
-- same drift as two definitions of "ready". `openCheckoutSession` computes the
-- TTL from `CHECKOUT_HOLD_SECONDS` and passes it in, so the caller must state
-- the hold and cannot silently inherit a stale number.

-- A default cannot be removed with `create or replace` (42P13), so the
-- function is dropped and recreated. That drops its grants too; they are
-- restored at the bottom of this file.
drop function public.reserve_checkout_stake(
  uuid, uuid, text, text, text, numeric, numeric, date, text, text, text, text, integer
);

create function public.reserve_checkout_stake(
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
  p_ttl_seconds integer
) returns public.checkout_sessions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_remaining numeric(5, 2);
  v_row public.checkout_sessions;
begin
  if p_ttl_seconds is null or p_ttl_seconds <= 0 then
    raise exception 'reserve_checkout_stake: p_ttl_seconds must be positive'
      using errcode = '23514';
  end if;

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
     p_sa_hash, now() + make_interval(secs => p_ttl_seconds))
  returning * into v_row;

  return v_row;
end;
$$;

revoke execute on function public.reserve_checkout_stake(
  uuid, uuid, text, text, text, numeric, numeric, date, text, text, text, text, integer
) from public, anon, authenticated;

grant execute on function public.reserve_checkout_stake(
  uuid, uuid, text, text, text, numeric, numeric, date, text, text, text, text, integer
) to service_role;
