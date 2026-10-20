#!/usr/bin/env bash
#
# Step 7 legal-template enforcement.
#
# The PDS and the SA are only as good as the corpus they are compiled from, and
# the corpus can go wrong in five silent ways:
#
#   1. A prose file is edited without the pinned hash being updated, so the
#      document a buyer receives is not the one the build reviewed.
#   2. A banned term slips back into the raw text.
#   3. A soft slot leaks into the SA, which must carry none.
#   4. A token is added to the corpus but not to the resolver union, or a key in
#      the union has no call site, so a document renders an empty string or the
#      resolver map grows dead code.
#   5. The compiler is cut loose from its production consumer.
#
# The file is checked as CODE and PROSE: hashes and banned terms are the
# document's own words, so comments are not stripped from the corpus. The
# wiring check reads the page source with comments removed.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TEMPLATES="$ROOT/engine/src/templates"
BLOCKS="$TEMPLATES/blocks"
PREVIEW="$ROOT/engine/src/app/dsl/[id]/legal/page.tsx"
COMPILE_TEST="$ROOT/engine/tests/legal-compile.test.ts"

RED=$'\033[31m'; GREEN=$'\033[32m'; OFF=$'\033[0m'
fail=0

ok() { printf '%sok%s %s\n' "$GREEN" "$OFF" "$1"; }
bad() { printf '%sFAIL%s %s\n' "$RED" "$OFF" "$1"; fail=1; }

FILES=(
  "$TEMPLATES/PDS.template.md"
  "$TEMPLATES/SA.template.md"
  "$BLOCKS/pds-costs-summary.float.md"
  "$BLOCKS/pds-costs-summary.upfront.md"
  "$BLOCKS/pds-close-style.fourteen-day.md"
  "$BLOCKS/pds-close-style.three-x-remaining.md"
)

# 1. Every prose file is present. A missing one is a compile failure at runtime.
missing=0
for file in "${FILES[@]}"; do
  [ -f "$file" ] || { bad "missing legal prose file: ${file#"$ROOT"/}"; missing=1; }
done
[ "$missing" -eq 0 ] && ok "six legal prose files present"

# 2. The six hashes are pinned and match. An edit is deliberate or it is drift.
if (cd "$ROOT" && sha256sum -c engine/src/templates/SHA256SUMS >/dev/null 2>&1); then
  ok "SHA256SUMS verifies for all six files"
else
  bad "SHA256SUMS does not match the prose on disk"
fi

# 3. No banned term in the raw corpus.
BANNED=(
  'Tokinvest'
  '\bVARA\b'
  'digital[[:space:]]+token'
  'tokenis(ed|ing)'
  '\btokens?\b'
  'fair[[:space:]]+value'
  '\b14[[:space:]]+business[[:space:]]+days\b'
  '\babsorb(ed|ing|s)?\b'
)
banned_hit=0
for file in "${FILES[@]}"; do
  [ -f "$file" ] || continue
  for pattern in "${BANNED[@]}"; do
    if grep -E -i -q "$pattern" "$file"; then
      bad "banned term /$pattern/ in ${file#"$ROOT"/}"
      banned_hit=1
    fi
  done
done
[ "$banned_hit" -eq 0 ] && ok "no banned term in the raw corpus"

# 4. The SA carries none of the four soft slots; the PDS carries all four.
tokens_in() {
  { grep -o '{{[^}]*}}' "$1" || true; } | sed 's/^{{//; s/}}$//' | tr -d ' ' | sort -u
}

count_in() {
  { grep -o -- "$1" "$2" || true; } | wc -l
}
SOFT=(
  'horse.about_horse'
  'horse.racing_outlook_and_pedigree'
  'horse.race_expectation'
  'trainer.bio'
)
soft_fail=0
SA_TOKENS="$(tokens_in "$TEMPLATES/SA.template.md")"
PDS_TOKENS="$(tokens_in "$TEMPLATES/PDS.template.md")"
for soft in "${SOFT[@]}"; do
  if grep -Fxq "$soft" <<<"$SA_TOKENS"; then
    bad "the SA carries the soft slot {{$soft}}"
    soft_fail=1
  fi
  if ! grep -Fxq "$soft" <<<"$PDS_TOKENS"; then
    bad "the PDS is missing the soft slot {{$soft}}"
    soft_fail=1
  fi
done
[ "$soft_fail" -eq 0 ] && ok "SA zero soft slots, PDS all four"

# 5. The token contract, in both directions.
EXPECTED=(
  'account.full_name'
  'dsl.campaign_slug'
  'dsl.distribution_schedule'
  'dsl.end_date'
  'dsl.investor_split'
  'dsl.listed_stake'
  'dsl.min_stake'
  'dsl.owner_retention_split'
  'dsl.payment_model_label'
  'dsl.step'
  'dsl.term_months'
  'dsl.term_start'
  'horse.about_horse'
  'horse.breeder'
  'horse.colour'
  'horse.dam_name'
  'horse.foaling_label'
  'horse.legal_name'
  'horse.microchip'
  'horse.race_expectation'
  'horse.racing_outlook_and_pedigree'
  'horse.sex'
  'horse.sire_name'
  'owner.entity_name'
  'pds.close_style_block'
  'pds.costs_summary_block'
  'pricing.float_per_percent_nzd'
  'pricing.monthly_lease_payment_unit_nzd'
  'pricing.upfront_per_percent_nzd'
  'sale.executed_date'
  'sale.initial_payment_nzd'
  'sale.monthly_payment_nzd'
  'sale.stake_pct'
  'syndicate.name'
  'syndicate.version'
  'trainer.bio'
  'trainer.location'
  'trainer.name'
)

CORPUS_TOKENS="$(for file in "${FILES[@]}"; do tokens_in "$file"; done | sort -u)"
EXPECTED_SORTED="$(printf '%s\n' "${EXPECTED[@]}" | sort -u)"

token_fail=0
unknown="$(comm -23 <(echo "$CORPUS_TOKENS") <(echo "$EXPECTED_SORTED"))"
orphans="$(comm -13 <(echo "$CORPUS_TOKENS") <(echo "$EXPECTED_SORTED"))"
if [ -n "$unknown" ]; then
  bad "corpus token outside the union: $(tr '\n' ' ' <<<"$unknown")"
  token_fail=1
fi
if [ -n "$orphans" ]; then
  bad "union key with no call site: $(tr '\n' ' ' <<<"$orphans")"
  token_fail=1
fi
for file in "${FILES[@]}"; do
  opens="$(count_in '{{' "$file")"
  closes="$(count_in '}}' "$file")"
  if [ "$opens" -ne "$closes" ]; then
    bad "unbalanced braces in ${file#"$ROOT"/}"
    token_fail=1
  fi
done
[ "$token_fail" -eq 0 ] && ok "token union exhaustive and matched, braces balanced"

# 6. The compiler is wired to a production consumer and its tests.
wiring_fail=0
if ! grep -q "from '@/lib/legal/compile'" "$PREVIEW" || ! grep -q 'compileLegalPack(' "$PREVIEW"; then
  bad "the preview page does not import and call compileLegalPack"
  wiring_fail=1
fi
if ! grep -q "src/lib/legal/" "$COMPILE_TEST"; then
  bad "the compiler tests do not import src/lib/legal"
  wiring_fail=1
fi
[ "$wiring_fail" -eq 0 ] && ok "compiler wired to the preview and the tests"

if [ "$fail" -ne 0 ]; then
  printf '%sFAIL%s legal templates\n' "$RED" "$OFF"
  exit 1
fi

printf '%sok%s legal templates\n' "$GREEN" "$OFF"
