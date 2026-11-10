/**
 * Hashes for the narrative override warning and the approval. Chunk 3, U14/U5.
 *
 * Server-only: imports `node:crypto`, so it is never bundled into the wizard.
 *
 * Two different hashes are needed, and they answer different questions:
 *
 * - `sourceHash(text)` pins one Records slot as it was when the operator
 *   overrode it. Comparing it with the slot now is what raises the warning.
 * - `narrativeHash(resolved)` pins the four *resolved* texts, canonicalised,
 *   so an approval names exactly what the documents will say. It never hashes
 *   the raw Records values: an override that shadows an edit is not a change.
 */

import { createHash } from 'node:crypto'

import { SOFT_TOKEN_KEYS } from './legal/tokens'
import type { HorseNarrativeSlot, ResolvedNarrative } from './narrative'

function sha256(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex')
}

/** One slot's source text, trimmed, as a stable fingerprint. */
export function sourceHash(text: string | null | undefined): string {
  return sha256(typeof text === 'string' ? text.trim() : '')
}

/**
 * The four resolved texts in the declared order, each as `slot\0text`, joined
 * by `\n`. A null text is the empty string, so an empty slot has a stable
 * hash rather than a crash; approval refuses empties before hashing.
 */
export function canonicalNarrativeText(resolved: ResolvedNarrative): string {
  return SOFT_TOKEN_KEYS.map(
    (slot) => `${slot}\u0000${resolved[slot].text ?? ''}`,
  ).join('\n')
}

export function narrativeHash(resolved: ResolvedNarrative): string {
  return sha256(canonicalNarrativeText(resolved))
}

/**
 * The overridden slots whose Records source has moved since the override was
 * written, and whose new source hash has not been dismissed. This is the whole
 * of the warning rule (U5): informational, one banner, never a block.
 */
export function staleOverrideSlots(
  horse: {
    aboutHorse: string | null
    racingOutlookAndPedigree: string | null
    raceExpectation: string | null
  } | null,
  dsl: {
    narrativeAboutHorse?: string | null
    narrativeRacingOutlook?: string | null
    narrativeRaceExpectation?: string | null
    narrativeOverrideMeta?: Record<string, { sourceHash?: string; dismissedHash?: string }> | null
  },
): HorseNarrativeSlot[] {
  const meta = dsl.narrativeOverrideMeta ?? {}

  const pairs: [HorseNarrativeSlot, boolean, string | null | undefined][] = [
    ['horse.about_horse', present(dsl.narrativeAboutHorse), horse?.aboutHorse],
    [
      'horse.racing_outlook_and_pedigree',
      present(dsl.narrativeRacingOutlook),
      horse?.racingOutlookAndPedigree,
    ],
    ['horse.race_expectation', present(dsl.narrativeRaceExpectation), horse?.raceExpectation],
  ]

  return pairs.flatMap(([slot, overridden, recordsText]) => {
    if (!overridden) return []
    const current = sourceHash(recordsText)
    const entry = meta[slot]
    if (entry?.sourceHash === current) return []
    if (entry?.dismissedHash === current) return []
    return [slot]
  })
}

function present(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.trim() !== ''
}
