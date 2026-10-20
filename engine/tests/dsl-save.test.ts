/**
 * One operator save writes the horse, the trainer, the owner, and the DSL.
 * PLAN.md step 4, OUTCOME.md § Records and § DSL.
 *
 * Horse, trainer, and owner have no screens of their own, so this single pure
 * action is the only door those rows come through. The store is injected: the
 * in-memory implementation carries these assertions in CI, the Supabase
 * implementation sits behind the same interface.
 */

import { beforeEach, describe, expect, it } from 'vitest'

import {
  saveDsl,
  type DslDraft,
  type SaveDslInput,
  type SavedDsl,
} from '../src/lib/dsl'
import { createInMemoryDslStore, type DslStore, type InMemoryDslStore } from '../src/lib/dslStore'
import { retailPerPercentFromWholesale } from '../src/lib/pricing'

/** Stands in for a branding choice made on the page. It must never be stored. */
const BRANDING_SENTINEL = 'BRANDING-SENTINEL-NOT-STORED'

function draft(overrides: Partial<DslDraft> = {}): DslDraft {
  return {
    endDate: '2029-05-31',
    termStart: '2026-11-01',
    paymentModel: 'subscription_float',
    closeStyle: 'fourteen_day',
    status: 'coming_soon',
    published: false,
    wholesaleMonthlyPerPercent: 65,
    investorSplit: 75,
    listedStake: 5,
    minStake: 1,
    step: 1,
    distributionSchedule: 'Monthly on the 1st.',
    ...overrides,
  }
}

function input(overrides: Partial<SaveDslInput> = {}): SaveDslInput {
  return {
    horse: {
      legalName: 'Lady Ketchikan',
      foalingDate: '2021-09-14',
      sex: 'Filly',
      colour: 'Bay',
      breeder: 'Ketchikan Bloodstock Ltd',
      sireName: 'Wexford Lad',
      damName: 'Ketchikan Bay',
      microchip: '985113000123456',
      lifeNumber: 'NZ01234567',
      loveracingId: 'LR-88421',
      registered: true,
    },
    trainer: {
      name: 'T Trainer',
      stable: 'Wexford Stables',
      location: 'Cambridge',
      website: 'https://example.test',
      bio: 'One bio.',
    },
    owner: {
      entity: 'Ketchikan Bloodstock Ltd',
      contact: 'C Contact',
      website: null,
      profile: 'One profile paragraph.',
    },
    dsl: draft(),
    ...overrides,
  }
}

async function ok(result: Awaited<ReturnType<typeof saveDsl>>): Promise<SavedDsl> {
  if (!result.ok) throw new Error(`expected a save, got: ${result.reason}`)
  return result.value
}

/**
 * A store that loses the last leg of the save exactly once, the way a failed
 * `dsls.insert` over HTTP does: trainer, owner, and horse land, the DSL does
 * not. The next call behaves normally, which is the retry the operator makes.
 */
function failingFirstDslInsert(base: InMemoryDslStore): DslStore {
  let failNext = true
  return {
    ...base,
    async insertDsl(row) {
      if (failNext) {
        failNext = false
        throw new Error('dsls insert failed')
      }
      return base.insertDsl(row)
    },
  }
}

let store: InMemoryDslStore

beforeEach(() => {
  store = createInMemoryDslStore()
})

describe('one save writes and links horse, trainer, and owner', () => {
  it('creates one row in each table', async () => {
    await ok(await saveDsl(input(), store))
    const rows = store.dump()
    expect(rows.horses).toHaveLength(1)
    expect(rows.trainers).toHaveLength(1)
    expect(rows.owners).toHaveLength(1)
    expect(rows.dsls).toHaveLength(1)
  })

  it('links the DSL to the horse and the horse to its trainer and owner', async () => {
    const saved = await ok(await saveDsl(input(), store))
    expect(saved.horse.trainerId).toBe(saved.trainer.id)
    expect(saved.horse.ownerId).toBe(saved.owner.id)
    expect(saved.dsl.horseId).toBe(saved.horse.id)
  })

  it('generates the trainer and owner ids, since the schema declares no default', async () => {
    // supabase/migrations/00002_trainers.sql and 00003_owners.sql declare
    // `id uuid primary key` with no default, unlike horses and dsls.
    const saved = await ok(await saveDsl(input(), store))
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    expect(saved.trainer.id).toMatch(uuid)
    expect(saved.owner.id).toMatch(uuid)
  })

  it('derives the slug from the legal name', async () => {
    const saved = await ok(await saveDsl(input(), store))
    expect(saved.horse.slug).toBe('lady-ketchikan')
  })

  it('refuses a second horse that produces the same slug', async () => {
    await ok(await saveDsl(input(), store))
    const second = await saveDsl(input(), store)
    expect(second.ok).toBe(false)
    if (second.ok) throw new Error('expected the duplicate slug to be refused')
    expect(second.reason).toMatch(/slug/i)
    expect(store.dump().horses).toHaveLength(1)
  })

  it('reuses the trainer and owner rather than duplicating them on a second horse', async () => {
    await ok(await saveDsl(input(), store))
    await ok(
      await saveDsl(
        input({
          horse: { ...input().horse, legalName: 'Mulan The Brave', microchip: '985113000999999' },
        }),
        store,
      ),
    )
    const rows = store.dump()
    expect(rows.horses).toHaveLength(2)
    expect(rows.trainers).toHaveLength(1)
    expect(rows.owners).toHaveLength(1)
    expect(rows.horses[1].trainerId).toBe(rows.horses[0].trainerId)
  })
})

describe('the initial stake remaining is the listed stake', () => {
  it('sets stake_remaining equal to listed_stake on insert', async () => {
    const saved = await ok(await saveDsl(input({ dsl: draft({ listedStake: 100 }) }), store))
    expect(saved.dsl.stakeRemaining).toBe(100)
  })

  it('never leaves stake_remaining unset, since the column has no default', async () => {
    // supabase/migrations/00005_dsls.sql:39 is `not null` with no default.
    const saved = await ok(await saveDsl(input({ dsl: draft({ listedStake: 5, step: 5 }) }), store))
    expect(saved.dsl.stakeRemaining).toBe(5)
    expect(saved.dsl.stakeRemaining).toBe(saved.dsl.listedStake)
  })
})

describe('the retail price is derived, never supplied', () => {
  it('uses the Step 3 rules module for the stored retail figure', async () => {
    const saved = await ok(await saveDsl(input({ dsl: draft({ wholesaleMonthlyPerPercent: 65 }) }), store))
    const expected = retailPerPercentFromWholesale(65)
    expect(expected).toBe(71)
    expect(saved.dsl.retailMonthlyPerPercent).toBe(expected)
  })

  it('ignores a retail figure passed in from the page', async () => {
    // A DSL row holds one price input. The generated column means a writer
    // cannot store a second one, and the action must not either. The sentinel
    // is long enough that no generated id can contain it by accident.
    const tampered = {
      ...input(),
      dsl: { ...draft(), retailMonthlyPerPercent: 987654321 },
    }
    const saved = await ok(await saveDsl(tampered as SaveDslInput, store))
    expect(saved.dsl.retailMonthlyPerPercent).toBe(71)
    expect(JSON.stringify(store.dump())).not.toContain('987654321')
  })

  it('keeps the wholesale figure as the single price input', async () => {
    const saved = await ok(
      await saveDsl(input({ dsl: draft({ wholesaleMonthlyPerPercent: 70 }) }), store),
    )
    expect(saved.dsl.wholesaleMonthlyPerPercent).toBe(70)
    expect(saved.dsl.retailMonthlyPerPercent).toBe(76)
  })
})

describe('branding fields on the page are not stored', () => {
  it('writes no branding onto the horse or the DSL', async () => {
    const saved = await ok(
      await saveDsl(
        {
          ...input(),
          branding: { primary: BRANDING_SENTINEL },
        } as SaveDslInput,
        store,
      ),
    )
    expect(Object.keys(saved.horse)).not.toContain('branding')
    expect(Object.keys(saved.dsl)).not.toContain('branding')
    expect(JSON.stringify(store.dump())).not.toContain(BRANDING_SENTINEL)
  })
})

describe('commercial terms are validated before anything is written', () => {
  it('refuses an investor split below the range', async () => {
    const result = await saveDsl(input({ dsl: draft({ investorSplit: 49 }) }), store)
    expect(result.ok).toBe(false)
    expect(store.dump().horses).toHaveLength(0)
  })

  it('refuses an investor split above the range', async () => {
    const result = await saveDsl(input({ dsl: draft({ investorSplit: 86 }) }), store)
    expect(result.ok).toBe(false)
    expect(store.dump().horses).toHaveLength(0)
  })

  it('stores an unassigned split as null, never as the empty form value', async () => {
    const saved = await ok(await saveDsl(input({ dsl: draft({ investorSplit: null }) }), store))
    expect(saved.dsl.investorSplit).toBeNull()
  })

  it('refuses a listed stake that is not a whole multiple of the step', async () => {
    const result = await saveDsl(
      input({ dsl: draft({ listedStake: 7, minStake: 1, step: 5 }) }),
      store,
    )
    expect(result.ok).toBe(false)
    expect(store.dump().horses).toHaveLength(0)
  })
})

describe('the registration gate holds on save', () => {
  it('saves an unregistered horse typed by hand at coming_soon', async () => {
    const saved = await ok(
      await saveDsl(
        input({
          horse: {
            ...input().horse,
            registered: false,
            microchip: null,
            lifeNumber: null,
            loveracingId: null,
          },
          dsl: draft({ status: 'coming_soon', published: false }),
        }),
        store,
      ),
    )
    expect(saved.horse.registered).toBe(false)
    expect(saved.horse.microchip).toBeNull()
  })

  it('saves an unregistered horse at coming_soon whether published or not', async () => {
    const saved = await ok(
      await saveDsl(
        input({ horse: { ...input().horse, registered: false }, dsl: draft({ published: true }) }),
        store,
      ),
    )
    expect(saved.dsl.status).toBe('coming_soon')
    expect(saved.dsl.published).toBe(true)
  })

  it('refuses to save an unregistered horse past coming_soon, writing nothing', async () => {
    for (const status of ['available', 'fully_allocated', 'completed'] as const) {
      const scoped = createInMemoryDslStore()
      const result = await saveDsl(
        input({ horse: { ...input().horse, registered: false }, dsl: draft({ status }) }),
        scoped,
      )
      expect(result.ok).toBe(false)
      const rows = scoped.dump()
      expect(rows.horses).toHaveLength(0)
      expect(rows.trainers).toHaveLength(0)
      expect(rows.owners).toHaveLength(0)
      expect(rows.dsls).toHaveLength(0)
    }
  })

  it('permits a registered horse to save at available', async () => {
    const saved = await ok(
      await saveDsl(input({ dsl: draft({ status: 'available', published: true }) }), store),
    )
    expect(saved.dsl.status).toBe('available')
  })
})

describe('the race record is one jsonb blob', () => {
  it('stores the record as a single object on the horse', async () => {
    const saved = await ok(
      await saveDsl(
        input({
          horse: {
            ...input().horse,
            raceRecord: { starts: 4, wins: 1, places: 1, resultLines: ['1st Maiden 1200'] },
          },
        }),
        store,
      ),
    )
    expect(saved.horse.raceRecord).toEqual({
      starts: 4,
      wins: 1,
      places: 1,
      resultLines: ['1st Maiden 1200'],
    })
  })

  it('defaults the record to an empty object, never null', async () => {
    const saved = await ok(await saveDsl(input(), store))
    expect(saved.horse.raceRecord).toEqual({})
  })
})

describe('the soft slots are the three on the horse', () => {
  it('writes about_horse, racing_outlook_and_pedigree, and race_expectation', async () => {
    const saved = await ok(
      await saveDsl(
        input({
          horse: {
            ...input().horse,
            aboutHorse: 'About the horse.',
            racingOutlookAndPedigree: 'Outlook and pedigree.',
            raceExpectation: 'Race expectation.',
          },
        }),
        store,
      ),
    )
    expect(saved.horse.aboutHorse).toBe('About the horse.')
    expect(saved.horse.racingOutlookAndPedigree).toBe('Outlook and pedigree.')
    expect(saved.horse.raceExpectation).toBe('Race expectation.')
  })

  it('leaves them empty on a first save, so the operator can fill them after loading', async () => {
    const saved = await ok(await saveDsl(input(), store))
    expect(saved.horse.aboutHorse).toBeNull()
    expect(saved.horse.racingOutlookAndPedigree).toBeNull()
    expect(saved.horse.raceExpectation).toBeNull()
  })
})

describe('a save abandoned at its last leg does not lock the horse out', () => {
  it('reuses the orphan horse instead of refusing its slug on retry', async () => {
    const flaky = failingFirstDslInsert(store)

    await expect(saveDsl(input(), flaky)).rejects.toThrow(/dsls insert failed/)
    expect(store.dump().horses).toHaveLength(1)
    expect(store.dump().dsls).toHaveLength(0)

    const retry = await ok(await saveDsl(input(), flaky))
    const rows = store.dump()
    expect(rows.horses).toHaveLength(1)
    expect(rows.dsls).toHaveLength(1)
    expect(retry.dsl.horseId).toBe(retry.horse.id)
    expect(rows.dsls[0].horseId).toBe(rows.horses[0].id)
  })

  it('takes the corrected values from the resubmission onto the orphan', async () => {
    const flaky = failingFirstDslInsert(store)
    await expect(saveDsl(input(), flaky)).rejects.toThrow(/dsls insert failed/)

    const retry = await ok(
      await saveDsl(
        input({ horse: { ...input().horse, colour: 'Chestnut', imageCount: 3 } }),
        flaky,
      ),
    )
    expect(retry.horse.colour).toBe('Chestnut')
    expect(retry.horse.imageCount).toBe(3)
    expect(store.dump().horses).toHaveLength(1)
  })

  it('still refuses a slug collision once the horse has a DSL of its own', async () => {
    await ok(await saveDsl(input(), store))
    const second = await saveDsl(input(), store)
    expect(second.ok).toBe(false)
    expect(store.dump().horses).toHaveLength(1)
    expect(store.dump().dsls).toHaveLength(1)
  })
})

describe('the payment-model rule holds on save', () => {
  const shortTerms = [
    { termStart: '2026-01-01', endDate: '2026-03-31' }, // 3 months
    { termStart: '2026-01-01', endDate: '2026-04-30' }, // 4 months
    { termStart: '2026-01-01', endDate: '2026-05-31' }, // 5 months
  ]

  it('refuses subscription_float at 3, 4, and 5 months, writing nothing', async () => {
    for (const dates of shortTerms) {
      const scoped = createInMemoryDslStore()
      const result = await saveDsl(
        input({ dsl: draft({ ...dates, paymentModel: 'subscription_float' }) }),
        scoped,
      )

      expect(result.ok).toBe(false)
      if (result.ok) throw new Error('expected the short float to be refused')
      expect(result.reason).toMatch(/must use upfront/)
      expect(scoped.dump().horses).toHaveLength(0)
      expect(scoped.dump().dsls).toHaveLength(0)
    }
  })

  it('accepts upfront at 5 months', async () => {
    const saved = await ok(
      await saveDsl(
        input({
          dsl: draft({
            termStart: '2026-01-01',
            endDate: '2026-05-31',
            paymentModel: 'upfront',
          }),
        }),
        store,
      ),
    )
    expect(saved.dsl.paymentModel).toBe('upfront')
  })

  it('accepts either model at 6 months', async () => {
    for (const paymentModel of ['subscription_float', 'upfront'] as const) {
      const scoped = createInMemoryDslStore()
      const saved = await ok(
        await saveDsl(
          input({
            dsl: draft({
              termStart: '2026-01-01',
              endDate: '2026-06-30',
              paymentModel,
            }),
          }),
          scoped,
        ),
      )
      expect(saved.dsl.paymentModel).toBe(paymentModel)
    }
  })

  it('accepts upfront at 18 months', async () => {
    const saved = await ok(
      await saveDsl(
        input({
          dsl: draft({
            termStart: '2026-01-01',
            endDate: '2027-06-30',
            paymentModel: 'upfront',
          }),
        }),
        store,
      ),
    )
    expect(saved.dsl.paymentModel).toBe('upfront')
  })

  it('refuses invalid term dates, writing nothing', async () => {
    for (const dates of [
      { termStart: '2026-01-01', endDate: '2026-13-01' },
      { termStart: '2026-06-01', endDate: '2026-05-31' },
      { termStart: '2026-03-20', endDate: '2026-03-01' },
      { termStart: '2026-01-15', endDate: '2026-06-30' },
      { termStart: '2026-01-01', endDate: '2026-06-15' },
    ]) {
      const scoped = createInMemoryDslStore()
      const result = await saveDsl(input({ dsl: draft(dates) }), scoped)

      expect(result.ok).toBe(false)
      if (result.ok) throw new Error('expected the invalid term to be refused')
      expect(result.reason).toMatch(/term dates are invalid/)
      expect(scoped.dump().horses).toHaveLength(0)
    }
  })
})
