# Repo gate. `just check` is what dispatch runs on a worktree.
check:
	pnpm verify

# Local-only parity gate. Not part of `check` or `pnpm verify`: CI and
# worktrees may have no Postgres. Run it where the local Supabase stack is up.
#
# The brief calls this `just check:db`, but just 1.21.0 rejects ':' in a recipe
# name, so the recipe is `check-db`. Same command, legal name.
check-db:
	bash scripts/check-db.sh
alias db := check-db

# The SQL gate. Runs every scripts/probe-*.sql against the local stack, then
# the narrative parity check. Refuses a non-local database, asserts the schema
# version, and takes an advisory lock so two runs cannot collide.
#
# Not part of `check` or `pnpm verify`: CI runs it as its own job with
# `supabase start`; locally it is best-effort.
verify-db:
	bash scripts/verify-db.sh
alias vdb := verify-db
