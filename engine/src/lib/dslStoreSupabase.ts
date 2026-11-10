/**
 * The Supabase-backed DslStore. Chunk 2, ruling 10.
 *
 * The operator surface is server-side only. Every table is deny-by-default
 * under RLS: no migration creates a public write policy, so this client uses
 * the service role key, which is read from the environment on the server and
 * is never sent to a browser.
 *
 * Column facts that are load bearing here:
 *
 * - `retail_monthly_per_percent` is a generated column. It is read back and
 *   never written, so a writer cannot store a second price.
 * - `wholesale_monthly_total` is generated too, and no admin surface quotes
 *   it (H4a). It is deliberately absent from the row type and this mapper.
 * - `parties.id` has a default, so the database generates it; the role rows
 *   are written alongside it.
 *
 * A field left undefined is left out of the statement altogether, so Postgres
 * applies its own default rather than a null this module invented.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

import {
  DSL_STATUS_VALUES,
  PARTY_ROLES,
  type DslRow,
  type DslStatus,
  type DslStore,
  type HorseRow,
  type LinkEntry,
  type NewDsl,
  type NewHorse,
  type NewParty,
  type PartyRole,
  type PartyRow,
} from './dslStore'

export const SUPABASE_URL_ENV = 'SUPABASE_URL'
export const SUPABASE_SERVICE_ROLE_KEY_ENV = 'SUPABASE_SERVICE_ROLE_KEY'

export function supabaseClientFromEnv(
  env: Record<string, string | undefined> = process.env,
): SupabaseClient {
  const url = env[SUPABASE_URL_ENV]
  const key = env[SUPABASE_SERVICE_ROLE_KEY_ENV]

  if (url === undefined || url === '' || key === undefined || key === '') {
    throw new Error(
      `set ${SUPABASE_URL_ENV} and ${SUPABASE_SERVICE_ROLE_KEY_ENV}: every table is deny-by-default under RLS, so the operator surface needs the service role key`,
    )
  }

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

type Db = Record<string, unknown>

function record(value: unknown): Db {
  return (value ?? {}) as Db
}

function str(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function strOrNull(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

function num(value: unknown): number {
  return typeof value === 'number' ? value : Number(value ?? 0)
}

function numOrNull(value: unknown): number | null {
  if (value === null || value === undefined) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function flag(value: unknown): boolean {
  return value === true
}

function blob(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return {}
  return value as Record<string, unknown>
}

function blobOrNull(value: unknown): Record<string, unknown> | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

/** `links` is a jsonb array of { label, url }; anything else reads as empty. */
function linkEntries(value: unknown): LinkEntry[] {
  if (!Array.isArray(value)) return []

  return value.flatMap((entry) => {
    const row = record(entry)
    const label = str(row.label)
    const url = str(row.url)
    if (label === '' || url === '') return []
    return [{ label, url }]
  })
}

/** A nested `party_roles(role)` result, in the order the database returns it. */
function partyRoles(value: unknown): PartyRole[] {
  if (!Array.isArray(value)) return []

  return value.flatMap((entry) => {
    const role = str(record(entry).role)
    return (PARTY_ROLES as readonly string[]).includes(role) ? [role as PartyRole] : []
  })
}

/**
 * The status column is an enum in the database, so a value outside the four is
 * a fault worth naming rather than a value to quietly round to Coming Soon.
 */
function dslStatus(value: unknown): DslStatus {
  const raw = str(value)
  if (!(DSL_STATUS_VALUES as readonly string[]).includes(raw)) {
    throw new Error(`dsls.status: '${raw}' is not one of the four statuses`)
  }
  return raw as DslStatus
}

function toParty(value: unknown): PartyRow {
  const row = record(value)
  return {
    id: str(row.id),
    displayName: str(row.display_name),
    company: strOrNull(row.company),
    contact: strOrNull(row.contact),
    location: strOrNull(row.location),
    website: strOrNull(row.website),
    bio: strOrNull(row.bio),
    achievements: strOrNull(row.achievements),
    other: strOrNull(row.other),
    xUrl: strOrNull(row.x_url),
    facebookUrl: strOrNull(row.facebook_url),
    instagramUrl: strOrNull(row.instagram_url),
    links: linkEntries(row.links),
    roles: partyRoles(row.party_roles),
  }
}

function toHorse(value: unknown): HorseRow {
  const row = record(value)
  return {
    id: str(row.id),
    slug: str(row.slug),
    legalName: str(row.legal_name),
    barnName: strOrNull(row.barn_name),
    foalingDate: str(row.foaling_date),
    sex: str(row.sex),
    colour: str(row.colour),
    breeder: strOrNull(row.breeder),
    sireName: str(row.sire_name),
    damName: str(row.dam_name),
    microchip: strOrNull(row.microchip),
    lifeNumber: strOrNull(row.life_number),
    loveracingId: strOrNull(row.loveracing_id),
    registered: flag(row.registered),
    aboutHorse: strOrNull(row.about_horse),
    racingOutlookAndPedigree: strOrNull(row.racing_outlook_and_pedigree),
    raceExpectation: strOrNull(row.race_expectation),
    imageCount: num(row.image_count),
    raceRecord: blob(row.race_record),
  }
}

function toDsl(value: unknown): DslRow {
  const row = record(value)
  return {
    id: str(row.id),
    horseId: str(row.horse_id),
    trainerId: strOrNull(row.trainer_id),
    ownerId: strOrNull(row.owner_id),
    endDate: strOrNull(row.end_date),
    termStart: strOrNull(row.term_start),
    paymentModel: strOrNull(row.payment_model) as DslRow['paymentModel'],
    closeStyle: strOrNull(row.close_style) as DslRow['closeStyle'],
    status: dslStatus(row.status),
    published: flag(row.published),
    wholesaleMonthlyPerPercent: numOrNull(row.wholesale_monthly_per_percent),
    retailMonthlyPerPercent: numOrNull(row.retail_monthly_per_percent),
    investorSplit: numOrNull(row.investor_split),
    listedStake: numOrNull(row.listed_stake),
    minStake: numOrNull(row.min_stake),
    step: numOrNull(row.step),
    stakeRemaining: numOrNull(row.stake_remaining),
    distributionSchedule: strOrNull(row.distribution_schedule),
    narrativeSignoff: blobOrNull(
      row.narrative_signoff,
    ) as Record<string, boolean> | null,
    narrativeApprovedAt: strOrNull(row.narrative_approved_at),
    narrativeApprovedHash: strOrNull(row.narrative_approved_hash),
    narrativeAboutHorse: strOrNull(row.narrative_about_horse),
    narrativeRacingOutlook: strOrNull(row.narrative_racing_outlook),
    narrativeRaceExpectation: strOrNull(row.narrative_race_expectation),
    narrativeOverrideMeta: blobOrNull(
      row.narrative_override_meta,
    ) as DslRow['narrativeOverrideMeta'],
  }
}

/** A field left undefined is omitted, so Postgres applies its own default. */
function defined<T extends Record<string, unknown>>(columns: T): T {
  return Object.fromEntries(
    Object.entries(columns).filter(([, value]) => value !== undefined),
  ) as T
}

function partyColumns(row: NewParty | Partial<NewParty>) {
  return defined({
    display_name: row.displayName,
    company: row.company,
    contact: row.contact,
    location: row.location,
    website: row.website,
    bio: row.bio,
    achievements: row.achievements,
    other: row.other,
    x_url: row.xUrl,
    facebook_url: row.facebookUrl,
    instagram_url: row.instagramUrl,
    links: row.links,
  })
}

function horseColumns(row: Partial<NewHorse>) {
  return defined({
    slug: row.slug,
    legal_name: row.legalName,
    barn_name: row.barnName,
    foaling_date: row.foalingDate,
    sex: row.sex,
    colour: row.colour,
    breeder: row.breeder,
    sire_name: row.sireName,
    dam_name: row.damName,
    microchip: row.microchip,
    life_number: row.lifeNumber,
    loveracing_id: row.loveracingId,
    registered: row.registered,
    about_horse: row.aboutHorse,
    racing_outlook_and_pedigree: row.racingOutlookAndPedigree,
    race_expectation: row.raceExpectation,
    image_count: row.imageCount,
    race_record: row.raceRecord,
  })
}

/**
 * `retail_monthly_per_percent` and `wholesale_monthly_total` are generated by
 * the database and are absent on purpose.
 */
function dslColumns(row: Partial<NewDsl>) {
  return defined({
    horse_id: row.horseId,
    trainer_id: row.trainerId,
    owner_id: row.ownerId,
    end_date: row.endDate,
    term_start: row.termStart,
    payment_model: row.paymentModel,
    close_style: row.closeStyle,
    status: row.status,
    published: row.published,
    wholesale_monthly_per_percent: row.wholesaleMonthlyPerPercent,
    investor_split: row.investorSplit,
    listed_stake: row.listedStake,
    min_stake: row.minStake,
    step: row.step,
    stake_remaining: row.stakeRemaining,
    distribution_schedule: row.distributionSchedule,
    narrative_signoff: row.narrativeSignoff,
    narrative_approved_at: row.narrativeApprovedAt,
    narrative_approved_hash: row.narrativeApprovedHash,
    narrative_about_horse: row.narrativeAboutHorse,
    narrative_racing_outlook: row.narrativeRacingOutlook,
    narrative_race_expectation: row.narrativeRaceExpectation,
    narrative_override_meta: row.narrativeOverrideMeta,
  })
}

const PARTY_SELECT = '*, party_roles(role)'

export function createSupabaseDslStore(client: SupabaseClient): DslStore {
  function fail(table: string, message: string): never {
    throw new Error(`${table}: ${message}`)
  }

  async function findPartyById(id: string): Promise<PartyRow | null> {
    const { data, error } = await client
      .from('parties')
      .select(PARTY_SELECT)
      .eq('id', id)
      .maybeSingle()

    if (error) fail('parties', error.message)
    return data === null ? null : toParty(data)
  }

  return {
    findPartyById,

    async listParties() {
      const { data, error } = await client
        .from('parties')
        .select(PARTY_SELECT)
        .order('display_name', { ascending: true })

      if (error) fail('parties', error.message)
      return (data ?? []).map(toParty)
    },

    async listPartiesByRole(role) {
      const { data: roleRows, error: roleError } = await client
        .from('party_roles')
        .select('party_id')
        .eq('role', role)

      if (roleError) fail('party_roles', roleError.message)
      const ids = (roleRows ?? []).map((row) => str(record(row).party_id))
      if (ids.length === 0) return []

      const { data, error } = await client
        .from('parties')
        .select(PARTY_SELECT)
        .in('id', ids)
        .order('display_name', { ascending: true })

      if (error) fail('parties', error.message)
      return (data ?? []).map(toParty)
    },

    async insertParty(row, roles) {
      const { data, error } = await client
        .from('parties')
        .insert(partyColumns(row))
        .select('id')
        .single()

      if (error) fail('parties', error.message)
      const id = str(record(data).id)

      if (roles.length > 0) {
        const { error: rolesError } = await client
          .from('party_roles')
          .insert(roles.map((role) => ({ party_id: id, role })))

        if (rolesError) fail('party_roles', rolesError.message)
      }

      const created = await findPartyById(id)
      if (created === null) fail('parties', `party ${id} vanished after insert`)
      return created
    },

    async updateParty(id, patch) {
      const { error } = await client.from('parties').update(partyColumns(patch)).eq('id', id)
      if (error) fail('parties', error.message)

      const updated = await findPartyById(id)
      if (updated === null) fail('parties', `party ${id} does not exist`)
      return updated
    },

    async setPartyRoles(id, roles) {
      const current = await findPartyById(id)
      if (current === null) fail('parties', `party ${id} does not exist`)

      const wanted = [...new Set(roles)]
      const removed = current.roles.filter((role) => !wanted.includes(role))
      const added = wanted.filter((role) => !current.roles.includes(role))

      if (removed.length > 0) {
        const { error } = await client
          .from('party_roles')
          .delete()
          .eq('party_id', id)
          .in('role', removed)
        if (error) fail('party_roles', error.message)
      }

      if (added.length > 0) {
        const { error } = await client
          .from('party_roles')
          .insert(added.map((role) => ({ party_id: id, role })))
        if (error) fail('party_roles', error.message)
      }

      const updated = await findPartyById(id)
      if (updated === null) fail('parties', `party ${id} does not exist`)
      return updated
    },

    async listHorses() {
      const { data, error } = await client
        .from('horses')
        .select('*')
        .order('legal_name', { ascending: true })

      if (error) fail('horses', error.message)
      return (data ?? []).map(toHorse)
    },

    async findHorseBySlug(slug) {
      const { data, error } = await client
        .from('horses')
        .select('*')
        .eq('slug', slug)
        .maybeSingle()

      if (error) fail('horses', error.message)
      return data === null ? null : toHorse(data)
    },

    async findHorseById(id) {
      const { data, error } = await client.from('horses').select('*').eq('id', id).maybeSingle()

      if (error) fail('horses', error.message)
      return data === null ? null : toHorse(data)
    },

    async insertHorse(row) {
      const { data, error } = await client
        .from('horses')
        .insert(horseColumns(row))
        .select('*')
        .single()

      if (error) fail('horses', error.message)
      return toHorse(data)
    },

    async updateHorse(id, patch) {
      const { data, error } = await client
        .from('horses')
        .update(horseColumns(patch))
        .eq('id', id)
        .select('*')
        .single()

      if (error) fail('horses', error.message)
      return toHorse(data)
    },

    async findDslById(id) {
      const { data, error } = await client.from('dsls').select('*').eq('id', id).maybeSingle()

      if (error) fail('dsls', error.message)
      return data === null ? null : toDsl(data)
    },

    async findDslByHorseAndEndDate(horseId, endDate) {
      const { data, error } = await client
        .from('dsls')
        .select('*')
        .eq('horse_id', horseId)
        .eq('end_date', endDate)
        .maybeSingle()

      if (error) fail('dsls', error.message)
      return data === null ? null : toDsl(data)
    },

    async countDslsByHorse(horseId) {
      const { count, error } = await client
        .from('dsls')
        .select('id', { count: 'exact', head: true })
        .eq('horse_id', horseId)

      if (error) fail('dsls', error.message)
      return count ?? 0
    },

    async listDsls() {
      const { data, error } = await client
        .from('dsls')
        .select('*')
        .order('end_date', { ascending: true })

      if (error) fail('dsls', error.message)
      return (data ?? []).map(toDsl)
    },

    async insertDsl(row) {
      const { data, error } = await client
        .from('dsls')
        .insert(dslColumns(row))
        .select('*')
        .single()

      if (error) fail('dsls', error.message)
      return toDsl(data)
    },

    async updateDsl(id, patch) {
      const { data, error } = await client
        .from('dsls')
        .update(dslColumns(patch))
        .eq('id', id)
        .select('*')
        .single()

      if (error) fail('dsls', error.message)
      return toDsl(data)
    },
  }
}
