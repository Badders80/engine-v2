#!/usr/bin/env bash
#
# `just check:db` — the local-only parity gate for the narrative fallback.
#
# It never runs in `pnpm verify`. CI and dispatch worktrees may have no
# Postgres, and a gate that needs a database would make the repo gate
# environment-dependent. Run it by hand on a machine with the local Supabase
# stack up; its output belongs in the handback.
#
# Default local database URL is the Supabase CLI's: port 54422, postgres.
# Override with CHECK_DB_URL.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DB_URL="${CHECK_DB_URL:-postgresql://postgres:postgres@127.0.0.1:54422/postgres}"
MIGRATION="$ROOT/supabase/migrations/00022_deal_assembly.sql"

cd "$ROOT"

if ! command -v psql >/dev/null 2>&1; then
  echo "check:db needs psql on PATH" >&2
  exit 1
fi

if ! psql "$DB_URL" -Atqc 'select 1' >/dev/null 2>&1; then
  echo "check:db needs the local Postgres at $DB_URL" >&2
  echo "start it with: supabase start" >&2
  exit 1
fi

applied="$(psql "$DB_URL" -Atqc "
  select 1 from information_schema.columns
   where table_schema = 'public'
     and table_name = 'dsls'
     and column_name = 'narrative_about_horse'
")"

if [ "$applied" != "1" ]; then
  echo "== applying 00022 to the local database =="
  psql "$DB_URL" -v ON_ERROR_STOP=1 -f "$MIGRATION" >/dev/null
fi

echo "== TS resolver vs the fixture set =="
pnpm --filter engine exec vitest run tests/narrative-parity.test.ts

echo "== SQL function vs the same fixture set =="
psql "$DB_URL" -v ON_ERROR_STOP=1 -f "$ROOT/scripts/check-db-narrative.sql"

echo "check:db: TS and SQL agree on every fixture case"
