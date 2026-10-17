#!/usr/bin/env bash
#
# Step 6b-i read-policy enforcement.
#
# Migration 00009 is the whole of what the public site can read, and it can be
# wrong in two ways that are both silent.
#
#   1. A policy drifts. Turning `published = true` into `true` on `dsls`
#      publishes every DSL at once, drafts included, and nothing else in the
#      gate would notice: the site would simply show more horses.
#   2. The client stops honouring the fence. `horses` is readable to `anon` in
#      full, unregistered rows included, which is safe only while the site reads
#      `dsls` and joins outward. A direct read of `horses` leaks the rest.
#   3. The table grants disappear. A policy with no matching GRANT is inert:
#      postgres-owned default ACLs in schema public give anon only `Dxtm`, with no
#      `r`, so an anon read fails 42501 before the policy is consulted. This was
#      found by running the probe, not by reading the law.
#
# The file is checked as CODE, not as text: SQL line comments are stripped first,
# because this project's migrations document the rules they follow and the
# documentation must not trip the assertions.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MIGRATIONS="$ROOT/supabase/migrations"
POLICIES="$MIGRATIONS/00009_website_read_policies.sql"
WEBSITE_SRC="$ROOT/website/src"

RED=$'\033[31m'; GREEN=$'\033[32m'; DIM=$'\033[2m'; OFF=$'\033[0m'
fail=0

if [ ! -f "$POLICIES" ]; then
  printf '%sFAIL%s migration missing: %s\n' "$RED" "$OFF" "${POLICIES#"$ROOT"/}"
  exit 1
fi

# Comments are documentation, not policy. Drop them before asserting.
CODE="$(sed 's/--.*$//' "$POLICIES" | tr '\n' ' ' | tr -s ' ')"

# The six policies the law rules: four predicate shapes across six tables
# (PLAN.md:277-280). Spelled out whole so a reordered or reworded statement is a
# failure rather than a near miss.
EXPECTED=(
  'create policy trainers_read_public on public.trainers for select using (true);'
  'create policy owners_read_public on public.owners for select using (true);'
  'create policy horses_read_public on public.horses for select using (true);'
  'create policy dsls_read_published on public.dsls for select using (published = true);'
  'create policy accounts_read_own on public.accounts for select using (auth.uid() = id);'
  'create policy sales_read_own on public.sales for select using (auth.uid() = user_id);'
)

for want in "${EXPECTED[@]}"; do
  case "$CODE" in
    *"$want"*) ;;
    *)
      printf '%sFAIL%s policy missing or drifted:\n  %s\n' "$RED" "$OFF" "$want"
      fail=1
      ;;
  esac
done

# The grants that make those policies reachable. Without them every one of the
# six is inert and the site fails with 42501 instead of returning rows. The four
# public tables go to anon; accounts and sales go to authenticated only, because
# no visitor path reads them and nothing should be reachable to a logged-out
# reader that has no rows to show it anyway.
GRANTS=(
  'grant select on public.trainers to anon, authenticated;'
  'grant select on public.owners to anon, authenticated;'
  'grant select on public.horses to anon, authenticated;'
  'grant select on public.dsls to anon, authenticated;'
  'grant select on public.accounts to authenticated;'
  'grant select on public.sales to authenticated;'
)

for want in "${GRANTS[@]}"; do
  case "$CODE" in
    *"$want"*) ;;
    *)
      printf '%sFAIL%s grant missing; the policy it backs is inert:\n  %s\n' "$RED" "$OFF" "$want"
      fail=1
      ;;
  esac
done

# Exactly six. A seventh policy would widen the public read surface silently.
declared="$(grep -o 'create policy' <<<"$CODE" | wc -l | tr -d ' ')"
if [ "$declared" -ne "${#EXPECTED[@]}" ]; then
  printf '%sFAIL%s migration declares %s policies, the ruling is %s\n' \
    "$RED" "$OFF" "$declared" "${#EXPECTED[@]}"
  fail=1
fi

# Policies only. Tables and RLS flags belong to 00001-00008 and are not repeated.
if grep -nE '\b(create|drop|alter)[[:space:]]+table\b|enable[[:space:]]+row[[:space:]]+level[[:space:]]+security' <<<"$CODE" >/dev/null; then
  printf '%sFAIL%s migration touches a table or re-enables RLS; it adds policies only\n' "$RED" "$OFF"
  grep -nE '\b(create|drop|alter)[[:space:]]+table\b|enable[[:space:]]+row[[:space:]]+level[[:space:]]+security' <<<"$CODE" | head -3
  fail=1
fi

# No migration prefix may be shared (PLAN.md:243, :315).
others="$(find "$MIGRATIONS" -maxdepth 1 -type f -name '00009*' ! -name '00009_website_read_policies.sql' | wc -l | tr -d ' ')"
if [ "$others" -ne 0 ]; then
  printf '%sFAIL%s another migration shares the 00009 prefix\n' "$RED" "$OFF"
  find "$MIGRATIONS" -maxdepth 1 -type f -name '00009*' ! -name '00009_website_read_policies.sql'
  fail=1
fi

# The client fence. `published` lives only on `dsls`; reaching these three
# directly leaks unpublished and unregistered rows (PLAN.md:282).
if grep -rnE "\.from\([[:space:]]*['\"](horses|trainers|owners)['\"]" "$WEBSITE_SRC" >/dev/null 2>&1; then
  printf '%sFAIL%s direct read of a fenced table under website/src/\n' "$RED" "$OFF"
  grep -rnE "\.from\([[:space:]]*['\"](horses|trainers|owners)['\"]" "$WEBSITE_SRC" | head -3
  printf '%s     %s\n' "$DIM" "read dsls and embed the horse instead; see website/src/lib/listings.ts" "$OFF"
  fail=1
fi

if [ "$fail" -ne 0 ]; then
  printf '%sread policy enforcement: FAILED%s\n' "$RED" "$OFF"
  exit 1
fi

printf '%sread policy enforcement: clean%s %s(6 policies, 6 grants, no direct reads)%s\n' \
  "$GREEN" "$OFF" "$DIM" "$OFF"
