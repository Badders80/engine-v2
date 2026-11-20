-- probe-00032.sql
-- expect: 2
-- The horse record owns a versioned 15-node Loveracing pedigree snapshot.

\set ON_ERROR_STOP on

begin;

create temp table probe_results (
  n serial,
  check_name text,
  passed boolean,
  detail text
) on commit drop;

insert into probe_results (check_name, passed, detail)
select 'horses.pedigree is jsonb',
       data_type = 'jsonb',
       data_type
  from information_schema.columns
 where table_schema = 'public'
   and table_name = 'horses'
   and column_name = 'pedigree';

insert into public.horses
  (slug, legal_name, foaling_date, sex, colour, sire_name, dam_name, registered, pedigree)
values
  ('pedigree-probe', 'Pedigree Probe', '2023-08-17', 'Filly', 'Bay',
   'Turn Me Loose', 'Yearn', true,
   '{"version":1,"source":"loveracing_nz","rootHorseId":"460867","sourceUrl":"https://loveracing.nz/stud-book/460867/Mulan-The-Brave-NZ-2023.aspx","retrievedAt":"2026-11-13T00:00:00.000Z","nodes":[]}'::jsonb);

insert into probe_results (check_name, passed, detail)
select 'a Loveracing snapshot is stored on the horse',
       pedigree->>'source' = 'loveracing_nz'
       and pedigree->>'rootHorseId' = '460867'
       and pedigree->>'version' = '1',
       coalesce(pedigree->>'sourceUrl', 'missing source URL')
  from public.horses
 where slug = 'pedigree-probe';

select n, check_name, passed, detail from probe_results order by n;
rollback;
