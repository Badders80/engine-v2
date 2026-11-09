# CONTINUE — engine-v2 website

> Shape (LOCKED): **Next action · State · Ledger · Blocked**. Chat is not storage.

**Next action:** say **`go chunk 3`** — open `/home/evo/sandbox/v2/dsl-sidequest/STATE.md`
§ Chunk 3 and start at **U4 (the term sheet)**, then U7, U11, U14 and U10. No
migration: the sign-off columns landed in `00021`.

## State — 2026-11-10

**The DSL side quest is running on its own branch.** `dsl-sidequest` off `main`
@ `0095106`; `main` is untouched; nothing pushed.

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
- **Chunk 1d — profile polish found necessary in use** (2026-11-10, no separate
  audit; the chunk-2 audit covers it): deduplicated profile headings; trainer =
  Company name + one or more Trainer names joined `' & '`; links as a raw
  registry with add/remove (title fetching removed); social URLs render as
  handles; `/trainers/[id]/edit` and `/owners/[id]/edit` use the horse Edit
  pattern; `NEXT_DIST_DIR` isolates a dev server from a build.
- **Chunk 2 — one profile, roles + hardening** (`e1f12f9`, audit PASS):
  `parties` + `party_roles` replace `trainers`/`owners`; DSL FKs point at
  parties; the status matrix lives in TS and the `00021` trigger; one `dsls`
  write; four readiness guards; narrative sign-off columns; horse authoring
  loses the trainer; admin stops quoting the wholesale total.
- **Gate:** `pnpm verify` green 2026-11-10 at `e1f12f9` — **345 engine / 54
  website**, both builds.
- **Target database:** new hosted Supabase `evolution-engine`
  (`rkcptsghxovoeaycabah`, Sydney). 21 migrations replayed (`00001`–`00021`),
  schema parity **326/326** manifest lines identical local ↔ hosted, migration
  history recorded —
  `supabase db push --dry-run` says *up to date*. `engine/.env.local` points at it.
  The old project `ejdenhlpvtldiljxawtd` stays untouched with the public site.
- **Data:** 1 party (trainer role), 1 horse — Mulan The Brave (NZ), registered —
  0 DSLs, 0 sales. The local 54422 stack is scratch only.
- **Chunks 3–4 are LOCKED** (2026-11-10): deal assembly, ledger (`00022`).
  Contents are in `STATE.md` and change only by ruling.
- **Plan of record:** `/home/evo/sandbox/v2/dsl-sidequest/` — `STATE.md` (position),
  `PLAN.md` (what), `EXECUTION-DOD-2026-11-09.md` (how we run: gate, decision
  policy, tools, audits), `PUBLIC-WRAP.md` (deferred public work).

## Ledger

| date | what | repo | commit | state |
|---|---|---|---|---|
| 2026-11-10 | DSL 2 — profiles/roles + hardening | engine_v2/website | `e1f12f9` | done |
| 2026-11-10 | DSL 1d — profile polish (names, links, handles, edit routes, dev cache) | engine_v2/website | `d387225` | done |
| 2026-11-09 | DSL 1c — horse edit + trainer | engine_v2/website | `82a702d` | done |
| 2026-11-09 | DSL 1b — loveracing, barn name, slug law | engine_v2/website | `e30e50c` | done |
| 2026-11-09 | DSL 1 — records, home, forms | engine_v2/website | `8b6baf4` | done |
| 2026-11-09 | Target Supabase created, replayed, parity, connected | — | — | done |
| 2026-11-09 | Wrap | engine_v2/website | — | done |

## Blocked

- **Chunk 3** — waits on the founder's `go`.
- **Backups** — the free tier has none and this is now the target authority:
  Pro plan or a scheduled `pg_dump`. Founder's call.
- **Sale fixture** — `sales` is empty and chunk 4's proof walks one. Create it
  deliberately at chunk 4.
- **Mumbai project** `umxljalfbmvrocaopao` — confirm deleted.
- **Keys** — the service-role JWT was pasted into chat; all keys rotate in one
  batch at cutover (ruled, not blocking).
