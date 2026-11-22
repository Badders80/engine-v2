import { compileLegalPack, type LegalPack } from './compile'
import type { DslRow, HorseRow, PartyRow } from '../dslStore'
import { isPricedDsl } from '../dslStore'
import { resolveNarrative } from '../narrative'
import { validateStake } from '../pricing'
import { currentMonthKey, firstDayOfMonthKey } from '../term'

type StakeCheck = { ok: true; stake: number } | { ok: false; reason: string }

export type DraftPreviewInput = {
  dsl: DslRow
  horse: HorseRow
  trainer: PartyRow | null
  owner: PartyRow | null
  stakeRaw?: string
  buyer?: string
  executedDate?: string
}

type DraftPreviewCommon = {
  blocking: string[]
  error: string | null
  previewDsl: DslRow
  stakeRaw: string
  buyer: string
  executedDate: string
}

export type DraftPreviewResult =
  | (DraftPreviewCommon & {
      ok: true
      pack: LegalPack
      stake: number
      trainer: PartyRow
      owner: PartyRow
    })
  | (DraftPreviewCommon & { ok: false })

function present(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.trim() !== ''
}

function parseStake(raw: string, minStake: number, remaining: number, step: number): StakeCheck {
  const stake = Number(raw)

  if (!Number.isFinite(stake) || stake <= 0) {
    return { ok: false, reason: `stake '${raw}' is not a positive number` }
  }
  if (stake < minStake) {
    return { ok: false, reason: `stake ${stake} is below the minimum of ${minStake}` }
  }
  if (stake > remaining) {
    return { ok: false, reason: `stake ${stake} is above the remaining ${remaining}` }
  }

  try {
    validateStake(stake, step)
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : 'invalid stake' }
  }

  return { ok: true, stake }
}

/** Compile the exact draft pack used by both the HTML controls and PDF endpoint. */
export function compileDraftPreview(input: DraftPreviewInput): DraftPreviewResult {
  const { dsl, horse, trainer, owner } = input
  const resolved = resolveNarrative(horse, dsl, trainer)
  const previewStart = dsl.termStart ?? firstDayOfMonthKey(currentMonthKey())
  const previewDsl =
    previewStart === null || previewStart === dsl.termStart
      ? dsl
      : { ...dsl, termStart: previewStart }

  const blocking: string[] = []
  const add = (missing: boolean, label: string) => {
    if (missing) blocking.push(label)
  }

  add(owner === null, 'the owner on the term sheet')
  add(trainer === null, 'the trainer on the term sheet')
  add(dsl.endDate === null, 'the expiry')
  add(dsl.paymentModel === null, 'the payment model')
  add(dsl.closeStyle === null, 'the close style')
  add(dsl.wholesaleMonthlyPerPercent === null, 'the wholesale cost per 1%')
  add(dsl.investorSplit === null, "the investor's split")
  add(dsl.listedStake === null, 'the listed stake')
  add(dsl.minStake === null, 'the minimum stake')
  add(dsl.step === null, 'the stake step')
  add(!present(dsl.distributionSchedule), 'the distribution schedule')
  add(!present(resolved['horse.about_horse'].text), 'the about-the-horse paragraph')
  add(
    !present(resolved['horse.racing_outlook_and_pedigree'].text),
    'the racing outlook and pedigree paragraph',
  )
  add(!present(resolved['horse.race_expectation'].text), 'the race expectation paragraph')
  add(!present(resolved['trainer.bio'].text), "the trainer's bio")

  const stakeRaw =
    typeof input.stakeRaw === 'string' && input.stakeRaw !== ''
      ? input.stakeRaw
      : String(dsl.minStake ?? '')
  const buyer =
    typeof input.buyer === 'string' && input.buyer !== '' ? input.buyer : 'Preview'
  const executedDate =
    typeof input.executedDate === 'string' && input.executedDate !== ''
      ? input.executedDate
      : new Date().toISOString().slice(0, 10)

  const common: DraftPreviewCommon = {
    blocking,
    error: null,
    previewDsl,
    stakeRaw,
    buyer,
    executedDate,
  }

  if (blocking.length > 0) {
    return {
      ...common,
      ok: false,
      error: 'the documents are blocked until the fields below are filled in',
    }
  }
  if (!isPricedDsl(previewDsl)) {
    return {
      ...common,
      ok: false,
      error: 'this listing does not have its commercial terms yet, so the documents cannot be compiled',
    }
  }
  if (trainer === null) {
    return {
      ...common,
      ok: false,
      error: 'this horse has no trainer row, so the documents cannot be compiled',
    }
  }
  if (owner === null) {
    return {
      ...common,
      ok: false,
      error: 'this horse has no owner row, so the documents cannot be compiled',
    }
  }

  const checked = parseStake(
    stakeRaw,
    previewDsl.minStake,
    previewDsl.stakeRemaining,
    previewDsl.step,
  )
  if (!checked.ok) return { ...common, ok: false, error: checked.reason }

  try {
    const pack = compileLegalPack({
      account: { fullName: buyer },
      dsl: previewDsl,
      horse,
      trainer,
      owner,
      sale: { stake: checked.stake, executedDate },
    })
    return {
      ...common,
      ok: true,
      pack,
      stake: checked.stake,
      trainer,
      owner,
    }
  } catch (error) {
    return {
      ...common,
      ok: false,
      error: error instanceof Error ? error.message : 'the compile failed',
    }
  }
}
