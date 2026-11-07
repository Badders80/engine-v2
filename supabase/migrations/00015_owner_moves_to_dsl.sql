-- 00015_owner_moves_to_dsl.sql
-- DSL engine decision 2026-11-07.
--
-- A horse can have several owners, and each lists their own stake on their
-- own terms. The owner is therefore a party to the deal, not an attribute of
-- the horse. Trainer stays on the horse: a horse is physically with one
-- trainer at a time, and a change follows every live DSL.
--
-- `owner_id` is nullable because a DSL can exist before its deal is done.
-- The availability gate requires it, so a listing cannot be bought without
-- an owner on the term sheet.

alter table public.dsls
  add column owner_id uuid references public.owners (id);

update public.dsls d
   set owner_id = h.owner_id
  from public.horses h
 where h.id = d.horse_id;

alter table public.horses
  drop column owner_id;

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

  select h.registered,
         h.image_count,
         h.about_horse,
         h.racing_outlook_and_pedigree,
         h.race_expectation,
         t.bio
    into horse_registered,
         horse_image_count,
         horse_about,
         horse_outlook,
         horse_expectation,
         trainer_bio
    from public.horses h
    left join public.trainers t on t.id = h.trainer_id
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
