'use server'

/**
 * The only write path on the engine. PLAN.md step 4; chunk 2, ruling 11.
 *
 * The page is a wrapper: everything that decides anything lives in
 * `@/lib/dsl`, which is pure and tested. This file reads the form into that
 * shape and hands the result back to the page. The DSL attaches existing ids
 * and writes `dsls` only.
 *
 * Every `redirect()` sits outside a `try`: Next's redirect works by throwing,
 * so a redirect inside the catch would be swallowed and turn into a second
 * redirect.
 */

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import {
  DSL_STATUSES,
  checkStatusTransition,
  saveDsl,
  updateDsl,
  type DslDraft,
  type DslStatus,
  type Result,
} from '@/lib/dsl'
import type { DslRow, HorseRow, NarrativeOverrideMeta } from '@/lib/dslStore'
import { createSupabaseDslStore, supabaseClientFromEnv } from '@/lib/dslStoreSupabase'
import {
  carryDismissals,
  fullSignoff,
  missingNarrativeSlots,
  resolveNarrative,
} from '@/lib/narrative'
import { narrativeHash, sourceHash, staleOverrideSlots } from '@/lib/narrativeHash'
import { checkDslReadiness, readinessReason } from '@/lib/readiness'
import { deletePublicImage, listPublicImages, uploadPublicImage } from '@/lib/storage'
import { lastDayOfMonthKey } from '@/lib/term'

import { loadDslView } from './data'

function store() {
  return createSupabaseDslStore(supabaseClientFromEnv())
}

function value(form: FormData, key: string): string {
  const raw = form.get(key)
  return typeof raw === 'string' ? raw.trim() : ''
}

function optional(form: FormData, key: string): string | null {
  const raw = value(form, key)
  return raw === '' ? null : raw
}

function decimal(form: FormData, key: string): number {
  const raw = value(form, key)
  return raw === '' ? Number.NaN : Number(raw)
}

function checked(form: FormData, key: string): boolean {
  return form.get(key) !== null
}

/**
 * The expiry, from the wizard's month input or the legacy date input. Chunk 3
 * asks for a month only and stores its last day; the expiry is fixed.
 */
function endDateFrom(form: FormData): string {
  const month = value(form, 'expiryMonth')
  if (month !== '') return lastDayOfMonthKey(month) ?? ''
  return value(form, 'endDate')
}

type DslFormInput = {
  horseId: string
  trainerId: string | null
  ownerId: string | null
  dsl: DslDraft
}

function toInput(
  form: FormData,
  fallback: { status: DslStatus; published: boolean },
): Result<DslFormInput> {
  const horseId = value(form, 'horseId')
  if (horseId === '') {
    return { ok: false, reason: 'choose the horse this DSL is for' }
  }

  const status = value(form, 'status')
  const nextStatus = status === '' ? fallback.status : status
  if (!(DSL_STATUSES as readonly string[]).includes(nextStatus)) {
    return { ok: false, reason: `'${nextStatus}' is not one of the four DSL statuses` }
  }

  const dsl: DslDraft = {
    endDate: endDateFrom(form),
    termStart: value(form, 'termStart'),
    paymentModel: value(form, 'paymentModel') as DslDraft['paymentModel'],
    closeStyle: value(form, 'closeStyle') as DslDraft['closeStyle'],
    status: nextStatus as DslStatus,
    published: form.has('published') ? checked(form, 'published') : fallback.published,
    wholesaleMonthlyPerPercent: decimal(form, 'wholesaleMonthlyPerPercent'),
    investorSplit: value(form, 'investorSplit') === '' ? null : decimal(form, 'investorSplit'),
    listedStake: decimal(form, 'listedStake'),
    minStake: decimal(form, 'minStake'),
    step: decimal(form, 'step'),
    distributionSchedule: optional(form, 'distributionSchedule'),
    narrativeAboutHorse: optional(form, 'narrativeAboutHorse'),
    narrativeRacingOutlook: optional(form, 'narrativeRacingOutlook'),
    narrativeRaceExpectation: optional(form, 'narrativeRaceExpectation'),
  }

  return {
    ok: true,
    value: {
      horseId,
      trainerId: optional(form, 'trainerId'),
      ownerId: optional(form, 'ownerId'),
      dsl,
    },
  }
}

/**
 * A missing environment or a dead connection comes back as a reason, not a
 * crash. This unwraps a `Result` and never wraps one.
 */
async function attempt<T>(run: () => Promise<Result<T>>): Promise<Result<T>> {
  try {
    return await run()
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : 'the save failed' }
  }
}

/**
 * The source hash per overridden slot, captured at edit time (U5). The
 * dismissed hash is deliberately cleared: an operator who changes the override
 * starts a fresh warning cycle rather than inheriting an old dismissal.
 */
function narrativeMetaFrom(
  dsl: DslDraft,
  horse: HorseRow | null,
): NarrativeOverrideMeta | null {
  const meta: NarrativeOverrideMeta = {}

  if (dsl.narrativeAboutHorse !== null && dsl.narrativeAboutHorse !== undefined) {
    meta['horse.about_horse'] = { sourceHash: sourceHash(horse?.aboutHorse) }
  }
  if (dsl.narrativeRacingOutlook !== null && dsl.narrativeRacingOutlook !== undefined) {
    meta['horse.racing_outlook_and_pedigree'] = {
      sourceHash: sourceHash(horse?.racingOutlookAndPedigree),
    }
  }
  if (dsl.narrativeRaceExpectation !== null && dsl.narrativeRaceExpectation !== undefined) {
    meta['horse.race_expectation'] = { sourceHash: sourceHash(horse?.raceExpectation) }
  }

  return Object.keys(meta).length === 0 ? null : meta
}

export async function createDslAction(form: FormData): Promise<void> {
  // A new DSL is always a draft. Going live is a deliberate act, on the term
  // sheet, after the operator has looked at it.
  const input = toInput(form, { status: 'coming_soon', published: false })
  if (!input.ok) redirect(`/dsl/new?error=${encodeURIComponent(input.reason)}`)

  const saved = await attempt(async () => {
    const dslStore = store()
    const horse = await dslStore.findHorseById(input.value.horseId)
    input.value.dsl.narrativeOverrideMeta = narrativeMetaFrom(input.value.dsl, horse)
    return saveDsl(input.value, dslStore)
  })
  if (!saved.ok) redirect(`/dsl/new?error=${encodeURIComponent(saved.reason)}`)

  revalidatePath('/dsl')
  redirect(`/dsl/${saved.value.dsl.id}`)
}

export async function updateDslAction(form: FormData): Promise<void> {
  const dslId = value(form, 'dslId')
  const back = `/dsl/${dslId}/edit`

  const current = await loadDslView(dslId)
  if (!current.ok || !current.found) {
    redirect(`${back}?error=${encodeURIComponent('the DSL could not be loaded')}`)
  }

  const input = toInput(form, {
    status: current.dsl.status,
    published: current.dsl.published,
  })
  if (!input.ok) redirect(`${back}?error=${encodeURIComponent(input.reason)}`)

  input.value.dsl.narrativeOverrideMeta = carryDismissals(
    narrativeMetaFrom(input.value.dsl, current.horse),
    current.dsl,
    input.value.dsl,
  )

  const saved = await attempt(() =>
    updateDsl(
      {
        dslId,
        trainerId: input.value.trainerId,
        ownerId: input.value.ownerId,
        dsl: input.value.dsl,
      },
      store(),
    ),
  )
  if (!saved.ok) redirect(`${back}?error=${encodeURIComponent(saved.reason)}`)

  revalidatePath(`/dsl/${dslId}`)
  redirect(`/dsl/${dslId}`)
}

/**
 * Upload one horse image and advance the stored count.
 *
 * Images are numbered `01` upward with no gap and no extension, so the next
 * number is one past the count already on the horse: the stored figure and the
 * bucket cannot drift apart. The key is built inside `uploadPublicImage` from
 * the slug and that number, so the operator cannot name a path, and a non-image
 * is refused before anything is written.
 */
export async function uploadHorseImageAction(form: FormData): Promise<void> {
  const dslId = value(form, 'dslId')
  const back = `/dsl/${dslId}`

  const file = form.get('image')
  if (!(file instanceof File) || file.size === 0) {
    redirect(`${back}?error=${encodeURIComponent('choose an image file to upload')}`)
  }

  const uploaded = await attempt<HorseRow>(async () => {
    const view = await loadDslView(dslId)
    if (!view.ok) return { ok: false, reason: view.reason }
    if (!view.found) return { ok: false, reason: `the DSL ${dslId} does not exist` }

    const { horse } = view
    const requested = Number(value(form, 'imageNumber'))
    const imageNumber =
      Number.isInteger(requested) && requested >= 1 ? requested : horse.imageCount + 1

    await uploadPublicImage({
      slug: horse.slug,
      imageNumber,
      body: new Uint8Array(await file.arrayBuffer()),
      contentType: file.type,
    })

    const images = await listPublicImages({ slug: horse.slug })
    return { ok: true, value: await store().updateHorse(horse.id, { imageCount: images.length }) }
  })

  if (!uploaded.ok) redirect(`${back}?error=${encodeURIComponent(uploaded.reason)}`)

  revalidatePath(back)
  redirect(back)
}

/**
 * Remove one horse image and close the gap it leaves.
 */
export async function deleteHorseImageAction(form: FormData): Promise<void> {
  const dslId = value(form, 'dslId')
  const back = `/dsl/${dslId}`
  const imageNumber = Number(value(form, 'imageNumber'))

  if (!Number.isInteger(imageNumber) || imageNumber < 1) {
    redirect(`${back}?error=${encodeURIComponent('that is not an image number')}`)
  }

  const deleted = await attempt<HorseRow>(async () => {
    const view = await loadDslView(dslId)
    if (!view.ok) return { ok: false, reason: view.reason }
    if (!view.found) return { ok: false, reason: `the DSL ${dslId} does not exist` }

    const { horse } = view
    await deletePublicImage({ slug: horse.slug, imageNumber })
    const images = await listPublicImages({ slug: horse.slug })
    return { ok: true, value: await store().updateHorse(horse.id, { imageCount: images.length }) }
  })

  if (!deleted.ok) redirect(`${back}?error=${encodeURIComponent(deleted.reason)}`)

  revalidatePath(back)
  redirect(back)
}

/**
 * Recount a horse's images from the bucket and store the result.
 */
export async function recountHorseImagesAction(form: FormData): Promise<void> {
  const dslId = value(form, 'dslId')
  const back = `/dsl/${dslId}`

  const recounted = await attempt<HorseRow>(async () => {
    const view = await loadDslView(dslId)
    if (!view.ok) return { ok: false, reason: view.reason }
    if (!view.found) return { ok: false, reason: `the DSL ${dslId} does not exist` }

    const { horse } = view
    const images = await listPublicImages({ slug: horse.slug })
    return { ok: true, value: await store().updateHorse(horse.id, { imageCount: images.length }) }
  })

  if (!recounted.ok) redirect(`${back}?error=${encodeURIComponent(recounted.reason)}`)

  revalidatePath(back)
  redirect(back)
}

/**
 * Publish. The one act that makes a listing live.
 *
 * Readiness is recomputed here rather than trusted from the form, so a DSL
 * that lost a field since the last save cannot go live on a stale tick. The
 * status machine runs first, then the Postgres trigger is the backstop.
 */
export async function publishDslAction(form: FormData): Promise<void> {
  const dslId = value(form, 'dslId')
  const back = `/dsl/${dslId}`

  const published = await attempt<DslRow>(async () => {
    const view = await loadDslView(dslId)
    if (!view.ok) return { ok: false, reason: view.reason }
    if (!view.found) return { ok: false, reason: `the DSL ${dslId} does not exist` }

    const transition = checkStatusTransition({
      registered: view.horse.registered,
      from: view.dsl.status,
      to: 'available',
    })
    if (!transition.ok) return transition

    const readiness = checkDslReadiness({
      dsl: view.dsl,
      horse: view.horse,
      trainer: view.trainer,
      narrative: {
        signoff: view.dsl.narrativeSignoff,
        approvedAt: view.dsl.narrativeApprovedAt,
        approvedHash: view.dsl.narrativeApprovedHash,
      },
    })
    if (!readiness.ok) {
      return { ok: false, reason: readinessReason(readiness) ?? 'this DSL is not ready' }
    }

    return {
      ok: true,
      value: await store().updateDsl(dslId, { published: true, status: 'available' }),
    }
  })

  if (!published.ok) redirect(`${back}?error=${encodeURIComponent(published.reason)}`)

  revalidatePath(back)
  revalidatePath('/dsl')
  redirect(back)
}

/** Take a listing off the market. It keeps its terms; it stops being buyable. */
export async function unpublishDslAction(form: FormData): Promise<void> {
  const dslId = value(form, 'dslId')
  const back = `/dsl/${dslId}`

  const taken = await attempt<DslRow>(async () => {
    const view = await loadDslView(dslId)
    if (!view.ok) return { ok: false, reason: view.reason }
    if (!view.found) return { ok: false, reason: `the DSL ${dslId} does not exist` }

    // Only an Available listing moves back to Coming Soon. A sold-out or
    // completed term keeps its status when it leaves the market.
    const status = view.dsl.status === 'available' ? 'coming_soon' : view.dsl.status
    return {
      ok: true,
      value: await store().updateDsl(dslId, { published: false, status }),
    }
  })

  if (!taken.ok) redirect(`${back}?error=${encodeURIComponent(taken.reason)}`)

  revalidatePath(back)
  revalidatePath('/dsl')
  redirect(back)
}

/**
 * Approve the narrative. U6.
 *
 * The approval pins the four *resolved* texts, canonicalised. It is refused
 * while any of the four is empty: an approval of a document with a blank
 * paragraph is not an approval. The hash never covers the raw Records values,
 * so an overridden slot that shadows a later Records edit does not invalidate
 * an approval it never depended on.
 */
export async function approveNarrativeAction(form: FormData): Promise<void> {
  const dslId = value(form, 'dslId')
  const back = `/dsl/${dslId}`

  const approved = await attempt<DslRow>(async () => {
    const view = await loadDslView(dslId)
    if (!view.ok) return { ok: false, reason: view.reason }
    if (!view.found) return { ok: false, reason: `the DSL ${dslId} does not exist` }

    const resolved = resolveNarrative(view.horse, view.dsl, view.trainer)
    const missing = missingNarrativeSlots(resolved)
    if (missing.length > 0) {
      return {
        ok: false,
        reason: `cannot approve: ${missing.join(', ')} ${missing.length === 1 ? 'is' : 'are'} empty`,
      }
    }

    return {
      ok: true,
      value: await store().updateDsl(dslId, {
        narrativeSignoff: fullSignoff(),
        narrativeApprovedAt: new Date().toISOString(),
        narrativeApprovedHash: narrativeHash(resolved),
      }),
    }
  })

  if (!approved.ok) redirect(`${back}?error=${encodeURIComponent(approved.reason)}`)

  revalidatePath(back)
  revalidatePath('/dsl')
  redirect(back)
}

/**
 * Dismiss the override warning. U5.
 *
 * The banner names the slots whose Records source moved. Dismiss stores the
 * current source hash for those slots, so the same change does not warn twice.
 * It is informational: nothing is blocked and no text is rewritten.
 */
export async function dismissNarrativeWarningAction(form: FormData): Promise<void> {
  const dslId = value(form, 'dslId')
  const back = `/dsl/${dslId}`

  const dismissed = await attempt<DslRow>(async () => {
    const view = await loadDslView(dslId)
    if (!view.ok) return { ok: false, reason: view.reason }
    if (!view.found) return { ok: false, reason: `the DSL ${dslId} does not exist` }

    const stale = staleOverrideSlots(view.horse, view.dsl)
    if (stale.length === 0) return { ok: true, value: view.dsl }

    const meta: NarrativeOverrideMeta = { ...(view.dsl.narrativeOverrideMeta ?? {}) }
    const records: Record<string, string | null> = {
      'horse.about_horse': view.horse.aboutHorse,
      'horse.racing_outlook_and_pedigree': view.horse.racingOutlookAndPedigree,
      'horse.race_expectation': view.horse.raceExpectation,
    }

    for (const slot of stale) {
      meta[slot] = {
        ...meta[slot],
        dismissedHash: sourceHash(records[slot]),
      }
    }

    return { ok: true, value: await store().updateDsl(dslId, { narrativeOverrideMeta: meta }) }
  })

  if (!dismissed.ok) redirect(`${back}?error=${encodeURIComponent(dismissed.reason)}`)

  revalidatePath(back)
  redirect(back)
}
