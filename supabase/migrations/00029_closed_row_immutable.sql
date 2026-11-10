-- 00029_closed_row_immutable.sql
-- Rules: R-DSL-05 (a closed row is immutable), R-DSL-04 (closed means inactive).
--
-- Closing a draft used to be reversible: updateDsl never consulted closed_at,
-- and the status machine permits coming_soon -> available. One rule closes
-- every hole at once: a row with closed_at set cannot be updated. That blocks
-- edits, un-closing and status resurrection, including new columns later.

create or replace function public.assert_dsl_not_closed()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.closed_at is not null then
    raise exception 'dsl % is closed and cannot be edited', old.id
      using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists dsls_closed_immutable on public.dsls;

create trigger dsls_closed_immutable
  before update on public.dsls
  for each row
  execute function public.assert_dsl_not_closed();
