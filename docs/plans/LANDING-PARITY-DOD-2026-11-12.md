# Landing Page Visual Parity — Definition of Done

**Date:** 2026-11-12  
**State:** Ready  
**Scope:** V2 public landing page only

## Done

The V2 `/` landing page visually matches the current production landing page at
1440×1000 desktop and 390×844 mobile, using V2's existing tokens and reusable
components, with News & Updates represented by an honest “Coming soon” state.

## Reference

- Production: `https://www.evolutionstables.nz/`
- Live production section order: hero → about → divider → mission → divider →
  model → divider → marketplace → divider → news → FAQ → footer CTA.
- V2 source: `website/src/app/page.tsx`.
- Design law: `website/DESIGN.md`.
- Prior comparison:
  `/home/evo/sandbox/mvp/audits/V2-VS-PRODUCTION-2026-11-11.md`.

## Acceptance criteria

1. `/` reproduces production's section order and visual hierarchy:
   hero, about, mission, model, marketplace, news, FAQ, footer CTA.
2. Hero composition, logo placement, image crop, headline treatment, section
   spacing, container width, card counts, typography, imagery and CTA treatment
   are visually aligned with production.
3. All non-news landing copy follows the current production page. News &
   Updates uses one responsive, clearly labelled “Coming soon” presentation in
   the same visual footprint; no fake stories or dead article links.
4. Desktop and mobile render without horizontal overflow. Navigation, focus,
   reduced-motion and 44px touch-target expectations remain intact.
5. The result consumes V2 tokens, named type roles and existing components.
   Production markup, CSS or scripts are not copied into the V2 tree.
6. Only existing production assets already represented in V2 are used, plus
   the existing production “Borderless Flexibility” icon if that section is
   included.
7. `just check` passes.
8. Paired full-page screenshots at 1440×1000 and 390×844 are captured for the
   founder walk, together with section heights and overflow checks.

## Out of scope

- Marketplace, horse-detail, checkout, MyStable or login changes.
- News content, article routes, CMS or data integration.
- Privacy or Terms page implementation.
- Deployment, domain cutover, PR creation, merge or push.
- Exact pixel identity where production content is intentionally replaced by
  the News “Coming soon” state.

## Where

Use a clean managed worktree created from `dsl-sidequest` HEAD
`6c4212502491b31c62d44b223ef35afd2ec1fb6a`. Do not build in the current dirty
worktree, which contains unrelated `engine/tsconfig.json` changes and an
untracked `.impeccable/` directory.

## Budget

- 120 minutes or 6 execution chunks, whichever comes first.
- 2× stop at 240 minutes or chunk 6 completion.
- Flush before 150 tool calls; write state before the context threshold.

## Gate

Primary code gate:

```bash
just check
```

Visual evidence gate uses `agent-browser` to capture and compare the production
and V2 landing pages at 1440×1000 and 390×844. No automated pixel threshold
exists because the news block is intentionally different; the founder visual
walk is the final acceptance gate.

## Assurance

**Tier A — public landing surface.** Run `kimi-code-audit` on the mergeable diff
before calling the work complete. The audit does not replace the screenshot
evidence or the founder walk. Any change touching marketplace, checkout, auth,
data or schema would keep this at Tier A and require a separate DoD.

## Tools

- Worktree: clean managed worktree from `dsl-sidequest`.
- Gate: `just check`.
- Browser: `agent-browser`.
- Checker: `kimi-code-audit`.
- Optional vision diff seat: `minimax`, only if screenshot comparison needs an
  independent visual read.

## Founder gates

1. One final desktop/mobile visual walk after parity and audit pass.
2. Any genuine content or taste question that cannot be resolved from the
   production reference is reported at that gate, not silently invented.
