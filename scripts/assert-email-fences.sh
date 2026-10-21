#!/usr/bin/env bash
# Step 9 email-fence enforcement.
#
# Verifies the architectural invariants for the four transactional emails:
#   1. engine/src/lib/email.ts defines EMAIL_KINDS with the exact four members
#      ('buyer_sale_written', 'buyer_kyc_failed', 'founder_sale_succeeded',
#      'founder_our_fault_failure') and no fifth kind.
#   2. engine/src/lib/email.ts includes the canonical MyStable URL
#      (https://www.evolutionstables.nz/mystable) and zero bare-apex URLs.
#   3. Zero Gmail SMTP usage (smtp.gmail.com, nodemailer) in engine/src/ or website/src/.
#   4. website/src/ never imports engine/src/lib/email.ts and holds zero
#      ENGINE_EMAIL_* or ENGINE_FOUNDER_EMAIL references.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
EMAIL_LIB="$ROOT/engine/src/lib/email.ts"
ENGINE_SRC="$ROOT/engine/src"
WEBSITE_SRC="$ROOT/website/src"

RED=$'\033[31m'; GREEN=$'\033[32m'; DIM=$'\033[2m'; OFF=$'\033[0m'
fail=0

ok() { printf '  %sok%s   %s\n' "$GREEN" "$OFF" "$1"; }
no() { printf '  %sFAIL%s %s\n' "$RED" "$OFF" "$1"; fail=1; }

printf '%semail fences — engine/ & website/%s\n' "$DIM" "$OFF"

# 1. Exact four EMAIL_KINDS members in engine/src/lib/email.ts, and no fifth kind
if [ ! -f "$EMAIL_LIB" ]; then
  no 'engine/src/lib/email.ts is missing'
else
  kinds_block="$(awk '/export const EMAIL_KINDS = \[/,/\] as const/' "$EMAIL_LIB")"
  kind_count="$(printf '%s\n' "$kinds_block" | grep -cE "^[[:space:]]*'[a-z_]+',$" || true)"
  if [ "$kind_count" -eq 4 ] \
    && printf '%s\n' "$kinds_block" | grep -q "'buyer_sale_written'" \
    && printf '%s\n' "$kinds_block" | grep -q "'buyer_kyc_failed'" \
    && printf '%s\n' "$kinds_block" | grep -q "'founder_sale_succeeded'" \
    && printf '%s\n' "$kinds_block" | grep -q "'founder_our_fault_failure'"; then
    ok 'EMAIL_KINDS contains the exact four email kinds and no fifth kind'
  else
    no "EMAIL_KINDS must contain the exact 4 kinds (found count=$kind_count)"
  fi
fi

# 2. Canonical MyStable URL present in engine/src/lib/email.ts, no bare apex URL
if [ -f "$EMAIL_LIB" ] && grep -Fq 'https://www.evolutionstables.nz/mystable' "$EMAIL_LIB"; then
  ok 'canonical MyStable URL https://www.evolutionstables.nz/mystable present in engine/src/lib/email.ts'
else
  no 'canonical MyStable URL https://www.evolutionstables.nz/mystable missing from engine/src/lib/email.ts'
fi

if [ -f "$EMAIL_LIB" ] && grep -nE 'https://evolutionstables\.nz' "$EMAIL_LIB" >/dev/null 2>&1; then
  no 'bare apex URL https://evolutionstables.nz found in engine/src/lib/email.ts'
else
  ok 'zero bare apex URLs in engine/src/lib/email.ts'
fi

# 3. Zero Gmail SMTP (smtp.gmail.com or nodemailer) in engine/src/ or website/src/
if grep -rnE 'smtp\.gmail\.com|nodemailer' "$ENGINE_SRC" "$WEBSITE_SRC" >/dev/null 2>&1; then
  no 'Gmail SMTP reference (smtp.gmail.com or nodemailer) found in engine/src/ or website/src/'
  grep -rnE 'smtp\.gmail\.com|nodemailer' "$ENGINE_SRC" "$WEBSITE_SRC" | head -3
else
  ok 'zero Gmail SMTP references (smtp.gmail.com / nodemailer) in engine/src/ and website/src/'
fi

# 4. website/src/ never imports email.ts and never references ENGINE_EMAIL_* or ENGINE_FOUNDER_EMAIL
if grep -rnE 'ENGINE_EMAIL_API_URL|ENGINE_EMAIL_API_KEY|ENGINE_EMAIL_FROM|ENGINE_FOUNDER_EMAIL|ENGINE_EMAIL_|lib/email' "$WEBSITE_SRC" >/dev/null 2>&1; then
  no 'website/src/ imports engine email module or references ENGINE_EMAIL_* / ENGINE_FOUNDER_EMAIL'
  grep -rnE 'ENGINE_EMAIL_API_URL|ENGINE_EMAIL_API_KEY|ENGINE_EMAIL_FROM|ENGINE_FOUNDER_EMAIL|ENGINE_EMAIL_|lib/email' "$WEBSITE_SRC" | head -3
else
  ok 'website/src/ holds zero email imports and zero ENGINE_EMAIL_* / ENGINE_FOUNDER_EMAIL references'
fi

if [ "$fail" -ne 0 ]; then
  printf '%semail fences: FAILED%s\n' "$RED" "$OFF"
  exit 1
fi

printf '%semail fences: clean%s %s(4 rule groups)%s\n' "$GREEN" "$OFF" "$DIM" "$OFF"
