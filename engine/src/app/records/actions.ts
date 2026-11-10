'use server'

/**
 * Create and edit for the records. Chunk 2, rulings 10 and 11.
 *
 * Records own entities: a horse, and a party profile with roles. The DSL
 * attaches ids and writes `dsls` only. A horse no longer stores a trainer:
 * the link lives on the DSL and the Records pages derive it.
 */

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { slugFromLegalName } from '@/lib/dsl'
import type { LinkEntry, PartyRole } from '@/lib/dslStore'

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
 * Links are a plain registry: one `linkUrl` per row, stored as given. The
 * jsonb shape still carries a label, which is the hostname for now; the
 * operator references the links headlessly, not by a hand-written title.
 */
function links(form: FormData): Result<LinkEntry[]> {
  const urls = form
    .getAll('linkUrl')
    .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))

  const entries: LinkEntry[] = []

  for (const url of urls) {
    if (url === '') continue

    if (!/^https?:\/\//i.test(url)) {
      return { ok: false, reason: `the link '${url}' must start with http:// or https://` }
    }

    let label: string
    try {
      label = new URL(url).hostname
    } catch {
      return { ok: false, reason: `the link '${url}' is not a valid URL` }
    }

    entries.push({ url, label })
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

function roles(form: FormData): Result<PartyRole[]> {
  const picked: PartyRole[] = []
  if (checked(form, 'roleTrainer')) picked.push('trainer')
  if (checked(form, 'roleOwner')) picked.push('owner')

  if (picked.length === 0) {
    return { ok: false, reason: 'tick at least one role' }
  }
  return { ok: true, value: picked }
}

function partyFields(form: FormData): Result<{
  displayName: string
  company: string | null
  contact: string | null
  location: string | null
  website: string | null
  bio: string | null
  achievements: string | null
  other: string | null
  xUrl: string | null
  facebookUrl: string | null
  instagramUrl: string | null
  links: LinkEntry[]
}> {
  const displayName = value(form, 'displayName')
  if (displayName === '') return { ok: false, reason: 'a profile needs a name or entity' }

  const profile = profileFields(form)
  if (!profile.ok) return profile

  return {
    ok: true,
    value: {
      displayName,
      company: optional(form, 'company'),
      contact: optional(form, 'contact'),
      location: optional(form, 'location'),
      website: optional(form, 'website'),
      bio: optional(form, 'bio'),
      ...profile.value,
    },
  }
}

/** `/trainers` or `/owners`, the role-filtered view the operator came from. */
function section(form: FormData): 'trainer' | 'owner' {
  return value(form, 'from') === 'owner' ? 'owner' : 'trainer'
}

function fail(back: string, reason: string): never {
  redirect(`${back}?error=${encodeURIComponent(reason)}`)
}

export async function createPartyAction(form: FormData): Promise<void> {
  const from = section(form)
  const back = `/${from}s/new`

  const fields = partyFields(form)
  if (!fields.ok) fail(back, fields.reason)

  const picked = roles(form)
  if (!picked.ok) fail(back, picked.reason)

  const created = await recordStore().insertParty(fields.value, picked.value)

  revalidatePath(`/${from}s`)
  redirect(`/${from}s/${created.id}`)
}

export async function updatePartyAction(form: FormData): Promise<void> {
  const from = section(form)
  const id = value(form, 'id')
  const back = `/${from}s/${id}/edit`

  if (id === '') fail(`/${from}s`, 'no profile was named')

  const fields = partyFields(form)
  if (!fields.ok) fail(back, fields.reason)

  const picked = roles(form)
  if (!picked.ok) fail(back, picked.reason)

  const store = recordStore()
  const current = await store.findPartyById(id)
  if (current === null) fail(`/${from}s`, 'that profile does not exist')

  // A role is a relationship a live deal depends on. Untick it only once no
  // DSL still points at this party in that role (ruling 22). The SQL trigger
  // `party_roles_removal_guard` enforces the same rule.
  const removed = current.roles.filter((role) => !picked.value.includes(role))
  if (removed.length > 0) {
    const live = (await store.listDsls()).some(
      (dsl) =>
        dsl.status !== 'completed' &&
        ((removed.includes('trainer') && dsl.trainerId === id) ||
          (removed.includes('owner') && dsl.ownerId === id)),
    )
    if (live) {
      fail(back, 'a live DSL depends on this role, so it cannot be unticked')
    }
  }

  await store.updateParty(id, fields.value)
  await store.setPartyRoles(id, picked.value)

  revalidatePath(`/${from}s`)
  revalidatePath(`/${from}s/${id}`)
  redirect(`/${from}s/${id}`)
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

/**
 * Horse-only create (U12). No owner and no DSL: a horse is a record. The
 * trainer is a link on the deal, so it is absent here (R1).
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

  const store = recordStore()

  const clash = await store.findHorseBySlug(slug)
  if (clash !== null) {
    fail(back, `a horse with the slug '${slug}' already exists`)
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
  })

  revalidatePath('/horses')
  redirect(`/horses/${created.id}`)
}

/**
 * Edit a horse (1c, R1). The slug is deliberately absent: it is the official
 * name, and a rename is a migration, not an edit. No trainer field: the link
 * lives on the DSL (ruling 10, ruling 15).
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
  })

  revalidatePath('/horses')
  revalidatePath(`/horses/${id}`)
  redirect(`/horses/${id}`)
}

/**
 * Soft content, edited in place on the horse profile (chunk 3, U14).
 *
 * Records owns the three base paragraphs. A deal may override them locally,
 * but nothing here writes a deal: this is the Records source only.
 */
export async function updateSoftContentAction(form: FormData): Promise<void> {
  const id = value(form, 'id')
  if (id === '') fail('/horses', 'no horse was named')

  const back = `/horses/${id}`
  const store = recordStore()

  const horse = await store.findHorseById(id)
  if (horse === null) fail('/horses', 'that horse no longer exists')

  await store.updateHorse(id, {
    aboutHorse: optional(form, 'aboutHorse'),
    racingOutlookAndPedigree: optional(form, 'racingOutlookAndPedigree'),
    raceExpectation: optional(form, 'raceExpectation'),
  })

  revalidatePath(back)
  redirect(back)
}
