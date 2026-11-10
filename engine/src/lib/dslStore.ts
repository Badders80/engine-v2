/**
 * The storage seam for the DSL page. Chunk 2, ruling 10.
 *
 * A real-world person or company is one `parties` row. Roles are
 * relationships on `party_roles`, never permissions (ruling 22). Records
 * author entities; the DSL attaches their ids and writes `dsls` only.
 *
 * The action layer never talks to Supabase directly. It talks to this
 * interface. The in-memory implementation carries the contract assertions in
 * CI, where no database and no credentials exist.
 */

export type PaymentModel = 'subscription_float' | 'upfront'
export type CloseStyle = 'fourteen_day' | 'three_x_remaining'

/**
 * The four statuses, from `supabase/migrations/00001_enums.sql`. Declared here
 * because the row shape is what carries them; `./dsl` re-exports both.
 */
export const DSL_STATUS_VALUES = [
  'coming_soon',
  'available',
  'fully_allocated',
  'completed',
] as const

export type DslStatus = (typeof DSL_STATUS_VALUES)[number]

/** One extra link on a party. Stored as a jsonb array. */
export type LinkEntry = { label: string; url: string }

/** The roles a profile may hold. Extensible: the column is plain text. */
export const PARTY_ROLES = ['trainer', 'owner'] as const
export type PartyRole = (typeof PARTY_ROLES)[number]

/**
 * Shared fields live once. `company` is the trainer's stable, `contact` is the
 * owner's contact person; `bio` is both the trainer bio and the owner profile.
 * The trainer block and owner block render by role.
 */
export type NewParty = {
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
}

export type PartyRow = NewParty & { id: string; roles: PartyRole[] }

export type NewHorse = {
  slug: string
  legalName: string
  /**
   * The unofficial stable nickname (Nellie, Mulan, Coco). Optional and
   * display-only — never a slug, folder or key.
   */
  barnName?: string | null
  foalingDate: string
  sex: string
  colour: string
  breeder: string | null
  sireName: string
  damName: string
  microchip: string | null
  lifeNumber: string | null
  loveracingId: string | null
  registered: boolean
  aboutHorse: string | null
  racingOutlookAndPedigree: string | null
  raceExpectation: string | null
  imageCount: number
  raceRecord: Record<string, unknown>
}

export type HorseRow = NewHorse & { id: string }

/**
 * A DSL row. The commercial and term fields are nullable on purpose: a DSL
 * exists from the moment the deal does, and its terms may not be complete
 * yet. Anything that reads a price must narrow through `isPricedDsl` first.
 *
 * `trainerId` and `ownerId` point at `parties`; the row is the only place a
 * deal links a horse, a trainer and an owner.
 */
export type NewDsl = {
  horseId: string
  trainerId: string | null
  ownerId: string | null
  endDate: string | null
  termStart: string | null
  paymentModel: PaymentModel | null
  closeStyle: CloseStyle | null
  status: DslStatus
  published: boolean
  wholesaleMonthlyPerPercent: number | null
  retailMonthlyPerPercent: number | null
  investorSplit: number | null
  listedStake: number | null
  minStake: number | null
  step: number | null
  stakeRemaining: number | null
  distributionSchedule: string | null
  narrativeSignoff: Record<string, boolean> | null
  narrativeApprovedAt: string | null
  narrativeApprovedHash: string | null
  /**
   * Deal-local soft content. Optional on the type so older fixtures stay
   * valid; a null or blank value means "read through from Records live".
   */
  narrativeAboutHorse?: string | null
  narrativeRacingOutlook?: string | null
  narrativeRaceExpectation?: string | null
  /** Source and dismissed hashes per overridden slot (U5). */
  narrativeOverrideMeta?: NarrativeOverrideMeta | null
  /**
   * The manual close (U19). Absent on older fixtures; a listing that was never
   * closed has all three null.
   */
  closedAt?: string | null
  closedReason?: string | null
  closedBy?: string | null
}

/** One overridden slot's two fingerprints. */
export type NarrativeOverrideMetaEntry = {
  sourceHash?: string
  dismissedHash?: string
}

export type NarrativeOverrideMeta = Partial<
  Record<
    | 'horse.about_horse'
    | 'horse.racing_outlook_and_pedigree'
    | 'horse.race_expectation',
    NarrativeOverrideMetaEntry
  >
>

export type DslRow = NewDsl & { id: string }

/**
 * A DSL that can be listed and bought: every field the quote and the pack
 * need except a term start. Chunk 3 listings carry an expiry and no start
 * (ruling 25); the sale stamps the start.
 */
export type ListableDsl = DslRow & {
  trainerId: string
  ownerId: string
  endDate: string
  paymentModel: PaymentModel
  closeStyle: CloseStyle
  wholesaleMonthlyPerPercent: number
  retailMonthlyPerPercent: number
  investorSplit: number
  listedStake: number
  minStake: number
  step: number
  stakeRemaining: number
}

/** A DSL with a real start: the shape a saved, dated deal has. */
export type PricedDsl = ListableDsl & {
  termStart: string
}

export function isListableDsl(dsl: DslRow): dsl is ListableDsl {
  return (
    dsl.trainerId !== null &&
    dsl.ownerId !== null &&
    dsl.endDate !== null &&
    dsl.paymentModel !== null &&
    dsl.closeStyle !== null &&
    dsl.wholesaleMonthlyPerPercent !== null &&
    dsl.retailMonthlyPerPercent !== null &&
    dsl.investorSplit !== null &&
    dsl.listedStake !== null &&
    dsl.minStake !== null &&
    dsl.step !== null &&
    dsl.stakeRemaining !== null
  )
}

export function isPricedDsl(dsl: DslRow): dsl is PricedDsl {
  return isListableDsl(dsl) && dsl.termStart !== null
}

export interface DslStore {
  findPartyById(id: string): Promise<PartyRow | null>
  listParties(): Promise<PartyRow[]>
  listPartiesByRole(role: PartyRole): Promise<PartyRow[]>
  insertParty(row: NewParty, roles: readonly PartyRole[]): Promise<PartyRow>
  updateParty(id: string, patch: Partial<NewParty>): Promise<PartyRow>
  setPartyRoles(id: string, roles: readonly PartyRole[]): Promise<PartyRow>
  listHorses(): Promise<HorseRow[]>
  findHorseBySlug(slug: string): Promise<HorseRow | null>
  findHorseById(id: string): Promise<HorseRow | null>
  insertHorse(row: NewHorse): Promise<HorseRow>
  updateHorse(id: string, patch: Partial<NewHorse>): Promise<HorseRow>
  findDslById(id: string): Promise<DslRow | null>
  findDslByHorseAndEndDate(horseId: string, endDate: string): Promise<DslRow | null>
  countDslsByHorse(horseId: string): Promise<number>
  listDsls(): Promise<DslRow[]>
  insertDsl(row: NewDsl): Promise<DslRow>
  updateDsl(id: string, patch: Partial<NewDsl>): Promise<DslRow>
}

export type StoreSnapshot = {
  horses: HorseRow[]
  parties: PartyRow[]
  dsls: DslRow[]
}

export type InMemoryDslStore = DslStore & { dump(): StoreSnapshot }

function newId(): string {
  return globalThis.crypto.randomUUID()
}

/** An update to a row that is not there is a bug, not a quiet insert. */
function mustFind<T>(row: T | undefined, table: string, id: string): T {
  if (row === undefined) throw new Error(`${table} ${id} does not exist`)
  return row
}

/**
 * An in-memory store with the same shape as the Supabase one.
 *
 * It enforces the uniqueness rules the schema declares, so a test that would
 * collide in the database collides here too: one horse per slug, one DSL per
 * horse per end date.
 */
export function createInMemoryDslStore(): InMemoryDslStore {
  const horses: HorseRow[] = []
  const parties: PartyRow[] = []
  const dsls: DslRow[] = []

  return {
    async findPartyById(id) {
      return parties.find((row) => row.id === id) ?? null
    },
    async listParties() {
      return [...parties]
    },
    async listPartiesByRole(role) {
      return parties.filter((row) => row.roles.includes(role))
    },
    async insertParty(row, roles) {
      const created = { ...row, id: newId(), roles: [...new Set(roles)] }
      parties.push(created)
      return created
    },
    async updateParty(id, patch) {
      const index = parties.findIndex((row) => row.id === id)
      mustFind(parties[index], 'party', id)
      const updated = { ...parties[index], ...patch }
      parties[index] = updated
      return updated
    },
    async setPartyRoles(id, roles) {
      const index = parties.findIndex((row) => row.id === id)
      mustFind(parties[index], 'party', id)
      const updated = { ...parties[index], roles: [...new Set(roles)] }
      parties[index] = updated
      return updated
    },
    async findHorseBySlug(slug) {
      return horses.find((row) => row.slug === slug) ?? null
    },
    async findHorseById(id) {
      return horses.find((row) => row.id === id) ?? null
    },
    async insertHorse(row) {
      const created = { ...row, id: newId() }
      horses.push(created)
      return created
    },
    async findDslByHorseAndEndDate(horseId, endDate) {
      return dsls.find((row) => row.horseId === horseId && row.endDate === endDate) ?? null
    },
    async countDslsByHorse(horseId) {
      return dsls.filter((row) => row.horseId === horseId).length
    },
    async listHorses() {
      return [...horses]
    },
    async findDslById(id) {
      return dsls.find((row) => row.id === id) ?? null
    },
    async listDsls() {
      return [...dsls]
    },
    async insertDsl(row) {
      const created = {
        ...row,
        id: newId(),
        closedAt: row.closedAt ?? null,
        closedReason: row.closedReason ?? null,
        closedBy: row.closedBy ?? null,
      }
      dsls.push(created)
      return created
    },
    async updateDsl(id, patch) {
      const index = dsls.findIndex((row) => row.id === id)
      mustFind(dsls[index], 'dsl', id)
      const updated = { ...dsls[index], ...patch }
      dsls[index] = updated
      return updated
    },
    async updateHorse(id, patch) {
      const index = horses.findIndex((row) => row.id === id)
      mustFind(horses[index], 'horse', id)
      const updated = { ...horses[index], ...patch }
      horses[index] = updated
      return updated
    },
    dump() {
      return {
        horses: [...horses],
        parties: [...parties],
        dsls: [...dsls],
      }
    },
  }
}
