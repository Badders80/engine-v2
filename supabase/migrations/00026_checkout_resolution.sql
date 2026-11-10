-- 00026_checkout_resolution.sql
-- Chunk 4 follow-up, P0: a paid_unfulfilled checkout blocked the close forever.
--
-- Rules: R-SALE-05 (close guard), R-SALE-06 (paid_unfulfilled is a financial
-- exception, not a sale), R-ALLOC-01 (cap-table identity), R-ALLOC-03
-- (stake_returned_at is the held/returned signal).
--
-- Resolution is a recorded operator act: who, when, why. A resolved row no
-- longer blocks the close and no longer holds capacity. The status stays
-- `paid_unfulfilled`; it is a historical fact, not a toggle.

alter table public.checkout_sessions
  add column resolved_at timestamptz,
  add column resolved_by text,
  add column resolution text;

create or replace function public.resolve_paid_unfulfilled(
  p_checkout_id uuid,
  p_resolved_by text,
  p_resolution text
) returns public.checkout_sessions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.checkout_sessions;
begin
  if p_resolved_by is null or btrim(p_resolved_by) = '' then
    raise exception 'resolve_paid_unfulfilled: a resolver is required'
      using errcode = '23514';
  end if;
  if p_resolution is null or btrim(p_resolution) = '' then
    raise exception 'resolve_paid_unfulfilled: a resolution is required'
      using errcode = '23514';
  end if;

  select c.* into v_row
    from public.checkout_sessions c
   where c.id = p_checkout_id
     for update;

  if v_row.id is null then
    raise exception 'checkout % does not exist', p_checkout_id
      using errcode = '23503';
  end if;
  if v_row.status <> 'paid_unfulfilled' then
    raise exception 'checkout % is %, not paid_unfulfilled', p_checkout_id, v_row.status
      using errcode = '23514';
  end if;
  if v_row.resolved_at is not null then
    raise exception 'checkout % is already resolved', p_checkout_id
      using errcode = '23514';
  end if;

  -- No sale exists, so a stake still held goes back to the listing.
  if v_row.stake_returned_at is null then
    update public.dsls
       set stake_remaining = least(listed_stake, stake_remaining + v_row.stake)
     where id = v_row.dsl_id;
  end if;

  update public.checkout_sessions
     set resolved_at = now(),
         resolved_by = btrim(p_resolved_by),
         resolution = btrim(p_resolution),
         stake_returned_at = coalesce(stake_returned_at, now())
   where id = p_checkout_id
  returning * into v_row;

  return v_row;
end;
$$;

revoke execute on function public.resolve_paid_unfulfilled(uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.resolve_paid_unfulfilled(uuid, text, text)
  to service_role;

-- R-SALE-05: close sweeps stale holds, then blocks on an open hold or an
-- UNRESOLVED paid_unfulfilled row. A resolved exception no longer blocks.
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
     and (
       c.status = 'open'
       or (c.status = 'paid_unfulfilled' and c.resolved_at is null)
     );

  if v_held + v_returned > 0 then
    raise exception
      'dsl % cannot be closed: % held and % returned unresolved checkout(s) exist',
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
