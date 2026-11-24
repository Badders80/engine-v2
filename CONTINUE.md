# CONTINUE — engine-v2 website

> Shape (LOCKED): **Next action · State · Ledger · Blocked**. Chat is not storage.

**Next action:** open `audits/cloud-supabase-pilot-2026-11-24/chunk-6/result.json`,
review the last saved failure, then rerun `scripts/run-chunk.sh 6`; the runner now
uses migrations plus a data-only backup restore and automatically recovers the pilot.

## State — 2026-11-25

- **Cloud pilot Chunks 4 and 5 are accepted.** Chunk 4 passes 18/18 checks on
  pilot `sjzhbssggonojtodcuzb` with 6 horses, 4 parties, 5 roles, 1 DSL, 0 sales
  and 0 checkouts. Chunk 5 passes 27/27 cloud smoke checks, including the
  browser walk, Mulan-only public visibility, private-row denial, disabled buying
  and a real draft Investor Pack PDF.
- **Chunk 5 gate:** `pnpm verify` passes; engine 434 passed / 1 skipped, website
  66 passed, both builds compile. The Supabase SSR read, cookie, and Vitest alias
  defects found during the walk are fixed in the worktree.
- **Chunk 6 is wrapped mid-proof.** Free-plan PITR and preview branches are
  unavailable. A data-only backup exists, disposable project
  `bnxytinikttypaxixemw` is paused, and the active pilot is healthy, relinked and
  still at 6/4/5/1/0/0. The saved Chunk 6 evidence is the earlier restore failure;
  rerun the fixed runner tomorrow.
- **Protected local source is unchanged:** normalized checksum
  `87022bbd77b62fff4a17926d0b09fed05b1f7fc4906ce366e576d12232450ee1`.

## State — 2026-11-24

- **Hottathanafantasy soft content is founder-approved and saved locally.** All
  three DB fields match the approved source hashes; the paragraphs are 105 / 127
  / 58 words. The exact approved text remains preserved under Blocked for replay
  because the local proof data is not migration-backed.
- The other five horses have soft content. Local totals remain six horses, three
  trainer roles, two owner roles across four party rows, one **Published DSL**
  (Mulan), zero sales and zero checkouts.

## State — 2026-11-23

- **The local horse set now contains all six production horses:** First Gear,
  Hottathanafantasy, I Stole A Manolo, Lady Ketchikan, Mulan The Brave and
  Prudentia. First Gear's three soft-content paragraphs are approved and saved.
  Every horse's R2 image `01` is byte-identical to the corresponding production
  cover in `engine/website/apps/web/public/images/content/horses`; gallery image
  counts and order are recorded on the horse rows.
- **Current local database count:** six horses, three trainer roles, two owner
  roles across four party rows (Stephen Gray Racing is trainer and owner), one
  **Published DSL** (Mulan), zero sales and zero checkouts. Manolo's three soft
  sections are approved and saved; Hottathanafantasy still needs soft content.
  Neither horse has a DSL yet. The operating rule is one horse, one DSL for the
  pilot; no schema constraint is being added.
- **Existing production cover images live in the legacy build at
  `/home/evo/evolution/engine/website/apps/web/public/images/content/horses/`.**
  Horse gallery images live separately at
  `/home/evo/evolution/engine/website/apps/web/public/horses/{slug}/`. Use these
  local production assets when migrating media; do not scrape the live website.
- **DSL lifecycle terminology is live across operator surfaces.** The DSL list,
  term sheet, horse profile and sales ledger now render **DSL**, **Published
  DSL** or **Executed DSL**. The state is derived from the existing `published`
  flag plus the presence of at least one sale; inventory status remains intact.
- **Gate:** `pnpm verify` exit 0; engine **434 passed / 1 skipped**, website
  **66 passed**, both production builds pass.

## State — 2026-11-22

- **Mulan soft content is founder-approved and locked locally.** The three
  Records blocks pass preflight at 121, 136 and 58 words. Their source hashes
  are `13d7b6ac…3432`, `3f7e2517…d784` and `1455ef9c…9240`.
- **Mulan race record refreshed from Loveracing:** one start, ninth over 1300m
  in the Central ITM Carterton Maiden at Tauherenikau on 2026-11-08, with
  NZ$370 stakes recorded.
- **Barbara Kennedy trainer profile refreshed from official sources.** The bio,
  achievements, contact block, Facebook presence and five source links are
  updated. Loveracing snapshot at 2026-11-22: 28 wins from 209 starts,
  NZ$838,810 stakes and one Group or Listed win; 25 horses in training.
- **Wexford and Stephen Gray trainer profiles refreshed from official sources.**
  Both pages now carry dated achievements, verified stable biographies,
  contacts, social links and official source links. X is linked to
  `@WexfordStables` and `@copperbelt_stc`. Loveracing snapshots at 2026-11-22:
  O'Sullivan & Scott have 612 wins from 4,619 starts and 82 horses in training;
  the Kevin & Stephen Gray partnership has 64 wins from 490 starts and 78
  horses. The Stephen Gray website is linked over HTTP because its HTTPS
  certificate does not match the hostname. The Records display name is
  **Stephen Gray Racing**, the stable company is **Stephen Gray Racing (SGR)**,
  and the licensed trainer partnership is recorded as Kevin & Stephen Gray.
- **Stephen Gray Racing is the first owner record.** The existing SGR party now
  holds both `trainer` and `owner` roles; there is no duplicate owner party.
  Both `/trainers/{id}` and `/owners/{id}` resolve the same shared profile.
- **B.A.X Bloodstock is the second owner record, with Kylie Bax as contact.**
  The profile was migrated from `engine/content/owners/kylie-bax.md` and
  `bax-bloodstock.md`: the legal owner is B.A.X Bloodstock Achieving Xcellence
  Limited, the public/display name is B.A.X Bloodstock, and Kylie Bax is the
  principal and manager. No duplicate person-as-owner row was created. Her two
  verified X accounts are recorded: `@BAXLTD` as the primary social handle and
  `@conistonlodge` in the owner links. The profile now includes her Cambridge /
  Waikato base, official website, Facebook, Instagram, public contact details,
  boutique ownership and lease-syndication model, and the notable winners
  published by B.A.X. NZTR authorised-syndicator status and horse purchase
  prices are not asserted because the current official sources do not verify
  them.
- **Owner profile parity restored.** The owner view now shows company/stable and
  location alongside contact and website, so shared SGR fields no longer drop
  when switching from the trainer route to the owner route.
- **DSL term-sheet layout polished.** Header actions now meet 44px touch
  targets, narrative/publication are grouped as responsive panels, term rows
  use compact labels with constrained prose measure, and horse images render
  as a responsive gallery. No DSL business logic changed.
- **Legal preview is now a real draft Investor Pack PDF.** `/dsl/{id}/legal`
  compiles through the shared draft resolver, renders the same cover + contents
  + PDS + SA ReportLab pack as execution, and serves it through a no-store PDF
  endpoint. The page displays the exact PDF SHA-256 and page count, downloads
  the draft bytes and embeds a page-navigable PDF viewer. Current Mulan preview:
  15 A4 pages with declarations on PDS pages 8–9 and SA page 15. It writes no
  sale row and stores no document.
- **Operator lifecycle terminology is locked and derived in code:** **DSL**
  means assembled but not live, **Published DSL** means live on the website,
  and **Executed DSL** means at least one completed investment has written a
  sale. The stored inventory status and `published` flag remain unchanged.
- This approval pins the three Records paragraphs only. No DSL exists, so the
  DSL-level four-slot `narrative_signoff` is not set. Identity, pedigree and
  images were not changed.

## State — 2026-11-21

- **Horse image cover and gallery order are implemented locally.** Migration
  `00033` stores `horses.image_order`; position 1 is the cover. The Records image
  section has an explicit edit mode with drag-and-drop cards plus arrow controls
  for touch and keyboard, and the engine cards, DSL term sheet, Marketplace hero
  and Marketplace gallery consume the saved sequence. R2 keys remain immutable
  `01..NN`; upload appends, delete remaps and recount reconciles.
- **Gate:** `pnpm verify` exit 0; engine **426 passed / 1 skipped**, website
  **66 passed**, both builds. `just verify-db` passes schema `00033` and its new
  image-order probe.
- **Founder Prudentia ordering walk passed on 2026-11-21.** The saved vector is
  `{5,2,3,1,4}`: image 5 is the cover, followed by images 2, 3, 1 and 4. The local
  dev engine is served against local Supabase at `http://127.0.0.1:3001`.

## State — 2026-11-20

- **Horse intake is merged and pushed on `dsl-sidequest`.** A Loveracing Stud Book
  URL now captures the horse record, a strict 15-node four-generation pedigree and
  the NZTR aggregate race summary. The summary stores starts, wins, seconds,
  thirds, stakes, source and retrieval time; the full Performance Profile remains
  deferred. A missing or malformed summary refuses the import rather than writing
  false zeroes. Merge `8432fd4`; branch proof `00af8a7` and `38fdf02` are pushed.
- **Soft-content authoring is integrated at `7b55702`.** The reusable brief is
  `engine/public/soft-content-guide.md` and is linked from every horse profile.
  Saves block empty fields, Markdown and the legal compiler's banned terms;
  section-length targets are non-blocking warnings. The engine stores and gates
  the prose but never generates it.
- **Local v2 proof database:** three horse rows and zero DSLs. Mulan has 15
  pedigree nodes and 3 active R2 images; Lady Ketchikan has 15 nodes, 0-start race
  summary, 6 images and all three soft blocks saved; Prudentia has 15 nodes, 10
  starts / 2 wins / NZ$36,585, 5 images and all three soft blocks saved. Mulan's
  three soft blocks are still empty and its local `race_record` predates the new
  summary shape.
- **R2 is clean for the active slugs:** `mulan-the-brave/01..03`,
  `lady-ketchikan/01..06`, `prudentia/01..05`. The obsolete
  `mulan-the-brave-nz/01..03` objects were permanently removed.
- **Local trainer proof exists but is on hold:** Barbara Kennedy, the joint
  Wexford partnership of Lance O'Sullivan & Andrew Scott, and Stephen Gray exist
  in local `parties` + `party_roles` with bios. They are manual test data, not a
  migration, and do not exist in hosted v2.
- **Gate:** `pnpm verify` exit 0 at the soft-content commit; engine **417 passed
  / 1 skipped**, website **64 passed**, both builds. `just verify-db` passed at
  schema `00032`.
- **Hosted v2 was not updated:** the target Supabase hostname cannot be resolved
  from this environment. All horse, trainer, soft-content and image-count work in
  that target still needs a deliberate replay/verification.
- Unrelated local work remains preserved: modified `engine/tsconfig.json` and
  untracked `website/.impeccable/`.

## State — 2026-11-13

- **Four-generation pedigree capture — done on
  `pedigree-capture-2026-11-13`:** the add-horse Loveracing loader accepts a
  Stud Book URL, follows the sire and dam profile links, and stores exactly 15
  nodes with provenance: 1 horse, 2 parents, 4 grandparents and 8
  great-grandparents. Migration `00032_horse_pedigree.sql` adds the versioned
  `horses.pedigree` jsonb snapshot; the load, profile and edit screens consume
  it. Live Mulan proof: `460867` persisted as `0:1, 1:2, 2:4, 3:8`.
- **Race summary capture — done on the same branch:** the loader also calls
  NZTR's pedigree endpoint for the exact aggregate summary (starts, wins,
  seconds, thirds, stakes) and stores it with source and retrieval time inside
  `race_record`. The runner-by-runner Performance Profile remains deferred; a
  summary failure refuses the import rather than presenting a false zero.
- **Soft-content authoring brief — integrated:** `engine/public/soft-content-guide.md`
  is the reusable external-chat brief, linked from every horse profile. The
  soft-content save now refuses empty fields, Markdown and compiler-banned terms;
  section-length targets are warnings. The engine remains the store and gate, not
  the prose generator.
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

**The original DSL side quest closed on `dsl-sidequest`; it is now pushed and
continues through the horse-intake work above.**

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
  return; 5% listed; 0.5% minimum; 0.5% step; subscription float; 14-day break;
  quarterly distributions; expiry 30 Jun 2027. Status remains `coming_soon` and
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
- **Feature commit:** legal pack `1.0.4`, Investor Pack presentation and
  acceptance persistence are committed at `dbd0184` on `dsl-sidequest`.
- **Marketplace plan preserved:** `/home/evo/sandbox/mvp/sessions/active/2026-11-13-marketplace-mystable.md`
  remains active after the checkout scroll-mapping session.

## Ledger

| date | what | repo | commit | state |
|---|---|---|---|---|
| 2026-11-25 | Cloud pilot Chunks 4–5 accepted; Chunk 6 durability proof wrapped mid-run | engine_v2/website; Supabase cloud | this commit | Chunk 5 PASS 27/27; pilot healthy; Chunk 6 BLOCKED pending rerun |
| 2026-11-24 | Hottathanafantasy soft content founder-approved and saved | engine_v2/website; local Supabase | this commit | done; DB hashes match approved source; 105 / 127 / 58 words |
| 2026-11-24 | Wrap after interrupted Hottathanafantasy soft-content save | engine_v2/website; local Supabase | this commit | approved copy preserved; DB remains unfilled |
| 2026-11-23 | I Stole A Manolo soft content approved and saved | engine_v2/website; local Supabase | this commit | done; 112 / 139 / 52 words |
| 2026-11-23 | Six-horse local seed, canonical covers and approved First Gear soft content | engine_v2/website; local Supabase/R2 | this commit | done; one published DSL, zero sales; cloud replay pending |
| 2026-11-23 | DSL / Published DSL / Executed DSL lifecycle wired into operator surfaces | engine_v2/website | local uncommitted | verified; 434 engine / 1 skipped, 66 website, both builds |
| 2026-11-22 | Real draft Investor Pack PDF preview with page navigation, hash and download | engine_v2/website | `8efdbeb` | verified; 15-page PDF, typecheck/lint/426 tests and production build pass |
| 2026-11-22 | DSL term-sheet formatting improved for desktop and mobile | engine_v2/website | local uncommitted | verified; typecheck, lint, detector and 426 tests pass |
| 2026-11-22 | B.A.X / Kylie Bax owner profile enriched from official BAX and public sources | engine_v2/website; local Supabase | — | verified; unconfirmed syndicator-status and purchase-price claims omitted |
| 2026-11-22 | B.A.X Bloodstock migrated as second owner; Kylie Bax stored as contact | engine_v2/website; local Supabase | — | done; legacy profile and locked entity name preserved |
| 2026-11-22 | Owner profile now displays shared company/stable and location fields | engine_v2/website | local uncommitted | verified; engine typecheck, lint and 426 tests pass |
| 2026-11-22 | Stephen Gray Racing added as first owner without duplicating the trainer party | engine_v2/website; local Supabase | — | role `owner` added; shared party holds trainer + owner |
| 2026-11-22 | Wexford and Stephen Gray trainer profiles enriched and source-linked | engine_v2/website; local Supabase | — | done; official stats snapshot dated 2026-11-22 |
| 2026-11-22 | Barbara Kennedy trainer profile enriched and source-linked | engine_v2/website; local Supabase | — | done; official stats snapshot dated 2026-11-22 |
| 2026-11-22 | Mulan soft content approved and source-hashed; race record refreshed | engine_v2/website; local Supabase | — | locked locally; DSL sign-off pending when a DSL exists |
| 2026-11-21 | Horse image cover/order vector: migration `00033`, drag-and-drop edit mode, accessible arrows, engine and public hero/gallery consumption | engine_v2/website | local uncommitted | done; founder walk passed with Prudentia `{5,2,3,1,4}` |
| 2026-11-21 | Prudentia fifth-image upload founder-walked; local DB count and public R2 object verified | engine_v2/website | local DB/R2 | done |
| 2026-11-20 | Horse intake end-to-end: pedigree + race summary, soft-content brief/preflight, three local horse proofs and clean R2 image sets | engine_v2/website | `8432fd4`, `7b55702`; local DB/R2 | done; hosted replay pending |
| 2026-11-13 | Four-generation Loveracing pedigree capture, storage and live Mulan proof | engine_v2/website | — | done; uncommitted branch |
| 2026-11-13 | Legal pack 1.0.4, Investor Pack presentation and checkout acceptance persistence | engine_v2/website | `dbd0184` | committed |
| 2026-11-13 | Checkout scroll-mapping next-session plan created | sandbox/mvp | — | ready |
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

- **Chunk 6 durability proof is incomplete.** The last saved
  `audits/cloud-supabase-pilot-2026-11-24/chunk-6/result.json` is the old restore
  failure. The runner now replays schema into the disposable target before a
  data-only restore, then resets/replays/seeds and checks parity twice. Rerun
  `scripts/run-chunk.sh 6`; do not treat the temporary project as accepted yet.
- **Disposable durability project** `bnxytinikttypaxixemw` is paused. Its mode-600
  password is `/home/evo/.supabase/pilots/bnxytinikttypaxixemw.dbpass`. Chunk 6
  reuses this project, pauses it at exit and resumes/relinks the pilot.
- **Chunk 7 remains locked** until Chunk 6 produces a PASS and is accepted.

- **Hottathanafantasy's approved soft-content copy remains unseeded.** It is
  saved in local Supabase, but the local proof data is not migration-backed.
  Preserve this copy for replay after a reset or hosted migration:

```text
About the horse
Hottathanafantasy is a New Zealand-bred bay filly foaled on 24 October 2023, by Contributer out of Whiffle. Bred by Goldeye Trust, she is prepared by Lance O’Sullivan and Andrew Scott at Wexford Stables in Matamata.

She remains unraced. Wexford’s Andrew Scott described her as “a snappy little filly who came a long way very quickly,” reflecting the regard for her early development within the stable.

Wexford Stables continues the legacy of Hall of Fame trainer Dave O’Sullivan, with the O’Sullivan–Scott partnership having prepared more than 600 winners and Group 1 winners including Waitak, Molly Bloom and Rocket Spade. Hottathanafantasy is developing inside that established programme.

Racing outlook and pedigree
Contributer was a dual Group 1 winner, taking the Chipping Norton Stakes over 1600m and Ranvet Stakes over 2000m in Australia. By High Chaparral and out of Serisia, he brings the Sadler’s Wells and European classic-distance influence associated with his sire line. His other notable wins included the Group 2 Apollo Stakes, Group 3 David Jones Cup and Listed Wolferton Handicap.

Whiffle is by Red Ransom, while the next dam, Whist, is by Mr. Prospector. The family continues through Wajd, by Northern Dancer, and Dahlia, winner of 15 races across four countries, including two King George VI and Queen Elizabeth Stakes. That background gives Hottathanafantasy a pedigree shaped by proven middle-distance and staying influences. Her distance range will be determined by the Wexford team as she develops.

Race expectation
Hottathanafantasy remains unraced, with no official starts recorded. Her trial and race programme will be set by the Wexford team according to fitness, education and nominations. No debut date or target is fixed. Members will receive stable updates as her preparation develops and will be notified once the next step is confirmed and entered in the race record.
```

- **Lifecycle implementation is still uncommitted.** The lifecycle utility,
  tests, operator-surface wiring and legal-gate correction are present on
  `dsl-sidequest` but not committed. Preserve them with the pre-existing
  `engine/tsconfig.json` and `website/.impeccable/` worktree changes; do not reset
  the branch before reviewing and committing that code.
- **Hosted v2 replay** — `rkcptsghxovoeaycabah.supabase.co` is unreachable from
  this environment. Re-run migrations and verify the six horse rows, R2 counts,
  soft content, trainer/owner parties and the Mulan DSL against the hosted target
  before relying on it.
- **Local proof data is not migration-backed** — horse rows, trainer parties and
  saved soft content live in local Supabase only. A reset removes them; preserve
  them in an idempotent seed or re-enter through the operator UI.
- **Trainer rollout is on hold** by founder decision. Resolve duplicate matching
  and hosted-v2 access before turning the three local trainer profiles into a
  durable seed.

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
