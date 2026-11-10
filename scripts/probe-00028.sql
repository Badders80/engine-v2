-- probe-00028.sql
-- expect: 3
-- Acceptance probes for 00028_dateless_draft_index.sql. Local stack only.
-- One transaction, rolled back.
--
-- Run:
--   psql "$LOCAL_DB" -v ON_ERROR_STOP=1 -f scripts/probe-00028.sql

\set ON_ERROR_STOP on

begin;

create temp table probe_results (
  n serial,
  check_name text,
  passed boolean,
  detail text
) on commit drop;

insert into public.parties (id, display_name, bio) values
  ('c1111111-1111-4111-8111-111111111111', 'Synthetic Trainer', 'Trainer bio.'),
  ('c2222222-2222-4222-8222-222222222222', 'Synthetic Owner', 'Owner profile.');

insert into public.party_roles (party_id, role) values
  ('c1111111-1111-4111-8111-111111111111', 'trainer'),
  ('c2222222-2222-4222-8222-222222222222', 'owner');

insert into public.horses
  (id, slug, legal_name, foaling_date, sex, colour, sire_name, dam_name,
   registered, about_horse, racing_outlook_and_pedigree, race_expectation,
   image_count)
values
  ('c3333333-3333-4333-8333-333333333333', 'probe-dateless-horse', 'Probe Dateless Horse',
   '2022-10-02', 'Filly', 'Brown', 'Super Seth', 'Warrior Queen', true,
   'Synthetic about.', 'Synthetic pedigree.', 'Synthetic expectation.', 0);

-- A: the dateless draft that is then archived.
insert into public.dsls
  (id, horse_id, trainer_id, owner_id, end_date, term_start, payment_model,
   close_style, status, published, wholesale_monthly_per_percent, investor_split,
   listed_stake, min_stake, step, stake_remaining, distribution_schedule,
   narrative_signoff, narrative_approved_at, narrative_approved_hash)
values
  ('c5555555-5555-4555-8555-555555555551', 'c3333333-3333-4333-8333-333333333333',
   'c1111111-1111-4111-8111-111111111111', 'c2222222-2222-4222-8222-222222222222',
   null, null, null, null, 'coming_soon', false, null, null, 5, 1, 1, 5, null, null, null, null);

select public.close_dsl('c5555555-5555-4555-8555-555555555551', 'draft abandoned', 'operator');

insert into probe_results (check_name, passed, detail)
select 'the archived draft is closed in place',
       status = 'coming_soon' and closed_at is not null,
       status || ' | closed_at=' || coalesce(closed_at::text, 'null')
  from public.dsls where id = 'c5555555-5555-4555-8555-555555555551';

-- B: a new dateless draft for the same horse must be allowed.
insert into public.dsls
  (id, horse_id, trainer_id, owner_id, end_date, term_start, payment_model,
   close_style, status, published, wholesale_monthly_per_percent, investor_split,
   listed_stake, min_stake, step, stake_remaining, distribution_schedule,
   narrative_signoff, narrative_approved_at, narrative_approved_hash)
values
  ('c5555555-5555-4555-8555-555555555552', 'c3333333-3333-4333-8333-333333333333',
   'c1111111-1111-4111-8111-111111111111', 'c2222222-2222-4222-8222-222222222222',
   null, null, null, null, 'coming_soon', false, null, null, 5, 1, 1, 5, null, null, null, null);

insert into probe_results (check_name, passed, detail)
select 'a second dateless draft is allowed after the first is archived',
       count(*) = 1, 'open dateless drafts=' || count(*)
  from public.dsls
 where horse_id = 'c3333333-3333-4333-8333-333333333333'
   and end_date is null and closed_at is null;

-- C: a second OPEN dateless draft is still refused.
do $$
begin
  begin
    insert into public.dsls
      (id, horse_id, trainer_id, owner_id, end_date, term_start, payment_model,
       close_style, status, published, wholesale_monthly_per_percent, investor_split,
       listed_stake, min_stake, step, stake_remaining, distribution_schedule,
       narrative_signoff, narrative_approved_at, narrative_approved_hash)
    values
      ('c5555555-5555-4555-8555-555555555553', 'c3333333-3333-4333-8333-333333333333',
       'c1111111-1111-4111-8111-111111111111', 'c2222222-2222-4222-8222-222222222222',
       null, null, null, null, 'coming_soon', false, null, null, 5, 1, 1, 5, null, null, null, null);
    insert into probe_results (check_name, passed, detail)
    values ('a second open dateless draft is refused', false, 'the insert succeeded');
  exception when others then
    insert into probe_results (check_name, passed, detail)
    values ('a second open dateless draft is refused',
            sqlerrm like '%dsls_one_dateless_draft_per_horse%' or sqlerrm like '%duplicate key%',
            sqlerrm);
  end;
end $$;

select n, check_name, case when passed then 'PASS' else 'FAIL' end as result, detail
  from probe_results order by n;

do $$
declare
  v_count integer;
begin
  select count(*) into v_count from probe_results;
  if v_count <> 3 then
    raise exception 'probe-00028 expected 3 rows, got %', v_count;
  end if;
  if exists (select 1 from probe_results where not passed) then
    raise exception 'probe-00028 failures: %',
      (select string_agg(check_name, '; ' order by n) from probe_results where not passed);
  end if;
end $$;

rollback;
