-- probe-00027.sql
-- Acceptance probes for 00027_close_draft.sql. Local stack only.
-- One transaction, rolled back.
--
-- Run:
--   psql "$LOCAL_DB" -v ON_ERROR_STOP=1 -f scripts/probe-00027.sql

\set ON_ERROR_STOP on

begin;

create temp table probe_results (
  n serial,
  check_name text,
  passed boolean,
  detail text
) on commit drop;

insert into public.parties (id, display_name, bio) values
  ('b1111111-1111-4111-8111-111111111111', 'Synthetic Trainer', 'Trainer bio.'),
  ('b2222222-2222-4222-8222-222222222222', 'Synthetic Owner', 'Owner profile.');

insert into public.party_roles (party_id, role) values
  ('b1111111-1111-4111-8111-111111111111', 'trainer'),
  ('b2222222-2222-4222-8222-222222222222', 'owner');

insert into public.horses
  (id, slug, legal_name, foaling_date, sex, colour, sire_name, dam_name,
   registered, about_horse, racing_outlook_and_pedigree, race_expectation,
   image_count)
values
  ('b3333333-3333-4333-8333-333333333333', 'probe-draft-horse', 'Probe Draft Horse',
   '2022-10-02', 'Filly', 'Brown', 'Super Seth', 'Warrior Queen', true,
   'Synthetic about.', 'Synthetic pedigree.', 'Synthetic expectation.', 0);

insert into public.dsls
  (id, horse_id, trainer_id, owner_id, end_date, term_start, payment_model,
   close_style, status, published, wholesale_monthly_per_percent, investor_split,
   listed_stake, min_stake, step, stake_remaining, distribution_schedule,
   narrative_signoff, narrative_approved_at, narrative_approved_hash)
values
  ('b5555555-5555-4555-8555-555555555555', 'b3333333-3333-4333-8333-333333333333',
   'b1111111-1111-4111-8111-111111111111', 'b2222222-2222-4222-8222-222222222222',
   '2028-06-30', null, null, null, 'coming_soon', false,
   null, null, 5, 1, 1, 5, null, null, null, null);

select status, closed_at, closed_reason, closed_by
  from public.close_dsl('b5555555-5555-4555-8555-555555555555', 'draft abandoned', 'operator');

insert into probe_results (check_name, passed, detail)
select 'a coming_soon draft closes in place',
       status = 'coming_soon' and closed_at is not null
         and closed_reason = 'draft abandoned' and closed_by = 'operator',
       status || ' | ' || coalesce(closed_reason, 'null')
  from public.dsls where id = 'b5555555-5555-4555-8555-555555555555';

do $$
begin
  begin
    perform public.close_dsl('b5555555-5555-4555-8555-555555555555', 'again', 'operator');
    insert into probe_results (check_name, passed, detail)
    values ('a second draft close is refused', false, 'the second close succeeded');
  exception when others then
    insert into probe_results (check_name, passed, detail)
    values ('a second draft close is refused', sqlerrm like '%already closed%', sqlerrm);
  end;
end $$;

select n, check_name, case when passed then 'PASS' else 'FAIL' end as result, detail
  from probe_results order by n;

do $$
declare
  v_count integer;
begin
  select count(*) into v_count from probe_results;
  if v_count <> 2 then
    raise exception 'probe-00027 expected 2 rows, got %', v_count;
  end if;
  if exists (select 1 from probe_results where not passed) then
    raise exception 'probe-00027 failures: %',
      (select string_agg(check_name, '; ' order by n) from probe_results where not passed);
  end if;
end $$;

rollback;
