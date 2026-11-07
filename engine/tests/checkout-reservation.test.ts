/**
 * B6 — the stake is reserved at Checkout, released when the hold lapses, and
 * never overdrawn.
 *
 * `DSL-ENGINE-BRIEF-2026-11-07.md` §3 (locked): reserve at Checkout
 * (decrement `stake_remaining` on session creation), 5-minute hold, cron
 * expires overdue sessions, atomic conditional decrement at the webhook as
 * the backstop.
 */

import { describe, expect, it } from 'vitest'

import { saveDsl, type SaveDslInput } from '../src/lib/dsl'
import { CHECKOUT_HOLD_SECONDS, openCheckoutSession, recordWebhookEvent, SA_DECLARATIONS } from '../src/lib/purchase'
import {
  createInMemoryPurchaseStore,
  type InMemoryPurchaseStore,
  type NewCheckoutSession,
} from '../src/lib/purchaseStore'
import type { StripeGateway } from '../src/lib/stripe'

function sampleSaveInput(overrides: Partial<SaveDslInput['dsl']> = {}): SaveDslInput {
  return {
    horse: {
      legalName: 'Reservation Belle',
      foalingDate: '2021-08-11',
      sex: 'Mare',
      colour: 'Brown',
      breeder: 'Pencarrow Stud',
      sireName: 'Almanzor',
      damName: 'Belle Rose',
      microchip: '985125000777777',
      lifeNumber: 'NZ-2021-RB',
      loveracingId: '77777',
      registered: true,
      aboutHorse: 'Strong staying mare with a late-maturing frame.',
      racingOutlookAndPedigree: 'Out of a Group-placed dam; staying family.',
      raceExpectation: 'Targeting 2000m handicaps this prep.',
      imageCount: 3,
      raceRecord: { starts: 3, wins: 1 },
    },
    trainer: {
      name: 'Shaun Ritchie',
      stable: 'Matamata Lodge',
      location: 'Matamata',
      website: null,
      bio: 'Matamata trainer with a small, select team.',
    },
    owner: {
      entity: 'Belle Rose Racing Ltd',
      contact: 'Mere Tane',
      website: null,
      profile: 'Longstanding Waikato owners.',
    },
    dsl: {
      termStart: '2026-11-01',
      endDate: '2027-10-31',
      paymentModel: 'subscription_float',
      closeStyle: 'fourteen_day',
      status: 'available',
      published: true,
      wholesaleMonthlyPerPercent: 65,
      investorSplit: 70,
      listedStake: 10,
      minStake: 2.5,
      step: 2.5,
      distributionSchedule: 'Quarterly within 14 days of NZTR settlement',
      ...overrides,
    },
  }
}

async function seed(store: InMemoryPurchaseStore) {
  const saved = await saveDsl(sampleSaveInput(), store)
  if (!saved.ok) throw new Error(saved.reason)
  const account = await store.insertAccount({
    id: 'acc-reserve-1',
    fullName: 'Tui Rewiti',
    email: 'tui@example.co.nz',
    kycStatus: 'verified',
  })
  return { dsl: saved.value.dsl, account }
}

function bindingRow(
  dslId: string,
  accountId: string,
  stake: number,
  expiresAt: string,
): NewCheckoutSession {
  return {
    dslId,
    accountId,
    printedName: 'Tui Rewiti',
    email: 'tui@example.co.nz',
    horseLegalName: 'Reservation Belle',
    stake,
    amountNzd: Math.round(stake * 71 * 100) / 100,
    executedDate: '2026-11-07',
    pdsMarkdown: '# PDS',
    saMarkdown: '# SA',
    pdsHash: 'a'.repeat(64),
    saHash: 'b'.repeat(64),
    expiresAt,
  }
}

function inFiveMinutes(): string {
  return new Date(Date.now() + CHECKOUT_HOLD_SECONDS * 1000).toISOString()
}

function fakeGateway(): StripeGateway {
  let n = 0
  return {
    async createIdentitySession() {
      throw new Error('identity is not used in these tests')
    },
    async retrieveIdentitySession() {
      throw new Error('identity is not used in these tests')
    },
    async createCheckoutSession() {
      n += 1
      return { id: `cs_reserve_${n}`, url: `https://checkout.stripe.com/c/pay/cs_reserve_${n}` }
    },
  }
}

/** Hermetic stand-in for R2: CI has no bucket. */
function fakeImages(count = 3) {
  return { countImages: async () => count }
}

describe('B6 — reserve at Checkout', () => {
  it('takes the stake out of the listing as soon as Checkout opens', async () => {
    const store = createInMemoryPurchaseStore()
    const { dsl, account } = await seed(store)

    const opened = await openCheckoutSession(
      {
        dslId: dsl.id,
        accountId: account.id,
        stake: 5,
        acceptance: {
          pdsAccepted: true,
          saAccepted: true,
          declarationsAccepted: [...SA_DECLARATIONS],
        },
        successUrl: 'https://example.test/ok',
        cancelUrl: 'https://example.test/cancel',
      },
      store,
      fakeGateway(),
      undefined,
      fakeImages(),
    )
    expect(opened.ok).toBe(true)

    expect((await store.findDslById(dsl.id))?.stakeRemaining).toBe(5)
    const row = await store.findCheckoutSessionByStripeSessionId('cs_reserve_1')
    expect(row?.status).toBe('open')
    const remainingMs = Date.parse(row?.expiresAt ?? '') - Date.now()
    expect(remainingMs).toBeGreaterThan(4 * 60 * 1000)
    expect(remainingMs).toBeLessThanOrEqual(CHECKOUT_HOLD_SECONDS * 1000)
  })

  it('cannot sell the last stake twice: the second reserve throws and the listing is unchanged', async () => {
    const store = createInMemoryPurchaseStore()
    const { dsl, account } = await seed(store)

    await store.reserveCheckoutSession(bindingRow(dsl.id, account.id, 10, inFiveMinutes()))
    expect((await store.findDslById(dsl.id))?.stakeRemaining).toBe(0)

    await expect(
      store.reserveCheckoutSession(bindingRow(dsl.id, account.id, 2.5, inFiveMinutes())),
    ).rejects.toThrow(/no stake available/)
    expect((await store.findDslById(dsl.id))?.stakeRemaining).toBe(0)
    expect(store.dump().checkoutSessions).toHaveLength(1)
  })

  it('returns the stake when the hold is released, exactly once', async () => {
    const store = createInMemoryPurchaseStore()
    const { dsl, account } = await seed(store)

    const row = await store.reserveCheckoutSession(
      bindingRow(dsl.id, account.id, 5, inFiveMinutes()),
    )
    expect((await store.findDslById(dsl.id))?.stakeRemaining).toBe(5)

    const released = await store.releaseCheckoutSession(row.id)
    expect(released?.status).toBe('released')
    expect((await store.findDslById(dsl.id))?.stakeRemaining).toBe(10)

    // A second release must not credit the listing again.
    expect(await store.releaseCheckoutSession(row.id)).toBeNull()
    expect((await store.findDslById(dsl.id))?.stakeRemaining).toBe(10)
  })

  it('expires overdue holds and leaves live ones alone', async () => {
    const store = createInMemoryPurchaseStore()
    const { dsl, account } = await seed(store)

    const past = new Date(Date.now() - 60_000).toISOString()
    const overdue = await store.reserveCheckoutSession(bindingRow(dsl.id, account.id, 2.5, past))
    const live = await store.reserveCheckoutSession(
      bindingRow(dsl.id, account.id, 2.5, inFiveMinutes()),
    )
    expect((await store.findDslById(dsl.id))?.stakeRemaining).toBe(5)

    expect(await store.expireCheckoutSessions()).toBe(1)
    expect((await store.findCheckoutSessionById(overdue.id))?.status).toBe('expired')
    expect((await store.findCheckoutSessionById(live.id))?.status).toBe('open')
    expect((await store.findDslById(dsl.id))?.stakeRemaining).toBe(7.5)

    // Idempotent: a second sweep releases nothing further.
    expect(await store.expireCheckoutSessions()).toBe(0)
    expect((await store.findDslById(dsl.id))?.stakeRemaining).toBe(7.5)
  })
})

describe('B6 — the webhook backstop', () => {
  async function paidEventFor(stripeSessionId: string, checkoutId: string, cents: number) {
    return {
      id: `evt_${stripeSessionId}`,
      type: 'checkout.session.completed',
      data: {
        object: {
          id: stripeSessionId,
          payment_status: 'paid',
          amount_total: cents,
          currency: 'nzd',
          metadata: { checkout_id: checkoutId },
        },
      },
    }
  }

  it('decrements atomically when the hold lapsed before the money arrived', async () => {
    const store = createInMemoryPurchaseStore()
    const { dsl, account } = await seed(store)

    const past = new Date(Date.now() - 60_000).toISOString()
    const row = await store.reserveCheckoutSession(bindingRow(dsl.id, account.id, 5, past))
    await store.attachStripeSession(row.id, 'cs_late_payment')
    // The cron swept the hold; the stake is back on the market.
    expect(await store.expireCheckoutSessions()).toBe(1)
    expect((await store.findDslById(dsl.id))?.stakeRemaining).toBe(10)

    const res = await recordWebhookEvent(
      await paidEventFor('cs_late_payment', row.id, 35_500),
      store,
    )
    expect(res.ok).toBe(true)
    if (!res.ok || res.value.action !== 'sale_written') return

    expect(res.value.sale.stake).toBe(5)
    expect((await store.findDslById(dsl.id))?.stakeRemaining).toBe(5)
  })

  it('refuses the sale and keeps the money flagged when the backstop has no stock', async () => {
    const store = createInMemoryPurchaseStore()
    const { dsl, account } = await seed(store)

    const past = new Date(Date.now() - 60_000).toISOString()
    const row = await store.reserveCheckoutSession(bindingRow(dsl.id, account.id, 5, past))
    await store.attachStripeSession(row.id, 'cs_no_stock')
    await store.expireCheckoutSessions()

    // Someone else took the stake while this payment was in flight.
    const other = await store.reserveCheckoutSession(
      bindingRow(dsl.id, account.id, 10, inFiveMinutes()),
    )
    expect((await store.findDslById(dsl.id))?.stakeRemaining).toBe(0)

    const res = await recordWebhookEvent(
      await paidEventFor('cs_no_stock', row.id, 35_500),
      store,
    )
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.value.action).toBe('refused')
    expect(store.dump().sales).toHaveLength(0)
    expect((await store.findCheckoutSessionById(row.id))?.status).toBe('paid_unfulfilled')
    expect((await store.findCheckoutSessionById(other.id))?.status).toBe('open')
  })

  it('flips the listing to fully_allocated when a sale takes the last stake', async () => {
    const store = createInMemoryPurchaseStore()
    const { dsl, account } = await seed(store)

    const row = await store.reserveCheckoutSession(
      bindingRow(dsl.id, account.id, 10, inFiveMinutes()),
    )
    await store.attachStripeSession(row.id, 'cs_last_stake')
    expect((await store.findDslById(dsl.id))?.stakeRemaining).toBe(0)

    const res = await recordWebhookEvent(
      await paidEventFor('cs_last_stake', row.id, 71_000),
      store,
    )
    expect(res.ok).toBe(true)
    const after = await store.findDslById(dsl.id)
    expect(after?.stakeRemaining).toBe(0)
    expect(after?.status).toBe('fully_allocated')
  })
})
