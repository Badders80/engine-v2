/**
 * Editing a DSL through the same door as creating one. PLAN.md step 4.
 *
 * The gate runs against the status the DSL is at now, so an unregistered horse
 * already sitting at Coming Soon cannot be walked forward by an edit. The stake
 * remaining is never reset, because buyers have drawn it down already.
 */

import { beforeEach, describe, expect, it } from 'vitest'

import {
  saveDsl,
  updateDsl,
  type DslDraft,
  type EditDslInput,
  type SaveDslInput,
  type SavedDsl,
} from '../src/lib/dsl'
import { createInMemoryDslStore, type InMemoryDslStore } from '../src/lib/dslStore'
import { retailPerPercentFromWholesale } from '../src/lib/pricing'

function draft(overrides: Partial<DslDraft> = {}): DslDraft {
  return {
    endDate: '2029-05-01',
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
      website: null,
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

/** The trainer and the owner stay as they are; only the horse and DSL move. */
function edit(seed: SavedDsl, overrides: Partial<EditDslInput> = {}): EditDslInput {
  return {
    dslId: seed.dsl.id,
    horse: {},
    trainer: input().trainer,
    owner: input().owner,
    dsl: draft(),
    ...overrides,
  }
}

async function ok(result: Awaited<ReturnType<typeof saveDsl>>): Promise<SavedDsl> {
  if (!result.ok) throw new Error(`expected a save, got: ${result.reason}`)
  return result.value
}

let store: InMemoryDslStore

async function seed(overrides: Partial<SaveDslInput> = {}): Promise<SavedDsl> {
  return ok(await saveDsl(input(overrides), store))
}

beforeEach(() => {
  store = createInMemoryDslStore()
})

describe('an edit writes the soft slots the operator fills by hand', () => {
  it('writes all three', async () => {
    const seedRow = await seed()

    const saved = await ok(
      await updateDsl(
        edit(seedRow, {
          horse: {
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

  it('keeps the hard facts it was not given', async () => {
    const seedRow = await seed()
    const saved = await ok(await updateDsl(edit(seedRow, { horse: { aboutHorse: 'Only this.' } }), store))

    expect(saved.horse.legalName).toBe('Lady Ketchikan')
    expect(saved.horse.microchip).toBe('985113000123456')
    expect(saved.horse.foalingDate).toBe('2021-09-14')
    expect(saved.horse.sireName).toBe('Wexford Lad')
    expect(saved.horse.registered).toBe(true)
  })

  it('does not duplicate the trainer or the owner', async () => {
    const seedRow = await seed()
    await ok(await updateDsl(edit(seedRow, { horse: { raceExpectation: 'Set.' } }), store))

    const rows = store.dump()
    expect(rows.trainers).toHaveLength(1)
    expect(rows.owners).toHaveLength(1)
    expect(rows.horses).toHaveLength(1)
    expect(rows.dsls).toHaveLength(1)
  })
})

describe('an edit re-derives the price and never resets the stake remaining', () => {
  it('re-derives the retail figure from the new wholesale figure', async () => {
    const seedRow = await seed()
    const saved = await ok(
      await updateDsl(edit(seedRow, { dsl: draft({ wholesaleMonthlyPerPercent: 70 }) }), store),
    )

    expect(retailPerPercentFromWholesale(65)).toBe(71)
    expect(saved.dsl.wholesaleMonthlyPerPercent).toBe(70)
    expect(saved.dsl.retailMonthlyPerPercent).toBe(76)
    expect(store.dump().dsls[0].retailMonthlyPerPercent).toBe(76)
  })

  it('ignores a retail figure passed in from the page', async () => {
    const seedRow = await seed()
    const tampered = {
      ...edit(seedRow),
      dsl: { ...draft(), retailMonthlyPerPercent: 987654321 },
    }
    const saved = await ok(await updateDsl(tampered as EditDslInput, store))

    expect(saved.dsl.retailMonthlyPerPercent).toBe(71)
    expect(JSON.stringify(store.dump())).not.toContain('987654321')
  })

  it('leaves the stake remaining where the sales left it', async () => {
    const seedRow = await seed()
    await store.updateDsl(seedRow.dsl.id, { stakeRemaining: 3 })

    const saved = await ok(
      await updateDsl(edit(seedRow, { horse: { raceExpectation: 'Set.' } }), store),
    )

    expect(saved.dsl.stakeRemaining).toBe(3)
    expect(saved.dsl.listedStake).toBe(5)
  })

  it('refuses commercial terms outside the range, leaving the row alone', async () => {
    const seedRow = await seed()
    const result = await updateDsl(edit(seedRow, { dsl: draft({ investorSplit: 86 }) }), store)

    expect(result.ok).toBe(false)
    expect(store.dump().dsls[0].investorSplit).toBe(75)
  })
})

describe('the registration gate runs against the status the DSL is at now', () => {
  it('refuses to walk an unregistered horse past coming_soon, and leaves the status alone', async () => {
    const seedRow = await seed({ horse: { ...input().horse, registered: false } })

    for (const status of ['available', 'fully_allocated', 'completed'] as const) {
      const result = await updateDsl(edit(seedRow, { dsl: draft({ status }) }), store)
      expect(result.ok).toBe(false)
      expect(store.dump().dsls[0].status).toBe('coming_soon')
    }
  })

  it('permits an unregistered horse to be edited while it stays at coming_soon', async () => {
    const seedRow = await seed({ horse: { ...input().horse, registered: false } })
    const saved = await ok(
      await updateDsl(
        edit(seedRow, { horse: { raceExpectation: 'Typed by hand.' } }),
        store,
      ),
    )

    expect(saved.dsl.status).toBe('coming_soon')
    expect(saved.horse.registered).toBe(false)
  })

  it('permits a registered horse to move to available', async () => {
    const seedRow = await seed()
    const saved = await ok(
      await updateDsl(edit(seedRow, { dsl: draft({ status: 'available', published: true }) }), store),
    )

    expect(saved.dsl.status).toBe('available')
  })

  it('refuses to move an unregistered horse forward, leaving the row where it was', async () => {
    const seedRow = await seed({ horse: { ...input().horse, registered: false } })
    const result = await updateDsl(
      edit(seedRow, { dsl: draft({ status: 'available', published: true }) }),
      store,
    )

    expect(result.ok).toBe(false)
    expect(store.dump().dsls[0].status).toBe('coming_soon')
  })

  it('allows it once the same edit records the horse as registered', async () => {
    // `registered` is a fact on the horse, so the value being written is the one
    // the gate reads. Recording the registration and taking the horse to
    // available in one save is the one lawful way past Coming Soon.
    const seedRow = await seed({ horse: { ...input().horse, registered: false } })
    const saved = await ok(
      await updateDsl(
        edit(seedRow, {
          horse: { registered: true },
          dsl: draft({ status: 'available', published: true }),
        }),
        store,
      ),
    )

    expect(saved.horse.registered).toBe(true)
    expect(saved.dsl.status).toBe('available')
  })
})

describe('the rules specific to editing', () => {
  it('refuses an edit to a DSL that does not exist', async () => {
    const seedRow = await seed()
    const result = await updateDsl(
      { ...edit(seedRow), dslId: '00000000-0000-4000-8000-000000000000' },
      store,
    )

    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('expected a refusal')
    expect(result.reason).toMatch(/does not exist/)
  })

  it('refuses an end date this horse already has a DSL for', async () => {
    const seedRow = await seed()
    // The store gives the inserted row its own id, so the seeded one is harmless.
    await store.insertDsl({ ...seedRow.dsl, endDate: '2030-05-01' })

    const result = await updateDsl(
      edit(seedRow, { dsl: draft({ endDate: '2030-05-01' }) }),
      store,
    )

    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('expected a refusal')
    expect(result.reason).toMatch(/2030-05-01/)
    expect(store.dump().dsls).toHaveLength(2)
  })

  it('refuses a rename onto a slug another horse already holds', async () => {
    const seedRow = await seed()
    await ok(
      await saveDsl(
        input({
          horse: { ...input().horse, legalName: 'Mulan The Brave', microchip: '985113000999999' },
        }),
        store,
      ),
    )

    const result = await updateDsl(
      edit(seedRow, { horse: { legalName: 'Mulan The Brave' } }),
      store,
    )

    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('expected a refusal')
    expect(result.reason).toMatch(/mulan-the-brave/)
    expect(store.dump().horses[0].slug).toBe('lady-ketchikan')
  })

  it('moves the slug with the legal name on a rename that is free', async () => {
    const seedRow = await seed()
    const saved = await ok(
      await updateDsl(edit(seedRow, { horse: { legalName: 'Lady Ketchikan II' } }), store),
    )

    expect(saved.horse.slug).toBe('lady-ketchikan-ii')
    expect(saved.horse.legalName).toBe('Lady Ketchikan II')
  })

  it('leaves the horse and DSL counts alone', async () => {
    const seedRow = await seed()
    await ok(await updateDsl(edit(seedRow), store))

    const rows = store.dump()
    expect(rows.horses).toHaveLength(1)
    expect(rows.dsls).toHaveLength(1)
  })
})

describe('the payment-model rule holds on edit', () => {
  it('refuses to move an existing float to a 5-month term, leaving the row alone', async () => {
    const seedRow = await seed()
    const result = await updateDsl(
      edit(seedRow, {
        dsl: draft({ termStart: '2026-01-01', endDate: '2026-05-31' }),
      }),
      store,
    )

    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('expected the short float to be refused')
    expect(result.reason).toMatch(/must use upfront/)

    const stored = store.dump().dsls[0]
    expect(stored.paymentModel).toBe('subscription_float')
    expect(stored.termStart).toBe('2026-11-01')
    expect(stored.endDate).toBe('2029-05-01')
  })

  it('accepts the same 5-month term once the model is upfront', async () => {
    const seedRow = await seed()
    const saved = await ok(
      await updateDsl(
        edit(seedRow, {
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
    expect(saved.dsl.termStart).toBe('2026-01-01')
    expect(saved.dsl.endDate).toBe('2026-05-31')
  })
})
