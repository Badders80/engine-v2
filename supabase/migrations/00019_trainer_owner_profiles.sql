-- 00019_trainer_owner_profiles.sql
-- DSL side quest U3 (2026-11-09). Confirmed ruling: trainer/owner gain three
-- sections plus socials plus links. Fixed display order:
--   Profile → Achievements → Other → Social → Links.
--
-- Optional everywhere: readiness and the legal templates are untouched. This
-- is an admin-only private store; nothing here is projected to the public site.
--
-- `links` is a jsonb array of { "label": text, "url": text }.

alter table public.trainers
  add column achievements text,
  add column other text,
  add column x_url text,
  add column facebook_url text,
  add column instagram_url text,
  add column links jsonb not null default '[]'::jsonb;

alter table public.owners
  add column achievements text,
  add column other text,
  add column x_url text,
  add column facebook_url text,
  add column instagram_url text,
  add column links jsonb not null default '[]'::jsonb;

comment on column public.trainers.achievements is 'Trainer achievements, plain text (U3).';
comment on column public.trainers.other is 'Trainer other profile notes, plain text (U3).';
comment on column public.trainers.links is 'Extra links as a jsonb array of {label,url} (U3).';
comment on column public.owners.achievements is 'Owner achievements, plain text (U3).';
comment on column public.owners.other is 'Owner other profile notes, plain text (U3).';
comment on column public.owners.links is 'Extra links as a jsonb array of {label,url} (U3).';
