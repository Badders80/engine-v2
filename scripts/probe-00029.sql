-- probe-00029.sql
-- expect: 5
-- Acceptance probes for 00029_closed_row_immutable.sql. Local stack only.
-- One transaction, rolled back.
--
-- Run:
--   psql "$LOCAL_DB" -v ON_ERROR_STOP=1 -f scripts/probe-00029.sql

\set ON_ERROR_STOP on

begin;

create temp table probe_results (
  n serial,
  check_name text,
  passed boolean,
  detail text
) on commit drop;

insert into public.parties (id, display_name, bio) values
  ('d1111111-1111-4111-8111-111111111111', 'Synthetic Trainer', 'Trainer bio.'),
  ('d2222222-2222-4222-8222-222222222222', 'Synthetic Owner', 'Owner profile.');

insert into public.party_roles (party_id, role) values
  ('d1111111-1111-4111-8111-111111111111', 'trainer'),
  ('d2222222-2222-4222-8222-222222222222', 'owner');

insert into public.horses
  (id, slug, legal_name, foaling_date, sex, colour, sire_name, dam_name,
   registered, about_horse, racing_outlook_and_pedigree, race_expectation,
   image_count)
values
  ('d3333333-3333-4333-8333-333333333333', 'probe-closed-horse', 'Probe Closed Horse',
   '2022-10-02', 'Filly', 'Brown', 'Super Seth', 'Warrior Queen', true,
   'Synthetic about.', 'Synthetic pedigree.', 'Synthetic expectation.', 0);

-- A: a draft that is closed in place.
insert into public.dsls
  (id, horse_id, trainer_id, owner_id, end_date, term_start, payment_model,
   close_style, status, published, wholesale_monthly_per_percent, investor_split,
   listed_stake, min_stake, step, stake_remaining, distribution_schedule,
   narrative_signoff, narrative_approved_at, narrative_approved_hash)
values
  ('d5555555-5555-4555-8555-555555555551', 'd3333333-3333-4333-8333-333333333333',
   'd1111111-1111-4111-8111-111111111111', 'd2222222-2222-4222-8222-222222222222',
   null, null, null, null, 'coming_soon', false, null, null, 5, 1, 1, 5, null, null, null, null);

select public.close_dsl('d5555555-5555-4555-8555-555555555551', 'draft abandoned', 'operator');

insert into probe_results (check_name, passed, detail)
select 'the draft closes in place',
       status = 'coming_soon' and closed_at is not null,
       status || ' | closed_at=' || coalesce(closed_at::text, 'null')
  from public.dsls where id = 'd5555555-5555-4555-8555-555555555551';

-- 2. Editing a closed draft is refused.
do $$
begin
  begin
    update public.dsls set listed_stake = 6
     where id = 'd5555555-5555-4555-8555-555555555551';
    insert into probe_results (check_name, passed, detail)
    values ('editing a closed draft is refused', false, 'the update succeeded');
  exception when others then
    insert into probe_results (check_name, passed, detail)
    values ('editing a closed draft is refused',
            sqlerrm like '%closed and cannot be edited%', sqlerrm);
  end;
end $$;

-- 3. Un-closing is refused by the same rule.
do $$
begin
  begin
    update public.dsls set closed_at = null
     where id = 'd5555555-5555-4555-8555-555555555551';
    insert into probe_results (check_name, passed, detail)
    values ('un-closing is refused', false, 'the update succeeded');
  exception when others then
    insert into probe_results (check_name, passed, detail)
    values ('un-closing is refused', sqlerrm like '%closed and cannot be edited%', sqlerrm);
  end;
end $$;

-- B: a listed DSL that closes, then refuses a status change.
insert into public.dsls
  (id, horse_id, trainer_id, owner_id, end_date, term_start, payment_model,
   close_style, status, published, wholesale_monthly_per_percent, investor_split,
   listed_stake, min_stake, step, stake_remaining, distribution_schedule,
   narrative_signoff, narrative_approved_at, narrative_approved_hash)
values
  ('d5555555-5555-4555-8555-555555555552', 'd3333333-3333-4333-8333-333333333333',
   'd1111111-1111-4111-8111-111111111111', 'd2222222-2222-4222-8222-222222222222',
   '2028-06-30', null, 'subscription_float', 'fourteen_day', 'available', true,
   70, 75, 5, 1, 1, 5, 'Monthly within 14 days of NZTR settlement',
   '{"horse.about_horse": true, "horse.racing_outlook_and_pedigree": true,
     "horse.race_expectation": true, "trainer.bio": true}'::jsonb,
   now(), 'synthetic-approval-hash');

select public.close_dsl('d5555555-5555-4555-8555-555555555552', 'season ended', 'operator');

insert into probe_results (check_name, passed, detail)
select 'the listed DSL closes to completed',
       status = 'completed' and closed_at is not null,
       status || ' | closed_at=' || coalesce(closed_at::text, 'null')
  from public.dsls where id = 'd5555555-5555-4555-8555-555555555552';

do $$
begin
  begin
    update public.dsls set status = 'available'
     where id = 'd5555555-5555-4555-8555-555555555552';
    insert into probe_results (check_name, passed, detail)
    values ('a closed listed DSL cannot be resurrected', false, 'the update succeeded');
  exception when others then
    insert into probe_results (check_name, passed, detail)
    values ('a closed listed DSL cannot be resurrected',
            sqlerrm like '%closed and cannot be edited%', sqlerrm);
  end;
end $$;

select n, check_name, case when passed then 'PASS' else 'FAIL' end as result, detail
  from probe_results order by n;

do $$
declare
  v_count integer;
begin
  select count(*) into v_count from probe_results;
  if v_count <> 5 then
    raise exception 'probe-00029 expected 5 rows, got %', v_count;
  end if;
  if exists (select 1 from probe_results where not passed) then
    raise exception 'probe-00029 failures: %',
      (select string_agg(check_name, '; ' order by n) from probe_results where not passed);
  end if;
end $$;

rollback;
