-- scripts/check-db-narrative.sql
--
-- The SQL half of `just check:db`. It loads the shared fixture set, inserts it
-- into the local database inside one transaction, and asserts that
-- `public.resolve_narrative()` returns exactly the expected JSON for every
-- case. The TS half is `engine/tests/narrative-parity.test.ts`, which asserts
-- `resolveNarrative()` against the same expected JSON. Together they prove the
-- two implementations agree without either one being the oracle.
--
-- Local only. Never runs in `pnpm verify`: CI and worktrees may have no
-- Postgres. Run it with `just check:db`.

\set ON_ERROR_STOP on
\set fixtures `cat engine/tests/fixtures/narrative-cases.json`

begin;

create temporary table _narrative_fixtures (doc jsonb) on commit drop;
insert into _narrative_fixtures (doc) values (:'fixtures'::jsonb);

insert into public.horses (
  id, slug, legal_name, foaling_date, sex, colour, sire_name, dam_name,
  registered, image_count, about_horse, racing_outlook_and_pedigree,
  race_expectation
)
select
  x.id, x.slug, x.legal_name, x.foaling_date, x.sex, x.colour, x.sire_name,
  x.dam_name, x.registered, x.image_count, x.about_horse,
  x.racing_outlook_and_pedigree, x.race_expectation
from jsonb_to_recordset((select doc -> 'horses' from _narrative_fixtures)) as x(
  id uuid,
  slug text,
  legal_name text,
  foaling_date date,
  sex text,
  colour text,
  sire_name text,
  dam_name text,
  registered boolean,
  image_count integer,
  about_horse text,
  racing_outlook_and_pedigree text,
  race_expectation text
);

insert into public.parties (id, display_name, bio)
select x.id, x.display_name, x.bio
from jsonb_to_recordset((select doc -> 'parties' from _narrative_fixtures)) as x(
  id uuid,
  display_name text,
  bio text
);

insert into public.party_roles (party_id, role)
select p.id, role.value
from jsonb_to_recordset((select doc -> 'parties' from _narrative_fixtures)) as p(
  id uuid,
  display_name text,
  bio text,
  roles jsonb
)
cross join lateral jsonb_array_elements_text(p.roles) as role(value);

insert into public.dsls (
  id, horse_id, trainer_id, status,
  narrative_about_horse, narrative_racing_outlook, narrative_race_expectation
)
select
  d.id, d.horse_id, d.trainer_id, d.status,
  d.narrative_about_horse, d.narrative_racing_outlook, d.narrative_race_expectation
from jsonb_to_recordset((select doc -> 'dsls' from _narrative_fixtures)) as d(
  id uuid,
  horse_id uuid,
  trainer_id uuid,
  status public.status,
  narrative_about_horse text,
  narrative_racing_outlook text,
  narrative_race_expectation text
);

do $$
declare
  c record;
  actual jsonb;
  expected jsonb;
  checked integer := 0;
begin
  for c in
    select value
      from jsonb_array_elements((select doc -> 'cases' from _narrative_fixtures))
  loop
    actual := public.resolve_narrative(
      (c.value ->> 'horse_id')::uuid,
      nullif(c.value ->> 'dsl_id', '')::uuid,
      nullif(c.value ->> 'party_id', '')::uuid
    );
    expected := c.value -> 'expected';

    if actual is distinct from expected then
      raise exception 'narrative parity FAILED for case %: expected %, got %',
        c.value ->> 'name', expected, actual
        using errcode = '23514';
    end if;

    checked := checked + 1;
    raise notice 'ok  %', c.value ->> 'name';
  end loop;

  raise notice 'narrative parity: %/% cases agree', checked, checked;
end;
$$;

rollback;
