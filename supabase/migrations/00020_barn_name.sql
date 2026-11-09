-- 00020_barn_name.sql
-- The barn name: the horse's unofficial stable nickname (Nellie, Mulan, Coco).
--
-- Law: engine/SSOT/doc/HORSE-IDENTITY-NAMING-LAW.md §1–§4, locked 2026-09-16.
-- It is a display name only: never a folder, never a slug, never an asset path,
-- never a join key. It is null when the horse has no real nickname, and it is
-- never derived from the official name or set equal to it.
--
-- Nothing else changes: no index, no uniqueness, no backfill. Optional by
-- design, so readiness and the legal templates are untouched.

alter table public.horses
  add column barn_name text;

comment on column public.horses.barn_name is
  'Unofficial stable nickname (law §4). Display only; null when there is none. Never a slug or key.';
