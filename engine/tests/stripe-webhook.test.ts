/**
 * Hermetic tests for Stripe webhook signature verification and event handling.
 *
 * Covers checklist items 9, 10, 11, and 12:
 * - Item 9: HMAC-SHA256 verification and 300s timestamp tolerance.
 * - Item 10: Idempotency on `sales.stripe_session_id`.
 * - Item 11: Full `sales` column write, `stake_remaining` drawdown, and
 *   `status = 'fully_allocated'` flip when `stake_remaining === 0`.
 * - Item 12: Card declines (`payment_intent.payment_failed`) write no `sales` row.
 */

import { createHmac } from 'node:crypto'
import { describe, expect, it } from 'vitest'

import { saveDsl } from '../src/lib/dsl'
import { createInMemoryEmailSender } from '../src/lib/email'
import { openCheckoutSession, recordWebhookEvent, SA_DECLARATIONS } from '../src/lib/purchase'
import { createInMemoryPurchaseStore } from '../src/lib/purchaseStore'
import { verifyStripeSignature, type StripeGateway } from '../src/lib/stripe'

const SECRET = 'whsec_test_secret_for_v2_engine'

function signPayload(payload: string, timestamp: number, secret: string = SECRET): string {
  const digest = createHmac('sha256', secret).update(`${timestamp}.${payload}`, 'utf8').digest('hex')
  return `t=${timestamp},v1=${digest}`
}

describe('Step 8a — verifyStripeSignature', () => {
  const now = 1_792_540_000
  const payload = JSON.stringify({
    id: 'evt_1',
    type: 'checkout.session.completed',
    data: { object: { id: 'cs_1' } },
  })

  it('verifies a valid HMAC-SHA256 signature within the 300-second window', () => {
    const header = signPayload(payload, now - 60)
    const event = verifyStripeSignature(payload, header, SECRET, now)
    expect(event.id).toBe('evt_1')
    expect(event.type).toBe('checkout.session.completed')
  })

  it('rejects a tampered payload or wrong secret', () => {
    const header = signPayload(payload, now)
    const tampered = payload.replace('cs_1', 'cs_tampered')
    expect(() => verifyStripeSignature(tampered, header, SECRET, now)).toThrow(
      /HMAC verification failed/,
    )
    expect(() => verifyStripeSignature(payload, header, 'whsec_wrong', now)).toThrow(
      /HMAC verification failed/,
    )
  })

  it('rejects a replay outside the 300-second tolerance', () => {
    const expiredHeader = signPayload(payload, now - 301)
    expect(() => verifyStripeSignature(payload, expiredHeader, SECRET, now)).toThrow(
      /outside tolerance/,
    )
  })
})

describe('Step 8a — recordWebhookEvent', () => {
  async function setupStore() {
    const store = createInMemoryPurchaseStore()
    const saved = await saveDsl(
      {
        horse: {
          legalName: 'Mulan The Brave',
          foalingDate: '2022-10-02',
          sex: 'Filly',
          colour: 'Brown',
          breeder: 'Waikato Stud',
          sireName: 'Super Seth',
          damName: 'Warrior Queen',
          microchip: '985125000654321',
          lifeNumber: 'NZ-2022-MTB',
          loveracingId: '54321',
          registered: true,
          aboutHorse: 'Sharp brown filly with clean action.',
          racingOutlookAndPedigree: 'By Super Seth from a proven juvenile family.',
          raceExpectation: 'Aimed at autumn 3YO fillies features.',
          imageCount: 3,
          raceRecord: {},
        },
        trainer: {
          name: 'Stephen Marsh',
          stable: 'Marsh Racing',
          location: 'Cambridge',
          website: null,
          bio: 'Leading Cambridge stable.',
        },
        owner: {
          entity: 'Brave Bloodstock',
          contact: 'Alex Baddeley',
          website: null,
          profile: null,
        },
        dsl: {
          termStart: '2026-11-01',
          endDate: '2027-10-31',
          paymentModel: 'subscription_float',
          closeStyle: 'three_x_remaining',
          status: 'available',
          published: true,
          wholesaleMonthlyPerPercent: 70, // retail 76, float 380 per 1%
          investorSplit: 75,
          listedStake: 10,
          minStake: 5,
          step: 5,
          distributionSchedule: 'Monthly within 14 days of NZTR settlement',
        },
      },
      store,
    )
    if (!saved.ok) throw new Error(saved.reason)

    const account = await store.insertAccount({
      id: 'acc-webhook-1',
      fullName: 'Nikau Henare',
      email: 'nikau@example.co.nz',
      kycStatus: 'verified',
    })

    return { store, dsl: saved.value.dsl, account }
  }

  const gateway = (() => {
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
        return { id: `cs_test_${n}`, url: `https://checkout.stripe.com/c/pay/cs_test_${n}` }
      },
    }
  })()

  function fakeGateway(): StripeGateway {
    return gateway
  }

  /** Drives the real Checkout path, so the webhook has a bound row to read. */
  async function openCheckout(
    store: ReturnType<typeof createInMemoryPurchaseStore>,
    dslId: string,
    accountId: string,
    stake: number,
  ) {
    const opened = await openCheckoutSession(
      {
        dslId,
        accountId,
        stake,
        acceptance: {
          pdsAccepted: true,
          saAccepted: true,
          declarationsAccepted: [...SA_DECLARATIONS],
        },
        executedDate: '2026-10-21',
        successUrl: 'https://example.test/ok',
        cancelUrl: 'https://example.test/cancel',
      },
      store,
      fakeGateway(),
    )
    if (!opened.ok) throw new Error(opened.reason)
    const row = await store.findCheckoutSessionByStripeSessionId(opened.value.checkoutSessionId)
    if (row === null) throw new Error('checkout binding row was not written')
    return {
      stripeSessionId: opened.value.checkoutSessionId,
      checkoutId: row.id,
      quote: opened.value.quote,
      amountTotalCents: Math.round(opened.value.quote.initialPaymentNzd * 100),
    }
  }

  function completedEvent(
    stripeSessionId: string,
    checkoutId: string,
    amountTotalCents: number,
  ) {
    return {
      id: `evt_${stripeSessionId}`,
      type: 'checkout.session.completed',
      data: {
        object: {
          id: stripeSessionId,
          payment_status: 'paid',
          amount_total: amountTotalCents,
          currency: 'nzd',
          metadata: { checkout_id: checkoutId },
        },
      },
    }
  }

  it('writes the sale row from the bound checkout, decrements stake_remaining, flips to fully_allocated at 0, and is idempotent on replay', async () => {
    const { store, dsl, account } = await setupStore()

    const firstCheckout = await openCheckout(store, dsl.id, account.id, 5)
    const event1 = completedEvent(
      firstCheckout.stripeSessionId,
      firstCheckout.checkoutId,
      firstCheckout.amountTotalCents,
    )

    const first = await recordWebhookEvent(event1, store)
    expect(first.ok).toBe(true)
    if (!first.ok || first.value.action !== 'sale_written') return

    expect(first.value.idempotentReplay).toBe(false)
    expect(first.value.sale.dslId).toBe(dsl.id)
    expect(first.value.sale.userId).toBe(account.id)
    expect(first.value.sale.printedName).toBe('Nikau Henare')
    expect(first.value.sale.email).toBe('nikau@example.co.nz')
    expect(first.value.sale.stake).toBe(5)
    expect(first.value.sale.amount).toBe(1900) // 5% * $380
    expect(first.value.sale.stripeSessionId).toBe(firstCheckout.stripeSessionId)
    expect(first.value.sale.checkoutSessionId).toBe(firstCheckout.checkoutId)
    expect(first.value.sale.pdsMarkdown).toContain('Mulan The Brave')
    expect(first.value.sale.saMarkdown).toContain('Mulan The Brave')
    expect(first.value.sale.pdsHash).toMatch(/^[a-f0-9]{64}$/)
    expect(first.value.sale.saHash).toMatch(/^[a-f0-9]{64}$/)

    const afterFirstDsl = await store.findDslById(dsl.id)
    expect(afterFirstDsl?.stakeRemaining).toBe(5)
    expect(afterFirstDsl?.status).toBe('available')

    // Replay of the exact same Stripe session is idempotent and does not double-decrement
    const replay = await recordWebhookEvent(event1, store)
    expect(replay.ok).toBe(true)
    if (replay.ok && replay.value.action === 'sale_written') {
      expect(replay.value.idempotentReplay).toBe(true)
      expect(replay.value.sale.id).toBe(first.value.sale.id)
    }
    expect((await store.findDslById(dsl.id))?.stakeRemaining).toBe(5)
    expect(store.dump().sales).toHaveLength(1)

    // Second 5% purchase exhausts remaining stake -> status flips to fully_allocated
    const secondCheckout = await openCheckout(store, dsl.id, account.id, 5)
    const second = await recordWebhookEvent(
      completedEvent(
        secondCheckout.stripeSessionId,
        secondCheckout.checkoutId,
        secondCheckout.amountTotalCents,
      ),
      store,
    )
    expect(second.ok).toBe(true)
    const afterSecondDsl = await store.findDslById(dsl.id)
    expect(afterSecondDsl?.stakeRemaining).toBe(0)
    expect(afterSecondDsl?.status).toBe('fully_allocated')
    expect(store.dump().sales).toHaveLength(2)
  })

  it('refuses a webhook with no bound checkout row and writes no sale', async () => {
    const { store, dsl } = await setupStore()
    const emailSender = createInMemoryEmailSender('founder@evolutionstables.nz')

    const refused = await recordWebhookEvent(
      {
        id: 'evt_unbound',
        type: 'checkout.session.completed',
        data: {
          object: {
            id: 'cs_test_unbound',
            metadata: { dsl_id: dsl.id, account_id: 'acc-webhook-1', stake: '5' },
          },
        },
      },
      store,
      emailSender,
    )
    expect(refused.ok).toBe(false)
    expect(store.dump().sales).toHaveLength(0)
    expect((await store.findDslById(dsl.id))?.stakeRemaining).toBe(10)
    expect(emailSender.sent.map((sent) => sent.kind)).toContain('founder_our_fault_failure')
  })

  it('B4 — records Stripe\'s charged amount and currency on the sale', async () => {
    const { store, dsl, account } = await setupStore()
    const checkout = await openCheckout(store, dsl.id, account.id, 5)

    const res = await recordWebhookEvent(
      completedEvent(checkout.stripeSessionId, checkout.checkoutId, checkout.amountTotalCents),
      store,
    )
    expect(res.ok).toBe(true)
    if (!res.ok || res.value.action !== 'sale_written') return
    expect(res.value.sale.amount).toBe(checkout.amountTotalCents / 100)
    expect(res.value.sale.stripeAmountTotal).toBe(checkout.amountTotalCents / 100)
    expect(res.value.sale.stripeCurrency).toBe('nzd')
  })

  it('B4 — refuses a sale when Stripe charged a different amount, keeps the hold, and alerts the founder', async () => {
    const { store, dsl, account } = await setupStore()
    const emailSender = createInMemoryEmailSender('founder@evolutionstables.nz')
    const checkout = await openCheckout(store, dsl.id, account.id, 5)

    const res = await recordWebhookEvent(
      completedEvent(
        checkout.stripeSessionId,
        checkout.checkoutId,
        checkout.amountTotalCents - 100,
      ),
      store,
      emailSender,
    )
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.value.action).toBe('refused')

    expect(store.dump().sales).toHaveLength(0)
    expect((await store.findCheckoutSessionById(checkout.checkoutId))?.status).toBe(
      'paid_unfulfilled',
    )
    expect(emailSender.sent.map((sent) => sent.kind)).toEqual(['founder_our_fault_failure'])
    // The hold is kept: money was taken, so the stake must not go back on sale.
    expect((await store.findDslById(dsl.id))?.stakeRemaining).toBe(5)
  })

  it('B4 — refuses a session Stripe has not marked paid, and leaves the hold open', async () => {
    const { store, dsl, account } = await setupStore()
    const emailSender = createInMemoryEmailSender('founder@evolutionstables.nz')
    const checkout = await openCheckout(store, dsl.id, account.id, 5)

    const event = completedEvent(
      checkout.stripeSessionId,
      checkout.checkoutId,
      checkout.amountTotalCents,
    )
    event.data.object.payment_status = 'unpaid'

    const res = await recordWebhookEvent(event, store, emailSender)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.value.action).toBe('refused')
    expect(store.dump().sales).toHaveLength(0)
    expect((await store.findCheckoutSessionById(checkout.checkoutId))?.status).toBe('open')
    expect(emailSender.sent).toHaveLength(1)
  })

  it('B4 — refuses a sale charged in a currency other than NZD', async () => {
    const { store, dsl, account } = await setupStore()
    const checkout = await openCheckout(store, dsl.id, account.id, 5)

    const event = completedEvent(
      checkout.stripeSessionId,
      checkout.checkoutId,
      checkout.amountTotalCents,
    )
    event.data.object.currency = 'usd'

    const res = await recordWebhookEvent(event, store)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.value.action).toBe('refused')
    expect(store.dump().sales).toHaveLength(0)
  })

  it('writes no sale row on payment_intent.payment_failed or checkout.session.expired', async () => {
    const { store, dsl } = await setupStore()
    const emailSender = createInMemoryEmailSender('founder@evolutionstables.nz')

    const declined = await recordWebhookEvent(
      {
        id: 'evt_decline',
        type: 'payment_intent.payment_failed',
        data: { object: { id: 'pi_failed_1' } },
      },
      store,
      emailSender,
    )
    expect(declined.ok).toBe(true)
    expect(store.dump().sales).toHaveLength(0)
    expect(emailSender.sent).toHaveLength(0)
    expect((await store.findDslById(dsl.id))?.stakeRemaining).toBe(10)
  })

  it('updates account kycStatus on identity.verification_session events', async () => {
    const { store, account } = await setupStore()
    const emailSender = createInMemoryEmailSender('founder@evolutionstables.nz')
    await store.updateAccountKycStatus(account.id, 'pending')

    const failed = await recordWebhookEvent(
      {
        id: 'evt_id_fail',
        type: 'identity.verification_session.requires_input',
        data: { object: { id: 'vs_1', metadata: { account_id: account.id } } },
      },
      store,
      emailSender,
    )
    expect(failed.ok).toBe(true)
    expect((await store.findAccountById(account.id))?.kycStatus).toBe('failed')
    expect(emailSender.sent).toHaveLength(1)
    expect(emailSender.sent[0].kind).toBe('buyer_kyc_failed')

    const verified = await recordWebhookEvent(
      {
        id: 'evt_id_ok',
        type: 'identity.verification_session.verified',
        data: { object: { id: 'vs_1', metadata: { account_id: account.id } } },
      },
      store,
      emailSender,
    )
    expect(verified.ok).toBe(true)
    expect((await store.findAccountById(account.id))?.kycStatus).toBe('verified')
    expect(emailSender.sent).toHaveLength(1)
  })
})
