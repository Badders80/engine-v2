# CONTINUE — engine-v2 website

> Shape (LOCKED): **Next action · State · Ledger · Blocked**. Chat is not storage.

**Next action:** say **`go chunk 2`** — open `/home/evo/sandbox/v2/dsl-sidequest/EXECUTION-DOD-2026-11-09.md`
§ Chunk contracts and start **H2 (status is a machine)** at `engine/src/lib/dsl.ts:57-66`:
`checkStatusTransition` ignores `from`, so encode the edges plus the no-op and
initial rows, in TS and in the trigger (`00021`).

## State — 2026-11-09

**The DSL side quest is running on its own branch.** `dsl-sidequest` off `main`
@ `0095106`; three commits, none pushed, none merged.

- **Chunk 1 — Records, Home, forms** (`8b6baf4`, audit PASS): console theme tokens,
  shared form primitives, `/` index, `/horses` tile grid, horse profile, horse-only
  `/horses/new`, the six trainer/owner profile fields (`00019`), and the
  `border-black` ban (whole-tree rule in `scripts/assert-design-tokens.sh`).
- **Chunk 1b — loveracing load, barn name, slug law** (`e30e50c`, audit PASS):
  the loader fetches through `curl_cffi` (`engine/scripts/loveracing-fetch.py`) —
  plain fetch is blocked by Cloudflare — and parses the real Stud Book markup.
  Both `/Breeding/{id}/…` and `/stud-book/{id}/…` work. `horses.barn_name`
  (`00020`), optional and null when it repeats the legal name. Slugs drop the
  `(NZ)` suffix; the unnamed `sire-x-dam-yr` rule is implemented and tested.
- **Chunk 1c — horse edit** (`82a702d`, audit PASS): `/horses/[id]/edit`,
  `updateHorseAction`, the shared `HorseForm`, an Edit link on the profile. The
  trainer and barn name are authorable after creation; the slug is fixed.
- **Gate:** `pnpm verify` green — **343 engine / 54 website**.
- **Target database:** new hosted Supabase `evolution-engine`
  (`rkcptsghxovoeaycabah`, Sydney). 20 migrations replayed, zero-rows gate,
  schema parity 171/171, migration history recorded —
  `supabase db push --dry-run` says *up to date*. `engine/.env.local` points at it.
  The old project `ejdenhlpvtldiljxawtd` stays untouched with the public site.
- **Data:** Mulan The Brave (NZ), slug `mulan-the-brave`, registered; 0 trainers,
  0 owners, 0 DSLs. The local 54422 stack is scratch only.
- **Chunks 2–4 remain:** harden (`00021`), deal assembly, ledger (`00022`).
- **Plan of record:** `/home/evo/sandbox/v2/dsl-sidequest/` — `STATE.md` (position),
  `PLAN.md` (what), `EXECUTION-DOD-2026-11-09.md` (how we run: gate, decision
  policy, tools, audits), `PUBLIC-WRAP.md` (deferred public work).

## Ledger

| date | what | repo | commit | state |
|---|---|---|---|---|
| 2026-11-09 | DSL 1c — horse edit + trainer | engine_v2/website | `82a702d` | done |
| 2026-11-09 | DSL 1b — loveracing, barn name, slug law | engine_v2/website | `e30e50c` | done |
| 2026-11-09 | DSL 1 — records, home, forms | engine_v2/website | `8b6baf4` | done |
| 2026-11-09 | Target Supabase created, replayed, parity, connected | — | — | done |
| 2026-11-09 | Wrap | engine_v2/website | — | done |

## Blocked

- **Chunk 2** — waits on the founder's `go`.
- **Backups** — the free tier has none and this is now the target authority:
  Pro plan or a scheduled `pg_dump`. Founder's call.
- **Sale fixture** — `sales` is empty and chunk 4's proof walks one. Create it
  deliberately at chunk 4.
- **Mumbai project** `umxljalfbmvrocaopao` — confirm deleted.
- **Keys** — the service-role JWT was pasted into chat; all keys rotate in one
  batch at cutover (ruled, not blocking).
