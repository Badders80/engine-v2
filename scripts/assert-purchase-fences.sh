#!/usr/bin/env bash
# Step 8b purchase-fence enforcement.
#
# Verifies the architectural seams between website/, engine/, and Supabase:
#   1. Migration 00012_accounts_signup.sql exists and wires auth.users -> public.accounts.
#   2. website/src/ imports nothing from engine/, sandbox/rebuild, or legal_engine.
#   3. website/src/ holds no STRIPE_* or SERVICE_ROLE / service_role / sb_secret_ secret,
#      and performs no pricing math (1.05 * 1.03) or legal template compilation.
#   4. website/src/lib/mystable.ts is the only file in website/src/ that queries
#      `accounts` or `sales`; every other `.from(...)` in website/src/ targets `dsls`.
#   5. BuyFlowModal.tsx and engineClient.ts print the verbatim refund sentence,
#      contain zero day-count expressions, and never claim "NZTR-verified member".
#   6. /mystable renders per request (`export const dynamic = 'force-dynamic'`).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WEBSITE_SRC="$ROOT/website/src"
MIGRATION_00012="$ROOT/supabase/migrations/00012_accounts_signup.sql"
MYSTABLE_LIB="$WEBSITE_SRC/lib/mystable.ts"
MYSTABLE_PAGE="$WEBSITE_SRC/app/mystable/page.tsx"
MODAL="$WEBSITE_SRC/components/BuyFlowModal.tsx"
ENGINE_CLIENT="$WEBSITE_SRC/lib/engineClient.ts"

RED=$'\033[31m'; GREEN=$'\033[32m'; DIM=$'\033[2m'; OFF=$'\033[0m'
fail=0

ok() { printf '  %sok%s   %s\n' "$GREEN" "$OFF" "$1"; }
no() { printf '  %sFAIL%s %s\n' "$RED" "$OFF" "$1"; fail=1; }

printf '%spurchase fences — website/%s\n' "$DIM" "$OFF"

# 1. Migration 00012 exists and triggers on auth.users -> public.accounts
if [ -f "$MIGRATION_00012" ] && grep -q 'create trigger on_auth_user_created' "$MIGRATION_00012" && grep -q 'insert into public.accounts' "$MIGRATION_00012"; then
  ok '00012_accounts_signup.sql populates public.accounts from auth.users'
else
  no '00012_accounts_signup.sql missing or does not insert into public.accounts from auth.users'
fi

# 2. website/src/ imports nothing from engine/ or sandbox/rebuild
if grep -rnE "from[[:space:]]+['\"][^'\"]*(^|/)engine/|sandbox/rebuild|legal_engine" "$WEBSITE_SRC" >/dev/null 2>&1; then
  no 'website/src/ imports from engine/, sandbox/rebuild, or legal_engine'
  grep -rnE "from[[:space:]]+['\"][^'\"]*(^|/)engine/|sandbox/rebuild|legal_engine" "$WEBSITE_SRC" | head -3
else
  ok 'website/src/ imports nothing from engine/ or sandbox/rebuild'
fi

# 3. website/src/ holds no STRIPE_* or SERVICE_ROLE secret and does no pricing/compilation
if grep -rnE 'STRIPE_SECRET_KEY|STRIPE_WEBHOOK_SECRET|SERVICE_ROLE|service_role|sb_secret_' "$WEBSITE_SRC" >/dev/null 2>&1; then
  no 'website/src/ references a Stripe or service-role secret'
  grep -rnE 'STRIPE_SECRET_KEY|STRIPE_WEBHOOK_SECRET|SERVICE_ROLE|service_role|sb_secret_' "$WEBSITE_SRC" | head -3
else
  ok 'website/src/ holds no Stripe or service-role secret'
fi

if grep -rnE '1\.05[[:space:]]*\*[[:space:]]*1\.03|compileLegalPack|\.template\.md' "$WEBSITE_SRC" >/dev/null 2>&1; then
  no 'website/src/ performs pricing math or template compilation'
  grep -rnE '1\.05[[:space:]]*\*[[:space:]]*1\.03|compileLegalPack|\.template\.md' "$WEBSITE_SRC" | head -3
else
  ok 'website/src/ performs no pricing math or template compilation'
fi

# 4. .from(...) fence: only mystable.ts may read accounts/sales; everything else reads dsls
bad_from=0
while IFS=: read -r file line rest; do
  [ -n "$file" ] || continue
  table="$(printf '%s' "$rest" | sed -E "s/.*\.from\([[:space:]]*['\"]([a-z_]+)['\"].*/\1/")"
  if [ "$file" = "$MYSTABLE_LIB" ]; then
    case "$table" in
      accounts|sales) ;;
      *)
        no "mystable.ts queries disallowed table '$table' at line $line"
        bad_from=1
        ;;
    esac
  else
    if [ "$table" != "dsls" ]; then
      no "${file#"$ROOT"/}:$line queries '$table' (only 'dsls' allowed outside mystable.ts)"
      bad_from=1
    fi
  fi
done < <(grep -rnE "\.from\([[:space:]]*['\"][a-z_]+['\"]" "$WEBSITE_SRC" || true)

if [ "$bad_from" -eq 0 ]; then
  ok 'only website/src/lib/mystable.ts queries accounts/sales; all other reads target dsls'
fi

# 5. Refund sentence, zero day-count expressions in buy flow, no NZTR-verified member claim
REFUND='If the horse is retired or the lease ends early, the leaseholder receives a pro-rata refund of the unused lease fee for the full months remaining.'
if grep -Fq "$REFUND" "$ENGINE_CLIENT" && grep -q 'BUY_FLOW_REFUND_SENTENCE' "$MODAL"; then
  ok 'verbatim refund sentence wired into BuyFlowModal.tsx'
else
  no 'verbatim refund sentence missing from engineClient.ts or BuyFlowModal.tsx'
fi

if grep -nEi '[0-9]+[[:space:]]+days?' "$MODAL" "$ENGINE_CLIENT" >/dev/null 2>&1; then
  no 'day-count expression found in buy flow copy'
  grep -nEi '[0-9]+[[:space:]]+days?' "$MODAL" "$ENGINE_CLIENT" | head -3
else
  ok 'zero day-count expressions in buy flow copy'
fi

if grep -rnF 'NZTR-verified member' "$WEBSITE_SRC" >/dev/null 2>&1; then
  no 'forbidden "NZTR-verified member" phrase found in website/src/'
else
  ok 'no "NZTR-verified member" claim in website/src/'
fi

# 6. /mystable is force-dynamic
if [ -f "$MYSTABLE_PAGE" ] && grep -q "export const dynamic = 'force-dynamic'" "$MYSTABLE_PAGE"; then
  ok 'website/src/app/mystable/page.tsx renders per request (force-dynamic)'
else
  no 'website/src/app/mystable/page.tsx missing or not force-dynamic'
fi

if [ "$fail" -ne 0 ]; then
  printf '%spurchase fences: FAILED%s\n' "$RED" "$OFF"
  exit 1
fi

printf '%spurchase fences: clean%s %s(6 rule groups)%s\n' "$GREEN" "$OFF" "$DIM" "$OFF"
