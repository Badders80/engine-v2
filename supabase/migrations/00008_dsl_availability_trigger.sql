-- 00008_dsl_availability_trigger.sql
-- PLAN.md step 2, constraint trigger. A DSL may only sit at status
-- 'available' when it is complete: published, priced, split assigned, and
-- backed by a registered horse with at least three images.
--
-- image_count and registered live on the horse, so this cannot be a CHECK
-- constraint. It is a deferrable constraint trigger so the operator may add
-- images and flip the status inside one transaction.

create or replace function public.assert_dsl_available()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  horse_registered boolean;
  horse_image_count integer;
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

  select h.registered, h.image_count
    into horse_registered, horse_image_count
    from public.horses h
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

  return new;
end;
$$;

create constraint trigger dsls_available_invariants
  after insert or update on public.dsls
  deferrable initially immediate
  for each row
  execute function public.assert_dsl_available();
