/**
 * The DSL edit action. Chunk 2 (2026-11-10).
 *
 * An edit writes **one** `dsls` row. Records owns the horse, trainers and
 * owners, so an edit attaches ids and changes the status; it never writes
 * another table. The status machine runs against the status the DSL is at
 * now, so an illegal move is refused and the row is left alone.
 */

import { beforeEach, describe, expect, it } from 'vitest'

import {
  updateDsl,
  type EditDslInput,
  type SavedDsl,
} from '../src/lib/dsl'
import {
  createInMemoryDslStore,
  type InMemoryDslStore,
  type NewDsl,
} from '../src/lib/dslStore'
import { retailPerPercentFromWholesale } from '../src/lib/pricing'
import { APPROVED_NARRATIVE, approvedDraft, draft, seedStore } from './helpers/dsl-fixture'

async function ok(result: Awaited<ReturnType<typeof updateDsl>>): Promise<SavedDsl> {
  if (!result.ok) throw new Error(`expected an edit, got: ${result.reason}`)
  return result.value
}

function dslRow(overrides: Partial<NewDsl>): NewDsl {
  return {
    horseId: '',
    trainerId: null,
    ownerId: null,
    endDate: '2029-05-31',
    termStart: '2026-11-01',
    paymentModel: 'subscription_float',
    closeStyle: 'fourteen_day',
    status: 'coming_soon',
    published: false,
    wholesaleMonthlyPerPercent: 65,
    retailMonthlyPerPercent: retailPerPercentFromWholesale(65),
    investorSplit: 75,
    listedStake: 5,
    minStake: 1,
    step: 1,
    stakeRemaining: 5,
    distributionSchedule: 'Monthly on the 1st.',
    narrativeSignoff: null,
    narrativeApprovedAt: null,
    narrativeApprovedHash: null,
    ...overrides,
  }
}

function edit(
  seeded: {
    dsl: { id: string }
    horse: { id: string }
    trainer: { id: string }
    owner: { id: string }
  },
  overrides: Partial<EditDslInput> = {},
): EditDslInput {
  return {
    dslId: seeded.dsl.id,
    trainerId: seeded.trainer.id,
    ownerId: seeded.owner.id,
    dsl: draft({ status: 'coming_soon' }),
    ...overrides,
  }
}

let store: InMemoryDslStore

beforeEach(() => {
  store = createInMemoryDslStore()
})

/** Seed the Records rows and one DSL row in the given status. */
async function seedDsl(overrides: Partial<NewDsl> = {}) {
  const seeded = await seedStore(store)
  const dsl = await store.insertDsl(
    dslRow({ horseId: seeded.horse.id, trainerId: seeded.trainer.id, ownerId: seeded.owner.id, ...overrides }),
  )
  return { ...seeded, dsl }
}

describe('an edit re-derives the price and never resets the stake remaining', () => {
  it('re-derives the retail figure from the new wholesale figure', async () => {
    const seeded = await seedDsl()
    const saved = await ok(
      await updateDsl(edit(seeded, { dsl: draft({ wholesaleMonthlyPerPercent: 70 }) }), store),
    )
    expect(saved.dsl.retailMonthlyPerPercent).toBe(retailPerPercentFromWholesale(70))
  })

  it('leaves the stake remaining where the sales left it', async () => {
    const seeded = await seedDsl({ stakeRemaining: 2 })
    const saved = await ok(
      await updateDsl(edit(seeded, { dsl: draft({ listedStake: 5 }) }), store),
    )
    expect(saved.dsl.stakeRemaining).toBe(2)
  })

  it('refuses commercial terms outside the range, leaving the row alone', async () => {
    const seeded = await seedDsl()
    const result = await updateDsl(
      edit(seeded, { dsl: draft({ investorSplit: 86 }) }),
      store,
    )
    expect(result.ok).toBe(false)
    const row = await store.findDslById(seeded.dsl.id)
    expect(row?.investorSplit).toBe(75)
  })
})

describe('the status is a machine', () => {
  it('permits coming_soon -> available when fully ready', async () => {
    const seeded = await seedDsl()
    const saved = await ok(
      await updateDsl(
        {
          dslId: seeded.dsl.id,
          trainerId: seeded.trainer.id,
          ownerId: seeded.owner.id,
          dsl: approvedDraft(),
        },
        store,
      ),
    )
    expect(saved.dsl.status).toBe('available')
  })

  it('permits a no-op at the same status', async () => {
    const seeded = await seedDsl({
      status: 'available',
      published: true,
      narrativeSignoff: { ...APPROVED_NARRATIVE.narrativeSignoff },
      narrativeApprovedAt: APPROVED_NARRATIVE.narrativeApprovedAt,
      narrativeApprovedHash: APPROVED_NARRATIVE.narrativeApprovedHash,
    })
    const saved = await ok(
      await updateDsl(
        {
          dslId: seeded.dsl.id,
          trainerId: seeded.trainer.id,
          ownerId: seeded.owner.id,
          dsl: draft({ status: 'available', published: true }),
        },
        store,
      ),
    )
    expect(saved.dsl.status).toBe('available')
  })

  it('permits fully_allocated -> completed', async () => {
    const seeded = await seedDsl({ status: 'fully_allocated', published: true })
    const saved = await ok(
      await updateDsl(
        {
          dslId: seeded.dsl.id,
          trainerId: seeded.trainer.id,
          ownerId: seeded.owner.id,
          dsl: draft({ status: 'completed', published: true }),
        },
        store,
      ),
    )
    expect(saved.dsl.status).toBe('completed')
  })

  it('refuses a move the machine does not declare, leaving the status alone', async () => {
    const seeded = await seedDsl({ status: 'completed', published: true })
    const result = await updateDsl(
      {
        dslId: seeded.dsl.id,
        trainerId: seeded.trainer.id,
        ownerId: seeded.owner.id,
        dsl: draft({ status: 'available', published: true }),
      },
      store,
    )
    expect(result.ok).toBe(false)
    const row = await store.findDslById(seeded.dsl.id)
    expect(row?.status).toBe('completed')
  })

  it('refuses an unregistered horse moving past coming_soon', async () => {
    const seeded = await seedDsl()
    // Mutate the horse the way Records would: registered false.
    await store.updateHorse(seeded.horse.id, { registered: false })
    const result = await updateDsl(
      {
        dslId: seeded.dsl.id,
        trainerId: seeded.trainer.id,
        ownerId: seeded.owner.id,
        dsl: approvedDraft(),
      },
      store,
    )
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.reason).toMatch(/unregistered/)
    const row = await store.findDslById(seeded.dsl.id)
    expect(row?.status).toBe('coming_soon')
  })
})

describe('the rules specific to editing', () => {
  it('refuses an edit to a DSL that does not exist', async () => {
    const seeded = await seedDsl()
    const result = await updateDsl(
      { ...edit(seeded), dslId: '00000000-0000-4000-8000-000000000000' },
      store,
    )
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.reason).toContain('does not exist')
  })

  it('refuses an end date this horse already has a DSL for', async () => {
    const seeded = await seedDsl()
    await store.insertDsl(
      dslRow({
        horseId: seeded.horse.id,
        trainerId: seeded.trainer.id,
        ownerId: seeded.owner.id,
        endDate: '2030-05-31',
      }),
    )
    const result = await updateDsl(
      edit(seeded, { dsl: draft({ endDate: '2030-05-31' }) }),
      store,
    )
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.reason).toMatch(/already has a DSL/)
  })

  it('changes the trainer on the DSL without writing a party', async () => {
    const seeded = await seedDsl()
    const otherTrainer = await store.insertParty(
      {
        ...seeded.trainer,
        displayName: 'Second Trainer',
      },
      ['trainer'],
    )
    const partiesBefore = store.dump().parties.length

    const saved = await ok(
      await updateDsl(
        { ...edit(seeded), trainerId: otherTrainer.id },
        store,
      ),
    )

    expect(saved.dsl.trainerId).toBe(otherTrainer.id)
    expect(store.dump().parties).toHaveLength(partiesBefore)
  })

  it('refuses a trainer id that does not hold the trainer role', async () => {
    const seeded = await seedDsl()
    const result = await updateDsl(
      { ...edit(seeded), trainerId: seeded.owner.id },
      store,
    )
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.reason).toMatch(/trainer role/)
  })

  it('leaves an approval in place when the edit does not mention the narrative', async () => {
    const seeded = await seedDsl({
      status: 'available',
      published: true,
      narrativeSignoff: { ...APPROVED_NARRATIVE.narrativeSignoff },
      narrativeApprovedAt: APPROVED_NARRATIVE.narrativeApprovedAt,
      narrativeApprovedHash: APPROVED_NARRATIVE.narrativeApprovedHash,
    })
    const saved = await ok(
      await updateDsl(
        {
          dslId: seeded.dsl.id,
          trainerId: seeded.trainer.id,
          ownerId: seeded.owner.id,
          dsl: draft({ status: 'available', published: true }),
        },
        store,
      ),
    )
    expect(saved.dsl.narrativeApprovedHash).toBe(APPROVED_NARRATIVE.narrativeApprovedHash)
  })

  it('refuses available when no owner is attached', async () => {
    const seeded = await seedDsl()
    const result = await updateDsl(
      {
        dslId: seeded.dsl.id,
        trainerId: seeded.trainer.id,
        ownerId: null,
        dsl: approvedDraft(),
      },
      store,
    )
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.reason).toMatch(/owner/)
  })
})
