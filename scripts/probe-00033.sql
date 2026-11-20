-- probe-00033.sql
-- expect: 2
-- The horse record owns its image display order, with cover at position 1.

\set ON_ERROR_STOP on

begin;

create temp table probe_results (
  n serial,
  check_name text,
  passed boolean,
  detail text
) on commit drop;

insert into probe_results (check_name, passed, detail)
select 'horses.image_order is a smallint array with an empty default',
       data_type = 'ARRAY'
       and udt_name = '_int2'
       and column_default = '''{}''::smallint[]',
       concat(data_type, ' / ', udt_name, ' / ', coalesce(column_default, 'missing'))
  from information_schema.columns
 where table_schema = 'public'
   and table_name = 'horses'
   and column_name = 'image_order';

insert into public.horses
  (slug, legal_name, foaling_date, sex, colour, sire_name, dam_name, registered, image_order)
values
  ('image-order-probe', 'Image Order Probe', '2023-08-17', 'Filly', 'Bay',
   'Turn Me Loose', 'Yearn', true, array[3, 1, 2]::smallint[]);

insert into probe_results (check_name, passed, detail)
select 'the saved display order is stored unchanged',
       image_order = array[3, 1, 2]::smallint[],
       image_order::text
  from public.horses
 where slug = 'image-order-probe';

select n, check_name, passed, detail from probe_results order by n;
rollback;
