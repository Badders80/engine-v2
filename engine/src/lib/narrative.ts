/**
 * The one narrative resolver. Chunk 3 (U14), 2026-11-10.
 *
 * Records owns the base text: three horse paragraphs and the trainer bio. A
 * deal may override the three horse slots with deal-local text stored on
 * `dsls`; it may never override the trainer bio, which always resolves from
 * the party. Untouched slots read through from Records live.
 *
 * This module is deliberately free of Node built-ins: the wizard editor, the
 * readiness gate, the compiler and the term-sheet preview all import it, and
 * the editor runs in the browser. The hash helpers live in `narrativeHash.ts`.
 *
 * The SQL function `public.resolve_narrative()` in `00022` encodes the same
 * fallback for the Available trigger. `just check:db` proves the two agree on
 * one fixture set.
 */

import { SOFT_TOKEN_KEYS } from './legal/tokens'

/** The three slots a deal may override. The trainer bio is never one. */
export const HORSE_NARRATIVE_SLOTS = [
  'horse.about_horse',
  'horse.racing_outlook_and_pedigree',
  'horse.race_expectation',
] as const

export type HorseNarrativeSlot = (typeof HORSE_NARRATIVE_SLOTS)[number]
export type NarrativeSlot = (typeof SOFT_TOKEN_KEYS)[number]

export type NarrativeHorse = {
  aboutHorse: string | null
  racingOutlookAndPedigree: string | null
  raceExpectation: string | null
}

/** The three deal-local override columns, as the row carries them. */
export type NarrativeDslOverrides = {
  narrativeAboutHorse?: string | null
  narrativeRacingOutlook?: string | null
  narrativeRaceExpectation?: string | null
}

/** Per-slot warning state: the source hash at edit, and at dismissal. */
export type NarrativeOverrideEntry = {
  sourceHash?: string
  dismissedHash?: string
}
export type NarrativeMeta = Partial<Record<HorseNarrativeSlot, NarrativeOverrideEntry>>

const NARRATIVE_FIELDS = [
  ['horse.about_horse', 'narrativeAboutHorse'],
  ['horse.racing_outlook_and_pedigree', 'narrativeRacingOutlook'],
  ['horse.race_expectation', 'narrativeRaceExpectation'],
] as const

/**
 * Rebuild meta for the slots this save carries, but keep a dismissal while the
 * override text it was made against is unchanged. Changing the text clears the
 * dismissal, so a warning may speak again on the next source change.
 *
 * Without this, an unrelated edit that resubmits the same overrides would wipe
 * `dismissedHash` and the banner would return.
 */
export function carryDismissals(
  next: NarrativeMeta | null,
  current: NarrativeDslOverrides & { narrativeOverrideMeta?: NarrativeMeta | null },
  draft: NarrativeDslOverrides,
): NarrativeMeta | null {
  if (next === null) return null
  const previous = current.narrativeOverrideMeta ?? {}
  const merged: NarrativeMeta = {}

  for (const [slot, field] of NARRATIVE_FIELDS) {
    const entry = next[slot]
    if (entry === undefined) continue
    const unchanged = (draft[field] ?? null) === (current[field] ?? null)
    const dismissedHash = previous[slot]?.dismissedHash
    merged[slot] =
      unchanged && dismissedHash !== undefined
        ? { sourceHash: entry.sourceHash, dismissedHash }
        : { sourceHash: entry.sourceHash }
  }

  return Object.keys(merged).length === 0 ? null : merged
}

export type NarrativeParty = { bio: string | null } | null

export type ResolvedSlot = {
  /** The text the documents read. null when neither source has anything. */
  text: string | null
  /** True when the deal-local text won over Records. */
  overridden: boolean
}

export type ResolvedNarrative = Record<NarrativeSlot, ResolvedSlot>

/**
 * A value is present when it is a string with something in it. The resolved
 * text is trimmed, so a stray leading newline in Records cannot change the
 * approval hash without changing what a reader sees.
 */
function present(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

/**
 * Resolve every slot. `dsl` may be null (the horse profile preview); `party`
 * may be null (no trainer attached yet).
 */
export function resolveNarrative(
  horse: NarrativeHorse | null,
  dsl: NarrativeDslOverrides | null,
  party: NarrativeParty,
): ResolvedNarrative {
  const overrides: Record<HorseNarrativeSlot, string | null | undefined> = {
    'horse.about_horse': dsl?.narrativeAboutHorse,
    'horse.racing_outlook_and_pedigree': dsl?.narrativeRacingOutlook,
    'horse.race_expectation': dsl?.narrativeRaceExpectation,
  }

  const records: Record<HorseNarrativeSlot, string | null | undefined> = {
    'horse.about_horse': horse?.aboutHorse,
    'horse.racing_outlook_and_pedigree': horse?.racingOutlookAndPedigree,
    'horse.race_expectation': horse?.raceExpectation,
  }

  const resolved = {} as ResolvedNarrative

  for (const slot of HORSE_NARRATIVE_SLOTS) {
    const override = present(overrides[slot])
    resolved[slot] =
      override === null
        ? { text: present(records[slot]), overridden: false }
        : { text: override, overridden: true }
  }

  resolved['trainer.bio'] = { text: present(party?.bio ?? null), overridden: false }

  return resolved
}

/** The three override values a form may submit, keyed by their row columns. */
export function overridesFromForm(input: {
  aboutHorse: string
  racingOutlook: string
  raceExpectation: string
}): NarrativeDslOverrides {
  return {
    narrativeAboutHorse: present(input.aboutHorse),
    narrativeRacingOutlook: present(input.racingOutlook),
    narrativeRaceExpectation: present(input.raceExpectation),
  }
}

/** True when any of the four resolved slots is empty. */
export function missingNarrativeSlots(resolved: ResolvedNarrative): NarrativeSlot[] {
  return SOFT_TOKEN_KEYS.filter((slot) => resolved[slot].text === null)
}

/** `{ slot: true }` for all four, the shape `narrative_signoff` stores. */
export function fullSignoff(): Record<SlotName, true> {
  return Object.fromEntries(SOFT_TOKEN_KEYS.map((slot) => [slot, true])) as Record<
    SlotName,
    true
  >
}

type SlotName = NarrativeSlot
