-- 00003_owners.sql
-- OUTCOME.md § Records, Owner: entity name, contact person, website, one
-- profile paragraph. No race record and no results column.

create table public.owners (
  id uuid primary key,
  entity text not null,
  contact text not null,
  website text,
  profile text
);

alter table public.owners enable row level security;
