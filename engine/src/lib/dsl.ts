/**
 * The DSL action. PLAN.md step 4, OUTCOME.md § How a horse gets in and § DSL.
 *
 * One operator save writes the horse, the trainer, the owner, and the DSL.
 * Horse, trainer, and owner have no screens of their own, so this pure function
 * is the only door those rows come through. It takes a store and returns a
 * result: no React, no Supabase client, no network, so the whole contract is
 * testable in plain Node.
 *
 * Two rules live here rather than in the database:
 *
 * - An unregistered horse is typed by hand and cannot pass Coming Soon. The
 *   trigger in `supabase/migrations/00008` only guards status `available`, so
 *   `fully_allocated` and `completed` are gated here.
 * - The retail price is derived, never supplied. A DSL row holds one price
 *   input, `wholesaleMonthlyPerPercent`; the generated column and the Step 3
 *   rules module both derive the rest.
 */

import {
  DSL_STATUS_VALUES,
  type CloseStyle,
  type DslRow,
  type DslStatus,
  type DslStore,
  type HorseRow,
  type OwnerRow,
  type PaymentModel,
  type TrainerRow,
} from './dslStore'
import { isInvestorReturnPctInRange, retailPerPercentFromWholesale, validateStake } from './pricing'
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
 * The registration gate.
 *
 * A registered horse walks the full lifecycle. An unregistered horse may only
 * ever sit at Coming Soon, published or not: it is refused every other status,
 * including a direct jump with no prior status.
 */
export function checkStatusTransition(input: StatusTransitionInput): CheckResult {
  if (input.registered) return { ok: true }

  if (input.to === 'coming_soon') return { ok: true }

  return {
    ok: false,
    reason: `an unregistered horse cannot be set to '${input.to}': it cannot pass coming_soon until it is registered`,
  }
}

export type HorseDraft = {
  legalName: string
  foalingDate: string
  sex: string
  colour: string
  breeder?: string | null
  sireName: string
  damName: string
  microchip?: string | null
  lifeNumber?: string | null
  loveracingId?: string | null
  registered: boolean
  aboutHorse?: string | null
  racingOutlookAndPedigree?: string | null
  raceExpectation?: string | null
  imageCount?: number
  raceRecord?: Record<string, unknown>
}

export type TrainerDraft = {
  name: string
  stable: string
  location: string
  website?: string | null
  bio?: string | null
}

export type OwnerDraft = {
  entity: string
  contact: string
  website?: string | null
  profile?: string | null
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
}

export type SaveDslInput = {
  horse: HorseDraft
  trainer: TrainerDraft
  owner: OwnerDraft
  dsl: DslDraft
}

export type SavedDsl = {
  horse: HorseRow
  trainer: TrainerRow
  owner: OwnerRow
  dsl: DslRow
}

/**
 * The slug from the legal name. OUTCOME.md § Horse: the slug is derived when
 * the horse is saved, a second horse with the same slug is refused, and there
 * is no redirect table.
 */
export function slugFromLegalName(legalName: string): string {
  return legalName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function text(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

/**
 * Validate everything before a single row is written, so a refusal leaves the
 * store exactly as it was.
 */
function checkDraft(input: SaveDslInput): CheckResult {
  const transition = checkStatusTransition({
    registered: input.horse.registered,
    from: null,
    to: input.dsl.status,
  })
  if (!transition.ok) return transition

  const terms = checkCommercialTerms(input.dsl)
  if (!terms.ok) return terms

  if (text(input.horse.legalName) === null) {
    return { ok: false, reason: 'the horse needs a legal name, which makes the slug' }
  }

  return { ok: true }
}

/**
 * The commercial terms, validated before a single row is written so that a
 * refusal leaves the store exactly as it was. Shared by create and edit.
 */
function checkCommercialTerms(dsl: DslDraft): CheckResult {
  const { investorSplit, listedStake, minStake, step, wholesaleMonthlyPerPercent } = dsl

  if (investorSplit !== null && !isInvestorReturnPctInRange(investorSplit)) {
    return { ok: false, reason: `investor split ${investorSplit} sits outside the 50 to 85 range` }
  }

  if (!(wholesaleMonthlyPerPercent > 0)) {
    return { ok: false, reason: 'wholesale cost per 1% must be above zero' }
  }

  if (!(minStake > 0)) return { ok: false, reason: 'minimum stake must be above zero' }
  if (!(step > 0)) return { ok: false, reason: 'step must be above zero' }
  if (minStake > listedStake) {
    return { ok: false, reason: 'minimum stake cannot exceed the listed stake' }
  }

  try {
    validateStake(listedStake, step)
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : 'invalid stake shape' }
  }

  const termMonths = termMonthsBetween(dsl.termStart, dsl.endDate)
  if (termMonths === null || termMonths < 1) {
    return { ok: false, reason: 'term dates are invalid' }
  }

  if (!paymentModelAllowed(dsl.paymentModel, termMonths)) {
    return {
      ok: false,
      reason: `a ${termMonths}-month term must use upfront; subscription_float requires 6 months or more`,
    }
  }

  return { ok: true }
}

/** An existing trainer with the same name and stable is reused, never doubled. */
async function resolveTrainer(draft: TrainerDraft, store: DslStore): Promise<TrainerRow> {
  const existing = await store.findTrainer({ name: draft.name, stable: draft.stable })
  if (existing !== null) return existing

  return store.insertTrainer({
    name: draft.name,
    stable: draft.stable,
    location: draft.location,
    website: text(draft.website),
    bio: text(draft.bio),
  })
}

/** An existing owner with the same entity is reused, never doubled. */
async function resolveOwner(draft: OwnerDraft, store: DslStore): Promise<OwnerRow> {
  const existing = await store.findOwner({ entity: draft.entity })
  if (existing !== null) return existing

  return store.insertOwner({
    entity: draft.entity,
    contact: draft.contact,
    website: text(draft.website),
    profile: text(draft.profile),
  })
}

/**
 * Write the horse, the trainer, the owner, and the DSL in one save.
 *
 * The trainer and the owner are reused when one already exists with the same
 * name and stable, or the same entity. The horse is keyed by the slug from its
 * legal name.
 *
 * The four rows go out as separate statements, so the save can die between
 * them: a horse row that landed without its DSL row is an orphan. A later save
 * that produces the same slug adopts that orphan and updates it, rather than
 * refusing the slug and locking the horse out for good. A horse that already
 * has a DSL is still a real collision and is still refused.
 */
export async function saveDsl(input: SaveDslInput, store: DslStore): Promise<Result<SavedDsl>> {
  const checked = checkDraft(input)
  if (!checked.ok) return checked

  const slug = slugFromLegalName(input.horse.legalName)
  const existing = await store.findHorseBySlug(slug)
  if (existing !== null && (await store.countDslsByHorse(existing.id)) > 0) {
    return {
      ok: false,
      reason: `a horse with the slug '${slug}' already exists; a rename changes the slug`,
    }
  }

  const trainer = await resolveTrainer(input.trainer, store)
  const owner = await resolveOwner(input.owner, store)

  const horseFields = {
    slug,
    legalName: input.horse.legalName.trim(),
    foalingDate: input.horse.foalingDate,
    sex: input.horse.sex,
    colour: input.horse.colour,
    breeder: text(input.horse.breeder),
    sireName: input.horse.sireName,
    damName: input.horse.damName,
    microchip: text(input.horse.microchip),
    lifeNumber: text(input.horse.lifeNumber),
    loveracingId: text(input.horse.loveracingId),
    registered: input.horse.registered,
    aboutHorse: text(input.horse.aboutHorse),
    racingOutlookAndPedigree: text(input.horse.racingOutlookAndPedigree),
    raceExpectation: text(input.horse.raceExpectation),
    // An adopted orphan keeps the images already uploaded to it, so a save that
    // follows an upload cannot silently drop the horse back under the three
    // images that `00008_dsl_availability_trigger.sql` requires.
    imageCount: input.horse.imageCount ?? existing?.imageCount ?? 0,
    raceRecord: input.horse.raceRecord ?? {},
    trainerId: trainer.id,
    ownerId: owner.id,
  }

  const horse =
    existing === null
      ? await store.insertHorse(horseFields)
      : await store.updateHorse(existing.id, horseFields)

  const dsl = await store.insertDsl({
    horseId: horse.id,
    endDate: input.dsl.endDate,
    termStart: input.dsl.termStart,
    paymentModel: input.dsl.paymentModel,
    closeStyle: input.dsl.closeStyle,
    status: input.dsl.status,
    published: input.dsl.published,
    wholesaleMonthlyPerPercent: input.dsl.wholesaleMonthlyPerPercent,
    retailMonthlyPerPercent: retailPerPercentFromWholesale(input.dsl.wholesaleMonthlyPerPercent),
    wholesaleMonthlyTotal: input.dsl.wholesaleMonthlyPerPercent * 100,
    investorSplit: input.dsl.investorSplit,
    listedStake: input.dsl.listedStake,
    minStake: input.dsl.minStake,
    step: input.dsl.step,
    stakeRemaining: input.dsl.listedStake,
    distributionSchedule: text(input.dsl.distributionSchedule),
  })

  return { ok: true, value: { horse, trainer, owner, dsl } }
}

export type EditDslInput = {
  dslId: string
  horse: Partial<HorseDraft>
  trainer: TrainerDraft
  owner: OwnerDraft
  dsl: DslDraft
}

/**
 * Edit an existing DSL. The same door as create, with the horse and the DSL
 * already in place.
 *
 * The gate runs against the status the DSL is at now, not against a blank
 * slate, so an unregistered horse already sitting at Coming Soon cannot be
 * walked forward by an edit. Two rules are specific to editing:
 *
 * - The stake remaining is never reset. Buyers have drawn it down, and an edit
 *   is not a fresh sale.
 * - A rename moves the slug, and a second horse holding that slug is refused.
 */
export async function updateDsl(
  input: EditDslInput,
  store: DslStore,
): Promise<Result<SavedDsl>> {
  const currentDsl = await store.findDslById(input.dslId)
  if (currentDsl === null) {
    return { ok: false, reason: `DSL ${input.dslId} does not exist` }
  }

  const currentHorse = await store.findHorseById(currentDsl.horseId)
  if (currentHorse === null) {
    return { ok: false, reason: `horse ${currentDsl.horseId} does not exist` }
  }

  const registered = input.horse.registered ?? currentHorse.registered

  const transition = checkStatusTransition({
    registered,
    from: currentDsl.status,
    to: input.dsl.status,
  })
  if (!transition.ok) return transition

  const terms = checkCommercialTerms(input.dsl)
  if (!terms.ok) return terms

  if (input.dsl.endDate !== currentDsl.endDate) {
    const clash = await store.findDslByHorseAndEndDate(currentHorse.id, input.dsl.endDate)
    if (clash !== null) {
      return { ok: false, reason: `this horse already has a DSL ending ${input.dsl.endDate}` }
    }
  }

  let slug = currentHorse.slug
  const named = input.horse.legalName?.trim()
  if (named !== undefined && named !== '' && named !== currentHorse.legalName) {
    slug = slugFromLegalName(named)
    const clash = await store.findHorseBySlug(slug)
    if (clash !== null && clash.id !== currentHorse.id) {
      return {
        ok: false,
        reason: `a horse with the slug '${slug}' already exists; a rename changes the slug`,
      }
    }
  }

  const trainer = await resolveTrainer(input.trainer, store)
  const owner = await resolveOwner(input.owner, store)

  const horse = await store.updateHorse(currentHorse.id, {
    slug,
    legalName: named === undefined || named === '' ? currentHorse.legalName : named,
    foalingDate: input.horse.foalingDate ?? currentHorse.foalingDate,
    sex: input.horse.sex ?? currentHorse.sex,
    colour: input.horse.colour ?? currentHorse.colour,
    sireName: input.horse.sireName ?? currentHorse.sireName,
    damName: input.horse.damName ?? currentHorse.damName,
    breeder: input.horse.breeder === undefined ? currentHorse.breeder : text(input.horse.breeder),
    microchip:
      input.horse.microchip === undefined ? currentHorse.microchip : text(input.horse.microchip),
    lifeNumber:
      input.horse.lifeNumber === undefined ? currentHorse.lifeNumber : text(input.horse.lifeNumber),
    loveracingId:
      input.horse.loveracingId === undefined
        ? currentHorse.loveracingId
        : text(input.horse.loveracingId),
    registered,
    aboutHorse:
      input.horse.aboutHorse === undefined ? currentHorse.aboutHorse : text(input.horse.aboutHorse),
    racingOutlookAndPedigree:
      input.horse.racingOutlookAndPedigree === undefined
        ? currentHorse.racingOutlookAndPedigree
        : text(input.horse.racingOutlookAndPedigree),
    raceExpectation:
      input.horse.raceExpectation === undefined
        ? currentHorse.raceExpectation
        : text(input.horse.raceExpectation),
    imageCount: input.horse.imageCount ?? currentHorse.imageCount,
    raceRecord: input.horse.raceRecord ?? currentHorse.raceRecord,
    trainerId: trainer.id,
    ownerId: owner.id,
  })

  const dsl = await store.updateDsl(currentDsl.id, {
    endDate: input.dsl.endDate,
    termStart: input.dsl.termStart,
    paymentModel: input.dsl.paymentModel,
    closeStyle: input.dsl.closeStyle,
    status: input.dsl.status,
    published: input.dsl.published,
    wholesaleMonthlyPerPercent: input.dsl.wholesaleMonthlyPerPercent,
    retailMonthlyPerPercent: retailPerPercentFromWholesale(input.dsl.wholesaleMonthlyPerPercent),
    wholesaleMonthlyTotal: input.dsl.wholesaleMonthlyPerPercent * 100,
    investorSplit: input.dsl.investorSplit,
    listedStake: input.dsl.listedStake,
    minStake: input.dsl.minStake,
    step: input.dsl.step,
    distributionSchedule: text(input.dsl.distributionSchedule),
  })

  return { ok: true, value: { horse, trainer, owner, dsl } }
}
