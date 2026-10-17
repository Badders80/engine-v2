#!/usr/bin/env bash
# Step 6b-ii search-layer check.
#
# Five things PLAN.md's "Search" section rules, and one class of defect the 6a
# build shipped because nothing looked for it:
#
#   1. The three metadata routes exist, and are static or dynamic for the right
#      reason. A page that reads a row is server-rendered per request, because CI
#      builds with no environment variables and the read client throws without
#      them. A route that reads nothing stays static.
#   2. The public host is the www host. The apex is the mistake the current site
#      makes (PLAN.md:84) and it must not reappear as a URL anywhere.
#   3. MyStable, login and checkout stay out of the index (PLAN.md:80).
#   4. The sitemap derives its set from the read layer, and no page points at the
#      retired /horses/ path (PLAN.md:85).
#   5. **Every asset path under website/src/ resolves on disk.** 6a asked for
#      `wexford-stables.png` while the file that shipped was a `.jpg`, and
#      `next/image` takes a runtime string, so typecheck, lint and build all passed
#      while the mark would have 404'd. That is the defect this sweep makes
#      impossible to repeat.
#
# Scope note: like scripts/assert-design-tokens.sh, this scans TEXT source only.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC="$ROOT/website/src"
PUBLIC="$ROOT/website/public"
APP="$SRC/app"
SITE="$SRC/lib/site.ts"

RED=$'\033[31m'; GREEN=$'\033[32m'; DIM=$'\033[2m'; OFF=$'\033[0m'
fail=0

rel() { printf '%s' "${1#"$ROOT"/}"; }
ok() { printf '  %sok%s   %s\n' "$GREEN" "$OFF" "$1"; }
no() { printf '  %sFAIL%s %s\n' "$RED" "$OFF" "$1"; fail=1; }

printf '%ssearch layer — website/%s\n' "$DIM" "$OFF"

# --- 1 · the routes exist, and each one is dynamic or static for its right reason.
for f in "$APP/robots.ts" "$APP/sitemap.ts"; do
  if [ -f "$f" ]; then ok "$(rel "$f") exists"; else no "$(rel "$f") is missing"; fi
done

for f in "$APP/marketplace/page.tsx" "$APP/marketplace/[slug]/page.tsx" "$APP/sitemap.ts"; do
  [ -f "$f" ] || { no "$(rel "$f") is missing"; continue; }
  if grep -q "export const dynamic = 'force-dynamic'" "$f"; then
    ok "$(rel "$f") renders per request"
  else
    no "$(rel "$f") reads rows but is not force-dynamic — it will throw at build time in CI, where no environment variables are set"
  fi
done

if [ -f "$APP/robots.ts" ]; then
  if grep -q 'force-dynamic' "$APP/robots.ts"; then
    no "$(rel "$APP/robots.ts") is force-dynamic but reads nothing — it should stay static"
  else
    ok "$(rel "$APP/robots.ts") reads nothing and stays static"
  fi
fi

# --- 2 · the www host, and never the apex as a URL.
if grep -q "SITE_URL = 'https://www.evolutionstables.nz'" "$SITE"; then
  ok 'the canonical host is the www host'
else
  no "$(rel "$SITE") does not declare SITE_URL as https://www.evolutionstables.nz"
fi

if grep -rnE 'https://evolutionstables\.nz' "$SRC" >/dev/null 2>&1; then
  no 'the apex host is used as a URL — PLAN.md:84 rules it is not a second canonical'
  grep -rnE 'https://evolutionstables\.nz' "$SRC" | head -3
else
  ok 'the apex host appears as a URL nowhere in the app'
fi

# --- 3 · the three routes that stay out of the index.
if [ -f "$APP/robots.ts" ]; then
  for path in /mystable /login /checkout; do
    if grep -q "'$path'" "$APP/robots.ts"; then
      ok "robots.txt disallows $path"
    else
      no "robots.txt does not disallow $path (PLAN.md:80)"
    fi
  done
fi

# --- 4 · the sitemap's set comes from the read layer, and /horses/ is retired.
if [ -f "$APP/sitemap.ts" ]; then
  if grep -q 'listPublishedListings' "$APP/sitemap.ts" && grep -q 'sitemapUrls' "$APP/sitemap.ts"; then
    ok 'the sitemap derives its set from the read layer'
  else
    no "$(rel "$APP/sitemap.ts") does not build its set from listPublishedListings through sitemapUrls"
  fi
fi

if grep -rn '/horses/' "$SRC" >/dev/null 2>&1; then
  no 'the retired /horses/ path appears in the app — the horse page is /marketplace/[slug]'
  grep -rn '/horses/' "$SRC" | head -3
else
  ok 'the retired /horses/ path appears nowhere'
fi

# --- 5 · every asset path in the app resolves on disk.
missing=0
count=0
while IFS= read -r asset; do
  [ -n "$asset" ] || continue
  count=$((count + 1))
  if [ ! -f "$PUBLIC$asset" ]; then
    no "asset referenced but not on disk: website/public$asset"
    missing=$((missing + 1))
  fi
done < <(grep -rhoE "['\"]/(images|brand|og)/[^'\"]+" "$SRC" | sed -E "s/^['\"]//" | sort -u)

if [ "$missing" -eq 0 ]; then
  ok "every asset path resolves ($count referenced)"
fi

if [ "$fail" -ne 0 ]; then
  printf '%ssearch layer: FAILED%s\n' "$RED" "$OFF"
  exit 1
fi

printf '%ssearch layer: clean%s %s(5 rule groups)%s\n' "$GREEN" "$OFF" "$DIM" "$OFF"
