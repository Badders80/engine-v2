/**
 * Chunk 4 — Phases B and C contract tests.
 *
 * Covers the sale path (U18 snapshot, U21 sale-time start and pricing, H6
 * atomic write), the close guard (U19), the cap-table identity (U20) and the
 * absence of a delete method.
 */

import { describe, expect, it } from 'vitest'

import { saveDsl, updateDsl, type DslDraft } from '../src/lib/dsl'
import { createInMemoryEmailSender } from '../src/lib/email'
import {
  capTableFor,
  capTableIdentityHolds,
  closeListing,
  resolveCheckout,
} from '../src/lib/ledger'
import { openCheckoutSession, recordWebhookEvent, SA_DECLARATIONS } from '../src/lib/purchase'
import { createInMemoryPurchaseStore } from '../src/lib/purchaseStore'
import type { StripeGateway } from '../src/lib/stripe'
import { approvedDraft, seedStore } from './helpers/dsl-fixture'

function fakeStripe(): StripeGateway {
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
      return { id: `cs_chunk4_${n}`, url: `https://checkout.stripe.com/c/pay/cs_chunk4_${n}` }
    },
  }
}


const acceptance = {
  pdsAccepted: true,
  saAccepted: true,
  declarationsAccepted: [...SA_DECLARATIONS],
}

async function setup(overrides: Partial<DslDraft> = {}) {
  const store = createInMemoryPurchaseStore()
  const { horse, trainer, owner } = await seedStore(store, {
    horse: {
      slug: 'chunk4-mulan',
      legalName: 'Chunk Four Mulan',
      foalingDate: '2022-10-02',
      sex: 'Filly',
      colour: 'Brown',
      sireName: 'Super Seth',
      damName: 'Warrior Queen',
    },
  })
  const saved = await saveDsl(
    {
      horseId: horse.id,
      trainerId: trainer.id,
      ownerId: owner.id,
      dsl: approvedDraft({
        // Chunk 3: the listing carries an expiry and no start.
        termStart: '',
        endDate: '2027-10-31',
        paymentModel: 'subscription_float',
        closeStyle: 'fourteen_day',
        status: 'available',
        published: true,
        wholesaleMonthlyPerPercent: 70,
        investorSplit: 75,
        listedStake: 10,
        minStake: 5,
        step: 5,
        distributionSchedule: 'Monthly within 14 days of NZTR settlement',
        ...overrides,
      }),
    },
    store,
  )
  if (!saved.ok) throw new Error(saved.reason)

  const account = await store.insertAccount({
    id: 'acc-chunk4',
    fullName: 'Nikau Henare',
    email: 'nikau@example.co.nz',
    kycStatus: 'verified',
  })

  return { store, dsl: saved.value.dsl, account }
}

async function openCheckout(
  store: ReturnType<typeof createInMemoryPurchaseStore>,
  dslId: string,
  accountId: string,
  stake: number,
  executedDate: string,
) {
  const opened = await openCheckoutSession(
    {
      dslId,
      accountId,
      stake,
      acceptance,
      executedDate,
      successUrl: 'https://example.test/ok',
      cancelUrl: 'https://example.test/cancel',
    },
    store,
    fakeStripe(),
    undefined,
  )
  if (!opened.ok) throw new Error(opened.reason)
  const row = await store.findCheckoutSessionByStripeSessionId(opened.value.checkoutSessionId)
  if (row === null) throw new Error('checkout binding row was not written')
  return { stripeSessionId: opened.value.checkoutSessionId, checkout: row, quote: opened.value.quote }
}

function completedEvent(
  stripeSessionId: string,
  checkoutId: string,
  amountTotalCents: number,
  overrides: { currency?: string; paymentStatus?: string } = {},
) {
  return {
    id: `evt_${stripeSessionId}`,
    type: 'checkout.session.completed',
    data: {
      object: {
        id: stripeSessionId,
        payment_status: overrides.paymentStatus ?? 'paid',
        amount_total: amountTotalCents,
        currency: overrides.currency ?? 'nzd',
        metadata: { checkout_id: checkoutId },
      },
    },
  }
}

describe('Chunk 4 — no sale-delete path', () => {
  it('exposes no delete, insert, complete or sell method on the store', () => {
    const store = createInMemoryPurchaseStore()
    expect('deleteSaleById' in store).toBe(false)
    expect('insertSale' in store).toBe(false)
    expect('completeCheckoutSession' in store).toBe(false)
    expect('sellStake' in store).toBe(false)
    expect('recordSaleAtomically' in store).toBe(true)
  })
})

describe('Chunk 4 — U21 sale-time start and remaining-month pricing', () => {
  it('a dateless listing more than five months out is priced on the float', async () => {
    const { store, dsl } = await setup()
    expect(dsl.termStart).toBeNull()

    const { quote } = await openCheckout(store, dsl.id, 'acc-chunk4', 5, '2026-11-15')

    expect(quote.termStart).toBe('2026-11-01')
    expect(quote.termMonths).toBe(12)
    expect(quote.paymentModel).toBe('subscription_float')
    expect(quote.initialPaymentNzd).toBe(1900) // 5 months × $76 × 5%
    expect(quote.monthlyPaymentNzd).toBe(380)
  })

  it('a dateless listing with five months or less left sells upfront', async () => {
    const { store, dsl } = await setup()
    const { quote } = await openCheckout(store, dsl.id, 'acc-chunk4', 5, '2027-08-15')

    expect(quote.termStart).toBe('2027-08-01')
    expect(quote.termMonths).toBe(3)
    expect(quote.paymentModel).toBe('upfront')
    expect(quote.initialPaymentNzd).toBe(1140) // 3 months × $76 × 5%
    expect(quote.monthlyPaymentNzd).toBe(0)
  })

  it('an upfront listing stays upfront for a long term', async () => {
    const { store, dsl } = await setup({ paymentModel: 'upfront', endDate: '2027-03-31' })
    const { quote } = await openCheckout(store, dsl.id, 'acc-chunk4', 5, '2026-11-15')

    expect(quote.termStart).toBe('2026-11-01')
    expect(quote.termMonths).toBe(5)
    expect(quote.paymentModel).toBe('upfront')
    expect(quote.initialPaymentNzd).toBe(1900)
  })

  it('sells a dateless listing with the sale start and documents, never writing dsls.term_start', async () => {
    const { store, dsl, account } = await setup()
    const { stripeSessionId, checkout, quote } = await openCheckout(
      store,
      dsl.id,
      account.id,
      5,
      '2026-11-15',
    )

    const res = await recordWebhookEvent(
      completedEvent(stripeSessionId, checkout.id, Math.round(quote.initialPaymentNzd * 100)),
      store,
    )
    expect(res.ok).toBe(true)
    if (!res.ok || res.value.action !== 'sale_written') return

    const sale = res.value.sale
    expect(sale.termStart).toBe('2026-11-01')
    expect(sale.termEnd).toBe('2027-10-31')
    expect(sale.termMonths).toBe(12)
    expect(sale.paymentModelAtSale).toBe('subscription_float')
    expect(sale.endDate).toBe('2027-10-31')
    expect(sale.retailMonthlyPerPercent).toBe(76)
    expect(sale.wholesaleMonthlyPerPercent).toBe(70)
    expect(sale.investorSplit).toBe(75)
    expect(sale.listedStake).toBe(10)
    expect(sale.minStake).toBe(5)
    expect(sale.step).toBe(5)
    expect(sale.closeStyle).toBe('fourteen_day')
    expect(sale.distributionSchedule).toBe('Monthly within 14 days of NZTR settlement')

    // The documents carry the sale's start and the terms the buyer accepted.
    expect(sale.pdsMarkdown).toContain('2026-11-01')
    expect(sale.pdsMarkdown).toContain('2026-11-15')
    expect(sale.saMarkdown).toContain('2026-11-01')
    expect(sale.saMarkdown).toContain('subscription float')

    // The listing is not dated by the sale.
    expect((await store.findDslById(dsl.id))?.termStart).toBeNull()
  })

  it('compiles an upfront document when five months or less remain', async () => {
    const { store, dsl, account } = await setup()
    const opened = await openCheckout(store, dsl.id, account.id, 5, '2027-08-15')

    const checkout = opened.checkout
    expect(opened.quote.paymentModel).toBe('upfront')
    expect(checkout.pdsMarkdown).toContain('2027-08-01')
    expect(checkout.saMarkdown).toContain('Upfront')
    expect(checkout.saMarkdown).toContain('3 months')
  })
})

describe('Chunk 4 — H6 atomic sale, replay and concurrent claim', () => {
  it('writes the snapshot through one transaction and claims the hold', async () => {
    const { store, dsl, account } = await setup()
    const { stripeSessionId, checkout, quote } = await openCheckout(
      store,
      dsl.id,
      account.id,
      5,
      '2026-11-15',
    )

    const res = await recordWebhookEvent(
      completedEvent(stripeSessionId, checkout.id, Math.round(quote.initialPaymentNzd * 100)),
      store,
    )
    expect(res.ok).toBe(true)
    if (!res.ok || res.value.action !== 'sale_written') return

    expect(res.value.idempotentReplay).toBe(false)
    expect((await store.findCheckoutSessionById(checkout.id))?.status).toBe('completed')
    expect(store.dump().sales).toHaveLength(1)
    expect((await store.findDslById(dsl.id))?.stakeRemaining).toBe(5)
  })

  it('a replayed webhook returns the same sale and writes no second row', async () => {
    const { store, dsl, account } = await setup()
    const { stripeSessionId, checkout, quote } = await openCheckout(
      store,
      dsl.id,
      account.id,
      5,
      '2026-11-15',
    )
    const event = completedEvent(
      stripeSessionId,
      checkout.id,
      Math.round(quote.initialPaymentNzd * 100),
    )

    const first = await recordWebhookEvent(event, store)
    const replay = await recordWebhookEvent(event, store)

    expect(first.ok && first.value.action === 'sale_written').toBe(true)
    expect(replay.ok).toBe(true)
    if (!first.ok || first.value.action !== 'sale_written') return
    if (!replay.ok || replay.value.action !== 'sale_written') return

    expect(replay.value.idempotentReplay).toBe(true)
    expect(replay.value.sale.id).toBe(first.value.sale.id)
    expect(store.dump().sales).toHaveLength(1)
  })

  it('two concurrent claims on one hold write exactly one sale', async () => {
    const { store, dsl, account } = await setup()
    const { checkout, quote } = await openCheckout(store, dsl.id, account.id, 5, '2026-11-15')
    const amount = Math.round(quote.initialPaymentNzd * 100)

    const [a, b] = await Promise.all([
      store.recordSaleAtomically({
        checkoutId: checkout.id,
        stripeSessionId: 'cs_claim_a',
        stripeAmountTotalCents: amount,
        stripeCurrency: 'nzd',
        stripeIdentityId: null,
      }),
      store.recordSaleAtomically({
        checkoutId: checkout.id,
        stripeSessionId: 'cs_claim_b',
        stripeAmountTotalCents: amount,
        stripeCurrency: 'nzd',
        stripeIdentityId: null,
      }),
    ])

    expect([a.outcome, b.outcome].sort()).toEqual(['paid_unfulfilled', 'sale_written'])
    expect(store.dump().sales).toHaveLength(1)
  })

  it('a lapsed hold writes no sale and is marked paid_unfulfilled', async () => {
    const { store, dsl, account } = await setup()
    const past = new Date(Date.now() - 60_000).toISOString()
    const checkout = await store.reserveCheckoutSession({
      dslId: dsl.id,
      accountId: account.id,
      printedName: account.fullName,
      email: account.email,
      horseLegalName: 'Chunk Four Mulan',
      stake: 5,
      amountNzd: 1900,
      executedDate: '2026-11-15',
      pdsMarkdown: '# PDS',
      saMarkdown: '# SA',
      pdsHash: 'a'.repeat(64),
      saHash: 'b'.repeat(64),
      expiresAt: past,
    })
    await store.attachStripeSession(checkout.id, 'cs_lapsed')

    expect(await store.expireCheckoutSessions()).toBe(1)

    const res = await recordWebhookEvent(
      completedEvent('cs_lapsed', checkout.id, 190_000),
      store,
    )
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.value.action).toBe('refused')
    expect(store.dump().sales).toHaveLength(0)
    expect((await store.findCheckoutSessionById(checkout.id))?.status).toBe('paid_unfulfilled')
    expect((await store.findDslById(dsl.id))?.stakeRemaining).toBe(10)
  })
})

describe('Chunk 4 — U19 close guard and U20 invariant', () => {
  it('refuses a close while an open hold exists', async () => {
    const { store, dsl } = await setup()
    await store.reserveCheckoutSession({
      dslId: dsl.id,
      accountId: 'acc-chunk4',
      printedName: 'Nikau Henare',
      email: 'nikau@example.co.nz',
      horseLegalName: 'Chunk Four Mulan',
      stake: 5,
      amountNzd: 1900,
      executedDate: '2026-11-15',
      pdsMarkdown: '# PDS',
      saMarkdown: '# SA',
      pdsHash: 'a'.repeat(64),
      saHash: 'b'.repeat(64),
      expiresAt: new Date(Date.now() + 600_000).toISOString(),
    })

    await expect(store.closeDsl(dsl.id, 'close', 'operator')).rejects.toThrow(/held/)
    expect((await store.findDslById(dsl.id))?.status).toBe('available')
  })

  it('refuses a close while a held paid_unfulfilled exists', async () => {
    const { store, dsl, account } = await setup()
    const { checkout } = await openCheckout(store, dsl.id, account.id, 5, '2026-11-15')

    const res = await recordWebhookEvent(
      completedEvent('cs_chunk4_1', checkout.id, 190_000, { currency: 'usd' }),
      store,
      createInMemoryEmailSender(),
    )
    expect(res.ok).toBe(true)
    expect((await store.findCheckoutSessionById(checkout.id))?.status).toBe('paid_unfulfilled')
    expect((await store.findCheckoutSessionById(checkout.id))?.stakeReturnedAt).toBeNull()

    await expect(store.closeDsl(dsl.id, 'close', 'operator')).rejects.toThrow(
      /1 held and 0 returned/,
    )
  })

  it('refuses a close while a returned paid_unfulfilled exists', async () => {
    const { store, dsl, account } = await setup()
    const { stripeSessionId, checkout, quote } = await openCheckout(
      store,
      dsl.id,
      account.id,
      5,
      '2026-11-15',
    )

    await store.releaseCheckoutSession(checkout.id)
    const res = await recordWebhookEvent(
      completedEvent(stripeSessionId, checkout.id, Math.round(quote.initialPaymentNzd * 100)),
      store,
      createInMemoryEmailSender(),
    )
    expect(res.ok).toBe(true)
    const after = await store.findCheckoutSessionById(checkout.id)
    expect(after?.status).toBe('paid_unfulfilled')
    expect(after?.stakeReturnedAt).not.toBeNull()

    await expect(store.closeDsl(dsl.id, 'close', 'operator')).rejects.toThrow(
      /0 held and 1 returned/,
    )
  })

  it('resolves a held paid_unfulfilled, returns its stake, and unblocks the close', async () => {
    const { store, dsl, account } = await setup()
    const { checkout } = await openCheckout(store, dsl.id, account.id, 5, '2026-11-15')

    await recordWebhookEvent(
      completedEvent('cs_chunk4_resolve_held', checkout.id, 190_000, { currency: 'usd' }),
      store,
      createInMemoryEmailSender(),
    )
    const before = await store.findCheckoutSessionById(checkout.id)
    expect(before?.status).toBe('paid_unfulfilled')
    expect(before?.stakeReturnedAt).toBeNull()

    const resolved = await resolveCheckout(
      {
        checkoutId: checkout.id,
        resolvedBy: 'operator',
        resolution: 'refunded, no sale',
      },
      store,
    )
    expect(resolved.ok).toBe(true)

    const after = await store.findCheckoutSessionById(checkout.id)
    expect(after?.resolvedAt).not.toBeNull()
    expect(after?.resolvedBy).toBe('operator')
    expect(after?.resolution).toBe('refunded, no sale')
    expect(after?.stakeReturnedAt).not.toBeNull()
    expect((await store.findDslById(dsl.id))?.stakeRemaining).toBe(10)

    const closed = await closeListing(
      { dslId: dsl.id, reason: 'season ended', closedBy: 'operator' },
      store,
    )
    expect(closed.ok).toBe(true)
  })

  it('resolves a returned paid_unfulfilled and unblocks the close', async () => {
    const { store, dsl, account } = await setup()
    const { stripeSessionId, checkout, quote } = await openCheckout(
      store,
      dsl.id,
      account.id,
      5,
      '2026-11-15',
    )

    await store.releaseCheckoutSession(checkout.id)
    await recordWebhookEvent(
      completedEvent(stripeSessionId, checkout.id, Math.round(quote.initialPaymentNzd * 100)),
      store,
      createInMemoryEmailSender(),
    )
    const before = await store.findCheckoutSessionById(checkout.id)
    expect(before?.stakeReturnedAt).not.toBeNull()

    const resolved = await resolveCheckout(
      { checkoutId: checkout.id, resolvedBy: 'operator', resolution: 'refunded twice' },
      store,
    )
    expect(resolved.ok).toBe(true)

    const closed = await closeListing(
      { dslId: dsl.id, reason: 'season ended', closedBy: 'operator' },
      store,
    )
    expect(closed.ok).toBe(true)
  })

  it('refuses a second resolution and an empty note', async () => {
    const { store, dsl, account } = await setup()
    const { checkout } = await openCheckout(store, dsl.id, account.id, 5, '2026-11-15')
    await recordWebhookEvent(
      completedEvent('cs_chunk4_resolve_twice', checkout.id, 190_000, { currency: 'usd' }),
      store,
      createInMemoryEmailSender(),
    )

    const empty = await resolveCheckout(
      { checkoutId: checkout.id, resolvedBy: 'operator', resolution: '   ' },
      store,
    )
    expect(empty.ok).toBe(false)

    const first = await resolveCheckout(
      { checkoutId: checkout.id, resolvedBy: 'operator', resolution: 'refunded' },
      store,
    )
    expect(first.ok).toBe(true)

    const second = await resolveCheckout(
      { checkoutId: checkout.id, resolvedBy: 'operator', resolution: 'again' },
      store,
    )
    expect(second.ok).toBe(false)
  })

  it('closes an abandoned coming_soon draft', async () => {
    const { store, dsl } = await setup({ status: 'coming_soon', published: false })

    const closed = await closeListing(
      { dslId: dsl.id, reason: 'draft abandoned', closedBy: 'operator' },
      store,
    )
    expect(closed.ok).toBe(true)
    if (!closed.ok) return
    expect(closed.value.status).toBe('coming_soon')
    expect(closed.value.closedAt).not.toBeNull()
    expect(closed.value.closedReason).toBe('draft abandoned')

    const again = await closeListing(
      { dslId: dsl.id, reason: 'again', closedBy: 'operator' },
      store,
    )
    expect(again.ok).toBe(false)
  })

  it('refuses an edit to a closed draft', async () => {
    const { store, dsl } = await setup({ status: 'coming_soon', published: false })
    await closeListing(
      { dslId: dsl.id, reason: 'draft abandoned', closedBy: 'operator' },
      store,
    )

    const edit = await updateDsl(
      {
        dslId: dsl.id,
        trainerId: dsl.trainerId,
        ownerId: dsl.ownerId,
        dsl: approvedDraft({ status: 'coming_soon', published: false }),
      },
      store,
    )
    expect(edit.ok).toBe(false)
    if (!edit.ok) expect(edit.reason).toMatch(/closed/)
  })

  it('sweeps a stale hold, then closes with a reason and a closer', async () => {
    const { store, dsl } = await setup()
    await store.reserveCheckoutSession({
      dslId: dsl.id,
      accountId: 'acc-chunk4',
      printedName: 'Nikau Henare',
      email: 'nikau@example.co.nz',
      horseLegalName: 'Chunk Four Mulan',
      stake: 5,
      amountNzd: 1900,
      executedDate: '2026-11-15',
      pdsMarkdown: '# PDS',
      saMarkdown: '# SA',
      pdsHash: 'a'.repeat(64),
      saHash: 'b'.repeat(64),
      expiresAt: new Date(Date.now() - 60_000).toISOString(),
    })

    const closed = await closeListing(
      { dslId: dsl.id, reason: 'season ended', closedBy: 'operator' },
      store,
    )
    expect(closed.ok).toBe(true)
    if (!closed.ok) return

    expect(closed.value.status).toBe('completed')
    expect(closed.value.closedReason).toBe('season ended')
    expect(closed.value.closedBy).toBe('operator')
    expect(closed.value.closedAt).not.toBeNull()
    expect((await store.findDslById(dsl.id))?.stakeRemaining).toBe(10)

    const again = await closeListing(
      { dslId: dsl.id, reason: 'again', closedBy: 'operator' },
      store,
    )
    expect(again.ok).toBe(false)
  })

  it('the identity holds after reserve, sale, expiry and release', async () => {
    const { store, dsl, account } = await setup()

    const check = async (label: string) => {
      const current = await store.findDslById(dsl.id)
      if (current === null) throw new Error('dsl vanished')
      const cap = capTableFor(current, store.dump().sales, store.dump().checkoutSessions)
      expect(capTableIdentityHolds(cap), label).toBe(true)
      return cap
    }

    const hold = await store.reserveCheckoutSession({
      dslId: dsl.id,
      accountId: account.id,
      printedName: account.fullName,
      email: account.email,
      horseLegalName: 'Chunk Four Mulan',
      stake: 5,
      amountNzd: 1900,
      executedDate: '2026-11-15',
      pdsMarkdown: '# PDS',
      saMarkdown: '# SA',
      pdsHash: 'a'.repeat(64),
      saHash: 'b'.repeat(64),
      expiresAt: new Date(Date.now() + 600_000).toISOString(),
    })
    const reserved = await check('after reserve')
    expect(reserved.openHoldStake).toBe(5)
    expect(reserved.remainingStake).toBe(5)

    await store.attachStripeSession(hold.id, 'cs_invariant_sale')
    const sale = await store.recordSaleAtomically({
      checkoutId: hold.id,
      stripeSessionId: 'cs_invariant_sale',
      stripeAmountTotalCents: 190_000,
      stripeCurrency: 'nzd',
      stripeIdentityId: null,
    })
    expect(sale.outcome).toBe('sale_written')
    const sold = await check('after sale')
    expect(sold.soldStake).toBe(5)
    expect(sold.remainingStake).toBe(5)

    // A fresh hold that lapses is returned to the listing.
    const expiring = await store.reserveCheckoutSession({
      dslId: dsl.id,
      accountId: account.id,
      printedName: account.fullName,
      email: account.email,
      horseLegalName: 'Chunk Four Mulan',
      stake: 5,
      amountNzd: 1900,
      executedDate: '2026-11-15',
      pdsMarkdown: '# PDS',
      saMarkdown: '# SA',
      pdsHash: 'a'.repeat(64),
      saHash: 'b'.repeat(64),
      expiresAt: new Date(Date.now() - 60_000).toISOString(),
    })
    await store.expireCheckoutSessions()
    const expired = await check('after expiry')
    expect(expired.openHoldStake).toBe(0)
    expect(expired.remainingStake).toBe(5)

    // A live hold that is released is returned too.
    const released = await store.reserveCheckoutSession({
      dslId: dsl.id,
      accountId: account.id,
      printedName: account.fullName,
      email: account.email,
      horseLegalName: 'Chunk Four Mulan',
      stake: 5,
      amountNzd: 1900,
      executedDate: '2026-11-15',
      pdsMarkdown: '# PDS',
      saMarkdown: '# SA',
      pdsHash: 'a'.repeat(64),
      saHash: 'b'.repeat(64),
      expiresAt: new Date(Date.now() + 600_000).toISOString(),
    })
    await store.releaseCheckoutSession(released.id)
    const afterRelease = await check('after release')
    expect(afterRelease.openHoldStake).toBe(0)
    expect(afterRelease.remainingStake).toBe(5)
    expect(expiring.id).not.toBe(released.id)
  })
})
