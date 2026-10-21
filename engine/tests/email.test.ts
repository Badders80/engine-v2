/**
 * Hermetic tests for Step 9 — the four transactional emails (`engine/src/lib/email.ts`)
 * and their wiring in `openCheckoutSession` and `recordWebhookEvent` (`engine/src/lib/purchase.ts`).
 *
 * Covers the locked 29-item Step 9 checklist:
 *   - Closed four-kind union (`EMAIL_KINDS`) and runtime rejection of any fifth kind
 *   - `buildBuyerSaleWrittenEmail` recipient (`sale.email`), stake, amount, and canonical MyStable URL
 *   - `buildBuyerKycFailedEmail` recipient (`account.email`)
 *   - `buildFounderSaleSucceededEmail` recipient (`sender.founderEmail`) and full sale facts
 *   - `buildFounderOurFaultFailureEmail` recipient (`sender.founderEmail`), `stage`, and `reason`
 *   - New `checkout.session.completed` (`idempotentReplay === false`) sends `buyer_sale_written` + `founder_sale_succeeded`
 *   - Replayed `checkout.session.completed` (`idempotentReplay === true`) sends zero emails
 *   - `identity.verification_session.requires_input` and `canceled` flip KYC to `'failed'` and send `buyer_kyc_failed`
 *   - `payment_intent.payment_failed` and `checkout.session.expired` write no `sales` row and send zero emails
 *   - `stripe.createCheckoutSession` failure in `openCheckoutSession` sends `founder_our_fault_failure` (`stage: 'checkout'`) and writes no `sales` row
 *   - Buyer-fault validation rejections in `openCheckoutSession` send zero founder emails
 *   - Our-fault webhook failures send `founder_our_fault_failure` (`stage: 'webhook'`) and roll back any `sales` row via `deleteSaleById` if `updateDsl` throws after `insertSale`
 */

import { describe, expect, it } from 'vitest'

import { saveDsl, type SaveDslInput } from '../src/lib/dsl'
import {
  buildBuyerKycFailedEmail,
  buildBuyerSaleWrittenEmail,
  buildFounderOurFaultFailureEmail,
  buildFounderSaleSucceededEmail,
  createEmailSenderFromEnv,
  createInMemoryEmailSender,
  EMAIL_KINDS,
  MYSTABLE_URL,
  sendEngineEmail,
  type EmailDispatchInput,
} from '../src/lib/email'
import {
  openCheckoutSession,
  recordWebhookEvent,
  SA_DECLARATIONS,
} from '../src/lib/purchase'
import { createInMemoryPurchaseStore, type InMemoryPurchaseStore } from '../src/lib/purchaseStore'
import type { StripeGateway } from '../src/lib/stripe'

function sampleSaveInput(): SaveDslInput {
  return {
    horse: {
      legalName: 'Lady Ketchikan',
      foalingDate: '2022-09-14',
      sex: 'Mare',
      colour: 'Bay',
      breeder: 'Trelawney Stud',
      sireName: 'Savabeel',
      damName: 'Ketchikan',
      microchip: '985125000123456',
      lifeNumber: 'NZ-2022-LK',
      loveracingId: '12345',
      registered: true,
      aboutHorse: 'Athletic bay mare progressing well in work.',
      racingOutlookAndPedigree: 'By Savabeel out of a stakes-producing dam line.',
      raceExpectation: 'Targeting spring maiden and rating bands.',
      imageCount: 3,
      raceRecord: { starts: 2, wins: 1 },
    },
    trainer: {
      name: 'Lance O’Sullivan',
      stable: 'Wexford Stables',
      location: 'Matamata',
      website: 'https://wexfordstables.co.nz',
      bio: 'Multiple premiership-winning Matamata training partnership.',
    },
    owner: {
      entity: 'Ketchikan Bloodstock Ltd',
      contact: 'David Ellis',
      website: null,
      profile: 'Longstanding New Zealand thoroughbred breeders.',
    },
    dsl: {
      termStart: '2026-11-01',
      endDate: '2027-10-31',
      paymentModel: 'subscription_float',
      closeStyle: 'fourteen_day',
      status: 'available',
      published: true,
      wholesaleMonthlyPerPercent: 65, // retail 71, 5-month float = 355 per 1%
      investorSplit: 70,
      listedStake: 20,
      minStake: 2.5,
      step: 2.5,
      distributionSchedule: 'Quarterly within 14 days of NZTR settlement',
    },
  }
}

async function seedStore(): Promise<{
  store: InMemoryPurchaseStore
  dslId: string
  accountId: string
}> {
  const store = createInMemoryPurchaseStore()
  const saved = await saveDsl(sampleSaveInput(), store)
  if (!saved.ok) throw new Error(saved.reason)

  const account = await store.insertAccount({
    id: 'acc-email-1',
    fullName: 'Aroha Williams',
    email: 'aroha@example.co.nz',
    kycStatus: 'verified',
  })

  return { store, dslId: saved.value.dsl.id, accountId: account.id }
}

describe('Step 9 — EMAIL_KINDS and pure builders', () => {
  it('defines the exact four EMAIL_KINDS and rejects any fifth kind at runtime', async () => {
    expect(EMAIL_KINDS).toEqual([
      'buyer_sale_written',
      'buyer_kyc_failed',
      'founder_sale_succeeded',
      'founder_our_fault_failure',
    ])
    expect(EMAIL_KINDS).toHaveLength(4)

    const sender = createInMemoryEmailSender('alex@evolutionstables.nz')
    await expect(
      sendEngineEmail(
        { kind: 'payment_declined_alert' } as unknown as EmailDispatchInput,
        sender,
      ),
    ).rejects.toThrow(/unrecognised email kind/)
    expect(sender.sent).toHaveLength(0)
  })

  it('builds all four messages with exact recipients and required fields', async () => {
    const sender = createInMemoryEmailSender('alex@evolutionstables.nz')
    const sale = {
      id: 'sale-1',
      dslId: 'dsl-1',
      userId: 'acc-1',
      printedName: 'Aroha Williams',
      email: 'aroha@example.co.nz',
      stake: 5,
      amount: 1775,
      stripeSessionId: 'cs_live_abc123',
      stripeIdentityId: 'vs_live_xyz',
      pdsMarkdown: '# PDS',
      saMarkdown: '# SA',
      pdsHash: 'a'.repeat(64),
      saHash: 'b'.repeat(64),
      createdAt: '2026-10-21T00:00:00.000Z',
    }
    const account = {
      id: 'acc-1',
      fullName: 'Aroha Williams',
      email: 'aroha@example.co.nz',
      kycStatus: 'failed' as const,
      createdAt: '2026-10-21T00:00:00.000Z',
    }

    const buyerSale = buildBuyerSaleWrittenEmail({
      sale,
      horseLegalName: 'Lady Ketchikan',
    })
    expect(buyerSale.kind).toBe('buyer_sale_written')
    expect(buyerSale.to).toBe('aroha@example.co.nz')
    expect(buyerSale.text).toContain('5%')
    expect(buyerSale.text).toContain('$1775 NZD')
    expect(buyerSale.text).toContain(MYSTABLE_URL)
    expect(buyerSale.text).toContain('https://www.evolutionstables.nz/mystable')

    const buyerKyc = buildBuyerKycFailedEmail({ account })
    expect(buyerKyc.kind).toBe('buyer_kyc_failed')
    expect(buyerKyc.to).toBe('aroha@example.co.nz')
    expect(buyerKyc.text).toContain('Aroha Williams')

    const founderSale = buildFounderSaleSucceededEmail(
      { sale, horseLegalName: 'Lady Ketchikan' },
      sender,
    )
    expect(founderSale.kind).toBe('founder_sale_succeeded')
    expect(founderSale.to).toBe('alex@evolutionstables.nz')
    expect(founderSale.text).toContain('Aroha Williams')
    expect(founderSale.text).toContain('aroha@example.co.nz')
    expect(founderSale.text).toContain('Lady Ketchikan')
    expect(founderSale.text).toContain('5%')
    expect(founderSale.text).toContain('$1775 NZD')
    expect(founderSale.text).toContain('cs_live_abc123')

    const founderFail = buildFounderOurFaultFailureEmail(
      { stage: 'webhook', reason: 'database connection lost' },
      sender,
    )
    expect(founderFail.kind).toBe('founder_our_fault_failure')
    expect(founderFail.to).toBe('alex@evolutionstables.nz')
    expect(founderFail.text).toContain('Stage: webhook')
    expect(founderFail.text).toContain('Reason: database connection lost')
  })

  it('validates environment variables in createEmailSenderFromEnv', () => {
    expect(() => createEmailSenderFromEnv({})).toThrow(
      /ENGINE_EMAIL_API_URL, ENGINE_EMAIL_API_KEY, ENGINE_EMAIL_FROM, ENGINE_FOUNDER_EMAIL/,
    )

    const configured = createEmailSenderFromEnv({
      ENGINE_EMAIL_API_URL: 'https://api.example.com/emails',
      ENGINE_EMAIL_API_KEY: 're_test_key',
      ENGINE_EMAIL_FROM: 'no-reply@evolutionstables.nz',
      ENGINE_FOUNDER_EMAIL: 'alex@evolutionstables.nz',
    })
    expect(configured.founderEmail).toBe('alex@evolutionstables.nz')
  })
})

describe('Step 9 — webhook email triggers and silence guarantees', () => {
  it('sends buyer_sale_written and founder_sale_succeeded once on a new checkout.session.completed, and zero emails on replay', async () => {
    const { store, dslId, accountId } = await seedStore()
    const sender = createInMemoryEmailSender('alex@evolutionstables.nz')

    const event = {
      id: 'evt_step9_sale',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_step9_1',
          metadata: {
            dsl_id: dslId,
            account_id: accountId,
            stake: '5',
            executed_date: '2026-10-21',
            stripe_identity_id: 'vs_step9_1',
          },
        },
      },
    }

    const first = await recordWebhookEvent(event, store, undefined, sender)
    expect(first.ok).toBe(true)
    expect(sender.sent).toHaveLength(2)
    expect(sender.sent[0].kind).toBe('buyer_sale_written')
    expect(sender.sent[0].to).toBe('aroha@example.co.nz')
    expect(sender.sent[0].text).toContain('5%')
    expect(sender.sent[0].text).toContain('$1775 NZD')
    expect(sender.sent[0].text).toContain('https://www.evolutionstables.nz/mystable')

    expect(sender.sent[1].kind).toBe('founder_sale_succeeded')
    expect(sender.sent[1].to).toBe('alex@evolutionstables.nz')
    expect(sender.sent[1].text).toContain('Aroha Williams')
    expect(sender.sent[1].text).toContain('aroha@example.co.nz')
    expect(sender.sent[1].text).toContain('Lady Ketchikan')
    expect(sender.sent[1].text).toContain('cs_step9_1')

    // Replay of the same session sends zero additional emails
    const replay = await recordWebhookEvent(event, store, undefined, sender)
    expect(replay.ok).toBe(true)
    if (replay.ok && replay.value.action === 'sale_written') {
      expect(replay.value.idempotentReplay).toBe(true)
    }
    expect(sender.sent).toHaveLength(2)
  })

  it('updates account KYC status to failed and sends buyer_kyc_failed on requires_input and canceled', async () => {
    const { store, accountId } = await seedStore()
    const sender = createInMemoryEmailSender('alex@evolutionstables.nz')

    await store.updateAccountKycStatus(accountId, 'pending')
    const requiresInput = await recordWebhookEvent(
      {
        id: 'evt_kyc_req_input',
        type: 'identity.verification_session.requires_input',
        data: { object: { id: 'vs_kyc_1', metadata: { account_id: accountId } } },
      },
      store,
      undefined,
      sender,
    )
    expect(requiresInput.ok).toBe(true)
    expect((await store.findAccountById(accountId))?.kycStatus).toBe('failed')
    expect(sender.sent).toHaveLength(1)
    expect(sender.sent[0].kind).toBe('buyer_kyc_failed')
    expect(sender.sent[0].to).toBe('aroha@example.co.nz')

    await store.updateAccountKycStatus(accountId, 'pending')
    const canceled = await recordWebhookEvent(
      {
        id: 'evt_kyc_canceled',
        type: 'identity.verification_session.canceled',
        data: { object: { id: 'vs_kyc_2', metadata: { account_id: accountId } } },
      },
      store,
      undefined,
      sender,
    )
    expect(canceled.ok).toBe(true)
    expect((await store.findAccountById(accountId))?.kycStatus).toBe('failed')
    expect(sender.sent).toHaveLength(2)
    expect(sender.sent[1].kind).toBe('buyer_kyc_failed')
    expect(sender.sent[1].to).toBe('aroha@example.co.nz')
  })

  it('writes no sale row and sends zero emails on payment_intent.payment_failed and checkout.session.expired', async () => {
    const { store } = await seedStore()
    const sender = createInMemoryEmailSender('alex@evolutionstables.nz')

    const declined = await recordWebhookEvent(
      {
        id: 'evt_card_decline',
        type: 'payment_intent.payment_failed',
        data: { object: { id: 'pi_decline_1' } },
      },
      store,
      undefined,
      sender,
    )
    expect(declined.ok).toBe(true)
    expect(store.dump().sales).toHaveLength(0)
    expect(sender.sent).toHaveLength(0)

    const expired = await recordWebhookEvent(
      {
        id: 'evt_checkout_expired',
        type: 'checkout.session.expired',
        data: { object: { id: 'cs_expired_1' } },
      },
      store,
      undefined,
      sender,
    )
    expect(expired.ok).toBe(true)
    expect(store.dump().sales).toHaveLength(0)
    expect(sender.sent).toHaveLength(0)
  })

  it('rolls back the sale row via deleteSaleById and sends founder_our_fault_failure if store.updateDsl throws after insertSale', async () => {
    const { store, dslId, accountId } = await seedStore()
    const sender = createInMemoryEmailSender('alex@evolutionstables.nz')

    const failingStore = {
      ...store,
      async updateDsl(): ReturnType<typeof store.updateDsl> {
        throw new Error('simulated updateDsl failure after insertSale')
      },
    }

    const res = await recordWebhookEvent(
      {
        id: 'evt_partial_fail',
        type: 'checkout.session.completed',
        data: {
          object: {
            id: 'cs_partial_fail_1',
            metadata: {
              dsl_id: dslId,
              account_id: accountId,
              stake: '5',
              executed_date: '2026-10-21',
            },
          },
        },
      },
      failingStore,
      undefined,
      sender,
    )

    expect(res.ok).toBe(false)
    // Compensating rollback removed the inserted sale row ("leaves no sale", PLAN.md:238)
    expect(store.dump().sales).toHaveLength(0)
    expect(sender.sent).toHaveLength(1)
    expect(sender.sent[0].kind).toBe('founder_our_fault_failure')
    expect(sender.sent[0].to).toBe('alex@evolutionstables.nz')
    expect(sender.sent[0].text).toContain('Stage: webhook')
    expect(sender.sent[0].text).toContain('simulated updateDsl failure after insertSale')
  })

  it('sends founder_our_fault_failure (stage: webhook) on missing webhook metadata and writes no sale', async () => {
    const { store } = await seedStore()
    const sender = createInMemoryEmailSender('alex@evolutionstables.nz')

    const res = await recordWebhookEvent(
      {
        id: 'evt_bad_meta',
        type: 'checkout.session.completed',
        data: {
          object: {
            id: 'cs_missing_meta',
            metadata: {},
          },
        },
      },
      store,
      undefined,
      sender,
    )

    expect(res.ok).toBe(false)
    expect(store.dump().sales).toHaveLength(0)
    expect(sender.sent).toHaveLength(1)
    expect(sender.sent[0].kind).toBe('founder_our_fault_failure')
    expect(sender.sent[0].text).toContain('Stage: webhook')
  })
})

describe('Step 9 — checkout email triggers and buyer-fault silence', () => {
  const fullAcceptance = {
    pdsAccepted: true,
    saAccepted: true,
    declarationsAccepted: [...SA_DECLARATIONS],
  }

  it('sends founder_our_fault_failure (stage: checkout) and writes no sale row when stripe.createCheckoutSession throws', async () => {
    const { store, dslId, accountId } = await seedStore()
    const sender = createInMemoryEmailSender('alex@evolutionstables.nz')

    const throwingStripe: StripeGateway = {
      async createIdentitySession() {
        throw new Error('not called')
      },
      async retrieveIdentitySession() {
        throw new Error('not called')
      },
      async createCheckoutSession() {
        throw new Error('Stripe API 503 upstream failure')
      },
    }

    const res = await openCheckoutSession(
      {
        dslId,
        accountId,
        stake: 5,
        acceptance: fullAcceptance,
        successUrl: 'https://www.evolutionstables.nz/mystable',
        cancelUrl: 'https://www.evolutionstables.nz/marketplace/lady-ketchikan',
      },
      store,
      throwingStripe,
      sender,
    )

    expect(res.ok).toBe(false)
    expect(store.dump().sales).toHaveLength(0)
    expect(sender.sent).toHaveLength(1)
    expect(sender.sent[0].kind).toBe('founder_our_fault_failure')
    expect(sender.sent[0].to).toBe('alex@evolutionstables.nz')
    expect(sender.sent[0].text).toContain('Stage: checkout')
    expect(sender.sent[0].text).toContain('Stripe API 503 upstream failure')
  })

  it('sends zero founder emails when a buyer fails acceptance, KYC, or stake validation in openCheckoutSession', async () => {
    const { store, dslId, accountId } = await seedStore()
    const sender = createInMemoryEmailSender('alex@evolutionstables.nz')

    const noopStripe: StripeGateway = {
      async createIdentitySession() {
        throw new Error('not called')
      },
      async retrieveIdentitySession() {
        throw new Error('not called')
      },
      async createCheckoutSession() {
        throw new Error('not called')
      },
    }

    // 1. Unaccepted documents
    const unaccepted = await openCheckoutSession(
      {
        dslId,
        accountId,
        stake: 5,
        acceptance: { pdsAccepted: false, saAccepted: true, declarationsAccepted: [...SA_DECLARATIONS] },
        successUrl: 'https://www.evolutionstables.nz/mystable',
        cancelUrl: 'https://www.evolutionstables.nz/marketplace/lady-ketchikan',
      },
      store,
      noopStripe,
      sender,
    )
    expect(unaccepted.ok).toBe(false)

    // 2. Invalid stake step
    const badStake = await openCheckoutSession(
      {
        dslId,
        accountId,
        stake: 3.3,
        acceptance: fullAcceptance,
        successUrl: 'https://www.evolutionstables.nz/mystable',
        cancelUrl: 'https://www.evolutionstables.nz/marketplace/lady-ketchikan',
      },
      store,
      noopStripe,
      sender,
    )
    expect(badStake.ok).toBe(false)

    // 3. Unverified KYC
    await store.updateAccountKycStatus(accountId, 'pending')
    const unverified = await openCheckoutSession(
      {
        dslId,
        accountId,
        stake: 5,
        acceptance: fullAcceptance,
        successUrl: 'https://www.evolutionstables.nz/mystable',
        cancelUrl: 'https://www.evolutionstables.nz/marketplace/lady-ketchikan',
      },
      store,
      noopStripe,
      sender,
    )
    expect(unverified.ok).toBe(false)

    expect(sender.sent).toHaveLength(0)
  })
})
