'use server'

/**
 * Create and edit for the three static records. DSL engine decision 2026-11-07.
 *
 * These are the only places a horse, trainer or owner is authored now. The DSL
 * form attaches an existing row by id; it no longer invents one, which is what
 * made the old natural-key lookup drop edits and orphan rows when a stable or
 * entity was renamed.
 *
 * Horses get their own create path (U12, 2026-11-09): horse-only, with an
 * optional current trainer and no owner — an owner is a party to a deal and
 * attaches to the DSL.
 */

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { slugFromLegalName } from '@/lib/dsl'
import type { LinkEntry } from '@/lib/dslStore'

import { recordStore } from './store'

type Result<T> = { ok: true; value: T } | { ok: false; reason: string }

function value(form: FormData, key: string): string {
  const raw = form.get(key)
  return typeof raw === 'string' ? raw.trim() : ''
}

function optional(form: FormData, key: string): string | null {
  const raw = value(form, key)
  return raw === '' ? null : raw
}

function checked(form: FormData, key: string): boolean {
  return form.get(key) !== null
}

/**
 * Extra links are one per line as `Label | https://…`, stored as a jsonb
 * array. Text that does not fit that shape is refused with a reason rather
 * than quietly dropped.
 */
function links(form: FormData): Result<LinkEntry[]> {
  const raw = value(form, 'links')
  if (raw === '') return { ok: true, value: [] }

  const entries: LinkEntry[] = []
  for (const line of raw.split('\n')) {
    const trimmed = line.trim()
    if (trimmed === '') continue

    const parts = trimmed.split('|')
    const label = (parts[0] ?? '').trim()
    const url = parts.slice(1).join('|').trim()

    if (label === '' || url === '') {
      return { ok: false, reason: `the link '${trimmed}' needs a label and a URL: Label | URL` }
    }
    if (!/^https?:\/\//i.test(url)) {
      return { ok: false, reason: `the link '${label}' must start with http:// or https://` }
    }

    entries.push({ label, url })
  }

  return { ok: true, value: entries }
}

type ProfileFields = {
  achievements: string | null
  other: string | null
  xUrl: string | null
  facebookUrl: string | null
  instagramUrl: string | null
  links: LinkEntry[]
}

function profileFields(form: FormData): Result<ProfileFields> {
  const parsed = links(form)
  if (!parsed.ok) return parsed

  return {
    ok: true,
    value: {
      achievements: optional(form, 'achievements'),
      other: optional(form, 'other'),
      xUrl: optional(form, 'xUrl'),
      facebookUrl: optional(form, 'facebookUrl'),
      instagramUrl: optional(form, 'instagramUrl'),
      links: parsed.value,
    },
  }
}

/** The race record is one jsonb blob, entered as JSON. */
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

function fail(back: string, reason: string): never {
  redirect(`${back}?error=${encodeURIComponent(reason)}`)
}

export async function createTrainerAction(form: FormData): Promise<void> {
  const profile = profileFields(form)
  if (!profile.ok) fail('/trainers/new', profile.reason)

  const created = await recordStore().insertTrainer({
    name: value(form, 'name'),
    stable: value(form, 'stable'),
    location: value(form, 'location'),
    website: optional(form, 'website'),
    bio: optional(form, 'bio'),
    ...profile.value,
  })

  revalidatePath('/trainers')
  redirect(`/trainers/${created.id}`)
}

export async function updateTrainerAction(form: FormData): Promise<void> {
  const id = value(form, 'id')
  const profile = profileFields(form)
  if (!profile.ok) fail(`/trainers/${id}`, profile.reason)

  await recordStore().updateTrainer(id, {
    name: value(form, 'name'),
    stable: value(form, 'stable'),
    location: value(form, 'location'),
    website: optional(form, 'website'),
    bio: optional(form, 'bio'),
    ...profile.value,
  })

  revalidatePath('/trainers')
  revalidatePath(`/trainers/${id}`)
  redirect(`/trainers/${id}`)
}

export async function createOwnerAction(form: FormData): Promise<void> {
  const profile = profileFields(form)
  if (!profile.ok) fail('/owners/new', profile.reason)

  const created = await recordStore().insertOwner({
    entity: value(form, 'entity'),
    contact: value(form, 'contact'),
    website: optional(form, 'website'),
    profile: optional(form, 'profile'),
    ...profile.value,
  })

  revalidatePath('/owners')
  redirect(`/owners/${created.id}`)
}

export async function updateOwnerAction(form: FormData): Promise<void> {
  const id = value(form, 'id')
  const profile = profileFields(form)
  if (!profile.ok) fail(`/owners/${id}`, profile.reason)

  await recordStore().updateOwner(id, {
    entity: value(form, 'entity'),
    contact: value(form, 'contact'),
    website: optional(form, 'website'),
    profile: optional(form, 'profile'),
    ...profile.value,
  })

  revalidatePath('/owners')
  revalidatePath(`/owners/${id}`)
  redirect(`/owners/${id}`)
}

/**
 * Horse-only create (U12). No owner and no DSL: a horse is a record, and a DSL
 * is a separate deal assembled later. The optional trainer is picked from the
 * existing rows; it is never typed here.
 */
export async function createHorseAction(form: FormData): Promise<void> {
  const back = '/horses/new'

  const legalName = value(form, 'legalName')
  if (legalName === '') fail(back, 'a horse needs a legal name')

  const foalingDate = value(form, 'foalingDate')
  if (foalingDate === '') fail(back, 'a horse needs a foaling date')

  const sex = value(form, 'sex')
  const colour = value(form, 'colour')
  const sireName = value(form, 'sireName')
  const damName = value(form, 'damName')
  if (sex === '' || colour === '' || sireName === '' || damName === '') {
    fail(back, 'sex, colour, sire and dam are required')
  }

  const record = raceRecord(form)
  if (!record.ok) fail(back, record.reason)

  const slug = slugFromLegalName(legalName)
  if (slug === '') fail(back, 'that legal name does not make a slug')

  // The barn name is a nickname, never a duplicate of the official name
  // (HORSE-IDENTITY-NAMING-LAW.md §4). Typing the same thing twice means
  // "there isn't one", so it is stored as null rather than refused.
  const typedBarnName = optional(form, 'barnName')
  const barnName =
    typedBarnName !== null && typedBarnName.toLowerCase() === legalName.toLowerCase()
      ? null
      : typedBarnName

  const trainerId = optional(form, 'trainerId')
  const store = recordStore()

  const clash = await store.findHorseBySlug(slug)
  if (clash !== null) {
    fail(back, `a horse with the slug '${slug}' already exists`)
  }

  if (trainerId !== null && (await store.findTrainerById(trainerId)) === null) {
    fail(back, `trainer ${trainerId} does not exist`)
  }

  const created = await store.insertHorse({
    slug,
    legalName,
    barnName,
    foalingDate,
    sex,
    colour,
    breeder: optional(form, 'breeder'),
    sireName,
    damName,
    microchip: optional(form, 'microchip'),
    lifeNumber: optional(form, 'lifeNumber'),
    loveracingId: optional(form, 'loveracingId'),
    registered: checked(form, 'registered'),
    aboutHorse: null,
    racingOutlookAndPedigree: null,
    raceExpectation: null,
    imageCount: 0,
    raceRecord: record.value,
    trainerId,
  })

  revalidatePath('/horses')
  redirect(`/horses/${created.id}`)
}

/**
 * Edit a horse (1c). The slug is deliberately absent: it is the official name,
 * and a rename is a migration, not an edit (`HORSE-IDENTITY-NAMING-LAW.md` §7).
 * The trainer is authored here, per ruling 15 — the DSL reads it read-only.
 */
export async function updateHorseAction(form: FormData): Promise<void> {
  const id = value(form, 'id')
  if (id === '') fail('/horses', 'no horse was named')

  const back = `/horses/${id}/edit`
  const store = recordStore()

  const horse = await store.findHorseById(id)
  if (horse === null) fail('/horses', 'that horse no longer exists')

  const legalName = value(form, 'legalName')
  if (legalName === '') fail(back, 'a horse needs a legal name')

  const foalingDate = value(form, 'foalingDate')
  if (foalingDate === '') fail(back, 'a horse needs a foaling date')

  const sex = value(form, 'sex')
  const colour = value(form, 'colour')
  const sireName = value(form, 'sireName')
  const damName = value(form, 'damName')
  if (sex === '' || colour === '' || sireName === '' || damName === '') {
    fail(back, 'sex, colour, sire and dam are required')
  }

  const record = raceRecord(form)
  if (!record.ok) fail(back, record.reason)

  // A barn name equal to the official name is "there isn't one" (§4).
  const typedBarnName = optional(form, 'barnName')
  const barnName =
    typedBarnName !== null && typedBarnName.toLowerCase() === legalName.toLowerCase()
      ? null
      : typedBarnName

  const trainerId = optional(form, 'trainerId')
  if (trainerId !== null && (await store.findTrainerById(trainerId)) === null) {
    fail(back, `trainer ${trainerId} does not exist`)
  }

  await store.updateHorse(id, {
    legalName,
    barnName,
    foalingDate,
    sex,
    colour,
    breeder: optional(form, 'breeder'),
    sireName,
    damName,
    microchip: optional(form, 'microchip'),
    lifeNumber: optional(form, 'lifeNumber'),
    loveracingId: optional(form, 'loveracingId'),
    registered: checked(form, 'registered'),
    raceRecord: record.value,
    trainerId,
  })

  revalidatePath('/horses')
  revalidatePath(`/horses/${id}`)
  redirect(`/horses/${id}`)
}
