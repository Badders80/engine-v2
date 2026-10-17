---
version: 2
posture: "Dark, quiet, editorial."
source_of_truth: "The live landing page for values; this document for rulings."

colors:
  # Surfaces
  canvas:          "#030303"
  surface:         "#0a0a0a"
  raised:          "#111111"
  # Structure
  border:          "rgba(255,255,255,0.1)"
  edge:            "#9a9aa0"
  disabled:        "#62666d"
  # Text
  heading:         "#f8fafc"
  ink:             "rgba(255,255,255,0.5)"
  hover:           "#b9b3a9"
  muted-foreground: "#7c7c7c"
  # Accent
  gold:            "#d4a964"
  gold-hover:      "#c39853"
  on-gold:         "#0a0a0a"
  on-light:        "#0a0a0a"
  spot-mint:       "#00e599"
  # Semantic — never adjacent to mint
  status-active:   "#10b981"
  status-pending:  "#f59e0b"
  status-closed:   "#738396"
  destructive:     "#ef4444"
  # Legal document surface — scoped to .legal-doc
  legal-surface:     "#ffffff"
  legal-ink:         "#111111"
  legal-surface-alt: "#f5f5f5"
  legal-border:      "#dddddd"
  legal-checkbox:    "#b98a2f"

typography:
  sans:  "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
  mono:  "var(--font-geist-mono), ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace"
  serif: "var(--font-instrument-serif)"   # italic only; never var(--font-serif)
  scale:
    micro: 10px
    label: 11px
    body-small: 15px
    body: 16px
    card-heading: 18px
    section-heading: 36px
    section-heading-wide: 48px
    display: 64px
  weights: [300, 400, 500]       # 600 maps to 500
  leading:
    none: 1              # single-line controls, badges, pills
    display: 1.05        # every major heading — 64px page heading and 36/48px section headings
    heading: 1.25        # card and panel headings
    body: 1.625          # all prose
  tracking:
    label:   0.2em
    nav:     0.15em
    tag:     0.05em
    display: -0.04em

rounded:
  # The bare `rounded` utility maps to `--radius`, with no suffix. The generator
  # reads this `bare` key onto it; `bare` is frontmatter-only and not a utility name.
  bare: 8px     # -> --radius, alias onto sm
  xs: 8px       # alias onto sm
  sm: 8px
  md: 16px
  lg: 24px
  xl: 24px      # alias onto lg
  "2xl": 24px   # alias onto lg
  "3xl": 24px   # alias onto lg
  "4xl": 24px   # alias onto lg
  pill: 9999px
  # `rounded-none` (0) and `rounded-full` (9999px) are hardcoded in the utility
  # rather than themeable, and both are legal. `rounded-[...]` bypasses the theme
  # entirely and is banned in CI.

spacing:
  section: 224px              # marketing sections, fixed
  app-header-top: 128px       # functional headers (pt-32)
  app-header-bottom: 96px     # functional headers (pb-24)

motion:
  ease-enter: cubic-bezier(0.16, 1, 0.3, 1)
  ease-modal: cubic-bezier(0.32, 0.72, 0, 1)
  duration-micro: 140ms
  duration-hover: 200ms
  duration-step: 220ms
  duration-collapse: 300ms
  duration-modal-enter: 240ms
  duration-modal-exit: 160ms
  duration-shimmer: 2000ms
  scale-press: 0.98
  scale-lift: 1.02

z:
  local: [0, 10, 20]          # intra-component only
  grain: -1
  sticky: 30
  nav: 40
  drawer: 50
  modal: 60

elevation:
  panel:        "0 0 60px rgba(0,0,0,0.6)"
  modal:        "0 0 120px rgba(0,0,0,0.98)"
  float:        "0 30px 80px rgba(0,0,0,0.6)"
  card-hover:   "0 20px 40px rgba(0,0,0,0.45)"
  bevel:        "inset 0 1px 0 rgba(255,255,255,0.05)"
  glow-success: "0 0 8px rgba(16,185,129,0.6)"
  glow-gold:    "0 0 12px rgba(212,169,100,0.25)"

layout:
  container: max-w-6xl        # 1152px, every page surface and all chrome
  gutter: [px-12, md:px-16, lg:px-20]
  chrome_collapse: 768px
  touch_target: 44px

components:
  listing-card:     { variants: [standard, featured] }
  status-badge:     { variants: [active, pending, settled] }
  navigation:       { variants: [transparent, solid] }
  footer:           { variants: [with-tagline, links-only] }
  mobile-bar:       { variants: [default] }
  menu-drawer:      { variants: [default] }
  button:           { variants: [solid, ghost], treatments: [SolidPill, GhostPill, GlowPill] }
  figure-row:       { variants: [default, money], unit: [stacked, inline] }
  form-field:       { variants: [field, capsule] }
---

# Evolution Stables — Design System

## 1 · Overview

**Dark, quiet, editorial.** The system is a near-black stage, a restrained typographic hierarchy, and
one warm accent spent carefully. It is built to make a horse — a photograph, a name, a figure — the
brightest thing on the page, and to get out of its way.

**Posture.** Nothing here is decorative for its own sake. Every surface, rule and glow has a job, and
the jobs are few. The system earns trust by being legible, consistent and unhurried rather than by
being loud.

**Key characteristics**

- **Three surfaces and no fourth.** `canvas → surface → raised`. Depth comes from stepping and from
  hairlines, not from a shadow on everything.
- **One chromatic accent.** Gold carries **3–5% of the viewport**. It is never a surface, never a
  button fill, and never the focus ring.
- **Mono means money.** Geist Mono carries financials, hashes, countdowns and tabular figures — and the
  editorial voice: standfirsts and secondary-page eyebrows.
- **One serif word per page.** Instrument Serif, italic, gold. Nothing else.
- **One container, everywhere.** `max-w-6xl` with `px-12 md:px-16 lg:px-20`, on every page and all
  chrome. There are no per-page widths.
- **One focus ring.** Two pixels, four-pixel offset, `--color-edge`.
- **Zero debt.** No raw values at call sites, no second implementation of a job, no variant outside a
  closed list. Where a rule and a convenience disagree, the rule wins.

---

## 2 · Colours

Every colour is a named token. **No hex, `rgb()`, `rgba()` or raw palette utility appears outside the
theme file.** A token exists so that a decision has a name; an unnamed colour is a decision nobody made.

### Brand and accent

| Token | Value | Job |
|---|---|---|
| `--color-gold` | `#d4a964` | **The sole brand accent.** 3–5% of the viewport. Never a surface. Never called `accent` in new code |
| `--color-gold-hover` | `#c39853` | Hover only — never a surface, never a border |
| `--color-on-gold` | `#0a0a0a` | Text and icons on a gold fill. **White on gold is 2.17:1 and fails** |
| `--color-on-light` | `#0a0a0a` | Dark text on any white or near-white fill |
| `--color-spot-mint` | `#00e599` | One display word per page. Never adjacent to a status colour |

### Surface

| Token | Value | Job |
|---|---|---|
| `--color-canvas` | `#030303` | The page. Deliberately not `#000000` — the gap is what makes a stage |
| `--color-surface` | `#0a0a0a` | Cards, panels, raised UI |
| `--color-raised` | `#111111` | Elevated, hover and inset surfaces |
| `--color-border` | `rgba(255,255,255,0.1)` | Translucent, so it works over any surface. **Never replace it with an opaque grey** |
| `--color-edge` | `#9a9aa0` | The 3:1 control floor, secondary metadata, and **the one focus ring** |
| `--color-disabled` | `#62666d` | **Non-text only** — disabled borders and inactive structure. Never text |

### Text

| Token | Value | Job |
|---|---|---|
| `--color-heading` | `#f8fafc` | Headings and hero |
| `--color-ink` | `rgba(255,255,255,0.5)` | **Body copy.** Translucent, so it adapts to the surface beneath it |
| `--color-hover` | `#b9b3a9` | The warm hover tone. Hover only — never a surface, never a border |
| `--color-muted-foreground` | `#7c7c7c` | Secondary metadata, timestamps, helper text. Static |
| `--color-foreground` | `= var(--color-ink)` | Compatibility mapping onto the ink token. One direction; do not delete |

**`--color-ink` and `--color-muted-foreground` are about five RGB units apart.** The distinction is
mechanical and semantic, not visual: `ink` is translucent and adapts, `muted` is static. Do not expect
a visible hierarchy step between body copy and secondary metadata, and do not push them apart to
manufacture one.

### Semantic — status

Status colours are **semantic only** and **never appear adjacent to mint**.

| Token | Value | Role |
|---|---|---|
| `--color-status-active` | `#10b981` | Active, verified, live availability, and positive returns |
| `--color-status-pending` | `#f59e0b` | `fully_subscribed`, labelled **FULLY ALLOCATED**. Read as *demand still standing*, not as closure |
| `--color-status-closed` | `#738396` | Terminal — **completed**. A neutral slate with a deliberate blue lean |
| `--color-destructive` | `#ef4444` | Error, cancelled, declined |

**`status-closed` is a slate, not a true neutral** — it measures B−R +35, and that is intended. Do not
neutralise it: blue is what the original defect looked like, and this value was chosen to stay in the
terminal family while clearing AA.

### Legal document surface

The white PDS/SA read inside the dark flow. **Scoped to `.legal-doc` and nowhere else.**

| Token | Value | Note |
|---|---|---|
| `--color-legal-surface` | `#ffffff` | |
| `--color-legal-ink` | `#111111` | |
| `--color-legal-surface-alt` | `#f5f5f5` | Table headers |
| `--color-legal-border` | `#dddddd` | **Deliberate** — a document hairline, not a control boundary. Do not "fix" it |
| `--color-legal-checkbox` | `#b98a2f` | Clears the 3:1 control floor |

### Retired — do not use

`ash #575757` and `smoke #454545` fail contrast. `hairline #050505` is imperceptible against the
canvas. `stage-black #000000` has no call sites. The `l1–l4` ladder was retired on 2026-09-22.

### Two traps

- **`text-muted` is not muted text.** The compatibility slot maps `--color-muted` to the *raised
  surface* `#111111`, so `text-muted` renders near-black type on a near-black canvas. **`--color-muted`
  is SURFACE ONLY and must never carry type.** It is not deprecated and must not be removed: shadcn
  components are written against that name, so deleting it means patching every future `shadcn add`.
  The token is correct; only its name is a trap. Dim type is always `muted-foreground` (`#7c7c7c`), and
  where a surface is meant, name `--color-raised` directly.
- **`--color-accent` is an alias for gold and is used widely in existing code.** The prohibition is on
  *new* names, not a reason to rewrite a working alias.

---

## 3 · Non-negotiables

Four rulings that survive from the brand system. They are not preferences and they are not open.

**1 · Retired faces stay retired.** Geist Sans was retired on 2026-09-22 and lives in the retired
folder. It must not be reintroduced, and `brand/fonts/` must never be copied wholesale — it holds a
retired face and a logo-only face.

**2 · One serif word per page.** Instrument Serif is *reserved drama*: a single italic gold word inside
a page headline, and nothing else. It arrives through `next/font` as `var(--font-instrument-serif)` —
there is no `.woff2` to find, and its absence is not a missing file. **The stack reads that variable,
never `var(--font-serif)`**, which is declared and drags an OS-dependent generic tail behind it.

**3 · Bw Gradual is a logo, not a font.** The wordmark ships as SVG vector paths and must never load as
a web font.

**4 · Label roles are four, and they are preserved rather than reinvented.**

| Role | Size | Weight | Tracking | Face | Used for |
|---|---|---|---|---|---|
| `.label-eyebrow` | 11px | 300 | 0.2em | sans | Section labels, eyebrows — the workhorse |
| `.label-action` | 11px | 500 | 0.2em | sans | Caps that are clicked, and gold status |
| `.label-spec` | 10px | **400** | 0.2em | **mono** | Card titles, spec strips, cap table |
| `.label-badge` | 10px | 500 | **0.05em** | sans | Status pills and highlight tags |

**The nav is not an eyebrow role.** Nav links are their own decision — `--text-label` at weight 300
with `0.15em` tracking — recorded with the navigation component.

**Tracking is four named steps and only four:** `0.2em` (labels), `0.15em` (nav), `0.05em` (tags and
pills), `-0.04em` (the display heading). A fifth is a ruling.

---

## 4 · Typography

### Families

| Face | Role | Delivery |
|---|---|---|
| **System sans stack** | Primary UI and body | No file. Inherited from `body` |
| **Geist Mono** | Financials, hashes, countdowns, tabular figures — **and the editorial voice**: standfirsts, secondary-page eyebrows | `next/font`, as `var(--font-geist-mono)` |
| **Instrument Serif** | One italic gold word inside a page headline | `next/font`, as `var(--font-instrument-serif)`. Italic cut only |
| **Bw Gradual** | Logo mark only. Not a web font | SVG vector paths |

**A component may only name a role, never a family.** `body` owns the face; nothing else sets one.

### Hierarchy

| Token | Size | Use |
|---|---|---|
| `--text-micro` | 10px | Tags, meta, pedigree, cap table |
| `--text-label` | 11px | The four label roles, and nav links |
| `--text-body-small` | 15px | Dense body — card hooks, helper text |
| `--text-body` | 16px | Default body |
| `--text-card-heading` | 18px | Card and panel headings |
| `--text-section-heading` | 36px | Section `h2`, base breakpoint |
| `--text-section-heading-wide` | 48px | The same role at `md:` |
| `--text-display` | 64px | **The page heading.** Weight 300, tracking `-0.04em`, leading 1.05 |

**36px and 48px are one role at two breakpoints**, not a display/heading pair.

**The 64px page heading is a role, and it now has a token: `--text-display`.** Weight 300, tracking
`-0.04em`, leading 1.05. It is the eighth role, and the base size for it is `--text-section-heading`
(36px) with `md:` stepping up to 64px — the same two-breakpoint shape as the 36/48 pair.

Naming it matters more than it looks: before this, the recipe was hand-typed into two page files as
`text-[36px] … md:text-[64px] leading-[1.05]`. A recipe typed twice is a recipe that drifts, which is how
several of §10's rules came to exist.

### Leading

**Four tiers, and they are the whole vocabulary.**

| Token | Value | Use |
|---|---|---|
| `--leading-none` | `1` | Single-line controls, badges, pills |
| `--leading-display` | `1.05` | **Every major heading** — the 64px page heading and the 36 / 48px section headings |
| `--leading-heading` | `1.25` | Card and panel headings |
| `--leading-body` | `1.625` | All prose |

**The tier is chosen by size and job, never by spelling.** Anything at heading scale takes
`--leading-display` and tightens hard — that is what gives the type its editorial punch. Card-scale
headings take `--leading-heading`. Prose takes `--leading-body`, at every body size. Single-line
controls take `--leading-none`.

**These four values are the vocabulary.** No bare Tailwind leading name (`leading-tight`,
`leading-snug`, `leading-relaxed`, `leading-loose`) and no arbitrary value (`leading-[1.8]`) appears in
a component. Where a piece of text does not fit a tier, fix the text, not the scale.

**One deliberate loosening and one deliberate tightening, both worth knowing.** `--leading-body` at
1.625 unifies two spellings that were doing the same job across 74 sites — `leading-relaxed` and
`leading-[1.7]`. And the section headings tighten from 1.1, which is a visible change to the largest
marketing type; it is intended.

### Weights

**300 · 400 · 500.** `400` belongs to the spec label role, which is mono and lives on cap tables and
data rooms. **600 maps to 500** — there is no semibold in this system.

### Principles

1. **Size carries hierarchy, weight carries action.** Two weights do the work at the same size: 500
   means *click this*, 300 means *read this*.
2. **Tracking widens as size drops.** `0.2em` at 10–11px, `0.15em` at the nav, `0.05em` on a pill, and
   `-0.04em` on the one very large heading. Small caps need air; large type needs tightening.
3. **Mono is not decoration.** Geist Mono is where digits must align down a column. Reaching for it
   anywhere else spends the signal.
4. **Never a raw generic.** `font-sans` and `font-serif` resolve differently per OS. Only named roles.

### Substitutes

If Geist Mono is unavailable, fall back through the mono stack, never to a serif or to sans. If
Instrument Serif is unavailable, the drama word stays **roman in the heading face** — a Georgia
substitute is worse than no serif, because the ruling exists to prevent exactly that substitution.

---

## 5 · Layout

### Spacing

| Token | Value | Use |
|---|---|---|
| `--spacing-section` | `224px` | Section vertical padding, marketing surfaces |

**The section rhythm is fixed, not fluid.** There is no `clamp()` at any viewport. If a fluid rhythm is
ever wanted it is a deliberate improvement with its reason recorded, never a correction of a value
that was never measured wrong.

**Vertical rhythm is per surface type, not one rule.**

| Surface type | Rhythm |
|---|---|
| Marketing sections | `py-section` — 224px |
| Functional dashboard and application headers | `pt-32 pb-24` — 128px / 96px |

Do not force the two into one value. **If a section feels wrong at its rhythm, fix the section, not the
rhythm.**

### Container — one, and universal

**Every page surface sits inside `max-w-6xl` (1152px) with gutters `px-12 md:px-16 lg:px-20`.**

This is the whole rule. All page routes, at every nesting depth, and all global chrome. There are **no
conditional page widths and no dashboard exceptions.**

**Two boundaries, both deliberate:**

- **Dialogs and modals are not pages.** An overlay shell takes its own intentional cap — 760px for the
  CTA lead modal, 520px for the billing dialog — rather than the page container. Containment rules
  bind pages and chrome; a cap binds an overlay.
- **The lock is horizontal.** It governs width and gutters. Vertical rhythm is the other axis and is
  governed above.

### Breakpoints

**Breakpoints are not tokens.** Page layouts differ legitimately per view, and forcing the set into the
theme constrains pages that share nothing. Standard Tailwind prefixes apply — `sm:`, `md:`, `lg:` —
mobile-first.

**One exception, and it is a different kind of thing: the chrome collapses at 768px.** The nav's
toggle, the drawer and the conversion bar all appear and disappear at the same width. That is not a
layout breakpoint; it is an *agreement between three chrome surfaces*, and having one value is the
entire point.

### Touch targets

**44px is the floor for anything tappable** — steppers, checkboxes, toggles, icon buttons. Anything
below it that a person presses to buy something is a defect, not a density choice.

---

## 6 · Elevation and Depth

Elevation is a vocabulary of seven tokens. **They are the whole vocabulary** — a shadow written at a
call site is not a design decision.

| Level | Treatment | Use |
|---|---|---|
| `--shadow-panel` | `0 0 60px rgba(0,0,0,0.6)` | Rail cards, modal shells |
| `--shadow-modal` | `0 0 120px rgba(0,0,0,0.98)` | Dialog shells |
| `--shadow-float` | `0 30px 80px rgba(0,0,0,0.6)` | Auth card, rail error card |
| `--shadow-card-hover` | `0 20px 40px rgba(0,0,0,0.45)` | The listing card, on hover |
| `--shadow-bevel` | `inset 0 1px 0 rgba(255,255,255,0.05)` | The top highlight. **Composes, never concatenates** |
| `--shadow-glow-success` | `0 0 8px rgba(16,185,129,0.6)` | The status dot, and nothing else |
| `--shadow-glow-gold` | `0 0 12px rgba(212,169,100,0.25)` | The selected pedigree node |

**The bevel is a separate concern from depth.** It is written
`shadow-[var(--shadow-panel),var(--shadow-bevel)]` and never as one hand-written value — concatenating
them is what made the original values impossible to tokenise.

**The glow is single-purpose: it marks motion, not importance.** There is no second glow colour, and
no blue.

**Banned:** Tailwind's named shadows (`shadow-sm`, `shadow-xl`, `shadow-2xl`, `shadow-md`) — the same
fix that banned bare `rounded`.

---

## 7 · Shapes

### Radius

| Token | Value | Use |
|---|---|---|
| `--radius-sm` | `8px` | Inputs, steppers, image frames |
| `--radius-md` | `16px` | Inner cards, accordion panels |
| `--radius-lg` | `24px` | Outer cards, rails, modals |
| `--radius-xl` / `--radius-2xl` / `--radius-3xl` | `24px` **each** | Aliases onto `lg` |
| `--radius-pill` | `9999px` | Pills, badges, status dots |

**Three steps plus pill — and the aliases exist so nothing falls through.** Tailwind's own scale
renders `rounded-xl` at 12px and `rounded-2xl` at 16px; pinning them to `lg` means a numeric tier cannot
quietly reintroduce a fourth radius. The theme declares them explicitly, all four at `24px`:
`--radius-lg`, `--radius-xl`, `--radius-2xl`, `--radius-3xl`.

**The namespace is closed, and it takes three more pins than the seven names suggest.** Tailwind v4
supplies radius values the set above does not name, so they are pinned onto real steps as well:

| Utility | Tailwind's default | Pinned to |
|---|---|---|
| bare `rounded` | `--radius: 0.25rem` — 4px | **8px** (onto `sm`) |
| `rounded-xs` | `--radius-xs: 0.125rem` — 2px | **8px** (onto `sm`) |
| `rounded-4xl` | `--radius-4xl: 2rem` — 32px | **24px** (onto `lg`) |

**Bare `rounded` at 4px is the exact fall-through §10's rule 10 was written for** — it shipped to 17
call sites. With all ten pinned, **every named radius utility resolves to 8, 16, 24 or 9999px**, whatever
anyone writes from habit. `rounded-none` (0) and `rounded-full` (9999px) are hardcoded in the utility
rather than themeable, and both are legal.

**Two honest caveats, because "closed" has a boundary.**

- **Arbitrary values still bypass the theme.** `rounded-[26px]` compiles to 26px no matter what is
  pinned, exactly as `scale-[…]`, `leading-[…]` and `z-[…]` bypass theirs. Nothing in the theme can
  stop it; **the CI ban is what closes that door**, and it is why the ban is not redundant now that
  the pins exist. There are zero arbitrary radii live, so the door is unwalked — but it is open.
- **The aliases are permanent, and they are load-bearing rather than a safety net.** `rounded-xl` is
  the single most-used radius spelling in the build at **58 sites**, with `rounded-2xl` ×19 and
  `rounded-3xl` ×5 — **82 sites that render correctly only because these aliases exist.** Remove them
  as unused-looking and 82 sites change radius, most of them to something smaller. **So they stay:
  pinned permanently, not migrated away.** The authoring standard is `sm` / `md` / `lg` / `pill`, and
  the aliases are the compiler's guarantee that the rest of Tailwind's scale lands inside it too.
  Code written against this document uses `lg`; code that already says `xl` is correct and stays.

### Borders

**Three opacity steps: `/20` whisper, `/40` default, `/60` emphasis.** A fourth is a defect.

**The step and the colour token are separate axes.** A border may change *token* at a constant step —
`border-border/60` → `hover:border-heading/60` is a legal hover, because `/60` is one of the three
steps and only the colour moved. Enforcement reads the **step**, never the pair: `heading/60` is not a
fourth opacity, and a check that flags it is a false positive. What is banned is a *new step* —
`/30`, `/45`, `/70` — anywhere.

---

## 8 · Components

Nine components are locked. Each has a **closed** variant list: a new variant is an architectural
ruling, not a local decision.

| Component | Variants (closed) | Production call sites |
|---|---|---|
| Listing card | `standard` · `featured` | The marketplace grid |
| Status badge | `active` · `pending` · `settled` | Every listing |
| Navigation | `transparent` · `solid` | Every route |
| Footer | `with-tagline` · `links-only` | Every route |
| Mobile conversion bar | *one* | The horse page, below 768px |
| Mobile menu drawer | *one* | Every route, below 768px |
| Button | `solid` · `ghost` | The purchase flow, the nav CTA |
| Figure row | `default` · `money` × `stacked` · `inline` | Cards, the rail, MyStable |
| Form field | `field` · `capsule` | The sign-in card, the purchase flow |

### Shared rulings

These bind every component above and are stated once.

**One container.** Every component sits inside `max-w-6xl` with `px-12 md:px-16 lg:px-20`. No component
carries its own gutter or its own page width.

**One focus ring.** A **2px outline, 4px offset, in `--color-edge`** — everywhere, in every component.
Never write `focus:outline-none` without proving a replacement **on the same line**; a border recolour
is not a ring.

**Every hover rule is wrapped in `@media (hover: hover)`.** Unconditional for the components in this
batch: nav links, footer links, drawer links.

**The z-ladder.**

```
z-grain    -1    film grain, behind everything
z-sticky   30    the mobile conversion bar
z-nav      40    global navigation
z-drawer   50    the mobile menu drawer
z-modal    60    dialogs, including full-screen viewers
```

Below 30 is **local stacking inside a component** (`z-0`, `z-10`, `z-20`) — a badge over an image, a
local highlight. A local stacking context is not a ladder slot. **`nav` sits below `modal`:** a dialog
must cover the bar. No component invents a value at or above 30.

### Listing card — the marketplace unit

**Anatomy:** status badge (required, top-right of the image frame) · image frame (required) · name
(required, one line) · hook (required, one paragraph) · CTA link (required, exactly one) · highlight
tags (optional, zero to three) · no-photo placeholder.

**Variants:** `standard`, and `featured` which differs only by **gap and image width** — one per grid
at most.

**States:** `default` · `hover` · `focus-visible` · `active` · `loading` (skeleton, same footprint) ·
`image-error` (falls back to the placeholder, never a broken frame). **There is no `disabled` card** —
an unsellable offering is a *status*, not an absent card.

**Rules.** Siblings never differ in padding. The name never wraps and never truncates. The hook has a
hard maximum and never expands the card. Tags describe the horse, never the offer's terms. **No price,
no percentage, no figures inside the card** — financials belong to the horse page, where mono is the
ruled face for them. **The card is never a link**: one anchor inside it, not a card-shaped one.

### Status badge — one component, one map

**Anatomy:** dot (required, the semantic carrier) · label (required, uppercase) · glow (conditional,
the active variant only). Always a pill; positioned by its host, never by itself.

| Value | Label | Variant | Glow |
|---|---|---|---|
| `draft` | DRAFT | settled | no — and never public |
| `coming_soon` | COMING SOON | active | yes |
| `coming_soon_details` | COMING SOON | active | yes |
| `listed` | AVAILABLE | active | yes |
| `fully_subscribed` | FULLY ALLOCATED | pending | no |
| `completed` | COMPLETED | settled | no |

**Five labels and three variants are the whole vocabulary.** A new status picks an existing variant or
forces a ruling.

**Rules.** A status is **never a call to action**: a status answers *what is this?*, a CTA answers
*what do I do?* Uppercase is applied by the component, so source strings stay sentence case. **An
unrecognised value is an error, not a fallback** — a default that renders the one state which must
never be public is worse than a visible failure. `fully_subscribed` in amber is *demand still
standing*; do not "fix" it to grey.

### Navigation

**Anatomy:** brand mark (required, links to the site root) · primary links (required, two to five) ·
account or CTA slot (required, one at most) · menu toggle (required below 768px).

**Variants:** `transparent` at the top of the page, `solid` when scrolled or when the menu is open.
Two, and no third — a light variant or a hero-specific variant is a ruling.

**The link role:** `--text-label` (11px) at weight 300, tracking `0.15em`, uppercase, with a gold
hairline underneath that scales in on hover.

**Rules.** Five primary links maximum — more than five is a footer's job. One CTA at most. **The brand
mark is an SVG wordmark, never type** — do not set it in Instrument Serif or any other face. The current
route carries `aria-current="page"`.

### Footer

**Anatomy:** closing tagline block (conditional) · link columns (required, two to four) · legal or
compliance note (conditional).

**Variants:** `with-tagline` (the default) and `links-only`, which is **route-determined, never
author-chosen**.

**Padding is asymmetric and deliberate:** 64px top / 48px bottom, and 96px / 64px above the collapse
point. The top edge separates the footer from content; the bottom edge only has to clear the viewport.
**A symmetric value here is wrong**, not tidier.

**Rules.** Column headings are the eyebrow role; links are never headings. **The compliance line is
not design content** — a regulatory claim carries legal weight and is confirmed by the founder or it is
not published.

### Mobile conversion bar

**This component exists because of a defect**: the horse page's primary CTA sat at the end of a
single-column mobile scroll, with no sticky equivalent.

**Anatomy:** price line (required) · primary CTA (required). One variant; a second is a ruling.

**States:** `default` · `pressed` · hidden above 768px. **Never `hover`** — it is a touch surface.

**Two requirements that are easy to miss.** The bar must compensate for the device's bottom inset with
`env(safe-area-inset-bottom)`, or it sits under the home indicator. And **the page must reserve the
bar's height** as bottom padding, or the bar covers the last element of the document and a buyer cannot
reach it.

**Rules.** The price line never contradicts the horse page. **The CTA is the same action and the same
words as the rail's** — one modal, two triggers. The bar is never the *only* route to purchase; it is a
second one. Nothing else goes in it: no navigation, no status, no dismiss control.

### Mobile menu drawer

**Anatomy:** the nav's primary links (required) · account or CTA slot (optional).

**Rules.** **A drawer is a disclosure, not a dialog** — do not make it an `aria-modal` dialog; a
drawer that does so puts a second modal on the page. Focus must not escape to the page behind it. **It
shares the collapse point with the nav and the bar** — one width, never three literals.

### Button hierarchy

**The primary CTA is white, not gold.** Gold is never a button fill, in any variant: the accent budget
is 3–5% of the viewport and it is not for controls.

**Anatomy:** label (required) · icon (optional) · group wrapper (required — it carries the hover lift).

**Variants:** `solid` and `ghost`. **The weight *is* the hierarchy** — 500 primary, 300 secondary, at the
same size and tracking.

| Variant | Treatment | Label role |
|---|---|---|
| **`solid`** | Near-white fill, dark text | `.label-action` — 11px / 500 / 0.2em |
| **`ghost`** | Outline only. Base `border-border/60` → hover `border-heading/60` | `.label-eyebrow` — 11px / 300 / 0.2em |

**The third treatment is a separate component, not a variant.** `GlowPill` is the **chrome** button:
`bg-surface` with a `border-edge/70` outline, a gold bottom hairline, a shimmer, and its own hover
guard. It is the nav's CTA. **It never appears in the purchase flow, and it is not the marketing hero
button** — the landing hero is a brand lockup with no button at all.

**States.** `hover` — **the lift rides the label, never the box.** A `w-full` button that scales its own
box pushes past its container on every hover, and whether that overflows depends on the caller's
padding, which the primitive cannot see. Scaling the label cannot overflow anything. `focus-visible` —
the one ring. `active` — `scale-press` (0.98). `disabled` — **`opacity-45`, one treatment for both
variants.** `loading` — same footprint, label replaced or preceded by a spinner; the button never
resizes.

**Rules.** `min-h-11` (44px) always, in every variant and every state. One primary per view — never two
`solid` buttons adjacent. **A button never disables to signal a status**; a greyed button says the
opposite of what is meant.

### Figure row

**Anatomy:** label (required, the `label-spec` role) · value (required, one figure) · unit (optional) ·
sub (optional, one qualifier line).

**Variants:** `default` (label muted, value in `heading`) and `money` (label and value in
`status-active` — a positive return). A third colour variant is a ruling.

**Unit position — a second closed axis:** `stacked` (unit below the value) is **the default**, and
`inline` (unit beside it) for the flow's rail. The unit is never inside the value string, so that it can
be positioned at all.

**The value is mono at weight 500.** This is a token decision, not a styling choice: a proportional
face gives unequal digit widths, so figures stop aligning down a column — which is the entire reason
the role exists.

**Rules.** One figure, never wrapped. **Green means a positive return, not merely a number** — zero and
negative values take `heading` or the destructive token, never `status-active`. Never recolour from the
call site; that is how a variant list grows looks it never sees.

### Form field

**Anatomy:** field (required) · label or `aria-label` (required — **a placeholder is never a label**) ·
leading icon (optional, rendered by the caller because the caller owns the meaning) · inline error
(optional) · submit (optional, capsule arrangement only).

**Variants:** `field`, the bordered text input, and `capsule`, one rounded capsule holding field and
button. Below 768px the capsule unfolds to a stacked field and a full-width button — **the same
control, two arrangements.**

**States:** `default` · `hover` · `focus-visible` · `filled` · `disabled` · `error` · `loading`.

**Rules.** **One spelling per control** — the same input is never spelled twice in one file. Do not
recolour the border gold on focus or hover: a gold border on a control the visitor has already decided
to act on reads as an alarm, and the focus ring is what marks focus. **Never remove the outline without
a replacement on the same line.** Do not hand-roll a submit button — it is the `ghost` variant and must
not carry its own classes. Do not signal `disabled` with a cursor alone; `disabled` needs a visual
state. Do not invent a shadow for focus: a second affordance competing with the ring is also an eighth
elevation value in a set of seven.

---

## 9 · Motion

**Motion is CSS-first.** No motion library, no physics engine, no external animation package.
**Transitions, not user-triggered keyframes**, because a transition can be interrupted and a keyframe
cannot.

### Tokens

| Token | Value | Use |
|---|---|---|
| `--ease-enter` | `cubic-bezier(0.16, 1, 0.3, 1)` | Entrances — decelerating |
| `--ease-modal` | `cubic-bezier(0.32, 0.72, 0, 1)` | Dialog shells |
| `--duration-micro` | `140ms` | Stepper increments, micro-interactions |
| `--duration-hover` | `200ms` | Hover and state changes |
| `--duration-step` | `220ms` | Step transitions and panel crossfades between modal steps |
| `--duration-collapse` | `300ms` | Collapse and structural movement |
| `--duration-modal-enter` | `240ms` | Dialog entrance |
| `--duration-modal-exit` | `160ms` | Dialog exit — deliberately faster than the entrance |
| `--duration-shimmer` | `2000ms` | The shimmer animation |
| `--scale-press` | `0.98` | Pointer-down feedback |
| `--scale-lift` | `1.02` | The hover lift, on the label only |

**A duration is never hand-typed.** These eleven are the vocabulary. Everything above 30ms is a
decision; nothing moves at a speed nobody chose.

### What moves

- **Pointer-down feedback on everything interactive.** `scale-press` on `:active`, at 44px minimum,
  with no waiting.
- **The hero renders on first paint.** Entrance delays are capped at `0.2s` / `0.32s`. **Nothing may
  hold the largest contentful paint invisible** — entrance timing is a cost the page pays before anyone
  reads it.
- **Collapse animates `grid-template-rows: 0fr ↔ 1fr`,** with opacity, and **no JavaScript
  measurement.** Two mechanisms for one movement is a defect, and a measurement has to be retaken on
  every open.
- **The dialog exit finishes faster than the entrance.** Asymmetric on purpose: an exit that lingers is
  what makes an interface feel slow.

### Two hard rules

**Never hold a conversion step behind an artificial timer.** Wait times are bounded strictly by real
network and API responses. Readability is delivered by the entrance transition, not by holding the user
hostage. A minimum elapsed-time hold on a purchase step is a conversion defect wearing a UX rationale.

**Everything is zeroed under `@media (prefers-reduced-motion: reduce)`.** Not shortened — zeroed, with
`animation-duration` and `transition-duration` both at `0.01ms` and `animation-iteration-count: 1`.

---

## 10 · Do / Don't

**The rules are numbered 1–24 and the numbers are stable.** A new rule **appends** as 25 — numbering is
never re-flowed to make a section read tidier. The number is a citation handle, not a priority.

Each rule names the drift that produced it. The drift is the reason the rule exists; it is not the
rule.

### 10.1 Colour and surface

**1 · Don't take a colour from anywhere but the locked set. Do read it off the token table.**
*Drift:* `text-purple-400` went on the MyStable `5×M` figure — a raw Tailwind palette class, in a
system that has no purple. A ban on *literals* alone does not catch it: a palette utility is the same
defect wearing a name.

**2 · Don't write a hex as a text colour. Do use `--color-on-light` for dark text on any light fill.**
*Drift:* `text-[#111]` sat beside a token holding `#0a0a0a` — wrong value, and the raised-surface colour
used as type. Wrong twice.

**3 · Don't declare a token nothing consumes. Do delete it.**
*Drift:* a shadow token was declared and never wired; a label role shipped with zero consumers. A
declaration with no consumer is an intention that does not resolve — the same failure as a class that
resolves to nothing.

**4 · Don't ship a decorative effect that cannot be seen on the surface beneath it. Do check the
mid-stop against the canvas.**
*Drift:* `via-black/70` ran over a `#030303` canvas — invisible at every one of its six call sites
across four files, all copied from one another.

**5 · Don't pick a status colour by eye. Do take the colour and the words from the locked status
table.**
*Drift:* `completed` shipped blue and `fully_subscribed` shipped white against a locked amber. Amber on
`fully_subscribed` means *demand still standing*, never a warning.

### 10.2 Type

**6 · Don't name a family inside a component. Do let `body` own the face.**
*Drift:* `font-heading` was applied to every FAQ question and resolved to nothing — a utility naming a
face that had never been declared.

**7 · Don't declare a second serif face. Do take the one serif from `--font-instrument-serif`, italic,
one word per page.**
*Drift:* a stylesheet declared a commercial face that was never licensed, and the stack fell through to
Georgia — one page, whichever face the OS had.

**8 · Don't use a weight off the scale. Do use 300 / 400 / 500; 600 maps to 500.**
*Drift:* `font-semibold` appeared 30 times across 6 files against a system that had three weights.

**9 · Don't hand-type a tracking value. Do take one of the four named steps.**
*Drift:* one button type carried `0.2em` and `0.05em` — two answers to a question the spec had already
answered.

### 10.3 Shape and depth

**10 · Don't use a numeric Tailwind radius name. Do take the scale — 8 / 16 / 24 plus pill.**
*Drift:* bare `rounded` fell through to Tailwind's built-in 4px at 17 call sites. The named tiers are
the same defect completed.

**11 · Don't invent a border opacity. Do use `/20`, `/40`, `/60`.**
*Drift:* 19 distinct border-opacity values were live.

**12 · Don't write a shadow at a call site. Do use one of the seven elevation tokens.**
*Drift:* 21 arbitrary shadows across 14 distinct definitions, plus 11 named utilities with no token
behind them, plus a call-site literal with no token at all.

**13 · Don't build a job twice. Do keep one component per job.**
*Drift:* two status-badge implementations of one enum — and the component written to unify them became
a third. A second implementation is a defect even when it is written better than the first.

### 10.4 Layout

**14 · Don't give a surface its own gutter. Do use the one container: `max-w-6xl`, `px-12 md:px-16
lg:px-20`.**
*Drift:* hero and body grid ran `px-12` and `px-6` — two left edges on one page. The chrome and the
content disagreeing about the left edge is the same defect, and it is why the wordmark never lines up
with the headline beneath it.

**15 · Don't fix a column's width in pixels. Do make it fluid and cap it at a breakpoint —
`w-full md:max-w-[300px]`.**
*Drift:* a `w-[300px]` rail overflowed its column by 28px at 320px. A fixed width inside a fluid parent
is an overflow waiting for a narrow viewport.

**This rule governs dialogs and modals too, and the page container does not.** A dialog is an overlay
shell, not a viewport: it takes its own intentional cap rather than the page's `max-w-6xl`. Containment
rules bind pages and chrome; a cap binds an overlay.

**16 · Don't size a tappable control below 44px.**
*Drift:* stepper buttons at 24×28px and a 16×16px acceptance checkbox — both purchase-critical.

**17 · Don't put the only route to purchase at the end of a scroll. Do keep the mobile conversion bar.**
*Drift:* the horse page's primary CTA sat at the bottom of a single-column mobile scroll.

**18 · Don't scale a DOM node to make it fit. Do let the container scroll, or scale the SVG's
`viewBox`.**
*Drift:* the pedigree table scaled itself down to fit a narrow viewport and compensated with negative
margins. A transform shrinks the paint but not the box, so the tap targets and the layout flow keep the
unscaled geometry. A transform is not a responsive layout.

**19 · Don't invent a fifth page-level padding scheme. If a section feels wrong at its rhythm, fix the
section, not the rhythm.**
*Drift:* a marketing section ran `py-24` (96px) because someone eyeballed the block above it and broke
the 224px section rhythm. Fix component spacing inside the section, not by altering page rhythm.

### 10.5 Components and states

**20 · Don't write a hover state that matches its own base. Do make the hover change something.**
*Drift:* the ghost variant hovered `border-border` → `border-border` — identical to its base, a no-op
that read as a working interaction.

**21 · Don't ship an unguarded hover. Do wrap every hover rule in `@media (hover: hover)`.**
*Drift:* zero guards anywhere — every hover rule shipped to every touch device, and an infinite shimmer
ran on phones.

### 10.6 Motion

**22 · Don't hold the largest contentful paint invisible. Do have the content present at first paint.**
*Drift:* the hero was held invisible for 0.85s and the tagline for 1.05s, both paid for in LCP. Entrance
timing is not styling; it is a cost the page pays before anyone reads it.

**23 · Don't measure in JavaScript what CSS can animate. Do collapse with grid rows only.**
*Drift:* the panel read `scrollHeight` in JS while also animating grid rows — two mechanisms for one
movement, and the measurement had to be retaken on every open.

**24 · Don't hold conversion steps behind artificial elapsed-time timers. Do bound wait times strictly
by real network and API responses.**
*Drift:* the legacy purchase flow enforced a mandatory 1400ms timer on every step, degrading conversion
under the guise of readability. Readability is solved by the entrance transition, not by holding the
user hostage. Elapsed time is bounded by the API, never by a clock we invented.

---

## 11 · Agent Prompt Guide

When writing or modifying code in this system:

**1 · Zero raw values.** Never write an ad-hoc hex code, `rgb()`, `rgba()`, or a raw Tailwind palette
utility (`text-purple-400`, `bg-zinc-900`) outside the theme file. Always consume a named semantic
token. A literal at a call site is the drift this system exists to prevent, and a palette utility is the
same defect wearing a name.

**2 · `body` owns the face.** Never set `font-sans` or `font-serif` on a component — the UI stack is
inherited from `body`. **Instrument Serif** is reserved for one italic gold word per headline and is set
strictly via `var(--font-instrument-serif)`, never `var(--font-serif)`, which carries an OS-dependent
generic tail. **Geist Mono** carries the financials — tabular numbers, hashes, countdowns, the spec
label role — **and the editorial voice**: standfirsts and secondary-page eyebrows. It is not
financial-only.

**3 · Closed component variants.** Never invent ad-hoc button, card, badge, or input styles. Every
variant list is closed. Adding one requires an explicit architectural ruling, not a local decision.

**4 · One universal horizontal container.** All page layouts and chrome use `max-w-6xl` with gutters
`px-12 md:px-16 lg:px-20`. Never introduce an alternative page width (`max-w-7xl`, `max-w-[1440px]`) or
a rogue gutter (`px-4`, `px-6`). **Overlay dialogs are not pages** — they take an explicit width cap
(760px, 520px) rather than the page container.

**5 · No blind hover, no blind focus.** Every hover transition is wrapped in `@media (hover: hover)`.
Never write `focus:outline-none` without providing the single system focus ring
(`outline-2 outline-offset-4 outline-edge`) **on the same line** — a border recolour is not a ring.

**6 · Beware `text-muted`.** `--color-muted` resolves to the raised surface `#111111`, which is
near-black and never legible as type. Dim metadata uses `text-muted-foreground`.

**7 · 44px is the floor for anything tappable.** Steppers, checkboxes, toggles, icon buttons. Anything
under it that a person must press to buy something is a defect, not a density choice.

**8 · Seven elevation tokens are the whole shadow vocabulary.** Never write a `shadow-[…]` literal,
never reach for Tailwind's named shadows (`shadow-sm`, `shadow-xl`), and never concatenate the bevel
with a depth shadow — compose them.

**9 · Vertical rhythm is per surface type.** Marketing sections run `py-section` (224px). Functional
dashboard and application headers run `pt-32 pb-24`. Never force the two into one value, and never
invent a third — if a section feels wrong at its rhythm, fix the section, not the rhythm.

**10 · Motion is CSS-first.** No motion library, no physics engine, no external animation package.
Transitions, not user-triggered keyframes. Entrances are capped at 0.2s / 0.32s and nothing may hold the
largest contentful paint invisible. Collapse animates `grid-template-rows: 0fr ↔ 1fr` with no JS
measurement. Never gate a conversion step behind a minimum elapsed-time timer. Everything above is
zeroed under `prefers-reduced-motion: reduce`.

**11 · The tokens, not the values.** When a token exists, use it. When one does not and the value would
be reused, that is a gap to raise — not a literal to write.

---

*This document specifies the system. Where a value and a rule disagree, the rule wins; where this
document and the live build disagree, this document wins on rulings and the build is corrected.*
