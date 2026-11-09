-- 00021_parties_and_hardening.sql
-- Chunk 2 (2026-11-10). One profile with roles, and the engine rules in SQL.
--
-- Ruling 10: a real-world person or company is one `parties` row. Roles are
-- relationships on `party_roles`, never permissions (ruling 22). The DSL is
-- the only place a deal links a horse, a trainer and an owner.
--
-- Ruling 11: Records author entities; the DSL attaches ids and writes `dsls`
-- only. This migration copies every trainer and owner into `parties` with the
-- matching role, re-points the DSL foreign keys, and drops the old tables.

create table public.parties (
  id uuid primary key default gen_random_uuid(),
  display_name text not null,
  company text,
  contact text,
  location text,
  website text,
  bio text,
  achievements text,
  other text,
  x_url text,
  facebook_url text,
  instagram_url text,
  links jsonb not null default '[]'::jsonb
);

create table public.party_roles (
  party_id uuid not null references public.parties (id) on delete restrict,
  role text not null,
  primary key (party_id, role)
);

alter table public.parties enable row level security;
alter table public.party_roles enable row level security;

grant select, insert, update, delete on public.parties to service_role;
grant select, insert, update, delete on public.party_roles to service_role;

comment on table public.parties is 'One profile per real-world person or company (ruling 10).';
comment on table public.party_roles is 'Relationships, not permissions (ruling 22).';
comment on column public.parties.bio is 'Trainer bio / owner profile — one shared prose field.';

-- Map the old ids to fresh party ids so a collision across the two old tables
-- cannot merge two people.
create temporary table trainer_map as
  select id as old_id, gen_random_uuid() as new_id from public.trainers;
create temporary table owner_map as
  select id as old_id, gen_random_uuid() as new_id from public.owners;

insert into public.parties
  (id, display_name, company, location, website, bio, achievements, other,
   x_url, facebook_url, instagram_url, links)
select m.new_id, t.name, t.stable, t.location, t.website, t.bio,
       t.achievements, t.other, t.x_url, t.facebook_url, t.instagram_url, t.links
  from public.trainers t
  join trainer_map m on m.old_id = t.id;

insert into public.party_roles (party_id, role)
select new_id, 'trainer' from trainer_map;

insert into public.parties
  (id, display_name, contact, website, bio, achievements, other,
   x_url, facebook_url, instagram_url, links)
select m.new_id, o.entity, o.contact, o.website, o.profile,
       o.achievements, o.other, o.x_url, o.facebook_url, o.instagram_url, o.links
  from public.owners o
  join owner_map m on m.old_id = o.id;

insert into public.party_roles (party_id, role)
select new_id, 'owner' from owner_map;

-- The DSL carries the trainer too; a horse no longer stores one.
alter table public.dsls add column trainer_id uuid references public.parties (id);

update public.dsls d
   set trainer_id = m.new_id
  from public.horses h
  join trainer_map m on m.old_id = h.trainer_id
 where h.id = d.horse_id;

-- The owner FK still points at `owners`; drop it before re-pointing the ids.
alter table public.dsls drop constraint dsls_owner_id_fkey;

update public.dsls d
   set owner_id = m.new_id
  from owner_map m
 where m.old_id = d.owner_id;

alter table public.dsls
  add constraint dsls_owner_id_fkey foreign key (owner_id) references public.parties (id);

alter table public.horses drop column trainer_id;

drop table public.trainers;
drop table public.owners;

drop table trainer_map;
drop table owner_map;

-- The three narrative approval columns. The sign-off is a record, not a lock
-- (ruling 14); Available requires all four PDS soft slots approved.
alter table public.dsls
  add column narrative_signoff jsonb,
  add column narrative_approved_at timestamptz,
  add column narrative_approved_hash text;

comment on column public.dsls.narrative_signoff is
  'Four PDS soft slots, each approved: horse.about_horse, horse.racing_outlook_and_pedigree, horse.race_expectation, trainer.bio.';

-- ---------------------------------------------------------------------------
-- H2: status is a machine. This trigger and `checkStatusTransition` in
-- `engine/src/lib/dsl.ts` must agree, pair for pair.
-- ---------------------------------------------------------------------------

create or replace function public.assert_dsl_status_transition()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  horse_registered boolean;
begin
  if tg_op = 'INSERT' then
    if new.status not in ('coming_soon', 'available') then
      raise exception 'dsl % cannot start at %: the initial status is coming_soon or available',
        new.id, new.status
        using errcode = '23514';
    end if;
  elsif new.status <> old.status then
    if not (
      (old.status = 'coming_soon'    and new.status = 'available')
      or (old.status = 'available'   and new.status = 'fully_allocated')
      or (old.status = 'available'   and new.status = 'coming_soon')
      or (old.status = 'fully_allocated' and new.status = 'completed')
      or (old.status = 'available'   and new.status = 'completed')
    ) then
      raise exception 'dsl % cannot move from % to %', new.id, old.status, new.status
        using errcode = '23514';
    end if;
  end if;

  select h.registered into horse_registered
    from public.horses h
   where h.id = new.horse_id;

  if horse_registered is distinct from true and new.status <> 'coming_soon' then
    raise exception 'dsl % cannot sit at %: horse % is not registered', new.id, new.status, new.horse_id
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger dsls_status_transition
  before insert or update of status on public.dsls
  for each row
  execute function public.assert_dsl_status_transition();

-- ---------------------------------------------------------------------------
-- A DSL write is refused unless the party holds the role the column names.
-- ---------------------------------------------------------------------------

create or replace function public.assert_dsl_party_roles()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.owner_id is not null and not exists (
    select 1 from public.party_roles r
     where r.party_id = new.owner_id and r.role = 'owner'
  ) then
    raise exception 'dsl % cannot attach party %: it does not hold the owner role',
      new.id, new.owner_id
      using errcode = '23514';
  end if;

  if new.trainer_id is not null and not exists (
    select 1 from public.party_roles r
     where r.party_id = new.trainer_id and r.role = 'trainer'
  ) then
    raise exception 'dsl % cannot attach party %: it does not hold the trainer role',
      new.id, new.trainer_id
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger dsls_party_roles
  before insert or update of owner_id, trainer_id on public.dsls
  for each row
  execute function public.assert_dsl_party_roles();

-- ---------------------------------------------------------------------------
-- H3: readiness cannot be cheated from any of the four referenced tables.
-- Non-empty edits flow (ruling 16); only blanking a required field, or an
-- untick a live DSL depends on, is refused.
-- ---------------------------------------------------------------------------

create or replace function public.assert_party_editable()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  is_trainer boolean;
  is_owner boolean;
begin
  select exists (select 1 from public.party_roles r where r.party_id = new.id and r.role = 'trainer')
    into is_trainer;
  select exists (select 1 from public.party_roles r where r.party_id = new.id and r.role = 'owner')
    into is_owner;

  -- Ruling 16: non-empty edits flow; only *blanking* a required field is
  -- refused. The comparison is against OLD, so a field that was already empty
  -- does not block an unrelated edit.
  if is_trainer and (
       (btrim(coalesce(old.display_name, '')) <> '' and btrim(coalesce(new.display_name, '')) = '')
       or (btrim(coalesce(old.company, '')) <> '' and btrim(coalesce(new.company, '')) = '')
       or (btrim(coalesce(old.location, '')) <> '' and btrim(coalesce(new.location, '')) = '')
       or (btrim(coalesce(old.bio, '')) <> '' and btrim(coalesce(new.bio, '')) = '')
     ) and exists (
       select 1 from public.dsls d
        where d.trainer_id = new.id and d.status = 'available'
     ) then
    raise exception 'party % cannot blank a required trainer field while an Available DSL depends on it',
      new.id
      using errcode = '23514';
  end if;

  if is_owner and (
       (btrim(coalesce(old.display_name, '')) <> '' and btrim(coalesce(new.display_name, '')) = '')
       or (btrim(coalesce(old.contact, '')) <> '' and btrim(coalesce(new.contact, '')) = '')
     ) and exists (
       select 1 from public.dsls d
        where d.owner_id = new.id and d.status = 'available'
     ) then
    raise exception 'party % cannot blank a required owner field while an Available DSL depends on it',
      new.id
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger parties_readiness_guard
  before update on public.parties
  for each row
  execute function public.assert_party_editable();

create or replace function public.assert_party_role_removal()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.role = 'trainer' and exists (
    select 1 from public.dsls d
     where d.trainer_id = old.party_id and d.status <> 'completed'
  ) then
    raise exception 'role trainer cannot be removed from party %: a live DSL depends on it',
      old.party_id
      using errcode = '23514';
  end if;

  if old.role = 'owner' and exists (
    select 1 from public.dsls d
     where d.owner_id = old.party_id and d.status <> 'completed'
  ) then
    raise exception 'role owner cannot be removed from party %: a live DSL depends on it',
      old.party_id
      using errcode = '23514';
  end if;

  return old;
end;
$$;

create trigger party_roles_removal_guard
  before delete on public.party_roles
  for each row
  execute function public.assert_party_role_removal();

create or replace function public.assert_horse_editable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (
       new.registered is distinct from true
       or new.image_count < 3
       or btrim(coalesce(new.about_horse, '')) = ''
       or btrim(coalesce(new.racing_outlook_and_pedigree, '')) = ''
       or btrim(coalesce(new.race_expectation, '')) = ''
     ) and exists (
       select 1 from public.dsls d
        where d.horse_id = new.id and d.status = 'available'
     ) then
    raise exception 'horse % cannot lose a required field while an Available DSL depends on it',
      new.id
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger horses_readiness_guard
  before update on public.horses
  for each row
  execute function public.assert_horse_editable();

-- ---------------------------------------------------------------------------
-- The Available gate, re-based on parties and extended with the narrative
-- sign-off. A trainer is now required exactly as an owner is.
-- ---------------------------------------------------------------------------

create or replace function public.assert_dsl_available()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  horse_registered boolean;
  horse_image_count integer;
  horse_about text;
  horse_outlook text;
  horse_expectation text;
  trainer_bio text;
begin
  if new.status <> 'available' then
    return new;
  end if;

  if not new.published then
    raise exception 'dsl % cannot be available: published is false', new.id
      using errcode = '23514';
  end if;

  if new.owner_id is null then
    raise exception 'dsl % cannot be available: no owner is attached to the term sheet', new.id
      using errcode = '23514';
  end if;

  if new.trainer_id is null then
    raise exception 'dsl % cannot be available: no trainer is attached to the term sheet', new.id
      using errcode = '23514';
  end if;

  if new.investor_split is null then
    raise exception 'dsl % cannot be available: investor_split is null', new.id
      using errcode = '23514';
  end if;

  if new.wholesale_monthly_per_percent is null
     or new.wholesale_monthly_per_percent <= 0 then
    raise exception 'dsl % cannot be available: wholesale_monthly_per_percent is not above zero', new.id
      using errcode = '23514';
  end if;

  if new.end_date is null or new.term_start is null then
    raise exception 'dsl % cannot be available: the term dates are not set', new.id
      using errcode = '23514';
  end if;

  if new.payment_model is null or new.close_style is null then
    raise exception 'dsl % cannot be available: the payment model or close style is not set', new.id
      using errcode = '23514';
  end if;

  if new.listed_stake is null or new.min_stake is null or new.step is null
     or new.stake_remaining is null then
    raise exception 'dsl % cannot be available: the stake shape is not set', new.id
      using errcode = '23514';
  end if;

  if new.distribution_schedule is null
     or btrim(new.distribution_schedule) = '' then
    raise exception 'dsl % cannot be available: the distribution schedule is empty', new.id
      using errcode = '23514';
  end if;

  if new.narrative_signoff is null
     or new.narrative_signoff -> 'horse.about_horse' is distinct from 'true'::jsonb
     or new.narrative_signoff -> 'horse.racing_outlook_and_pedigree' is distinct from 'true'::jsonb
     or new.narrative_signoff -> 'horse.race_expectation' is distinct from 'true'::jsonb
     or new.narrative_signoff -> 'trainer.bio' is distinct from 'true'::jsonb
     or new.narrative_approved_at is null
     or btrim(coalesce(new.narrative_approved_hash, '')) = '' then
    raise exception 'dsl % cannot be available: the narrative is not fully approved', new.id
      using errcode = '23514';
  end if;

  select h.registered,
         h.image_count,
         h.about_horse,
         h.racing_outlook_and_pedigree,
         h.race_expectation,
         p.bio
    into horse_registered,
         horse_image_count,
         horse_about,
         horse_outlook,
         horse_expectation,
         trainer_bio
    from public.horses h
    left join public.parties p on p.id = new.trainer_id
   where h.id = new.horse_id;

  if horse_image_count is null then
    raise exception 'dsl % cannot be available: horse % does not exist', new.id, new.horse_id
      using errcode = '23514';
  end if;

  if horse_registered is distinct from true then
    raise exception 'dsl % cannot be available: horse % is not registered', new.id, new.horse_id
      using errcode = '23514';
  end if;

  if horse_image_count < 3 then
    raise exception 'dsl % cannot be available: horse % has % image(s), three is the minimum',
      new.id, new.horse_id, horse_image_count
      using errcode = '23514';
  end if;

  if horse_about is null or btrim(horse_about) = ''
     or horse_outlook is null or btrim(horse_outlook) = ''
     or horse_expectation is null or btrim(horse_expectation) = '' then
    raise exception 'dsl % cannot be available: horse % is missing one of the three soft-prose paragraphs',
      new.id, new.horse_id
      using errcode = '23514';
  end if;

  if trainer_bio is null or btrim(trainer_bio) = '' then
    raise exception 'dsl % cannot be available: the horse''s trainer has no bio', new.id
      using errcode = '23514';
  end if;

  return new;
end;
$$;
