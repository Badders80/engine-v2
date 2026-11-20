-- The horse record owns its four-generation pedigree snapshot.
-- A horse loaded from a Loveracing Stud Book URL stores exactly 15 nodes:
-- the horse, 2 parents, 4 grandparents and 8 great-grandparents.
alter table public.horses add column pedigree jsonb;

comment on column public.horses.pedigree is
  'Versioned Loveracing four-generation snapshot: 1 horse, 2 parents, 4 grandparents, 8 great-grandparents, with source HorseIDs and URLs.';
