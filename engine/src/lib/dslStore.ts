/**
 * The storage seam for the DSL page. PLAN.md step 4.
 *
 * The action layer never talks to Supabase directly. It talks to this
 * interface. The in-memory implementation carries the contract assertions in
 * CI, where no database and no credentials exist; the Supabase implementation
 * sits behind the same shape.
 *
 * Row types mirror the column names in `supabase/migrations/`. The interface
 * generates the ids for trainers and owners because those two tables declare
 * `id uuid primary key` with no default, unlike horses and dsls.
 *
 * Nothing here holds a branding field. Branding choices on the page are page
 * state and are not stored.
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

export type NewTrainer = {
  name: string
  stable: string
  location: string
  website: string | null
  bio: string | null
}

export type TrainerRow = NewTrainer & { id: string }

export type NewOwner = {
  entity: string
  contact: string
  website: string | null
  profile: string | null
}

export type OwnerRow = NewOwner & { id: string }

export type NewHorse = {
  slug: string
  legalName: string
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
  trainerId: string
  ownerId: string
}

export type HorseRow = NewHorse & { id: string }

export type NewDsl = {
  horseId: string
  endDate: string
  termStart: string
  paymentModel: PaymentModel
  closeStyle: CloseStyle
  status: DslStatus
  published: boolean
  wholesaleMonthlyPerPercent: number
  retailMonthlyPerPercent: number
  wholesaleMonthlyTotal: number
  investorSplit: number | null
  listedStake: number
  minStake: number
  step: number
  stakeRemaining: number
  distributionSchedule: string | null
}

export type DslRow = NewDsl & { id: string }

export interface DslStore {
  findTrainer(match: { name: string; stable: string }): Promise<TrainerRow | null>
  insertTrainer(row: NewTrainer): Promise<TrainerRow>
  findTrainerById(id: string): Promise<TrainerRow | null>
  findOwner(match: { entity: string }): Promise<OwnerRow | null>
  insertOwner(row: NewOwner): Promise<OwnerRow>
  findOwnerById(id: string): Promise<OwnerRow | null>
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
  trainers: TrainerRow[]
  owners: OwnerRow[]
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
 * It enforces the two uniqueness rules the schema declares, so a test that
 * would collide in the database collides here too: one horse per slug, one DSL
 * per horse per end date.
 */
export function createInMemoryDslStore(): InMemoryDslStore {
  const horses: HorseRow[] = []
  const trainers: TrainerRow[] = []
  const owners: OwnerRow[] = []
  const dsls: DslRow[] = []

  return {
    async findTrainer(match) {
      return trainers.find((row) => row.name === match.name && row.stable === match.stable) ?? null
    },
    async insertTrainer(row) {
      const created = { ...row, id: newId() }
      trainers.push(created)
      return created
    },
    async findOwner(match) {
      return owners.find((row) => row.entity === match.entity) ?? null
    },
    async insertOwner(row) {
      const created = { ...row, id: newId() }
      owners.push(created)
      return created
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
    async findTrainerById(id) {
      return trainers.find((row) => row.id === id) ?? null
    },
    async findOwnerById(id) {
      return owners.find((row) => row.id === id) ?? null
    },
    async findDslById(id) {
      return dsls.find((row) => row.id === id) ?? null
    },
    async listDsls() {
      return [...dsls]
    },
    async insertDsl(row) {
      const created = { ...row, id: newId() }
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
        trainers: [...trainers],
        owners: [...owners],
        dsls: [...dsls],
      }
    },
  }
}
