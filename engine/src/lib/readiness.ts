/**
 * The single readiness check. DSL engine decision 2026-11-07; chunk 2 2026-11-10.
 *
 * A DSL exists from the moment the deal does: it can sit at Coming Soon with
 * no commercial terms at all. Completeness is therefore not a property of
 * saving, it is a property of *listing* — the same field list gates the save
 * action, the publish action and the compiler, or the three drift and a buyer
 * can reach a document that cannot be rendered.
 *
 * This module is the TypeScript half of `assert_dsl_available()` in
 * `supabase/migrations/00021_parties_and_hardening.sql`. The two must stay in
 * step; `readiness.test.ts` pins this list, and the SQL gate is probed against
 * a real database rather than asserted.
 *
 * The four soft slots are the PDS's own (`legal/tokens.ts`). Available
 * requires all four approved, with an approval timestamp and hash.
 */

import { SOFT_TOKEN_KEYS } from './legal/tokens'
import { resolveNarrative } from './narrative'

export const NARRATIVE_SLOTS = SOFT_TOKEN_KEYS

export type ReadinessDsl = {
  ownerId: string | null
  endDate: string | null
  /**
   * Chunk 3 stores no start on a draft. The sale stamps it (chunk 4), so the
   * Available gate requires the expiry only. `termStart` stays in the shape so
   * a dated row can still report it, but it is not a readiness requirement.
   */
  termStart: string | null
  paymentModel: string | null
  closeStyle: string | null
  wholesaleMonthlyPerPercent: number | null
  investorSplit: number | null
  listedStake: number | null
  minStake: number | null
  step: number | null
  stakeRemaining: number | null
  distributionSchedule: string | null
  /** Deal-local overrides; null/absent means the Records text wins. */
  narrativeAboutHorse?: string | null
  narrativeRacingOutlook?: string | null
  narrativeRaceExpectation?: string | null
}

export type ReadinessHorse = {
  registered: boolean
  imageCount: number
  aboutHorse: string | null
  racingOutlookAndPedigree: string | null
  raceExpectation: string | null
}

export type ReadinessTrainer = { bio: string | null } | null

export type ReadinessNarrative = {
  signoff: Record<string, boolean> | null
  approvedAt: string | null
  approvedHash: string | null
}

export type ReadinessInput = {
  dsl: ReadinessDsl
  horse: ReadinessHorse | null
  trainer: ReadinessTrainer
  narrative: ReadinessNarrative
}

export type ReadinessResult =
  | { ok: true }
  | { ok: false; missing: readonly string[] }

const MINIMUM_IMAGES = 3

function present(value: string | null | undefined): boolean {
  return value !== null && value !== undefined && value.trim() !== ''
}

export function narrativeApproved(narrative: ReadinessNarrative): boolean {
  if (!present(narrative.approvedAt) || !present(narrative.approvedHash)) return false
  const signoff = narrative.signoff
  if (signoff === null) return false
  return NARRATIVE_SLOTS.every((slot) => signoff[slot] === true)
}

/**
 * What stops this DSL going `available`. An empty list means ready.
 *
 * The order is the order an operator fills the form, so the first line the
 * page shows is the next thing to do.
 */
export function checkDslReadiness(input: ReadinessInput): ReadinessResult {
  const { dsl, horse, trainer, narrative } = input
  const missing: string[] = []

  if (dsl.ownerId === null) missing.push('the owner on the term sheet')

  // Chunk 3: a draft has an expiry and no start. The sale stamps the start.
  if (dsl.endDate === null) missing.push('the expiry')
  if (dsl.paymentModel === null) missing.push('the payment model')
  if (dsl.closeStyle === null) missing.push('the close style')

  if (dsl.wholesaleMonthlyPerPercent === null || !(dsl.wholesaleMonthlyPerPercent > 0)) {
    missing.push('the wholesale cost per 1%')
  }
  if (dsl.investorSplit === null) missing.push("the investor's split")
  if (dsl.listedStake === null) missing.push('the listed stake')
  if (dsl.minStake === null) missing.push('the minimum stake')
  if (dsl.step === null) missing.push('the stake step')
  if (dsl.stakeRemaining === null) missing.push('the stake remaining')

  if (!present(dsl.distributionSchedule)) missing.push('the distribution schedule')

  if (horse === null) {
    missing.push('the horse')
    return { ok: false, missing }
  }

  if (!horse.registered) missing.push('a registered horse')
  if (horse.imageCount < MINIMUM_IMAGES) {
    missing.push(`at least ${MINIMUM_IMAGES} horse images`)
  }

  // The four soft slots are judged on what the deal will actually print: a
  // deal-local override counts, and an untouched slot reads through live.
  const resolved = resolveNarrative(
    horse,
    {
      narrativeAboutHorse: dsl.narrativeAboutHorse,
      narrativeRacingOutlook: dsl.narrativeRacingOutlook,
      narrativeRaceExpectation: dsl.narrativeRaceExpectation,
    },
    trainer,
  )

  if (!present(resolved['horse.about_horse'].text)) {
    missing.push('the about-the-horse paragraph')
  }
  if (!present(resolved['horse.racing_outlook_and_pedigree'].text)) {
    missing.push('the racing outlook and pedigree paragraph')
  }
  if (!present(resolved['horse.race_expectation'].text)) {
    missing.push('the race expectation paragraph')
  }
  if (!present(resolved['trainer.bio'].text)) missing.push("the trainer's bio")
  if (!narrativeApproved(narrative)) {
    missing.push('the narrative sign-off (all four PDS soft slots approved)')
  }

  return missing.length === 0 ? { ok: true } : { ok: false, missing }
}

/** The one-line message the page shows when a DSL cannot be listed yet. */
export function readinessReason(result: ReadinessResult): string | null {
  if (result.ok) return null
  return `This DSL cannot go Available yet. Still needed: ${result.missing.join('; ')}.`
}
