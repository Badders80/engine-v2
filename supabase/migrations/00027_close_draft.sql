-- 00027_close_draft.sql
-- Rules: R-SALE-05 (close guard).
--
-- An abandoned coming_soon draft had no exit: close_dsl permitted only
-- available or fully_allocated. A draft that never listed now closes in place:
-- closed_at, closed_reason and closed_by are stamped and the status stays
-- coming_soon. The ledger labels a closed zero-sale draft "archived". No new
-- status, no enum migration, and an unregistered horse's draft closes too.

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

  if v_dsl.status not in ('coming_soon', 'available', 'fully_allocated') then
    raise exception 'dsl % is % and cannot be closed; a draft, available or fully allocated listing closes',
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

  -- A draft closes in place: it never listed, so it gains no terminal status.
  -- This also keeps an unregistered horse's draft closable, which the status
  -- machine would refuse.
  if v_dsl.status = 'coming_soon' then
    update public.dsls
       set closed_at = now(),
           closed_reason = p_reason,
           closed_by = p_closed_by
     where id = p_dsl_id
    returning * into v_dsl;
    return v_dsl;
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
