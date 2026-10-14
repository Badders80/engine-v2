-- 00004_horses.sql
-- OUTCOME.md § Records, Horse. Internal key is the uuid, external key is the
-- microchip, the slug is derived from the legal name when the horse is saved.
-- Sire and dam are stored names, not foreign keys.
--
-- Soft prose is limited to exactly three columns (about_horse,
-- racing_outlook_and_pedigree, race_expectation) plus the one race_record
-- jsonb blob. The PDS reads these; the SA reads none of them.

create table public.horses (
  id uuid primary key default gen_random_uuid(),
  microchip text unique,
  slug text unique not null,
  legal_name text not null,
  foaling_date date not null,
  sex text not null,
  colour text not null,
  breeder text,
  sire_name text not null,
  dam_name text not null,
  life_number text,
  loveracing_id text,
  registered boolean not null default false,
  trainer_id uuid references public.trainers (id),
  owner_id uuid references public.owners (id),
  about_horse text,
  racing_outlook_and_pedigree text,
  race_expectation text,
  image_count integer not null default 0 check (image_count >= 0),
  race_record jsonb not null default '{}'::jsonb
);

alter table public.horses enable row level security;
