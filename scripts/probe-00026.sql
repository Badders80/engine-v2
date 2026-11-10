-- probe-00026.sql
-- Acceptance probes for 00026_checkout_resolution.sql. Local stack only.
--
-- One transaction, rolled back. The fixture is synthetic and labelled.
-- Run:
--   psql "$LOCAL_DB" -v ON_ERROR_STOP=1 -f scripts/probe-00026.sql

\set ON_ERROR_STOP on

begin;

create temp table probe_results (
  n serial,
  check_name text,
  passed boolean,
  detail text
) on commit drop;

insert into public.parties (id, display_name, bio) values
  ('a1111111-1111-4111-8111-111111111111', 'Synthetic Trainer', 'Trainer bio.'),
  ('a2222222-2222-4222-8222-222222222222', 'Synthetic Owner', 'Owner profile.');

insert into public.party_roles (party_id, role) values
  ('a1111111-1111-4111-8111-111111111111', 'trainer'),
  ('a2222222-2222-4222-8222-222222222222', 'owner');

insert into public.horses
  (id, slug, legal_name, foaling_date, sex, colour, sire_name, dam_name,
   registered, about_horse, racing_outlook_and_pedigree, race_expectation,
   image_count)
values
  ('a3333333-3333-4333-8333-333333333333', 'probe-resolve-horse', 'Probe Resolve Horse',
   '2022-10-02', 'Filly', 'Brown', 'Super Seth', 'Warrior Queen', true,
   'Synthetic about.', 'Synthetic pedigree.', 'Synthetic expectation.', 0);

insert into auth.users (id, email, raw_user_meta_data) values
  ('a4444444-4444-4444-8444-444444444444', 'probe-resolve@example.co.nz',
   '{"full_name": "Probe Buyer"}'::jsonb);

update public.accounts set kyc_status = 'verified'
 where id = 'a4444444-4444-4444-8444-444444444444';

-- Listed 10; 5 is held by the paid-unfulfilled checkout below.
insert into public.dsls
  (id, horse_id, trainer_id, owner_id, end_date, term_start, payment_model,
   close_style, status, published, wholesale_monthly_per_percent, investor_split,
   listed_stake, min_stake, step, stake_remaining, distribution_schedule,
   narrative_signoff, narrative_approved_at, narrative_approved_hash)
values
  ('a5555555-5555-4555-8555-555555555555', 'a3333333-3333-4333-8333-333333333333',
   'a1111111-1111-4111-8111-111111111111', 'a2222222-2222-4222-8222-222222222222',
   '2028-06-30', null, 'subscription_float', 'fourteen_day', 'available', true,
   70, 75, 10, 1, 1, 5, 'Monthly within 14 days of NZTR settlement',
   '{"horse.about_horse": true, "horse.racing_outlook_and_pedigree": true,
     "horse.race_expectation": true, "trainer.bio": true}'::jsonb,
   now(), 'synthetic-approval-hash');

insert into public.checkout_sessions
  (id, stripe_session_id, dsl_id, account_id, printed_name, email, horse_legal_name,
   stake, amount_nzd, executed_date, pds_markdown, sa_markdown, pds_hash, sa_hash,
   status, expires_at, closed_at, stake_returned_at)
values
  ('a6666666-6666-4666-8666-666666666666', 'cs_probe_resolve',
   'a5555555-5555-4555-8555-555555555555', 'a4444444-4444-4444-8444-444444444444',
   'Probe Buyer', 'probe-resolve@example.co.nz', 'Probe Resolve Horse',
   5, 1900, '2026-11-15', '# PDS', '# SA', repeat('a', 64), repeat('b', 64),
   'paid_unfulfilled', now() + interval '10 minutes', now(), null);

insert into probe_results (check_name, passed, detail)
select 'fixture: 5 held by an unresolved paid_unfulfilled',
       stake_remaining = 5, 'remaining=' || stake_remaining
  from public.dsls where id = 'a5555555-5555-4555-8555-555555555555';

-- 1. Close is refused before resolution.
do $$
begin
  perform public.close_dsl('a5555555-5555-4555-8555-555555555555', 'close', 'operator');
  insert into probe_results (check_name, passed, detail)
  values ('close before resolve refused', false, 'no exception');
exception when others then
  insert into probe_results (check_name, passed, detail)
  values ('close before resolve refused', true, sqlerrm);
end $$;

-- 2. Resolution records who/when/why and returns the held stake.
select public.resolve_paid_unfulfilled(
  'a6666666-6666-4666-8666-666666666666', 'operator', 'refunded, no sale');

insert into probe_results (check_name, passed, detail)
select 'resolution records the operator, time and note',
       resolved_at is not null and resolved_by = 'operator'
         and resolution = 'refunded, no sale',
       coalesce(resolved_by, 'null') || ' | ' || coalesce(resolution, 'null')
  from public.checkout_sessions where id = 'a6666666-6666-4666-8666-666666666666';

insert into probe_results (check_name, passed, detail)
select 'resolution returns the held stake',
       stake_remaining = 10, 'remaining=' || stake_remaining
  from public.dsls where id = 'a5555555-5555-4555-8555-555555555555';

insert into probe_results (check_name, passed, detail)
select 'resolution stamps stake_returned_at',
       stake_returned_at is not null, coalesce(stake_returned_at::text, 'null')
  from public.checkout_sessions where id = 'a6666666-6666-4666-8666-666666666666';

-- 3. A second resolution is refused.
do $$
begin
  perform public.resolve_paid_unfulfilled(
    'a6666666-6666-4666-8666-666666666666', 'operator', 'again');
  insert into probe_results (check_name, passed, detail)
  values ('second resolution refused', false, 'no exception');
exception when others then
  insert into probe_results (check_name, passed, detail)
  values ('second resolution refused', true, sqlerrm);
end $$;

-- 4. Close now succeeds.
select status, closed_at, closed_reason, closed_by
  from public.close_dsl('a5555555-5555-4555-8555-555555555555', 'season ended', 'operator');

insert into probe_results (check_name, passed, detail)
select 'close succeeds after resolution',
       status = 'completed' and closed_at is not null
         and closed_reason = 'season ended' and closed_by = 'operator',
       status || ' | ' || coalesce(closed_reason, 'null')
  from public.dsls where id = 'a5555555-5555-4555-8555-555555555555';

select n, check_name, case when passed then 'PASS' else 'FAIL' end as result, detail
  from probe_results order by n;

select count(*) filter (where not passed) as failures from probe_results;

do $$
declare
  v_count integer;
begin
  select count(*) into v_count from probe_results;
  if v_count <> 7 then
    raise exception 'probe-00026 expected 7 rows, got %', v_count;
  end if;
  if exists (select 1 from probe_results where not passed) then
    raise exception 'probe-00026 failures: %',
      (select string_agg(check_name, '; ' order by n) from probe_results where not passed);
  end if;
end $$;

rollback;
