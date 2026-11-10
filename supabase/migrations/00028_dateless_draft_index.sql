-- 00028_dateless_draft_index.sql
-- Rules: R-DSL-01 (one dateless draft per horse), R-DSL-04 (closed rows are
-- inactive regardless of status).
--
-- A draft now closes in place: closed_at is stamped and end_date stays null
-- (00027). The old partial index matched on end_date is null alone, so an
-- archived draft blocked every future dateless draft for that horse. The
-- index now excludes closed rows.

drop index if exists public.dsls_one_dateless_draft_per_horse;

create unique index dsls_one_dateless_draft_per_horse
  on public.dsls (horse_id)
  where end_date is null and closed_at is null;
