/**
 * The DSL action. PLAN.md step 4; chunk 2 (2026-11-10).
 *
 * The DSL attaches existing records. A horse, a trainer and an owner are
 * authored in Records; this module takes their ids and writes one `dsls` row
 * at Confirm. A failure leaves zero rows because there is no earlier write to
 * unwind.
 *
 * Two rules live in TypeScript as well as in the database:
 *
 * - The status is a machine (`checkStatusTransition`), mirrored by
 *   `assert_dsl_status_transition()` in `00021`.
 * - An unregistered horse cannot pass Coming Soon, and Available needs the
 *   full readiness list, including the four approved narrative slots.
 */

import {
  DSL_STATUS_VALUES,
  type CloseStyle,
  type DslRow,
  type DslStatus,
  type DslStore,
  type HorseRow,
  type PartyRole,
  type PartyRow,
  type PaymentModel,
} from './dslStore'
import { isInvestorReturnPctInRange, retailPerPercentFromWholesale, validateStake } from './pricing'
import { checkDslReadiness, readinessReason, type ReadinessResult } from './readiness'
import { paymentModelAllowed, termMonthsBetween } from './term'

export const DSL_STATUSES = DSL_STATUS_VALUES

export type { DslStatus }

export type Result<T> = { ok: true; value: T } | { ok: false; reason: string }

/** A check carries no value: succeeding is the whole result. */
export type CheckResult = { ok: true } | { ok: false; reason: string }

export type StatusTransitionInput = {
  registered: boolean
  from: DslStatus | null
  to: DslStatus
}

/**
 * The legal moves. `from === to` is always allowed (the no-op), and `null`
 * may only start at Coming Soon or Available. Completion is manual (ruling
 * 13): both `fully_allocated → completed` and `available → completed` are
 * deliberate operator acts on the ledger.
 */
const ALLOWED_TRANSITIONS: Record<DslStatus, readonly DslStatus[]> = {
  coming_soon: ['available'],
  available: ['fully_allocated', 'coming_soon', 'completed'],
  fully_allocated: ['completed'],
  completed: [],
}

/**
 * The status machine, in one place.
 *
 * An unregistered horse may only ever sit at Coming Soon, published or not.
 * Every other status is refused, including a direct jump with no prior status.
 */
export function checkStatusTransition(input: StatusTransitionInput): CheckResult {
  const legal =
    input.from === null
      ? input.to === 'coming_soon' || input.to === 'available'
      : input.from === input.to || ALLOWED_TRANSITIONS[input.from].includes(input.to)

  if (!legal) {
    return {
      ok: false,
      reason: `a DSL cannot move from ${input.from ?? 'no status'} to '${input.to}'`,
    }
  }

  if (!input.registered && input.to !== 'coming_soon') {
    return {
      ok: false,
      reason: `an unregistered horse cannot be set to '${input.to}': it cannot pass coming_soon until it is registered`,
    }
  }

  return { ok: true }
}

export type DslDraft = {
  endDate: string
  termStart: string
  paymentModel: PaymentModel
  closeStyle: CloseStyle
  status: DslStatus
  published: boolean
  wholesaleMonthlyPerPercent: number
  investorSplit: number | null
  listedStake: number
  minStake: number
  step: number
  distributionSchedule?: string | null
  /** Written by the narrative editor; absent means "leave where it is". */
  narrativeSignoff?: Record<string, boolean> | null
  narrativeApprovedAt?: string | null
  narrativeApprovedHash?: string | null
}

/**
 * The DSL is the only place a deal links these three ids. Every id must name
 * an existing row; a party must hold the role its column names.
 */
export type SaveDslInput = {
  horseId: string
  trainerId: string | null
  ownerId: string | null
  dsl: DslDraft
}

export type SavedDsl = {
  horse: HorseRow
  trainer: PartyRow | null
  owner: PartyRow | null
  dsl: DslRow
}

/**
 * The slug from the legal name. OUTCOME.md § Horse: the slug is derived when
 * the horse is saved, a second horse with the same slug is refused, and there
 * is no redirect table.
 */
/**
 * The slug is the official NZTR name, kebab-cased, with the parenthetical
 * country suffix dropped (`HORSE-IDENTITY-NAMING-LAW.md` §2):
 * `Mulan The Brave (NZ)` → `mulan-the-brave`,
 * `Hottathanafantasy` → `hottathanafantasy` (one word stays one word).
 */
export function slugFromLegalName(legalName: string): string {
  return legalName
    .replace(/\s*\([A-Za-z]{2,3}\)\s*$/, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * The slug for a horse with no official name yet: `sire-x-dam-yr`, the year
 * required (`HORSE-IDENTITY-NAMING-LAW.md` §2). The sire is never abbreviated.
 */
export function slugFromUnnamed(sireName: string, damName: string, year: string): string {
  const sire = slugFromLegalName(sireName)
  const dam = slugFromLegalName(damName)
  const born = year.trim()
  if (sire === '' || dam === '' || !/^(19|20)\d{2}$/.test(born)) return ''
  return `${sire}-x-${dam}-${born}`
}

function text(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

function numberOrNull(value: number | null | undefined): number | null {
  if (value === null || value === undefined) return null
  return Number.isFinite(value) ? value : null
}

/** `undefined` means "leave this column where it is"; never write it as null. */
function compact<T extends object>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined),
  ) as T
}

/**
 * The fields the deal supplies. Absent means "not filled yet", never zero: a
 * blank form field arrives as `NaN` or `''`, and both become null so Postgres
 * sees the same absence the operator sees.
 */
function dealColumns(dsl: DslDraft) {
  const wholesale = numberOrNull(dsl.wholesaleMonthlyPerPercent)

  return compact({
    endDate: text(dsl.endDate),
    termStart: text(dsl.termStart),
    paymentModel: text(dsl.paymentModel) as PaymentModel | null,
    closeStyle: text(dsl.closeStyle) as CloseStyle | null,
    wholesaleMonthlyPerPercent: wholesale,
    retailMonthlyPerPercent: wholesale === null ? null : retailPerPercentFromWholesale(wholesale),
    investorSplit: numberOrNull(dsl.investorSplit),
    listedStake: numberOrNull(dsl.listedStake),
    minStake: numberOrNull(dsl.minStake),
    step: numberOrNull(dsl.step),
    distributionSchedule: text(dsl.distributionSchedule),
    narrativeSignoff: dsl.narrativeSignoff,
    narrativeApprovedAt: dsl.narrativeApprovedAt,
    narrativeApprovedHash: dsl.narrativeApprovedHash,
  })
}

/**
 * The commercial terms, validated before a row is written so that a refusal
 * leaves the store exactly as it was. Shared by create and edit.
 *
 * A DSL exists before its deal does, so an unset field is not an error: it is
 * simply not filled yet. Each rule applies only when its field is present.
 * `checkDslReadiness` is what refuses `available` until every field is set.
 */
function checkCommercialTerms(dsl: DslDraft): CheckResult {
  const { investorSplit, listedStake, minStake, step, wholesaleMonthlyPerPercent } = dsl

  if (investorSplit !== null && Number.isFinite(investorSplit) && !isInvestorReturnPctInRange(investorSplit)) {
    return { ok: false, reason: `investor split ${investorSplit} sits outside the 50 to 85 range` }
  }

  if (Number.isFinite(wholesaleMonthlyPerPercent) && wholesaleMonthlyPerPercent <= 0) {
    return { ok: false, reason: 'wholesale cost per 1% must be above zero' }
  }

  if (Number.isFinite(minStake) && minStake <= 0) {
    return { ok: false, reason: 'minimum stake must be above zero' }
  }
  if (Number.isFinite(step) && step <= 0) {
    return { ok: false, reason: 'step must be above zero' }
  }
  if (Number.isFinite(minStake) && Number.isFinite(listedStake) && minStake > listedStake) {
    return { ok: false, reason: 'minimum stake cannot exceed the listed stake' }
  }

  if (Number.isFinite(listedStake) && Number.isFinite(step)) {
    try {
      validateStake(listedStake, step)
    } catch (error) {
      return { ok: false, reason: error instanceof Error ? error.message : 'invalid stake shape' }
    }
  }

  const hasTermStart = text(dsl.termStart) !== null
  const hasEndDate = text(dsl.endDate) !== null

  if (hasTermStart && hasEndDate) {
    const termMonths = termMonthsBetween(dsl.termStart, dsl.endDate)
    if (termMonths === null || termMonths < 1) {
      return { ok: false, reason: 'term dates are invalid' }
    }

    if (text(dsl.paymentModel) !== null && !paymentModelAllowed(dsl.paymentModel, termMonths)) {
      return {
        ok: false,
        reason: `a ${termMonths}-month term must use upfront; subscription_float requires 6 months or more`,
      }
    }
  }

  return { ok: true }
}

/**
 * An id names a row that must exist and hold the role its column names.
 * `null` is allowed: a DSL may sit at Coming Soon with no trainer or owner,
 * and the readiness gate refuses Available without both.
 */
async function loadParty(
  id: string | null,
  role: PartyRole,
  store: DslStore,
): Promise<Result<PartyRow | null>> {
  if (id === null) return { ok: true, value: null }

  const party = await store.findPartyById(id)
  if (party === null) {
    return { ok: false, reason: `${role} ${id} does not exist` }
  }
  if (!party.roles.includes(role)) {
    return { ok: false, reason: `party ${id} does not hold the ${role} role` }
  }
  return { ok: true, value: party }
}

type Narrative = {
  signoff: Record<string, boolean> | null
  approvedAt: string | null
  approvedHash: string | null
}

function narrativeOf(dsl: DslDraft | DslRow): Narrative {
  return {
    signoff: dsl.narrativeSignoff ?? null,
    approvedAt: dsl.narrativeApprovedAt ?? null,
    approvedHash: dsl.narrativeApprovedHash ?? null,
  }
}

/** The draft as the readiness gate sees it, with the stake it will hold. */
function readinessFor(args: {
  horse: HorseRow
  trainer: PartyRow | null
  ownerId: string | null
  dsl: DslDraft
  stakeRemaining: number | null
  narrative: Narrative
}): ReadinessResult {
  const { horse, dsl } = args

  return checkDslReadiness({
    dsl: {
      ownerId: args.ownerId,
      endDate: text(dsl.endDate),
      termStart: text(dsl.termStart),
      paymentModel: text(dsl.paymentModel),
      closeStyle: text(dsl.closeStyle),
      wholesaleMonthlyPerPercent: numberOrNull(dsl.wholesaleMonthlyPerPercent),
      investorSplit: dsl.investorSplit,
      listedStake: numberOrNull(dsl.listedStake),
      minStake: numberOrNull(dsl.minStake),
      step: numberOrNull(dsl.step),
      stakeRemaining: args.stakeRemaining,
      distributionSchedule: text(dsl.distributionSchedule),
    },
    horse: {
      registered: horse.registered,
      imageCount: horse.imageCount,
      aboutHorse: horse.aboutHorse,
      racingOutlookAndPedigree: horse.racingOutlookAndPedigree,
      raceExpectation: horse.raceExpectation,
    },
    trainer: args.trainer === null ? null : { bio: args.trainer.bio },
    narrative: args.narrative,
  })
}

/**
 * Create one DSL row. No horse, party or other row is written here: the ids
 * point at Records. A failure leaves zero rows because there is exactly one
 * write, at the end.
 *
 * Pin 1: `stake_remaining` starts at the listed stake.
 * Pin 3: a horse that already holds a DSL is refused.
 */
export async function saveDsl(input: SaveDslInput, store: DslStore): Promise<Result<SavedDsl>> {
  const horse = await store.findHorseById(input.horseId)
  if (horse === null) {
    return { ok: false, reason: `horse ${input.horseId} does not exist` }
  }

  if ((await store.countDslsByHorse(horse.id)) > 0) {
    return {
      ok: false,
      reason: `horse ${horse.id} already holds a DSL; a second deal is a second term, not a second listing`,
    }
  }

  const transition = checkStatusTransition({
    registered: horse.registered,
    from: null,
    to: input.dsl.status,
  })
  if (!transition.ok) return transition

  const terms = checkCommercialTerms(input.dsl)
  if (!terms.ok) return terms

  const trainerResult = await loadParty(input.trainerId, 'trainer', store)
  if (!trainerResult.ok) return trainerResult
  const ownerResult = await loadParty(input.ownerId, 'owner', store)
  if (!ownerResult.ok) return ownerResult

  const trainer = trainerResult.value
  const owner = ownerResult.value
  const stakeRemaining = numberOrNull(input.dsl.listedStake)

  if (input.dsl.status === 'available') {
    const ready = readinessFor({
      horse,
      trainer,
      ownerId: owner?.id ?? null,
      dsl: input.dsl,
      stakeRemaining,
      narrative: narrativeOf(input.dsl),
    })
    if (!ready.ok) {
      return { ok: false, reason: readinessReason(ready) ?? 'this DSL is not ready' }
    }
  }

  const dsl = await store.insertDsl({
    horseId: horse.id,
    trainerId: trainer?.id ?? null,
    ownerId: owner?.id ?? null,
    ...dealColumns(input.dsl),
    status: input.dsl.status,
    published: input.dsl.published,
    stakeRemaining,
    narrativeSignoff: input.dsl.narrativeSignoff ?? null,
    narrativeApprovedAt: input.dsl.narrativeApprovedAt ?? null,
    narrativeApprovedHash: input.dsl.narrativeApprovedHash ?? null,
  })

  return { ok: true, value: { horse, trainer, owner, dsl } }
}

export type EditDslInput = {
  dslId: string
  trainerId: string | null
  ownerId: string | null
  dsl: DslDraft
}

/**
 * Edit one DSL. The same rules as create, against the status the DSL is at
 * now, so an unregistered horse already sitting at Coming Soon cannot be
 * walked forward by an edit.
 *
 * Specific to editing:
 *
 * - The stake remaining is never reset. Buyers have drawn it down, and an
 *   edit is not a fresh sale.
 * - The horse and the parties are not written. Records owns them.
 */
export async function updateDsl(
  input: EditDslInput,
  store: DslStore,
): Promise<Result<SavedDsl>> {
  const currentDsl = await store.findDslById(input.dslId)
  if (currentDsl === null) {
    return { ok: false, reason: `DSL ${input.dslId} does not exist` }
  }

  const horse = await store.findHorseById(currentDsl.horseId)
  if (horse === null) {
    return { ok: false, reason: `horse ${currentDsl.horseId} does not exist` }
  }

  const transition = checkStatusTransition({
    registered: horse.registered,
    from: currentDsl.status,
    to: input.dsl.status,
  })
  if (!transition.ok) return transition

  const terms = checkCommercialTerms(input.dsl)
  if (!terms.ok) return terms

  if (input.dsl.endDate !== currentDsl.endDate) {
    const clash = await store.findDslByHorseAndEndDate(horse.id, input.dsl.endDate)
    if (clash !== null) {
      return { ok: false, reason: `this horse already has a DSL ending ${input.dsl.endDate}` }
    }
  }

  const trainerResult = await loadParty(input.trainerId, 'trainer', store)
  if (!trainerResult.ok) return trainerResult
  const ownerResult = await loadParty(input.ownerId, 'owner', store)
  if (!ownerResult.ok) return ownerResult

  const trainer = trainerResult.value
  const owner = ownerResult.value

  // An absent narrative field means "leave the stored sign-off alone", so an
  // ordinary edit cannot silently clear an approval.
  const narrative: Narrative = {
    signoff:
      input.dsl.narrativeSignoff === undefined
        ? currentDsl.narrativeSignoff
        : input.dsl.narrativeSignoff,
    approvedAt:
      input.dsl.narrativeApprovedAt === undefined
        ? currentDsl.narrativeApprovedAt
        : input.dsl.narrativeApprovedAt,
    approvedHash:
      input.dsl.narrativeApprovedHash === undefined
        ? currentDsl.narrativeApprovedHash
        : input.dsl.narrativeApprovedHash,
  }

  if (input.dsl.status === 'available') {
    const ready = readinessFor({
      horse,
      trainer,
      ownerId: owner?.id ?? null,
      dsl: input.dsl,
      stakeRemaining: currentDsl.stakeRemaining,
      narrative,
    })
    if (!ready.ok) {
      return { ok: false, reason: readinessReason(ready) ?? 'this DSL is not ready' }
    }
  }

  const dsl = await store.updateDsl(currentDsl.id, {
    trainerId: trainer?.id ?? null,
    ownerId: owner?.id ?? null,
    ...dealColumns(input.dsl),
    status: input.dsl.status,
    published: input.dsl.published,
  })

  return { ok: true, value: { horse, trainer, owner, dsl } }
}
