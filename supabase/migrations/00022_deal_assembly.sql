-- 00022_deal_assembly.sql
-- Chunk 3 (2026-11-10). Deal-local soft content, the narrative fallback in SQL,
-- the dateless-draft rule, and the Available gate re-based on resolved text.
--
-- Ruling 23: a horse may hold several dated terms. It may hold exactly one
-- dateless draft, because a draft has no expiry and a second one would be the
-- same deal entered twice. Dated terms stay unlimited.
--
-- U14: Records owns the base text. A deal may override the three horse slots;
-- the trainer bio always resolves from the party. `public.resolve_narrative()`
-- is the SQL twin of `resolveNarrative()` in `engine/src/lib/narrative.ts`;
-- `just check:db` proves the two agree on one fixture set.

-- ---------------------------------------------------------------------------
-- The three nullable override columns and their warning metadata.
-- ---------------------------------------------------------------------------

alter table public.dsls
  add column narrative_about_horse text,
  add column narrative_racing_outlook text,
  add column narrative_race_expectation text,
  add column narrative_override_meta jsonb;

comment on column public.dsls.narrative_about_horse is
  'Deal-local override of horses.about_horse. Null/blank reads through from Records.';
comment on column public.dsls.narrative_racing_outlook is
  'Deal-local override of horses.racing_outlook_and_pedigree. Null/blank reads through.';
comment on column public.dsls.narrative_race_expectation is
  'Deal-local override of horses.race_expectation. Null/blank reads through.';
comment on column public.dsls.narrative_override_meta is
  'Per horse slot: { sourceHash, dismissedHash }. Keys are a subset of the three override slots.';

-- Keys are a subset of the three override slots. jsonb `-` removes a key, so
-- removing all three legal keys leaves the empty object only when no other key
-- was present. A non-object fails the typeof test.
alter table public.dsls
  add constraint dsls_narrative_override_meta_shape check (
    narrative_override_meta is null
    or (
      jsonb_typeof(narrative_override_meta) = 'object'
      and narrative_override_meta
            - 'horse.about_horse'
            - 'horse.racing_outlook_and_pedigree'
            - 'horse.race_expectation'
          = '{}'::jsonb
    )
  );

-- ---------------------------------------------------------------------------
-- Ruling 23: one dateless draft per horse. A dated term stays unlimited.
-- ---------------------------------------------------------------------------

create unique index dsls_one_dateless_draft_per_horse
  on public.dsls (horse_id)
  where end_date is null;

-- ---------------------------------------------------------------------------
-- A role is one of the two records roles.
-- ---------------------------------------------------------------------------

alter table public.party_roles
  add constraint party_roles_role_check check (role in ('trainer', 'owner'));

-- ---------------------------------------------------------------------------
-- The fallback, in SQL. Trim, then treat blank as absent.
-- ---------------------------------------------------------------------------

create or replace function public.narrative_trim(value text)
returns text
language sql
immutable
set search_path = ''
as $$
  select nullif(
    regexp_replace(coalesce(value, ''), '^[[:space:]]+|[[:space:]]+$', '', 'g'),
    ''
  );
$$;

comment on function public.narrative_trim(text) is
  'Trim, then a blank string is null. The SQL twin of present() in narrative.ts.';

/**
 * Resolve the four soft slots for one deal. The return shape mirrors
 * `ResolvedNarrative` in TypeScript:
 *
 *   {
 *     "horse.about_horse":               { "text": ..., "overridden": false },
 *     "horse.racing_outlook_and_pedigree": { "text": ..., "overridden": false },
 *     "horse.race_expectation":          { "text": ..., "overridden": false },
 *     "trainer.bio":                     { "text": ..., "overridden": false }
 *   }
 *
 * The trainer bio is never overridden. A missing dsl or party is not an error:
 * it means the fallback is all there is.
 */
create or replace function public.resolve_narrative(
  p_horse_id uuid,
  p_dsl_id uuid default null,
  p_party_id uuid default null
)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'horse.about_horse', jsonb_build_object(
      'text', coalesce(
        public.narrative_trim(
          (select d.narrative_about_horse from public.dsls d where d.id = p_dsl_id)
        ),
        public.narrative_trim(
          (select h.about_horse from public.horses h where h.id = p_horse_id)
        )
      ),
      'overridden', public.narrative_trim(
        (select d.narrative_about_horse from public.dsls d where d.id = p_dsl_id)
      ) is not null
    ),
    'horse.racing_outlook_and_pedigree', jsonb_build_object(
      'text', coalesce(
        public.narrative_trim(
          (select d.narrative_racing_outlook from public.dsls d where d.id = p_dsl_id)
        ),
        public.narrative_trim(
          (select h.racing_outlook_and_pedigree from public.horses h where h.id = p_horse_id)
        )
      ),
      'overridden', public.narrative_trim(
        (select d.narrative_racing_outlook from public.dsls d where d.id = p_dsl_id)
      ) is not null
    ),
    'horse.race_expectation', jsonb_build_object(
      'text', coalesce(
        public.narrative_trim(
          (select d.narrative_race_expectation from public.dsls d where d.id = p_dsl_id)
        ),
        public.narrative_trim(
          (select h.race_expectation from public.horses h where h.id = p_horse_id)
        )
      ),
      'overridden', public.narrative_trim(
        (select d.narrative_race_expectation from public.dsls d where d.id = p_dsl_id)
      ) is not null
    ),
    'trainer.bio', jsonb_build_object(
      'text', public.narrative_trim(
        (select p.bio from public.parties p where p.id = p_party_id)
      ),
      'overridden', false
    )
  );
$$;

comment on function public.resolve_narrative(uuid, uuid, uuid) is
  'The four soft slots, resolved with deal-local overrides. TS twin: resolveNarrative().';

-- ---------------------------------------------------------------------------
-- The Available gate, re-based on the resolved text and requiring the expiry
-- only. A start is stamped at sale time (chunk 4).
-- ---------------------------------------------------------------------------

create or replace function public.assert_dsl_available()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  horse_registered boolean;
  horse_image_count integer;
  resolved jsonb;
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

  if new.trainer_id is null then
    raise exception 'dsl % cannot be available: no trainer is attached to the term sheet', new.id
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

  -- Chunk 3: the expiry is required; the start is stamped at the sale.
  if new.end_date is null then
    raise exception 'dsl % cannot be available: the expiry is not set', new.id
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

  if new.narrative_signoff is null
     or new.narrative_signoff -> 'horse.about_horse' is distinct from 'true'::jsonb
     or new.narrative_signoff -> 'horse.racing_outlook_and_pedigree' is distinct from 'true'::jsonb
     or new.narrative_signoff -> 'horse.race_expectation' is distinct from 'true'::jsonb
     or new.narrative_signoff -> 'trainer.bio' is distinct from 'true'::jsonb
     or new.narrative_approved_at is null
     or btrim(coalesce(new.narrative_approved_hash, '')) = '' then
    raise exception 'dsl % cannot be available: the narrative is not fully approved', new.id
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

  -- The four soft slots are judged on what the deal will print: a deal-local
  -- override counts, and an untouched slot reads through from Records.
  resolved := public.resolve_narrative(new.horse_id, new.id, new.trainer_id);

  if resolved -> 'horse.about_horse' ->> 'text' is null
     or resolved -> 'horse.racing_outlook_and_pedigree' ->> 'text' is null
     or resolved -> 'horse.race_expectation' ->> 'text' is null then
    raise exception 'dsl % cannot be available: the horse narrative is missing one of the three resolved paragraphs',
      new.id
      using errcode = '23514';
  end if;

  if resolved -> 'trainer.bio' ->> 'text' is null then
    raise exception 'dsl % cannot be available: the horse''s trainer has no bio', new.id
      using errcode = '23514';
  end if;

  return new;
end;
$$;
