#!/usr/bin/env bash
#
# assert-no-anti-patterns.sh
#
# Fails when any banned legacy token is present in the tree that would land in
# the next commit. The ten tokens are named in PLAN.md step 1.
#
# Runs as the pre-commit hook and as the first stage of `pnpm test`.
# Exits 0 when clean, 1 when a banned token is found.
#
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT" || { echo "FAIL: cannot enter repo root"; exit 1; }

# This file names every banned token by definition, so it is never scanned.
SELF_PATH="scripts/assert-no-anti-patterns.sh"

# The ten banned legacy tokens. `orca` is matched case-insensitively: it is a
# bare product word, not a code identifier, so `Orca` is the same hit.
TOKENS=(
  INVENTORY_UUID_BY_SLUG
  LEGACY_SLUG_ALIASES
  slugCandidates
  HORSE_STILLS
  DEFAULT_CDN_HOST
  CONTENT_DIR
  resolveHorseSlug
  REFUND_WINDOW_DAYS
  brand_dna
  orca
)

# Everything that would be committed: tracked files plus untracked files that
# are not ignored. Ignored paths (node_modules, .next, ...) stay out.
mapfile -d '' FILES < <(git ls-files -z --cached --others --exclude-standard)

SCAN=()
for f in "${FILES[@]}"; do
  [[ "$f" == "$SELF_PATH" ]] && continue
  SCAN+=("$f")
done

if (( ${#SCAN[@]} == 0 )); then
  echo "OK: no files to scan; ${#TOKENS[@]} banned tokens armed."
  exit 0
fi

status=0
for token in "${TOKENS[@]}"; do
  flags=(-H -n -I)
  [[ "$token" == "orca" ]] && flags+=(-i)

  hits="$(grep "${flags[@]}" -- "$token" -- "${SCAN[@]}" 2>/dev/null || true)"
  if [[ -n "$hits" ]]; then
    echo "BANNED TOKEN: $token"
    printf '%s\n' "$hits" | head -20 | sed 's/^/  /'
    status=1
  fi
done

if (( status != 0 )); then
  echo
  echo "FAIL: banned legacy token(s) present. See PLAN.md step 1."
  exit 1
fi

echo "OK: 0 of ${#TOKENS[@]} banned legacy tokens across ${#SCAN[@]} files."
exit 0
