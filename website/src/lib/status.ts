/**
 * The status vocabulary. PLAN.md step 6b-ii.
 *
 * The database enum and the design vocabulary do not share names, so exactly one
 * module translates between them and this is it. `PLAN.md:286` rules the four
 * rows; `website/DESIGN.md:558-563` is the badge table they land on; the theme
 * file is where the three colour tokens are declared.
 *
 * One rule shapes the whole file: **an unrecognised value is an error, not a
 * fallback.** DESIGN.md says so outright, and PLAN.md:286 repeats it for the
 * site. A default here would render the one state that must never be public, so
 * `viewForStatus` throws instead. There is deliberately no `??`, no `default:`
 * branch and no optional chain in this module, and 6b-ii's test asserts their
 * absence rather than trusting review.
 *
 * Two names, one colour. The ruled variant enum is `active` / `pending` /
 * `settled` (`website/DESIGN.md:512`), and the theme declares three colour
 * tokens named `active` / `pending` / `closed`
 * (`website/src/app/globals.css:44-46`). Variant `settled` therefore binds to
 * the `closed` token — ruled 2026-10-17, and documented as such at
 * `website/DESIGN.md:211`, which carries `--color-status-closed` as the terminal
 * "completed" colour. No token is added and none is renamed.
 *
 * `draft` and `coming_soon_details` have no database equivalent and are never
 * emitted by the site (`PLAN.md:295`), so neither appears below. `draft` in
 * particular is `published = false`: an absence from the marketplace rather than
 * a status to render.
 */

import type { DslStatus } from './listings'

/** The three variants DESIGN.md's badge component is built around. */
export type StatusVariant = 'active' | 'pending' | 'settled'

/** The `DESIGN.md` key for a state. Not the database enum name, and not the label. */
export type DesignStatusKey = 'coming_soon' | 'listed' | 'fully_subscribed' | 'completed'

export type StatusView = {
  /** The design vocabulary's name for the state. */
  key: DesignStatusKey
  /**
   * The rendered label.
   *
   * Uppercase here because `PLAN.md:286`'s ruled table writes the Label column in
   * capitals. `DESIGN.md` applies uppercase in the component and keeps source
   * strings in sentence case; the ruling is step-specific and later, so the
   * literal follows the ruling and the component still applies the transform.
   * Same pixels either way. Do not "correct" this to sentence case.
   */
  label: string
  variant: StatusVariant
  /** The dot's colour: the semantic carrier, per DESIGN.md's badge anatomy. */
  className: string
  /** DESIGN.md's Glow column: the active variant only. */
  glow: boolean
}

/**
 * The ruled map. One row per database enum value, transcribed from `PLAN.md:286`.
 *
 * `Record<DslStatus, StatusView>` is the fence: if the enum ever gains a member,
 * this object stops compiling, which is the point. Adding a status forces a
 * ruling rather than a silent gap.
 */
export const STATUS_VIEWS: Record<DslStatus, StatusView> = {
  coming_soon: {
    key: 'coming_soon',
    label: 'COMING SOON',
    variant: 'active',
    className: 'bg-status-active',
    glow: true,
  },
  available: {
    key: 'listed',
    label: 'AVAILABLE',
    variant: 'active',
    className: 'bg-status-active',
    glow: true,
  },
  fully_allocated: {
    key: 'fully_subscribed',
    label: 'FULLY ALLOCATED',
    variant: 'pending',
    className: 'bg-status-pending',
    glow: false,
  },
  completed: {
    key: 'completed',
    label: 'COMPLETED',
    variant: 'settled',
    className: 'bg-status-closed',
    glow: false,
  },
}

/**
 * The view for a status value, or a throw.
 *
 * Takes a `string`, not a `DslStatus`, on purpose: the read layer carries the
 * enum through verbatim, including a value outside the four members, so that
 * this function is where the failure happens rather than a page rendering the
 * wrong state.
 */
export function viewForStatus(status: string): StatusView {
  const view = STATUS_VIEWS[status as DslStatus]

  if (!view) {
    throw new Error(
      `untranslatable DSL status ${JSON.stringify(status)}. The site emits only the four statuses ruled at PLAN.md:286, and an unrecognised value is an error rather than a fallback.`,
    )
  }

  return view
}
