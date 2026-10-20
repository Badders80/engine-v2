-- 00010_payment_model_eligibility.sql
-- PLAN.md step 7, `PLAN.md:72`. The payment-model rule at the database.
--
-- `upfront` is available for any term. A term of 5 months or less must use
-- `upfront`, because the five-month initial payment already covers the whole
-- term. A term of 6 months or more may use either model, defaulting to
-- `subscription_float`.
--
-- The month count is inclusive of both the start month and the end month and
-- mirrors `engine/src/lib/term.ts`. The same rule is enforced by the save gate
-- (`checkCommercialTerms`) and by the compiler, so no door is open.
--
-- The migration refuses to apply if an existing row already violates the rule,
-- so the table cannot be left in a state the trigger would refuse to reproduce.

create or replace function public.dsl_term_months(term_start date, end_date date)
returns integer
language sql
immutable
set search_path = ''
as $$
  select (
    (extract(year from end_date) - extract(year from term_start)) * 12
    + (extract(month from end_date) - extract(month from term_start))
    + 1
  )::integer
$$;

do $$
declare
  row record;
  term_months integer;
begin
  for row in select d.id, d.payment_model, d.term_start, d.end_date from public.dsls d loop
    term_months := public.dsl_term_months(row.term_start, row.end_date);

    if term_months < 1 then
      raise exception 'dsl % has term_start % and end_date %, which is not one month or more',
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

  if term_months < 1 then
    raise exception 'dsl has term_start % and end_date %, which is not one month or more',
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

create trigger dsls_payment_model_eligibility
  before insert or update of payment_model, term_start, end_date on public.dsls
  for each row
  execute function public.assert_payment_model_eligible();
