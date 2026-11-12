-- Additive expense pricing: every expense rate is measured against wholesale.
-- The 5% Evolution margin and 3% platform fee therefore apply a 1.08 uplift;
-- they are not compounded into 1.05 * 1.03.

alter table public.dsls
  drop column retail_monthly_per_percent;

alter table public.dsls
  add column retail_monthly_per_percent numeric(10, 2)
    generated always as (ceil(wholesale_monthly_per_percent * 1.08)) stored;

comment on column public.dsls.retail_monthly_per_percent is
  'Retail per 1% per month: ceil(wholesale * (1 + summed expense rates)), currently wholesale * 1.08.';
