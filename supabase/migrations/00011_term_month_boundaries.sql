-- 00011_term_month_boundaries.sql
-- PLAN.md step 7, ruling of 2026-10-20. Tightens the term rule from 00010.
--
-- A legal term runs from the 1st of a month to the last day of a month, and it
-- ends after it starts. The templates say the lease term is "counted in full
-- calendar months" (`SA.template.md:32`), so a mid-month date is not a term.
--
-- 00010 counted year and month only, which accepted 20 March to 1 March as a
-- one-month term. This migration replaces the helper and the trigger. The
-- application gate mirrors the same rule in `engine/src/lib/term.ts`.
--
-- The migration refuses to apply if an existing row already breaks the rule.

create or replace function public.dsl_term_months(term_start date, end_date date)
returns integer
language sql
immutable
set search_path = ''
as $$
  with counted as (
    select (
      (extract(year from end_date) - extract(year from term_start)) * 12
      + (extract(month from end_date) - extract(month from term_start))
      + 1
    )::integer as months
  )
  select case
    when extract(day from term_start) <> 1 then null
    when end_date <> (date_trunc('month', end_date) + interval '1 month' - interval '1 day')::date then null
    when counted.months < 1 then null
    else counted.months
  end
  from counted
$$;

do $$
declare
  row record;
  term_months integer;
begin
  for row in select d.id, d.payment_model, d.term_start, d.end_date from public.dsls d loop
    term_months := public.dsl_term_months(row.term_start, row.end_date);

    if term_months is null then
      raise exception 'dsl % has term_start % and end_date %; a term starts on the 1st and ends on the last day of a month',
        row.id, row.term_start, row.end_date
        using errcode = '23514';
    end if;

    if row.payment_model = 'subscription_float' and term_months <= 5 then
      raise exception 'dsl % is a %-month subscription_float; a term of 5 months or less must use upfront',
        row.id, term_months
        using errcode = '23514';
    end if;
  end loop;
end
$$;

create or replace function public.assert_payment_model_eligible()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  term_months integer;
begin
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

drop trigger if exists dsls_payment_model_eligibility on public.dsls;

create trigger dsls_payment_model_eligibility
  before insert or update of payment_model, term_start, end_date on public.dsls
  for each row
  execute function public.assert_payment_model_eligible();
