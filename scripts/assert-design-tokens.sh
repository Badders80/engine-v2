#!/usr/bin/env bash
# Step 6a design-enforcement check.
#
# The theme file is the ONE place raw colour is allowed, because it is where the
# tokens are defined. Everything else in the website app must reach for a token.
# A raw colour, a stock Tailwind palette utility, or a generic font utility in a
# component means someone bypassed the theme, and this makes that fail the build
# rather than survive review.
#
# Scope note: this scans TEXT source only (.tsx/.ts/.css). A recursive grep would
# also walk binaries and font files, and a corrupted binary will happily match a
# colour value inside it.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC="$ROOT/website/src"
THEME="$SRC/app/globals.css"

RED=$'\033[31m'; GREEN=$'\033[32m'; DIM=$'\033[2m'; OFF=$'\033[0m'
fail=0
scanned=0

if [ ! -f "$THEME" ]; then
  printf '%sFAIL%s theme file missing: %s\n' "$RED" "$OFF" "$THEME"
  exit 1
fi

if ! grep -q '@theme' "$THEME"; then
  printf '%sFAIL%s theme file carries no @theme block: %s\n' "$RED" "$OFF" "$THEME"
  fail=1
fi

# The theme file may DOCUMENT the retired names (it carries the ban as a comment)
# but may never DECLARE one as a token. Bare names in prose are documentation.
for retired in ash smoke hairline stage-black; do
  if grep -nE "^[[:space:]]*--[a-z-]*${retired}[[:space:]]*:" "$THEME" >/dev/null; then
    printf '%sFAIL%s theme declares retired token %s in %s\n' "$RED" "$OFF" "$retired" "${THEME#"$ROOT"/}"
    grep -nE "^[[:space:]]*--[a-z-]*${retired}[[:space:]]*:" "$THEME" | head -3
    fail=1
  fi
done

while IFS= read -r f; do
  [ "$f" = "$THEME" ] && continue
  scanned=$((scanned + 1))
  rel="${f#"$ROOT"/}"

  # Retired names and values, in component text only.
  if grep -nE '\b(ash|smoke|hairline|stage-black)\b|#575757|#454545|#050505' "$f" >/dev/null; then
    printf '%sFAIL%s retired token in %s\n' "$RED" "$OFF" "$rel"
    grep -nE '\b(ash|smoke|hairline|stage-black)\b|#575757|#454545|#050505' "$f" | head -3
    fail=1
  fi

  if grep -nE '#[0-9a-fA-F]{3,8}|rgba?\(|hsla?\(|oklch\(' "$f" >/dev/null; then
    printf '%sFAIL%s raw colour literal in %s\n' "$RED" "$OFF" "$rel"
    grep -nE '#[0-9a-fA-F]{3,8}|rgba?\(|hsla?\(|oklch\(' "$f" | head -3
    fail=1
  fi

  if grep -nE '\b(bg|text|border|from|to|via|ring|fill|stroke)-(slate|gray|grey|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-[0-9]{2,3}\b' "$f" >/dev/null; then
    printf '%sFAIL%s stock Tailwind palette utility in %s\n' "$RED" "$OFF" "$rel"
    grep -nE '\b(bg|text|border|from|to|via|ring|fill|stroke)-(slate|gray|grey|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-[0-9]{2,3}\b' "$f" | head -3
    fail=1
  fi

  if grep -nE '\bfont-(sans|serif)\b' "$f" >/dev/null; then
    printf '%sFAIL%s generic font utility in %s — use a named role\n' "$RED" "$OFF" "$rel"
    grep -nE '\bfont-(sans|serif)\b' "$f" | head -3
    fail=1
  fi

  # text-muted renders the raised SURFACE (#111111) as type. Near-black on near-black.
  if grep -nE '\btext-muted([^-a-z]|$)' "$f" >/dev/null; then
    printf '%sFAIL%s text-muted in %s — dim type is text-muted-foreground\n' "$RED" "$OFF" "$rel"
    grep -nE '\btext-muted([^-a-z]|$)' "$f" | head -3
    fail=1
  fi

  if grep -nE '\b(rounded|scale|duration|z)-\[[^]]+\]' "$f" >/dev/null; then
    printf '%sFAIL%s arbitrary theme-bypassing value in %s\n' "$RED" "$OFF" "$rel"
    grep -nE '\b(rounded|scale|duration|z)-\[[^]]+\]' "$f" | head -3
    fail=1
  fi
done < <(find "$SRC" -type f \( -name '*.tsx' -o -name '*.ts' -o -name '*.css' \) | sort)

if [ "$fail" -ne 0 ]; then
  printf '%sdesign enforcement: FAILED%s (%d files scanned)\n' "$RED" "$OFF" "$scanned"
  exit 1
fi

printf '%sdesign enforcement: clean%s %s(%d files scanned, theme file exempt)%s\n' "$GREEN" "$OFF" "$DIM" "$scanned" "$OFF"
