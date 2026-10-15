'use server'

/**
 * The only write path on the engine. PLAN.md step 4.
 *
 * The page is a wrapper: everything that decides anything lives in
 * `@/lib/dsl`, which is pure and tested. This file reads the form into that
 * shape and hands the result back to the page.
 *
 * Two rules hold here:
 *
 * - Every `redirect()` sits outside a `try`. Next's redirect works by throwing,
 *   so a redirect inside the catch would be swallowed and turn into a second
 *   redirect.
 * - No branding field is read. The branding controls on the page carry no name
 *   attribute, so they are never submitted and can never reach the database.
 *
 * The image upload is the second write path, and the only one that touches the
 * public bucket. It exists because `00008_dsl_availability_trigger.sql` refuses
 * `status = 'available'` below three images, so without it no listing could ever
 * be published as available.
 */

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import {
  DSL_STATUSES,
  saveDsl,
  updateDsl,
  type DslDraft,
  type DslStatus,
  type HorseDraft,
  type OwnerDraft,
  type Result,
  type SaveDslInput,
  type TrainerDraft,
} from '@/lib/dsl'
import type { HorseRow } from '@/lib/dslStore'
import { createSupabaseDslStore, supabaseClientFromEnv } from '@/lib/dslStoreSupabase'
import { uploadPublicImage } from '@/lib/storage'

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

/** One object, stored whole on the horse. Not a column per run. */
function raceRecord(form: FormData): Result<Record<string, unknown>> {
  const raw = value(form, 'raceRecord')
  if (raw === '') return { ok: true, value: {} }

  try {
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return { ok: false, reason: 'the race record has to be one json object' }
    }
    return { ok: true, value: parsed as Record<string, unknown> }
  } catch {
    return { ok: false, reason: 'the race record is not valid json' }
  }
}

function toInput(form: FormData): Result<SaveDslInput> {
  const record = raceRecord(form)
  if (!record.ok) return record

  const status = value(form, 'status')
  if (!(DSL_STATUSES as readonly string[]).includes(status)) {
    return { ok: false, reason: `'${status}' is not one of the four DSL statuses` }
  }

  const horse: HorseDraft = {
    legalName: value(form, 'legalName'),
    foalingDate: value(form, 'foalingDate'),
    sex: value(form, 'sex'),
    colour: value(form, 'colour'),
    breeder: optional(form, 'breeder'),
    sireName: value(form, 'sireName'),
    damName: value(form, 'damName'),
    microchip: optional(form, 'microchip'),
    lifeNumber: optional(form, 'lifeNumber'),
    loveracingId: optional(form, 'loveracingId'),
    registered: checked(form, 'registered'),
    aboutHorse: optional(form, 'aboutHorse'),
    racingOutlookAndPedigree: optional(form, 'racingOutlookAndPedigree'),
    raceExpectation: optional(form, 'raceExpectation'),
    imageCount: Number(value(form, 'imageCount') || '0'),
    raceRecord: record.value,
  }

  const trainer: TrainerDraft = {
    name: value(form, 'trainerName'),
    stable: value(form, 'trainerStable'),
    location: value(form, 'trainerLocation'),
    website: optional(form, 'trainerWebsite'),
    bio: optional(form, 'trainerBio'),
  }

  const owner: OwnerDraft = {
    entity: value(form, 'ownerEntity'),
    contact: value(form, 'ownerContact'),
    website: optional(form, 'ownerWebsite'),
    profile: optional(form, 'ownerProfile'),
  }

  const dsl: DslDraft = {
    endDate: value(form, 'endDate'),
    termStart: value(form, 'termStart'),
    paymentModel: value(form, 'paymentModel') as DslDraft['paymentModel'],
    closeStyle: value(form, 'closeStyle') as DslDraft['closeStyle'],
    status: status as DslStatus,
    published: checked(form, 'published'),
    wholesaleMonthlyPerPercent: decimal(form, 'wholesaleMonthlyPerPercent'),
    investorSplit: value(form, 'investorSplit') === '' ? null : decimal(form, 'investorSplit'),
    listedStake: decimal(form, 'listedStake'),
    minStake: decimal(form, 'minStake'),
    step: decimal(form, 'step'),
    distributionSchedule: optional(form, 'distributionSchedule'),
  }

  return { ok: true, value: { horse, trainer, owner, dsl } }
}

/**
 * A missing environment or a dead connection comes back as a reason, not a crash.
 *
 * This unwraps a `Result` and never wraps one: the run hands back the result it
 * already has, and only a thrown error is turned into one.
 */
async function attempt<T>(run: () => Promise<Result<T>>): Promise<Result<T>> {
  try {
    return await run()
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : 'the save failed' }
  }
}

export async function createDslAction(form: FormData): Promise<void> {
  const input = toInput(form)
  if (!input.ok) redirect(`/dsl/new?error=${encodeURIComponent(input.reason)}`)

  const saved = await attempt(() => saveDsl(input.value, store()))
  if (!saved.ok) redirect(`/dsl/new?error=${encodeURIComponent(saved.reason)}`)

  revalidatePath('/dsl')
  redirect(`/dsl/${saved.value.dsl.id}`)
}

export async function updateDslAction(form: FormData): Promise<void> {
  const dslId = value(form, 'dslId')
  const back = `/dsl/${dslId}/edit`

  const input = toInput(form)
  if (!input.ok) redirect(`${back}?error=${encodeURIComponent(input.reason)}`)

  const saved = await attempt(() =>
    updateDsl(
      {
        dslId,
        horse: input.value.horse,
        trainer: input.value.trainer,
        owner: input.value.owner,
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
    const imageNumber = horse.imageCount + 1

    await uploadPublicImage({
      slug: horse.slug,
      imageNumber,
      body: new Uint8Array(await file.arrayBuffer()),
      contentType: file.type,
    })

    return { ok: true, value: await store().updateHorse(horse.id, { imageCount: imageNumber }) }
  })

  if (!uploaded.ok) redirect(`${back}?error=${encodeURIComponent(uploaded.reason)}`)

  revalidatePath(back)
  redirect(back)
}
