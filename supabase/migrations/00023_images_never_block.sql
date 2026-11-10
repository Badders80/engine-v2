-- 00023_images_never_block.sql
-- Ruling 26 (2026-11-10): images never block a listing.
--
-- An image is marketing, not a legal precondition: the PDS and SA carry no
-- image. The public site shows a templated "images coming soon" when the
-- folder is empty, and real images flow through as they are added on Records.
--
-- Both gates lose their image clause; nothing else about them changes.
-- H6 (sales append-only) moves to 00024.

create or replace function public.assert_dsl_available()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  horse_registered boolean;
  resolved jsonb;
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

  -- Chunk 3: the expiry is required; the start is stamped at the sale.
  if new.end_date is null then
    raise exception 'dsl % cannot be available: the expiry is not set', new.id
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

  select h.registered
    into horse_registered
    from public.horses h
   where h.id = new.horse_id;

  if horse_registered is null then
    raise exception 'dsl % cannot be available: horse % does not exist', new.id, new.horse_id
      using errcode = '23514';
  end if;

  if horse_registered is distinct from true then
    raise exception 'dsl % cannot be available: horse % is not registered', new.id, new.horse_id
      using errcode = '23514';
  end if;

  -- The four soft slots are judged on what the deal will print: a deal-local
  -- override counts, and an untouched slot reads through from Records.
  resolved := public.resolve_narrative(new.horse_id, new.id, new.trainer_id);

  if resolved -> 'horse.about_horse' ->> 'text' is null
     or resolved -> 'horse.racing_outlook_and_pedigree' ->> 'text' is null
     or resolved -> 'horse.race_expectation' ->> 'text' is null then
    raise exception 'dsl % cannot be available: the horse narrative is missing one of the three resolved paragraphs',
      new.id
      using errcode = '23514';
  end if;

  if resolved -> 'trainer.bio' ->> 'text' is null then
    raise exception 'dsl % cannot be available: the horse''s trainer has no bio', new.id
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create or replace function public.assert_horse_editable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (
       new.registered is distinct from true
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
