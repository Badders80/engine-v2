# CONTINUE — engine-v2 website

> Shape (LOCKED): **Next action · State · Ledger · Blocked**. Chat is not storage.

**Next action:** open
`/home/evo/sandbox/mvp/sessions/active/2026-11-13-marketplace-mystable.md` and run
the read-only production Marketplace audit from a clean worktree based on
`origin/dsl-sidequest`. Do not work in the shared checkout that contains the
uncommitted legal/checkout changes.

## State — 2026-11-13

- **Landing parity is merged and pushed** on `dsl-sidequest` at merge commit
  `03ea397`; founder visual walk accepted.
- **Shared page foundation is locked and pushed** at `ade0cc3`: global
  `ScrollReveal`, `--duration-reveal: 750ms`, `PageShell`, `PageContainer`,
  `PageIntro`, `PageSection`, no page-level separator rule, and pathname-scoped
  reveal re-arming on client navigation.
- Marketplace, horse page and MyStable now consume the shared primitives; the
  Marketplace production audit and visual implementation remain the next work.
- Integrated gate after the foundation: **402 engine passed / 1 skipped, 63
  website passed**, both builds.
- The shared checkout still contains unrelated uncommitted legal/checkout work;
  preserve it and isolate new website work in a separate worktree.

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
  **30 migrations** (`00001`–`00030`). 1 Mulan draft (`coming_soon`,
  unpublished, narrative approved), 0 sales, 1 horse, 1 party. The old project
  `ejdenhlpvtldiljxawtd` stays with the public site.
- **Plan of record + handoff:** `/home/evo/sandbox/v2/dsl-sidequest/` —
  `STATE.md`, `PLAN.md`, `EXECUTION-DOD-2026-11-09.md`, `PUBLIC-WRAP.md`,
  `HANDOFF-2026-11-11.md`; the rulebook is `sandbox/v2/rulebook/`.
- **Investor Pack (PDS + SA) — done:** `engine/scripts/legal-package.ts` loads
  the saved DSL/horse/trainer/owner or a checked-in fixture, renders one
  combined Investor Pack PDF with ReportLab, and writes the exact-byte hash,
  PDS/SA source hashes, eight template hashes, provenance and six-field manifest
  into a write-once local directory. Gate: `bash scripts/legal-package-dod.sh`.
- **Formal Investor Pack assembly — done 2026-11-13:** page 1 is a cover, page 2
  is one contents page indexing both legal sections and all subsections, the PDS
  starts on a fresh page and the SA starts on a later fresh page. Contents page
  numbers are generated from final pagination. The gate verifies every indexed
  heading against the PDF body. Typography uses justified `9.5/13.9` body prose,
  a three-level heading hierarchy, 20mm margins, restrained rules, section-aware
  running headers and `Page N of M` page furniture.
- **Saved-record proof:** current Mulan DSL
  `5a46be50-41be-4fca-a554-793d5f1562fa` produced
  `/home/evo/sandbox/mvp/out/legal/ES-DSL-2026-900018/contract.pdf`; verifier
  PASS, 15 pages, legal pack `1.0.4`, PDS page 3, SA page 10 and 54 indexed
  headings. This is the current formal **Investor Pack (PDS + SA)**.
- **Previous proofs:** `ES-DSL-2026-900006` remains the pre-cover proof and
  `ES-DSL-2026-900007` remains the formal pre-polish proof. `ES-DSL-2026-900008`
  remains the polish proof before true body justification. `ES-DSL-2026-900009`
  remains the justified proof before the v1.0.3 legal redlines.
  `ES-DSL-2026-900011` remains the v1.0.3 proof before structural pagination
  fixes. `ES-DSL-2026-900012` remains the structural proof with dot-leader
  contents. `ES-DSL-2026-900013` remains the no-dot-leader proof before final
  density tuning. `ES-DSL-2026-900014` remains the density proof before the
  declarations and proof-of-address wording were aligned. None may be overwritten.
- **Mulan terms:** $60 wholesale / $65 retail per 1% per month; 75% investor
  return; 5% listed; 1% minimum; 0.5% step; subscription float; 14-day break;
  quarterly distributions; expiry 30 Jun 2028. Status remains `coming_soon` and
  unpublished.
- **Expense pricing:** expense rates are additive against wholesale. The current
  5% margin + 3% platform fee applies `ceil(wholesale × 1.08)`, not
  `ceil(wholesale × 1.05 × 1.03)`. Future expense rates join the same sum.
- **Gate:** `pnpm verify` exit 0; engine **402 passed / 1 skipped**, website
  **64 passed**, both builds. `just verify-db` PASS at schema `00031`.
- **Independent audit:** raw Ollama `kimi-k2.7-code` passed claims 1–5 and 7.
  Its initial claim-6 WARN found that the DOD was not wired into CI. CI now
  installs ReportLab + Poppler and runs the DOD after `pnpm verify`. The
  re-audit passed all three CI claims; its extra action-version warning was a
  false positive verified against live tags (`actions/checkout@v7`,
  `pnpm/action-setup@v6`, `actions/setup-node@v7` all exist).
- **Audit record:** `/home/evo/sandbox/mvp/audits/RAW-OLLAMA-AUDIT-2026-11-12.md`.
- **F1 acceptance persistence — done 2026-11-13:** checkout sessions now store
  PDS/SA acceptance timestamps, the canonical declaration snapshot, typed
  signature and recording time. The evidence is immutable and Stripe cannot bind
  the checkout until it exists. The sale remains linked by `checkout_session_id`.

## Ledger

| date | what | repo | commit | state |
|---|---|---|---|---|
| 2026-11-13 | F1 acceptance persistence: immutable PDS/SA declarations, typed signature and Stripe precondition | engine_v2/website | — | done |
| 2026-11-13 | Landing parity merged; shared page foundation locked | engine_v2/website | `03ea397`, `ade0cc3` | done; pushed |
| 2026-11-13 | Legal pack 1.0.4 aligned SA and checkout declarations; KYC and proof of address deferred as future obligations | engine_v2/website | — | done |
| 2026-11-13 | Investor Pack presentation baseline checkpointed at legal pack 1.0.3 | engine_v2/website | — | done |
| 2026-11-13 | Final density pass: compact type, uppercase subsections and signature grids | engine_v2/website | — | done |
| 2026-11-13 | Contents page refined to whitespace-aligned hierarchy without dot leaders | engine_v2/website | — | done |
| 2026-11-13 | Structural layout pass: break control, clause hierarchy and schedule tables | engine_v2/website | — | done |
| 2026-11-13 | Legal pack 1.0.3 redlines, Investor terminology and grayscale polish | engine_v2/website | — | done |
| 2026-11-13 | Body prose corrected to true justified alignment | engine_v2/website | — | done |
| 2026-11-13 | Legal-document typography polish and running page furniture | engine_v2/website | — | done |
| 2026-11-13 | Formal Investor Pack cover, indexed contents and fresh-page sections | engine_v2/website | — | done |
| 2026-11-12 | docs: wrap 2026-11-12 — resume at F1 | engine_v2/website | this commit | done |
| 2026-11-12 | Voluntary exit, default notice, wind-up, additive pricing, headless PDS/SA package and CI gate | engine_v2/website | `89ac971` | done |
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

- **Cloudflare Access** on the engine host — `/sales` has no in-app auth; do not
  expose the host without it.
- **F3** — external immutable document archive + manifest. **Priority.**
- **F1 remaining** — persist the generated contract ID through DB sale storage;
  separate the signature/executed date from the selectable whole-month term
  start; carry both through quote, documents, checkout and the frozen sale
  snapshot; add the post-sale executed Investor Pack and email handoff.
  Acceptance evidence is done. Declarations remain inside the SA; no third doc.
- **F2 / F4 / F5** — post-sale term freeze; offsite backup; recovery drill.
- **Mumbai project** `umxljalfbmvrocaopao` — confirm deleted.
- **Keys** — the service-role JWT was pasted into chat; rotate in one batch at
  cutover (ruled, not blocking).
