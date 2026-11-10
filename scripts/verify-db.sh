#!/usr/bin/env bash
# verify-db — the SQL gate `pnpm verify` cannot be.
#
# Runs every scripts/probe-*.sql against the local Supabase stack. Refuses a
# remote target: the probes insert fixtures, and a stray URL must never write
# into the hosted project.
#
# Not part of `pnpm verify`: CI and worktrees may have no Postgres. CI runs
# this as its own job with `supabase start`; locally it is best-effort.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
EXPECTED_SCHEMA="00026"   # bump in the same commit as the migration
ALLOW_HOST="${ALLOW_DB_HOST:-}"

fail() { printf 'FAIL %s\n' "$1" >&2; exit 1; }

# 1. Resolve the target. `supabase status` is the local stack's own answer.
if [ -n "${VERIFY_DB_URL:-}" ]; then
  DB_URL="$VERIFY_DB_URL"
elif command -v supabase >/dev/null 2>&1; then
  DB_URL="$(supabase status -o env 2>/dev/null | sed -n 's/^DB_URL="\(.*\)"/\1/p' | head -1)"
else
  fail "supabase CLI not found; install it or set VERIFY_DB_URL"
fi
[ -n "${DB_URL:-}" ] || fail "no local database URL; start the stack with 'supabase start'"

# 2. Refuse anything that is not local or an explicitly allowed CI host.
rest="${DB_URL#*://}"
rest="${rest#*@}"
if [[ "$rest" == \[* ]]; then
  host="${rest%%]*}]"
else
  host="${rest%%[:/]*}"
fi
case "$host" in
  localhost|127.0.0.1|::1|"[::1]") ;;
  *)
    if [ -z "$ALLOW_HOST" ] || [ "$host" != "$ALLOW_HOST" ]; then
      fail "refusing database host '$host' — verify-db runs only on localhost or ALLOW_DB_HOST"
    fi
    ;;
esac

# 3. The stack must be up. A hung image pull must fail, not stall the chunk.
if ! pg_isready -h 127.0.0.1 -p 54422 >/dev/null 2>&1; then
  command -v supabase >/dev/null 2>&1 || fail "database is down and supabase CLI is missing"
  echo "== starting the local Supabase stack (3 min cap) =="
  timeout 180 supabase start >/dev/null || fail "supabase start failed or timed out"
fi

# 4. The schema the probes were written for must be the schema on disk.
version="$(psql "$DB_URL" -Atqc "select max(version) from supabase_migrations.schema_migrations" postgres)"
[ "$version" = "$EXPECTED_SCHEMA" ] || \
  fail "schema is $version, expected $EXPECTED_SCHEMA — run 'supabase migration up --local' and bump EXPECTED_SCHEMA with the migration"

# 5. Serialise concurrent runs: the probes use fixed fixture ids. The advisory
#    lock is session-scoped and releases on disconnect.
echo "== probes =="
psql "$DB_URL" -v ON_ERROR_STOP=1 -q \
  -c "select pg_advisory_lock(hashtext('verify-db'))" \
  -f "$ROOT/scripts/probe-00024.sql" \
  -f "$ROOT/scripts/probe-00026.sql" \
  -c "select pg_advisory_unlock(hashtext('verify-db'))"

# 6. The TS/SQL narrative parity check, unchanged.
echo "== check-db =="
bash "$ROOT/scripts/check-db.sh"

echo "verify-db: PASS"
