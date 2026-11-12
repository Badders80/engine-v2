# CONTINUE — engine-v2 website

> Shape (LOCKED): **Next action · State · Ledger · Blocked**. Chat is not storage.

**Next action:** open
`/home/evo/sandbox/mvp/audits/landing-parity-2026-11-12/EVIDENCE.md` and
founder-walk this branch at 1440 and 390. After the integration decision,
resume F1 and then F3 from `dsl-sidequest`.

## State — 2026-11-12

**Landing parity is ready for the founder walk on `landing-parity-2026-11-12`**
at `73dd144` (code `5726a51`); the branch is pushed, worktree clean and not merged.

- Production-matched landing structure: hero, about, mission, model,
  marketplace, coming-soon news, FAQ and footer CTA.
- Final polish: hero image visible; wordmark-only nav; no nav divider; masked
  40px glass fade; 112px visual nav height with the 80px content row unchanged;
  300ms FAQ expansion with reduced-motion fallback.
- Gate: `just check` exit 0, **393 engine passed / 1 skipped, 54 website**, both
  builds. Landing audit passed on the initial diff; final refinement audit had
  one WARN for its read-only skipped build, then `just check` passed in the
  disposable audit clone.
- Evidence: `/home/evo/sandbox/mvp/audits/landing-parity-2026-11-12/`.
- Branch base is `6c42125`; `dsl-sidequest` has later docs tip `a7e48cc`, so
  reconcile before integration.

**The DSL side quest is closed on `dsl-sidequest`.** `main` untouched; nothing
pushed.

- **Chunk 4 — ledger — done** (`be5b3d4`, merged `72d7335`, audit 12/12 PASS):
  one atomic `record_sale_atomically`; the sale stores the executed snapshot and
  the sale-time start; the ledger reads the snapshot; close refuses open or
  unresolved holds; `sales` is append-only (update, delete, truncate refused).
- **Follow-ons this session:** `00026` paid_unfulfilled resolution (`014ad4b`);
  `just verify-db` (`221e25f`, hardened `6caffd2`); `00027` draft
  archive-in-place (`bae753f`); `00028` dateless-draft index (`5d8fc86`);
  `00029` closed-row immutability (`740c7e6`).
- **Images:** the checkout bucket check is removed (`567e052`); the generic
  placeholder was dropped (`81b5f5d`). The gallery stays blank until real images
  are added; `image_count` stays truthful.
- **Gate:** `pnpm verify` **393 engine / 1 skipped, 54 website**, both builds.
  `just verify-db` **27 + 7 + 2 + 3 + 5 probes**, `check-db` 6/6.
- **CI** (`482b6d6`): `pnpm verify` then `supabase start` + `db reset` +
  `just verify-db`, on every PR and branch push, no secrets.
- **Target database:** `evolution-engine` (`rkcptsghxovoeaycabah`, Sydney),
  **29 migrations** (`00001`–`00029`). 1 Mulan draft (`coming_soon`,
  unpublished, narrative approved), 0 sales, 1 horse, 1 party. The old project
  `ejdenhlpvtldiljxawtd` stays with the public site.
- **Plan of record + handoff:** `/home/evo/sandbox/v2/dsl-sidequest/` —
  `STATE.md`, `PLAN.md`, `EXECUTION-DOD-2026-11-09.md`, `PUBLIC-WRAP.md`,
  `HANDOFF-2026-11-11.md`; the rulebook is `sandbox/v2/rulebook/`.

## Ledger

| date | what | repo | commit | state |
|---|---|---|---|---|
| 2026-11-12 | Landing parity + nav/hero/FAQ refinement | engine_v2/website | `c1ca04e`…`5726a51` | done; founder walk pending |
| 2026-11-12 | wrap notes and branch publication | engine_v2/website | `73dd144` | pushed |
| 2026-11-11 | Images — checkout unblocked; placeholder dropped | engine_v2/website | `81b5f5d` | done |
| 2026-11-11 | DSL 4 — ledger, resolution, archive, SQL gate, CI | engine_v2/website | `482b6d6` | done |
| 2026-11-10 | Images never block; wizard polish; wrap | engine_v2/website | `97598c4` | done |
| 2026-11-10 | DSL 3 — deal assembly | engine_v2/website | `73f65bb` / merge `3dfdac6` | done |
| 2026-11-10 | DSL 2 — profiles/roles + hardening | engine_v2/website | `e1f12f9` | done |
| 2026-11-10 | DSL 1d — profile polish (names, links, handles, edit routes, dev cache) | engine_v2/website | `d387225` | done |
| 2026-11-09 | DSL 1c — horse edit + trainer | engine_v2/website | `82a702d` | done |
| 2026-11-09 | DSL 1b — loveracing, barn name, slug law | engine_v2/website | `e30e50c` | done |
| 2026-11-09 | DSL 1 — records, home, forms | engine_v2/website | `8b6baf4` | done |
| 2026-11-09 | Target Supabase created, replayed, parity, connected | — | — | done |
| 2026-11-09 | Wrap | engine_v2/website | — | done |

## Blocked

- **Landing parity integration:** founder visual walk at 1440 and 390, then
  decide whether to reconcile with `dsl-sidequest` and merge. The branch is
  already pushed; no merge before that gate.
- **Cloudflare Access** on the engine host — `/sales` has no in-app auth; do not
  expose the host without it.
- **F3** — external immutable document archive + manifest. **Priority.**
- **F1 / F2 / F4 / F5** — contract ID; post-sale term freeze; offsite backup;
  recovery drill.
- **Mumbai project** `umxljalfbmvrocaopao` — confirm deleted.
- **Keys** — the service-role JWT was pasted into chat; rotate in one batch at
  cutover (ruled, not blocking).
