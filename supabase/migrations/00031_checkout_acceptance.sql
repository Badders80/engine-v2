-- 00031_checkout_acceptance.sql
-- F1: bind the signed Investor Pack acceptance to the frozen checkout.
--
-- The Stripe-bound checkout is the legal handoff. It may not exist without a
-- complete acceptance record, and the record may not change after it is
-- written. PDS and SA markdown hashes are already frozen on this row.

alter table public.checkout_sessions
  add column pds_accepted_at timestamptz,
  add column sa_accepted_at timestamptz,
  add column declarations_accepted jsonb,
  add column typed_signature text,
  add column acceptance_recorded_at timestamptz;

alter table public.checkout_sessions
  add constraint checkout_acceptance_all_or_nothing check (
    num_nonnulls(
      pds_accepted_at,
      sa_accepted_at,
      declarations_accepted,
      typed_signature,
      acceptance_recorded_at
    ) in (0, 5)
  ),
  add constraint checkout_signature_matches_printed_name check (
    typed_signature is null or typed_signature = printed_name
  ),
  add constraint checkout_declarations_is_array check (
    declarations_accepted is null
    or (jsonb_typeof(declarations_accepted) = 'array'
        and jsonb_array_length(declarations_accepted) > 0)
  );

comment on column public.checkout_sessions.declarations_accepted is
  'Immutable canonical declaration snapshot accepted with the SA.';
comment on column public.checkout_sessions.typed_signature is
  'Typed full legal name; must match printed_name.';

create function public.record_checkout_acceptance(
  p_checkout_id uuid,
  p_declarations jsonb,
  p_typed_signature text
) returns public.checkout_sessions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.checkout_sessions;
begin
  if p_checkout_id is null then
    raise exception 'record_checkout_acceptance: checkout id is required'
      using errcode = '23514';
  end if;
  if p_declarations is null
     or jsonb_typeof(p_declarations) <> 'array'
     or jsonb_array_length(p_declarations) = 0 then
    raise exception 'record_checkout_acceptance: declarations must be a non-empty array'
      using errcode = '23514';
  end if;
  if p_typed_signature is null or btrim(p_typed_signature) = '' then
    raise exception 'record_checkout_acceptance: typed signature is required'
      using errcode = '23514';
  end if;

  update public.checkout_sessions
     set pds_accepted_at = now(),
         sa_accepted_at = now(),
         declarations_accepted = p_declarations,
         typed_signature = btrim(p_typed_signature),
         acceptance_recorded_at = now()
   where id = p_checkout_id
     and status = 'open'
     and stripe_session_id is null
     and acceptance_recorded_at is null
  returning * into v_row;

  if v_row.id is null then
    raise exception 'record_checkout_acceptance: checkout % is missing, already bound or already accepted', p_checkout_id
      using errcode = '23514';
  end if;

  return v_row;
end;
$$;

create function public.assert_checkout_acceptance_transition()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.stripe_session_id is not null
     and new.stripe_session_id is distinct from old.stripe_session_id
     and new.acceptance_recorded_at is null then
    raise exception 'checkout acceptance must be recorded before Stripe binds the checkout'
      using errcode = '23514';
  end if;

  if old.acceptance_recorded_at is not null and (
    new.pds_accepted_at is distinct from old.pds_accepted_at
    or new.sa_accepted_at is distinct from old.sa_accepted_at
    or new.declarations_accepted is distinct from old.declarations_accepted
    or new.typed_signature is distinct from old.typed_signature
    or new.acceptance_recorded_at is distinct from old.acceptance_recorded_at
  ) then
    raise exception 'checkout acceptance evidence is immutable'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger checkout_acceptance_transition
before update on public.checkout_sessions
for each row execute function public.assert_checkout_acceptance_transition();

revoke execute on function public.record_checkout_acceptance(uuid, jsonb, text)
  from public, anon, authenticated;
grant execute on function public.record_checkout_acceptance(uuid, jsonb, text)
  to service_role;
