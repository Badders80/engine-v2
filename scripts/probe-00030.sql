-- probe-00030.sql
-- expect: 1
-- Additive retail pricing is generated in SQL, not only in TypeScript.

\set ON_ERROR_STOP on

do $$
declare
  expression text;
begin
  select pg_get_expr(ad.adbin, ad.adrelid)
    into expression
    from pg_attribute a
    join pg_attrdef ad on ad.adrelid = a.attrelid and ad.adnum = a.attnum
   where a.attrelid = 'public.dsls'::regclass
     and a.attname = 'retail_monthly_per_percent';

  if expression is null or position('1.08' in expression) = 0 then
    raise exception 'retail pricing does not apply the summed 1.08 expense uplift: %', expression;
  end if;
  if position('1.05' in expression) > 0 or position('1.03' in expression) > 0 then
    raise exception 'retail pricing still compounds expense multipliers: %', expression;
  end if;
end
$$;

select 'additive retail pricing is generated in SQL' as evidence;
