/**
 * The single readiness check. DSL engine decision 2026-11-07.
 *
 * A DSL exists from the moment the horse does: it can sit on the website as
 * Coming Soon with no commercial terms at all. Completeness is therefore not a
 * property of saving, it is a property of *listing* — the same field list must
 * gate the save action, the publish action and the compiler, or the three
 * drift and a buyer can reach a document that cannot be rendered.
 *
 * This module is the TypeScript half of `assert_dsl_available()` in
 * `supabase/migrations/00015_owner_moves_to_dsl.sql`. The two must stay in
 * step; `readiness.test.ts` pins this list, and the SQL gate is probed against
 * a real database rather than asserted.
 *
 * It returns the missing fields, not a boolean, so the operator is told what
 * to fix rather than refused.
 */

export type ReadinessDsl = {
  ownerId: string | null
  endDate: string | null
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
}

export type ReadinessHorse = {
  registered: boolean
  imageCount: number
  aboutHorse: string | null
  racingOutlookAndPedigree: string | null
  raceExpectation: string | null
}

export type ReadinessTrainer = { bio: string | null } | null

export type ReadinessInput = {
  dsl: ReadinessDsl
  horse: ReadinessHorse | null
  trainer: ReadinessTrainer
}

export type ReadinessResult =
  | { ok: true }
  | { ok: false; missing: readonly string[] }

const MINIMUM_IMAGES = 3

function present(value: string | null | undefined): boolean {
  return value !== null && value !== undefined && value.trim() !== ''
}

/**
 * What stops this DSL going `available`. An empty list means ready.
 *
 * The order is the order an operator fills the form, so the first line the
 * page shows is the next thing to do.
 */
export function checkDslReadiness(input: ReadinessInput): ReadinessResult {
  const { dsl, horse, trainer } = input
  const missing: string[] = []

  if (dsl.ownerId === null) missing.push('the owner on the term sheet')

  if (dsl.endDate === null || dsl.termStart === null) missing.push('the term start and end date')
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

  if (!present(horse.aboutHorse)) missing.push('the about-the-horse paragraph')
  if (!present(horse.racingOutlookAndPedigree)) missing.push('the racing outlook and pedigree paragraph')
  if (!present(horse.raceExpectation)) missing.push('the race expectation paragraph')

  if (trainer === null || !present(trainer.bio)) missing.push("the trainer's bio")

  return missing.length === 0 ? { ok: true } : { ok: false, missing }
}

/** The one-line message the page shows when a DSL cannot be listed yet. */
export function readinessReason(result: ReadinessResult): string | null {
  if (result.ok) return null
  return `This DSL cannot go Available yet. Still needed: ${result.missing.join('; ')}.`
}
