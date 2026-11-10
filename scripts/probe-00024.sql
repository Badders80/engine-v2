-- probe-00024.sql
-- Phase A acceptance probes for 00024_ledger.sql. Local stack only.
--
-- Runs inside one transaction and rolls back, so it leaves no rows behind.
-- The fixture is synthetic and labelled as such (U20). Each check writes one
-- row into a temp table; the final SELECT is the evidence.
--
-- Run:
--   psql "$LOCAL_DB" -v ON_ERROR_STOP=1 -f scripts/probe-00024.sql

\set ON_ERROR_STOP on

begin;

create temp table probe_results (
  n serial,
  check_name text,
  passed boolean,
  detail text
) on commit drop;

-- ---------------------------------------------------------------------------
-- Fixture. Parties, one registered horse, and three chunk-3 listings: an
-- expiry, no start, status available.
-- ---------------------------------------------------------------------------

insert into public.parties (id, display_name, bio) values
  ('11111111-1111-4111-8111-111111111111', 'Synthetic Trainer', 'Trainer bio for the probe.'),
  ('22222222-2222-4222-8222-222222222222', 'Synthetic Owner', 'Owner profile for the probe.');

insert into public.party_roles (party_id, role) values
  ('11111111-1111-4111-8111-111111111111', 'trainer'),
  ('22222222-2222-4222-8222-222222222222', 'owner');

insert into public.horses
  (id, slug, legal_name, foaling_date, sex, colour, sire_name, dam_name,
   registered, about_horse, racing_outlook_and_pedigree, race_expectation,
   image_count)
values
  ('33333333-3333-4333-8333-333333333333', 'probe-horse', 'Probe Horse',
   '2022-10-02', 'Filly', 'Brown', 'Super Seth', 'Warrior Queen', true,
   'A synthetic horse for the ledger probe.',
   'A synthetic pedigree paragraph for the ledger probe.',
   'A synthetic race expectation for the ledger probe.', 0);

-- The account row is created by the real signup trigger on auth.users.
insert into auth.users (id, email, raw_user_meta_data) values
  ('44444444-4444-4444-8444-444444444444', 'probe@example.co.nz',
   '{"full_name": "Probe Buyer"}'::jsonb);

update public.accounts set kyc_status = 'verified'
 where id = '44444444-4444-4444-8444-444444444444';

-- A: eight months remain at the probe month; the listing is a float.
insert into public.dsls
  (id, horse_id, trainer_id, owner_id, end_date, term_start, payment_model,
   close_style, status, published, wholesale_monthly_per_percent, investor_split,
   listed_stake, min_stake, step, stake_remaining, distribution_schedule,
   narrative_signoff, narrative_approved_at, narrative_approved_hash)
values
  ('55555555-5555-4555-8555-555555555551', '33333333-3333-4333-8333-333333333333',
   '11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222',
   '2027-06-30', null, 'subscription_float', 'three_x_remaining', 'available', true,
   70, 75, 10, 5, 5, 10, 'Monthly within 14 days of NZTR settlement',
   '{"horse.about_horse": true, "horse.racing_outlook_and_pedigree": true,
     "horse.race_expectation": true, "trainer.bio": true}'::jsonb,
   now(), 'synthetic-approval-hash');

-- B: three months remain at the probe month; the listing is a float, so the
-- sale must charge the upfront model (ruling 25).
insert into public.dsls
  (id, horse_id, trainer_id, owner_id, end_date, term_start, payment_model,
   close_style, status, published, wholesale_monthly_per_percent, investor_split,
   listed_stake, min_stake, step, stake_remaining, distribution_schedule,
   narrative_signoff, narrative_approved_at, narrative_approved_hash)
values
  ('55555555-5555-4555-8555-555555555552', '33333333-3333-4333-8333-333333333333',
   '11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222',
   '2027-01-31', null, 'subscription_float', 'fourteen_day', 'available', true,
   70, 75, 10, 5, 5, 10, 'Monthly within 14 days of NZTR settlement',
   '{"horse.about_horse": true, "horse.racing_outlook_and_pedigree": true,
     "horse.race_expectation": true, "trainer.bio": true}'::jsonb,
   now(), 'synthetic-approval-hash');

-- C: the close probes.
insert into public.dsls
  (id, horse_id, trainer_id, owner_id, end_date, term_start, payment_model,
   close_style, status, published, wholesale_monthly_per_percent, investor_split,
   listed_stake, min_stake, step, stake_remaining, distribution_schedule,
   narrative_signoff, narrative_approved_at, narrative_approved_hash)
values
  ('55555555-5555-4555-8555-555555555553', '33333333-3333-4333-8333-333333333333',
   '11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222',
   '2027-07-31', null, 'subscription_float', 'three_x_remaining', 'available', true,
   70, 75, 10, 5, 5, 10, 'Monthly within 14 days of NZTR settlement',
   '{"horse.about_horse": true, "horse.racing_outlook_and_pedigree": true,
     "horse.race_expectation": true, "trainer.bio": true}'::jsonb,
   now(), 'synthetic-approval-hash');

-- D: the returned-payment close probe.
insert into public.dsls
  (id, horse_id, trainer_id, owner_id, end_date, term_start, payment_model,
   close_style, status, published, wholesale_monthly_per_percent, investor_split,
   listed_stake, min_stake, step, stake_remaining, distribution_schedule,
   narrative_signoff, narrative_approved_at, narrative_approved_hash)
values
  ('55555555-5555-4555-8555-555555555554', '33333333-3333-4333-8333-333333333333',
   '11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222',
   '2027-08-31', null, 'subscription_float', 'three_x_remaining', 'available', true,
   70, 75, 10, 5, 5, 10, 'Monthly within 14 days of NZTR settlement',
   '{"horse.about_horse": true, "horse.racing_outlook_and_pedigree": true,
     "horse.race_expectation": true, "trainer.bio": true}'::jsonb,
   now(), 'synthetic-approval-hash');

insert into probe_results (check_name, passed, detail)
select 'fixture: the retail rate is 76 and no listing stores a start',
       (select count(*) = 4 from public.dsls where id::text like '55555555%'
          and retail_monthly_per_percent = 76 and term_start is null),
       'retail_monthly_per_percent is generated from wholesale 70';

-- ---------------------------------------------------------------------------
-- A1: reserve then sell. Float listing, eight months remaining.
-- ---------------------------------------------------------------------------

select (public.reserve_checkout_stake(
  '55555555-5555-4555-8555-555555555551',
  '44444444-4444-4444-8444-444444444444',
  'Probe Buyer', 'probe@example.co.nz', 'Probe Horse',
  5, 1900, '2026-11-15',
  'pds markdown', 'sa markdown', 'pds-hash', 'sa-hash', 600
)).id as a1_checkout_id \gset

insert into probe_results (check_name, passed, detail)
select 'A1 reserve takes the stake out of the listing',
       (select stake_remaining = 5 from public.dsls where id = '55555555-5555-4555-8555-555555555551'),
       'listed 10, stake 5, remaining 5';

create temp table a1_result as
select * from public.record_sale_atomically(
  :'a1_checkout_id'::uuid, 'cs_probe_a1', 190000, 'nzd', 'vs_probe'
);

insert into probe_results (check_name, passed, detail)
select 'A1 record_sale writes the sale',
       (select outcome = 'sale_written' and (sale).id is not null from a1_result),
       coalesce((select reason from a1_result), 'sale_written');

insert into probe_results (check_name, passed, detail)
select 'U21 sale-time start is the first of the executed month',
       (select (sale).term_start = '2026-11-01' from a1_result),
       (select (sale).term_start::text from a1_result);

insert into probe_results (check_name, passed, detail)
select 'U21 remaining months are inclusive to the expiry',
       (select (sale).term_months = 8 and (sale).term_end = '2027-06-30' from a1_result),
       (select (sale).term_months::text from a1_result);

insert into probe_results (check_name, passed, detail)
select 'U21 a float listing with more than five months charges subscription_float',
       (select (sale).payment_model_at_sale = 'subscription_float' and (sale).amount = 1900 from a1_result),
       (select (sale).payment_model_at_sale::text from a1_result);

insert into probe_results (check_name, passed, detail)
select 'U18 the snapshot copies every executed term',
       (select (sale).wholesale_monthly_per_percent = 70
           and (sale).retail_monthly_per_percent = 76
           and (sale).investor_split = 75
           and (sale).listed_stake = 10
           and (sale).min_stake = 5
           and (sale).step = 5
           and (sale).end_date = '2027-06-30'
           and (sale).close_style = 'three_x_remaining'
           and (sale).distribution_schedule = 'Monthly within 14 days of NZTR settlement'
           and (sale).trainer_id = '11111111-1111-4111-8111-111111111111'
           and (sale).owner_id = '22222222-2222-4222-8222-222222222222'
           and (sale).term_months = 8
        from a1_result),
       'rates, split, stake shape, end, style, schedule, parties';

insert into probe_results (check_name, passed, detail)
select 'H6 the hold is claimed and the checkout completed',
       (select status = 'completed' and stake_returned_at is null
          from public.checkout_sessions where id = :'a1_checkout_id'::uuid),
       'stake_returned_at stays null: the stake is in the sale';

-- Replay.
create temp table a1_replay as
select * from public.record_sale_atomically(
  :'a1_checkout_id'::uuid, 'cs_probe_a1', 190000, 'nzd', 'vs_probe'
);

insert into probe_results (check_name, passed, detail)
select 'H6 a replayed webhook returns the same sale and writes no second row',
       (select outcome = 'idempotent_replay'
           and (sale).id = (select (sale).id from a1_result)
        from a1_replay)
       and (select count(*) = 1 from public.sales where stripe_session_id = 'cs_probe_a1'),
       'idempotent by stripe_session_id';

-- ---------------------------------------------------------------------------
-- U20: cap-table identity after A1.
-- ---------------------------------------------------------------------------

insert into probe_results (check_name, passed, detail)
select 'U20 identity: listed = sold + open holds + held paid_unfulfilled + remaining',
       (select d.listed_stake
             = coalesce(sold.sold, 0) + coalesce(open_h.holds, 0)
               + coalesce(held.h, 0) + d.stake_remaining
          from public.dsls d
          left join (select dsl_id, sum(stake) as sold from public.sales group by dsl_id) sold
            on sold.dsl_id = d.id
          left join (select dsl_id, sum(stake) as holds from public.checkout_sessions
                      where status = 'open' group by dsl_id) open_h
            on open_h.dsl_id = d.id
          left join (select dsl_id, sum(stake) as h from public.checkout_sessions
                      where status = 'paid_unfulfilled' and stake_returned_at is null
                      group by dsl_id) held
            on held.dsl_id = d.id
         where d.id = '55555555-5555-4555-8555-555555555551'),
       'A: 10 = 5 sold + 0 open + 0 held + 5 remaining';

-- ---------------------------------------------------------------------------
-- A2: a released hold that still gets paid. No sale, paid_unfulfilled,
-- and its stake was returned, so it contributes no capacity.
-- ---------------------------------------------------------------------------

select (public.reserve_checkout_stake(
  '55555555-5555-4555-8555-555555555551',
  '44444444-4444-4444-8444-444444444444',
  'Probe Buyer', 'probe@example.co.nz', 'Probe Horse',
  5, 1900, '2026-11-15',
  'pds markdown', 'sa markdown', 'pds-hash', 'sa-hash', 600
)).id as a2_checkout_id \gset

select public.release_checkout_stake(:'a2_checkout_id'::uuid, 'released');

insert into probe_results (check_name, passed, detail)
select 'U20 release records stake_returned_at and returns the stake',
       (select status = 'released' and stake_returned_at is not null
          from public.checkout_sessions where id = :'a2_checkout_id'::uuid)
       and (select stake_remaining = 5 from public.dsls
             where id = '55555555-5555-4555-8555-555555555551'),
       'released, returned, remaining 5';

create temp table a2_result as
select * from public.record_sale_atomically(
  :'a2_checkout_id'::uuid, 'cs_probe_a2', 190000, 'nzd', 'vs_probe'
);

insert into probe_results (check_name, passed, detail)
select 'H6 a released hold writes no sale and marks paid_unfulfilled',
       (select outcome = 'paid_unfulfilled' and (sale).id is null from a2_result)
       and not exists (select 1 from public.sales where stripe_session_id = 'cs_probe_a2'),
       coalesce((select reason from a2_result), 'no reason');

insert into probe_results (check_name, passed, detail)
select 'U20 a paid_unfulfilled whose stake was returned contributes no capacity',
       (select d.listed_stake
             = coalesce(sold.sold, 0) + coalesce(open_h.holds, 0)
               + coalesce(held.h, 0) + d.stake_remaining
          from public.dsls d
          left join (select dsl_id, sum(stake) as sold from public.sales group by dsl_id) sold
            on sold.dsl_id = d.id
          left join (select dsl_id, sum(stake) as holds from public.checkout_sessions
                      where status = 'open' group by dsl_id) open_h
            on open_h.dsl_id = d.id
          left join (select dsl_id, sum(stake) as h from public.checkout_sessions
                      where status = 'paid_unfulfilled' and stake_returned_at is null
                      group by dsl_id) held
            on held.dsl_id = d.id
         where d.id = '55555555-5555-4555-8555-555555555551'),
       'A: 10 = 5 sold + 0 open + 0 held + 5 remaining';

-- ---------------------------------------------------------------------------
-- A3: wrong currency. Money taken, stake held, no sale.
-- ---------------------------------------------------------------------------

select (public.reserve_checkout_stake(
  '55555555-5555-4555-8555-555555555551',
  '44444444-4444-4444-8444-444444444444',
  'Probe Buyer', 'probe@example.co.nz', 'Probe Horse',
  5, 1900, '2026-11-15',
  'pds markdown', 'sa markdown', 'pds-hash', 'sa-hash', 600
)).id as a3_checkout_id \gset

create temp table a3_result as
select * from public.record_sale_atomically(
  :'a3_checkout_id'::uuid, 'cs_probe_a3', 190000, 'usd', 'vs_probe'
);

insert into probe_results (check_name, passed, detail)
select 'H6 a non-NZD charge writes no sale and holds the stake',
       (select outcome = 'paid_unfulfilled' and (sale).id is null from a3_result)
       and (select status = 'paid_unfulfilled' and stake_returned_at is null
              from public.checkout_sessions where id = :'a3_checkout_id'::uuid),
       coalesce((select reason from a3_result), 'no reason');

insert into probe_results (check_name, passed, detail)
select 'U20 a held paid_unfulfilled contributes capacity',
       (select d.listed_stake
             = coalesce(sold.sold, 0) + coalesce(open_h.holds, 0)
               + coalesce(held.h, 0) + d.stake_remaining
          from public.dsls d
          left join (select dsl_id, sum(stake) as sold from public.sales group by dsl_id) sold
            on sold.dsl_id = d.id
          left join (select dsl_id, sum(stake) as holds from public.checkout_sessions
                      where status = 'open' group by dsl_id) open_h
            on open_h.dsl_id = d.id
          left join (select dsl_id, sum(stake) as h from public.checkout_sessions
                      where status = 'paid_unfulfilled' and stake_returned_at is null
                      group by dsl_id) held
            on held.dsl_id = d.id
         where d.id = '55555555-5555-4555-8555-555555555551'),
       'A: 10 = 5 sold + 0 open + 5 held + 0 remaining';

-- A wrong amount, on B, is refused too. B is then used for the close probe.
select (public.reserve_checkout_stake(
  '55555555-5555-4555-8555-555555555552',
  '44444444-4444-4444-8444-444444444444',
  'Probe Buyer', 'probe@example.co.nz', 'Probe Horse',
  5, 1140, '2026-11-15',
  'pds markdown', 'sa markdown', 'pds-hash', 'sa-hash', 600
)).id as b1_checkout_id \gset

create temp table b1_bad_amount as
select * from public.record_sale_atomically(
  :'b1_checkout_id'::uuid, 'cs_probe_b1_bad', 1, 'nzd', 'vs_probe'
);

insert into probe_results (check_name, passed, detail)
select 'H6 an amount that disagrees with the bound quote writes no sale',
       (select outcome = 'paid_unfulfilled' from b1_bad_amount),
       coalesce((select reason from b1_bad_amount), 'no reason');

-- ---------------------------------------------------------------------------
-- B: three months remain on a subscription_float listing. Ruling 25 forces
-- the upfront model and charges the three remaining months.
-- ---------------------------------------------------------------------------

select (public.reserve_checkout_stake(
  '55555555-5555-4555-8555-555555555552',
  '44444444-4444-4444-8444-444444444444',
  'Probe Buyer', 'probe@example.co.nz', 'Probe Horse',
  5, 1140, '2026-11-15',
  'pds markdown', 'sa markdown', 'pds-hash', 'sa-hash', 600
)).id as b2_checkout_id \gset

create temp table b2_result as
select * from public.record_sale_atomically(
  :'b2_checkout_id'::uuid, 'cs_probe_b2', 114000, 'nzd', 'vs_probe'
);

insert into probe_results (check_name, passed, detail)
select 'U21 three remaining months force upfront on a float listing',
       (select (sale).payment_model_at_sale = 'upfront'
           and (sale).term_months = 3
           and (sale).term_start = '2026-11-01'
           and (sale).amount = 1140
           and (sale).close_style = 'fourteen_day'
        from b2_result),
       (select format('model %s, %s months, $%s',
                      (sale).payment_model_at_sale, (sale).term_months, (sale).amount)
          from b2_result);

-- ---------------------------------------------------------------------------
-- U19: the close guard.
-- ---------------------------------------------------------------------------

select (public.reserve_checkout_stake(
  '55555555-5555-4555-8555-555555555553',
  '44444444-4444-4444-8444-444444444444',
  'Probe Buyer', 'probe@example.co.nz', 'Probe Horse',
  5, 1900, '2026-11-15',
  'pds markdown', 'sa markdown', 'pds-hash', 'sa-hash', 600
)).id as c1_checkout_id \gset

do $$
begin
  begin
    perform public.close_dsl('55555555-5555-4555-8555-555555555553', 'probe close', 'probe operator');
    insert into probe_results (check_name, passed, detail)
    values ('U19 close is refused while an open hold exists', false, 'the close succeeded');
  exception when others then
    insert into probe_results (check_name, passed, detail)
    values ('U19 close is refused while an open hold exists', sqlerrm like '%open hold%' or sqlerrm like '%held%', sqlerrm);
  end;
end
$$;

-- Sweep: force the hold past its expiry, then expire it.
update public.checkout_sessions
   set expires_at = now() - interval '1 minute'
 where id = :'c1_checkout_id'::uuid;

select public.expire_checkout_stakes();

insert into probe_results (check_name, passed, detail)
select 'U20 expiry records stake_returned_at and returns the stake',
       (select status = 'expired' and stake_returned_at is not null
          from public.checkout_sessions where id = :'c1_checkout_id'::uuid)
       and (select stake_remaining = 10 from public.dsls
             where id = '55555555-5555-4555-8555-555555555553'),
       'expired, returned, remaining restored to 10';

create temp table c1_closed as
select * from public.close_dsl(
  '55555555-5555-4555-8555-555555555553', 'probe close', 'probe operator'
);

insert into probe_results (check_name, passed, detail)
select 'U19 close succeeds once no open or paid_unfulfilled checkout remains',
       (select status = 'completed' and closed_at is not null
           and closed_reason = 'probe close' and closed_by = 'probe operator'
        from c1_closed),
       'status completed, closed_at/reason/by set';

do $$
begin
  begin
    perform public.close_dsl('55555555-5555-4555-8555-555555555553', 'again', 'probe operator');
    insert into probe_results (check_name, passed, detail)
    values ('U19 a second close is refused', false, 'the second close succeeded');
  exception when others then
    insert into probe_results (check_name, passed, detail)
    values ('U19 a second close is refused', sqlerrm like '%already closed%', sqlerrm);
  end;
end
$$;

do $$
begin
  begin
    perform public.close_dsl('55555555-5555-4555-8555-555555555551', 'probe close', 'probe operator');
    insert into probe_results (check_name, passed, detail)
    values ('U19 close is refused while a held paid_unfulfilled exists', false, 'the close succeeded');
  exception when others then
    insert into probe_results (check_name, passed, detail)
    values ('U19 close is refused while a held paid_unfulfilled exists', sqlerrm like '%unresolved%', sqlerrm);
  end;
end
$$;

-- D: a paid_unfulfilled whose stake was returned still blocks the close.
select (public.reserve_checkout_stake(
  '55555555-5555-4555-8555-555555555554',
  '44444444-4444-4444-8444-444444444444',
  'Probe Buyer', 'probe@example.co.nz', 'Probe Horse',
  5, 1900, '2026-11-15',
  'pds markdown', 'sa markdown', 'pds-hash', 'sa-hash', 600
)).id as d1_checkout_id \gset

select public.release_checkout_stake(:'d1_checkout_id'::uuid, 'released');
select * from public.record_sale_atomically(:'d1_checkout_id'::uuid, 'cs_probe_d1', 190000, 'nzd', null);

do $$
begin
  begin
    perform public.close_dsl('55555555-5555-4555-8555-555555555554', 'probe close', 'probe operator');
    insert into probe_results (check_name, passed, detail)
    values ('U19 close is refused while a returned paid_unfulfilled exists', false, 'the close succeeded');
  exception when others then
    insert into probe_results (check_name, passed, detail)
    values ('U19 close is refused while a returned paid_unfulfilled exists',
            sqlerrm like '%0 held and 1 returned%', sqlerrm);
  end;
end
$$;

-- ---------------------------------------------------------------------------
-- H6: UPDATE, DELETE and TRUNCATE are refused.
-- ---------------------------------------------------------------------------

do $$
begin
  begin
    update public.sales set amount = 1;
    insert into probe_results (check_name, passed, detail)
    values ('H6 UPDATE on sales is refused', false, 'the update succeeded');
  exception when sqlstate '55000' then
    insert into probe_results (check_name, passed, detail)
    values ('H6 UPDATE on sales is refused', true, sqlerrm);
  end;

  begin
    delete from public.sales;
    insert into probe_results (check_name, passed, detail)
    values ('H6 DELETE on sales is refused', false, 'the delete succeeded');
  exception when sqlstate '55000' then
    insert into probe_results (check_name, passed, detail)
    values ('H6 DELETE on sales is refused', true, sqlerrm);
  end;

  begin
    truncate public.sales;
    insert into probe_results (check_name, passed, detail)
    values ('H6 TRUNCATE on sales is refused', false, 'the truncate succeeded');
  exception when sqlstate '55000' then
    insert into probe_results (check_name, passed, detail)
    values ('H6 TRUNCATE on sales is refused', true, sqlerrm);
  end;
end
$$;

-- The privileges themselves, for the three API roles.
insert into probe_results (check_name, passed, detail)
select 'H6 UPDATE, DELETE and TRUNCATE are revoked from every API role',
       count(*) = 0,
       coalesce(string_agg(grantee || ':' || privilege_type, ', '), 'none granted')
  from information_schema.role_table_grants
 where table_schema = 'public'
   and table_name = 'sales'
   and grantee in ('service_role', 'anon', 'authenticated')
   and privilege_type in ('UPDATE', 'DELETE', 'TRUNCATE');

-- ---------------------------------------------------------------------------
-- Evidence.
-- ---------------------------------------------------------------------------

select n, check_name, case when passed then 'PASS' else 'FAIL' end as result, detail
  from probe_results order by n;

select count(*) filter (where not passed) as failures from probe_results;

do $$
begin
  if (select count(*) from probe_results where not passed) > 0 then
    raise exception 'probe-00024 failures: %',
      (select string_agg(check_name, '; ' order by n) from probe_results where not passed);
  end if;
end $$;

rollback;
