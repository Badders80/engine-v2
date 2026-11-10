/**
 * The DSL create action. Chunk 2 (2026-11-10), ruling 11.
 *
 * The DSL attaches existing Records rows: `saveDsl` takes `horseId`,
 * `trainerId` and `ownerId` and writes **one** `dsls` row. It never writes a
 * horse, trainer or owner. A failure therefore leaves zero rows.
 *
 * The store is injected: the in-memory implementation carries these
 * assertions in CI; the Supabase implementation sits behind the same
 * interface and is probed separately.
 */

import { beforeEach, describe, expect, it } from 'vitest'

import { saveDsl, type SaveDslInput, type SavedDsl } from '../src/lib/dsl'
import { createInMemoryDslStore, type DslStore, type InMemoryDslStore } from '../src/lib/dslStore'
import { retailPerPercentFromWholesale } from '../src/lib/pricing'
import {
  approvedDraft,
  draft,
  saveInput,
  seedStore,
} from './helpers/dsl-fixture'

async function ok(result: Awaited<ReturnType<typeof saveDsl>>): Promise<SavedDsl> {
  if (!result.ok) throw new Error(`expected a save, got: ${result.reason}`)
  return result.value
}

/** A store whose single `insertDsl` fails once, the way a refused HTTP write does. */
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

describe('the DSL writes one table', () => {
  it('writes exactly one dsls row and no horse or party row', async () => {
    const input = await saveInput(store)
    const before = store.dump()

    const saved = await ok(await saveDsl(input, store))
    const after = store.dump()

    expect(after.horses).toHaveLength(before.horses.length)
    expect(after.parties).toHaveLength(before.parties.length)
    expect(after.dsls).toHaveLength(before.dsls.length + 1)
    expect(saved.dsl.id).toBe(after.dsls[0].id)
  })

  it('links the DSL to the horse, the trainer and the owner by id', async () => {
    const input = await saveInput(store)
    const saved = await ok(await saveDsl(input, store))

    expect(saved.dsl.horseId).toBe(input.horseId)
    expect(saved.dsl.trainerId).toBe(input.trainerId)
    expect(saved.dsl.ownerId).toBe(input.ownerId)
    expect(saved.trainer?.id).toBe(input.trainerId)
    expect(saved.owner?.id).toBe(input.ownerId)
  })

  it('leaves zero rows when the one write fails', async () => {
    const input = await saveInput(store)
    const before = store.dump()

    await expect(saveDsl(input, failingFirstDslInsert(store))).rejects.toThrow('dsls insert failed')

    const after = store.dump()
    expect(after.dsls).toHaveLength(before.dsls.length)
    expect(after.horses).toHaveLength(before.horses.length)
    expect(after.parties).toHaveLength(before.parties.length)
  })

  it('allows a Coming Soon DSL with no trainer and no owner', async () => {
    const seeded = await seedStore(store)
    const saved = await ok(
      await saveDsl(
        { horseId: seeded.horse.id, trainerId: null, ownerId: null, dsl: draft() },
        store,
      ),
    )
    expect(saved.dsl.trainerId).toBeNull()
    expect(saved.dsl.ownerId).toBeNull()
    expect(saved.trainer).toBeNull()
    expect(saved.owner).toBeNull()
  })
})

describe('the ids must name Records rows that hold the role', () => {
  it('refuses a horse id that does not exist', async () => {
    const input = await saveInput(store)
    const result = await saveDsl({ ...input, horseId: 'missing-horse' }, store)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.reason).toContain('does not exist')
    expect(store.dump().dsls).toHaveLength(0)
  })

  it('refuses a trainer id that does not exist', async () => {
    const input = await saveInput(store)
    const result = await saveDsl({ ...input, trainerId: 'missing-party' }, store)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.reason).toContain('does not exist')
    expect(store.dump().dsls).toHaveLength(0)
  })

  it('refuses an owner id that does not hold the owner role', async () => {
    const seeded = await seedStore(store)
    const trainerOnly = await store.insertParty(
      { ...seeded.trainer, displayName: 'Trainer Only' },
      ['trainer'],
    )
    const result = await saveDsl(
      { horseId: seeded.horse.id, trainerId: seeded.trainer.id, ownerId: trainerOnly.id, dsl: draft() },
      store,
    )
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.reason).toMatch(/owner role/)
    expect(store.dump().dsls).toHaveLength(0)
  })

  it('refuses a trainer id that does not hold the trainer role', async () => {
    const seeded = await seedStore(store)
    const ownerOnly = await store.insertParty({ ...seeded.owner, displayName: 'Owner Only' }, [
      'owner',
    ])
    const result = await saveDsl(
      { horseId: seeded.horse.id, trainerId: ownerOnly.id, ownerId: seeded.owner.id, dsl: draft() },
      store,
    )
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.reason).toMatch(/trainer role/)
  })
})

describe('a horse may hold several terms', () => {
  it('allows a second DSL for the same horse at a different expiry', async () => {
    const input = await saveInput(store)
    await ok(await saveDsl(input, store))

    const result = await saveDsl({ ...input, dsl: draft({ endDate: '2030-05-31' }) }, store)
    expect(result.ok).toBe(true)
    expect(store.dump().dsls).toHaveLength(2)
  })
})

describe('the initial stake remaining is the listed stake', () => {
  it('sets stake_remaining equal to listed_stake on insert', async () => {
    const input = await saveInput(store, { listedStake: 12 })
    const saved = await ok(await saveDsl(input, store))
    expect(saved.dsl.stakeRemaining).toBe(12)
  })

  it('never leaves stake_remaining unset when the listed stake is blank', async () => {
    const input = await saveInput(store, { listedStake: Number.NaN })
    const saved = await ok(await saveDsl(input, store))
    expect(saved.dsl.listedStake).toBeNull()
    expect(saved.dsl.stakeRemaining).toBeNull()
  })
})

describe('the retail price is derived, never supplied', () => {
  it('uses the pricing module for the stored retail figure', async () => {
    const input = await saveInput(store, { wholesaleMonthlyPerPercent: 65 })
    const saved = await ok(await saveDsl(input, store))
    expect(saved.dsl.retailMonthlyPerPercent).toBe(retailPerPercentFromWholesale(65))
  })
})

describe('commercial terms are validated before anything is written', () => {
  it('refuses an investor split below the range', async () => {
    const input = await saveInput(store, { investorSplit: 49 })
    const result = await saveDsl(input, store)
    expect(result.ok).toBe(false)
    expect(store.dump().dsls).toHaveLength(0)
  })

  it('refuses an investor split above the range', async () => {
    const input = await saveInput(store, { investorSplit: 86 })
    const result = await saveDsl(input, store)
    expect(result.ok).toBe(false)
    expect(store.dump().dsls).toHaveLength(0)
  })

  it('stores an unassigned split as null, never as the empty form value', async () => {
    const input = await saveInput(store, { investorSplit: Number.NaN as unknown as number })
    const saved = await ok(await saveDsl(input, store))
    expect(saved.dsl.investorSplit).toBeNull()
  })

  it('refuses a listed stake that is not a whole multiple of the step', async () => {
    const input = await saveInput(store, { listedStake: 5, step: 2 })
    const result = await saveDsl(input, store)
    expect(result.ok).toBe(false)
    expect(store.dump().dsls).toHaveLength(0)
  })

  it('refuses a minimum stake above the listed stake', async () => {
    const input = await saveInput(store, { minStake: 6, listedStake: 5 })
    const result = await saveDsl(input, store)
    expect(result.ok).toBe(false)
  })
})

describe('the registration gate holds on save', () => {
  it('saves an unregistered horse at coming_soon', async () => {
    const input = await saveInput(store, { status: 'coming_soon' }, { horse: { registered: false } })
    const saved = await ok(await saveDsl(input, store))
    expect(saved.dsl.status).toBe('coming_soon')
  })

  it('refuses an unregistered horse at available, writing nothing', async () => {
    const input = await saveInput(
      store,
      approvedDraft(),
      { horse: { registered: false } },
    )
    const result = await saveDsl(input, store)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.reason).toMatch(/unregistered/)
    expect(store.dump().dsls).toHaveLength(0)
  })

  it('permits a registered horse to save at available when fully ready', async () => {
    const seeded = await seedStore(store)
    const input: SaveDslInput = {
      horseId: seeded.horse.id,
      trainerId: seeded.trainer.id,
      ownerId: seeded.owner.id,
      dsl: approvedDraft(),
    }
    const saved = await ok(await saveDsl(input, store))
    expect(saved.dsl.status).toBe('available')
  })
})

describe('the payment-model rule holds on save', () => {
  it('refuses subscription_float at 3, 4, and 5 months', async () => {
    for (const endDate of ['2027-01-31', '2027-02-28', '2027-03-31']) {
      const fresh = createInMemoryDslStore()
      const input = await saveInput(fresh, { paymentModel: 'subscription_float', endDate })
      const result = await saveDsl(input, fresh)
      expect(result.ok).toBe(false)
      expect(fresh.dump().dsls).toHaveLength(0)
    }
  })

  it('accepts upfront at 5 months', async () => {
    const input = await saveInput(store, { paymentModel: 'upfront', endDate: '2027-03-31' })
    await ok(await saveDsl(input, store))
  })

  it('accepts either model at 6 months', async () => {
    for (const paymentModel of ['upfront', 'subscription_float'] as const) {
      const fresh = createInMemoryDslStore()
      const input = await saveInput(fresh, { paymentModel, endDate: '2027-04-30' })
      await ok(await saveDsl(input, fresh))
    }
  })
})

describe('a DSL exists before its deal does', () => {
  it('saves at Coming Soon with every commercial field blank', async () => {
    const input = await saveInput(store, {
      endDate: '',
      termStart: '',
      paymentModel: '' as never,
      closeStyle: '' as never,
      wholesaleMonthlyPerPercent: Number.NaN,
      investorSplit: Number.NaN as unknown as number,
      listedStake: Number.NaN,
      minStake: Number.NaN,
      step: Number.NaN,
      distributionSchedule: '',
    })
    const saved = await ok(await saveDsl(input, store))
    expect(saved.dsl.status).toBe('coming_soon')
    expect(saved.dsl.endDate).toBeNull()
    expect(saved.dsl.investorSplit).toBeNull()
  })

  it('does not refuse available for missing images', async () => {
    const seeded = await seedStore(store, { horse: { imageCount: 0 } })
    const input: SaveDslInput = {
      horseId: seeded.horse.id,
      trainerId: seeded.trainer.id,
      ownerId: seeded.owner.id,
      dsl: approvedDraft(),
    }
    const result = await saveDsl(input, store)
    expect(result.ok).toBe(true)
  })

  it('refuses available when no owner is attached', async () => {
    const seeded = await seedStore(store)
    const result = await saveDsl(
      { horseId: seeded.horse.id, trainerId: seeded.trainer.id, ownerId: null, dsl: approvedDraft() },
      store,
    )
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.reason).toMatch(/owner/)
  })

  it('refuses available when the narrative is not fully approved', async () => {
    const seeded = await seedStore(store)
    const result = await saveDsl(
      {
        horseId: seeded.horse.id,
        trainerId: seeded.trainer.id,
        ownerId: seeded.owner.id,
        dsl: approvedDraft({ narrativeSignoff: { 'horse.about_horse': true } }),
      },
      store,
    )
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.reason).toMatch(/narrative/i)
  })
})
