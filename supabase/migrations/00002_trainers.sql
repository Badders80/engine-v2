-- 00002_trainers.sql
-- OUTCOME.md § Records, Trainer: name, stable, location, website, one bio.

create table public.trainers (
  id uuid primary key,
  name text not null,
  stable text not null,
  location text not null,
  website text,
  bio text
);

alter table public.trainers enable row level security;
