/**
 * The Supabase-backed DslStore. PLAN.md step 4.
 *
 * The operator surface is server-side only. Every table is deny-by-default
 * under RLS: no migration in `supabase/migrations` creates a policy, so the
 * anon key can read nothing and write nothing. This client therefore uses the
 * service role key, which is read from the environment on the server and is
 * never sent to a browser.
 *
 * Two column facts are load bearing here:
 *
 * - `retail_monthly_per_percent` and `wholesale_monthly_total` are generated
 *   columns. They are read back and never written, so a writer cannot store a
 *   second price.
 * - `trainers` and `owners` declare `id uuid primary key` with no default, so
 *   those two ids are generated here.
 *
 * A field left undefined is left out of the statement altogether, so Postgres
 * applies its own default rather than a null this module invented.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

import {
  DSL_STATUS_VALUES,
  type DslRow,
  type DslStatus,
  type DslStore,
  type HorseRow,
  type NewDsl,
  type NewHorse,
  type NewOwner,
  type NewTrainer,
  type OwnerRow,
  type TrainerRow,
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

/**
 * The status column is an enum in the database, so a value outside the four is a
 * fault worth naming rather than a value to quietly round to Coming Soon.
 */
function dslStatus(value: unknown): DslStatus {
  const raw = str(value)
  if (!(DSL_STATUS_VALUES as readonly string[]).includes(raw)) {
    throw new Error(`dsls.status: '${raw}' is not one of the four statuses`)
  }
  return raw as DslStatus
}

function toTrainer(value: unknown): TrainerRow {
  const row = record(value)
  return {
    id: str(row.id),
    name: str(row.name),
    stable: str(row.stable),
    location: str(row.location),
    website: strOrNull(row.website),
    bio: strOrNull(row.bio),
  }
}

function toOwner(value: unknown): OwnerRow {
  const row = record(value)
  return {
    id: str(row.id),
    entity: str(row.entity),
    contact: str(row.contact),
    website: strOrNull(row.website),
    profile: strOrNull(row.profile),
  }
}

function toHorse(value: unknown): HorseRow {
  const row = record(value)
  return {
    id: str(row.id),
    slug: str(row.slug),
    legalName: str(row.legal_name),
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
    trainerId: str(row.trainer_id),
    ownerId: str(row.owner_id),
  }
}

function toDsl(value: unknown): DslRow {
  const row = record(value)
  return {
    id: str(row.id),
    horseId: str(row.horse_id),
    endDate: str(row.end_date),
    termStart: str(row.term_start),
    paymentModel: str(row.payment_model) as DslRow['paymentModel'],
    closeStyle: str(row.close_style) as DslRow['closeStyle'],
    status: dslStatus(row.status),
    published: flag(row.published),
    wholesaleMonthlyPerPercent: num(row.wholesale_monthly_per_percent),
    retailMonthlyPerPercent: num(row.retail_monthly_per_percent),
    wholesaleMonthlyTotal: num(row.wholesale_monthly_total),
    investorSplit: numOrNull(row.investor_split),
    listedStake: num(row.listed_stake),
    minStake: num(row.min_stake),
    step: num(row.step),
    stakeRemaining: num(row.stake_remaining),
    distributionSchedule: strOrNull(row.distribution_schedule),
  }
}

/** A field left undefined is omitted, so Postgres applies its own default. */
function defined<T extends Record<string, unknown>>(columns: T): T {
  return Object.fromEntries(
    Object.entries(columns).filter(([, value]) => value !== undefined),
  ) as T
}

function trainerColumns(row: NewTrainer | Partial<NewTrainer>) {
  return defined({
    name: row.name,
    stable: row.stable,
    location: row.location,
    website: row.website,
    bio: row.bio,
  })
}

function ownerColumns(row: NewOwner | Partial<NewOwner>) {
  return defined({
    entity: row.entity,
    contact: row.contact,
    website: row.website,
    profile: row.profile,
  })
}

function horseColumns(row: Partial<NewHorse>) {
  return defined({
    slug: row.slug,
    legal_name: row.legalName,
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
    trainer_id: row.trainerId,
    owner_id: row.ownerId,
  })
}

/**
 * The two generated columns are absent on purpose: `retail_monthly_per_percent`
 * and `wholesale_monthly_total` are computed by the database.
 */
function dslColumns(row: Partial<NewDsl>) {
  return defined({
    horse_id: row.horseId,
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
  })
}

function newId(): string {
  return globalThis.crypto.randomUUID()
}

export function createSupabaseDslStore(client: SupabaseClient): DslStore {
  function fail(table: string, message: string): never {
    throw new Error(`${table}: ${message}`)
  }

  return {
    async findTrainer(match) {
      const { data, error } = await client
        .from('trainers')
        .select('*')
        .eq('name', match.name)
        .eq('stable', match.stable)
        .limit(1)
        .maybeSingle()

      if (error) fail('trainers', error.message)
      return data === null ? null : toTrainer(data)
    },

    async insertTrainer(row) {
      const { data, error } = await client
        .from('trainers')
        .insert({ id: newId(), ...trainerColumns(row) })
        .select('*')
        .single()

      if (error) fail('trainers', error.message)
      return toTrainer(data)
    },

    async findTrainerById(id) {
      const { data, error } = await client
        .from('trainers')
        .select('*')
        .eq('id', id)
        .maybeSingle()

      if (error) fail('trainers', error.message)
      return data === null ? null : toTrainer(data)
    },

    async findOwner(match) {
      const { data, error } = await client
        .from('owners')
        .select('*')
        .eq('entity', match.entity)
        .limit(1)
        .maybeSingle()

      if (error) fail('owners', error.message)
      return data === null ? null : toOwner(data)
    },

    async insertOwner(row) {
      const { data, error } = await client
        .from('owners')
        .insert({ id: newId(), ...ownerColumns(row) })
        .select('*')
        .single()

      if (error) fail('owners', error.message)
      return toOwner(data)
    },

    async findOwnerById(id) {
      const { data, error } = await client.from('owners').select('*').eq('id', id).maybeSingle()

      if (error) fail('owners', error.message)
      return data === null ? null : toOwner(data)
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
