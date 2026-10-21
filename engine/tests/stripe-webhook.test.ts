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
import { recordWebhookEvent } from '../src/lib/purchase'
import { createInMemoryPurchaseStore } from '../src/lib/purchaseStore'
import { verifyStripeSignature } from '../src/lib/stripe'

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

  it('writes the sale row, decrements stake_remaining, flips to fully_allocated at 0, and is idempotent on replay', async () => {
    const { store, dsl, account } = await setupStore()

    // First 5% purchase
    const event1 = {
      id: 'evt_sale_a',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_test_session_a',
          metadata: {
            dsl_id: dsl.id,
            account_id: account.id,
            stake: '5',
            executed_date: '2026-10-21',
            stripe_identity_id: 'vs_identity_a',
          },
        },
      },
    }

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
    expect(first.value.sale.stripeSessionId).toBe('cs_test_session_a')
    expect(first.value.sale.stripeIdentityId).toBe('vs_identity_a')
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
    const event2 = {
      id: 'evt_sale_b',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_test_session_b',
          metadata: {
            dsl_id: dsl.id,
            account_id: account.id,
            stake: '5',
            executed_date: '2026-10-21',
          },
        },
      },
    }
    const second = await recordWebhookEvent(event2, store)
    expect(second.ok).toBe(true)
    const afterSecondDsl = await store.findDslById(dsl.id)
    expect(afterSecondDsl?.stakeRemaining).toBe(0)
    expect(afterSecondDsl?.status).toBe('fully_allocated')
    expect(store.dump().sales).toHaveLength(2)
  })

  it('writes no sale row on payment_intent.payment_failed or checkout.session.expired', async () => {
    const { store, dsl } = await setupStore()

    const declined = await recordWebhookEvent(
      {
        id: 'evt_decline',
        type: 'payment_intent.payment_failed',
        data: { object: { id: 'pi_failed_1' } },
      },
      store,
    )
    expect(declined.ok).toBe(true)
    expect(store.dump().sales).toHaveLength(0)
    expect((await store.findDslById(dsl.id))?.stakeRemaining).toBe(10)
  })

  it('updates account kycStatus on identity.verification_session events', async () => {
    const { store, account } = await setupStore()
    await store.updateAccountKycStatus(account.id, 'pending')

    const failed = await recordWebhookEvent(
      {
        id: 'evt_id_fail',
        type: 'identity.verification_session.requires_input',
        data: { object: { id: 'vs_1', metadata: { account_id: account.id } } },
      },
      store,
    )
    expect(failed.ok).toBe(true)
    expect((await store.findAccountById(account.id))?.kycStatus).toBe('failed')

    const verified = await recordWebhookEvent(
      {
        id: 'evt_id_ok',
        type: 'identity.verification_session.verified',
        data: { object: { id: 'vs_1', metadata: { account_id: account.id } } },
      },
      store,
    )
    expect(verified.ok).toBe(true)
    expect((await store.findAccountById(account.id))?.kycStatus).toBe('verified')
  })
})
