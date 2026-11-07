-- 00014_dsl_commercial_nullable.sql
-- DSL engine decision 2026-11-07.
--
-- A DSL is created with the horse, before the deal is done, so it can sit on
-- the website as Coming Soon with no commercial terms. The commercial and
-- term columns therefore become nullable, and completeness moves entirely
-- into the `available` gate.
--
-- The operator is trusted to enter a valid stake. There is no cross-DSL 100%
-- ceiling; only the within-DSL shape check and this readiness gate apply.
--
-- `dsl_term_months` is unchanged. `assert_payment_model_eligible` now returns
-- early when the term is not yet set: a null term is a listing that has not
-- been priced, not an illegal term.

alter table public.dsls
  alter column end_date drop not null,
  alter column term_start drop not null,
  alter column payment_model drop not null,
  alter column close_style drop not null,
  alter column wholesale_monthly_per_percent drop not null,
  alter column listed_stake drop not null,
  alter column min_stake drop not null,
  alter column step drop not null,
  alter column stake_remaining drop not null;

create or replace function public.assert_payment_model_eligible()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  term_months integer;
begin
  -- No term yet: the listing exists but has not been priced.
  if new.term_start is null or new.end_date is null or new.payment_model is null then
    return new;
  end if;

  term_months := public.dsl_term_months(new.term_start, new.end_date);

  if term_months is null then
    raise exception 'a term starts on the 1st and ends on the last day of a month, and the end must follow the start (received % to %)',
      new.term_start, new.end_date
      using errcode = '23514';
  end if;

  if new.payment_model = 'subscription_float' and term_months <= 5 then
    raise exception 'a %-month term must use upfront; subscription_float requires 6 months or more',
      term_months
      using errcode = '23514';
  end if;

  return new;
end;
$$;

-- Refuse to apply if any existing available row would fail the tightened gate.
do $$
declare
  row record;
begin
  for row in
    select d.id
      from public.dsls d
      join public.horses h on h.id = d.horse_id
      left join public.trainers t on t.id = h.trainer_id
     where d.status = 'available'
       and (
         d.end_date is null
         or d.term_start is null
         or d.payment_model is null
         or d.close_style is null
         or d.wholesale_monthly_per_percent is null
         or d.listed_stake is null
         or d.min_stake is null
         or d.step is null
         or d.stake_remaining is null
         or d.distribution_schedule is null
         or btrim(d.distribution_schedule) = ''
         or h.about_horse is null or btrim(h.about_horse) = ''
         or h.racing_outlook_and_pedigree is null or btrim(h.racing_outlook_and_pedigree) = ''
         or h.race_expectation is null or btrim(h.race_expectation) = ''
         or t.bio is null or btrim(t.bio) = ''
       )
  loop
    raise exception 'dsl % is available but is missing content the legal pack needs', row.id
      using errcode = '23514';
  end loop;
end
$$;

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
