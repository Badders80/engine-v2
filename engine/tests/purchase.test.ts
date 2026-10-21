/**
 * Hermetic tests for Step 8a purchase core (`engine/src/lib/purchase.ts`).
 *
 * Covers checklist items 1–8 and 11–13:
 * - Item 1: `effectiveMinStake` allows purchasing `stake_remaining < min_stake`.
 * - Item 2: `validateStake` basis-points modulo (`stake % step === 0`).
 * - Item 3: `computeQuote` uses stored `retailMonthlyPerPercent` (`floatTotal` /
 *   `upfrontTotal` / `totalForStake`).
 * - Item 4: `investorSplit` is required; null is refused with zero `'75'` fallback.
 * - Item 5: `compileBuyerDocuments` compiles PDS and SA with `account.fullName`.
 * - Item 6: `verifyDocumentAcceptance` requires PDS, SA, and all four SA declarations.
 * - Item 7: `beginOrConfirmIdentity` skips Identity when verified, starts Identity
 *   when unverified, and refuses when failed.
 * - Item 8: `openCheckoutSession` requires verified KYC and available/published DSL,
 *   uses `payment` mode, and writes no sale row.
 * - Item 13: Later edits or renames via `updateDsl` do not alter any existing
 *   `sales` row's markdown or hashes.
 */

import { describe, expect, it } from 'vitest'

import { saveDsl, updateDsl, type SaveDslInput } from '../src/lib/dsl'
import { REFUND_SENTENCE } from '../src/lib/pricing'
import {
  beginOrConfirmIdentity,
  compileBuyerDocuments,
  computeQuote,
  openCheckoutSession,
  recordWebhookEvent,
  SA_DECLARATIONS,
  verifyDocumentAcceptance,
} from '../src/lib/purchase'
import { createInMemoryPurchaseStore, type InMemoryPurchaseStore } from '../src/lib/purchaseStore'
import type { StripeGateway } from '../src/lib/stripe'

function baseSaveInput(overrides: Partial<SaveDslInput['dsl']> = {}): SaveDslInput {
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
      wholesaleMonthlyPerPercent: 65,
      investorSplit: 70,
      listedStake: 50,
      minStake: 2.5,
      step: 0.5,
      distributionSchedule: 'Quarterly within 14 days of NZTR settlement',
      ...overrides,
    },
  }
}

function fakeStripe(): StripeGateway & {
  identityCalls: number
  checkoutCalls: number
} {
  const gateway = {
    identityCalls: 0,
    checkoutCalls: 0,
    async createIdentitySession(input: { accountId: string; email: string; returnUrl: string }) {
      gateway.identityCalls += 1
      return {
        id: `vs_test_${input.accountId}`,
        url: `https://verify.stripe.com/start/vs_test_${input.accountId}`,
        status: 'requires_input' as const,
      }
    },
    async retrieveIdentitySession(sessionId: string) {
      return {
        id: sessionId,
        url: `https://verify.stripe.com/start/${sessionId}`,
        status: 'verified' as const,
      }
    },
    async createCheckoutSession(input: { dslId: string; stake: number; amountNzd: number }) {
      gateway.checkoutCalls += 1
      return {
        id: `cs_test_${input.dslId}_${input.stake}`,
        url: `https://checkout.stripe.com/c/pay/cs_test_${input.dslId}_${input.stake}`,
      }
    },
  }
  return gateway
}

async function seedAvailableDsl(
  store: InMemoryPurchaseStore,
  overrides: Partial<SaveDslInput['dsl']> = {},
) {
  const saved = await saveDsl(baseSaveInput(overrides), store)
  if (!saved.ok) throw new Error(saved.reason)
  return saved.value
}

describe('Step 8a — effectiveMinStake, step validation, and quote calculation', () => {
  it('wires effectiveMinStake so an orphan remainder smaller than min_stake is buyable', async () => {
    const store = createInMemoryPurchaseStore()
    const { dsl } = await seedAvailableDsl(store, {
      minStake: 2.5,
      step: 0.5,
      listedStake: 50,
    })

    // Draw remaining stake down to 1.0% (< 2.5% minStake)
    await store.updateDsl(dsl.id, { stakeRemaining: 1.0 })

    const quote = await computeQuote({ dslId: dsl.id }, store)
    expect(quote.ok).toBe(true)
    if (!quote.ok) return

    expect(quote.value.effectiveMinStake).toBe(1.0)
    expect(quote.value.stake).toBe(1.0)
    // Wholesale 65 -> retail 71/1%/month. 5 months float * 71 * 1.0 = 355
    expect(quote.value.initialPaymentNzd).toBe(355)
    expect(quote.value.monthlyPaymentNzd).toBe(71)
    expect(quote.value.refundSentence).toBe(REFUND_SENTENCE)
    expect(quote.value.refundSentence).not.toMatch(/\d+\s+days?/i)
  })

  it('enforces stake % step === 0 in basis points and rejects off-step stakes', async () => {
    const store = createInMemoryPurchaseStore()
    const { dsl } = await seedAvailableDsl(store, {
      minStake: 0.1,
      step: 0.1,
      listedStake: 10,
    })

    // 0.3% on a 0.1% step must pass (IEEE-754 float trap check)
    const valid = await computeQuote({ dslId: dsl.id, stake: 0.3 }, store)
    expect(valid.ok).toBe(true)

    const invalid = await computeQuote({ dslId: dsl.id, stake: 0.35 }, store)
    expect(invalid.ok).toBe(false)
    if (!invalid.ok) {
      expect(invalid.reason).toMatch(/not a multiple of step/)
    }
  })

  it('derives upfront quotes with full-term initial payment and 0 monthly thereafter', async () => {
    const store = createInMemoryPurchaseStore()
    const { dsl } = await seedAvailableDsl(store, {
      termStart: '2026-11-01',
      endDate: '2027-03-31', // 5 months inclusive
      paymentModel: 'upfront',
      wholesaleMonthlyPerPercent: 70, // retail 76
      minStake: 2,
      step: 1,
      listedStake: 20,
    })

    const quote = await computeQuote({ dslId: dsl.id, stake: 5 }, store)
    expect(quote.ok).toBe(true)
    if (!quote.ok) return

    // 5 months * $76 * 5% = $1900 upfront, $0 monthly
    expect(quote.value.termMonths).toBe(5)
    expect(quote.value.initialPaymentNzd).toBe(1900)
    expect(quote.value.monthlyPaymentNzd).toBe(0)
  })

  it('refuses a quote when investorSplit is null and never falls back to 75', async () => {
    const store = createInMemoryPurchaseStore()
    const { dsl } = await seedAvailableDsl(store)
    await store.updateDsl(dsl.id, { investorSplit: null })

    const quote = await computeQuote({ dslId: dsl.id, stake: 2.5 }, store)
    expect(quote.ok).toBe(false)
    if (!quote.ok) {
      expect(quote.reason).toContain('dsl.investor_split')
    }
  })
})

describe('Step 8a — document compilation and acceptance gate', () => {
  it('compiles PDS and SA with account.fullName and enforces all four SA declarations', async () => {
    const store = createInMemoryPurchaseStore()
    const { dsl } = await seedAvailableDsl(store)
    const account = await store.insertAccount({
      id: 'acc-1',
      fullName: 'Aroha Williams',
      email: 'aroha@example.co.nz',
    })

    const compiled = await compileBuyerDocuments(
      { dslId: dsl.id, accountId: account.id, stake: 5, executedDate: '2026-10-21' },
      store,
    )
    expect(compiled.ok).toBe(true)
    if (!compiled.ok) return

    expect(compiled.value.pack.pds.markdown).toContain('Aroha Williams')
    expect(compiled.value.pack.sa.markdown).toContain('Aroha Williams')
    expect(compiled.value.pack.pds.hash).toMatch(/^[a-f0-9]{64}$/)
    expect(compiled.value.pack.sa.hash).toMatch(/^[a-f0-9]{64}$/)

    // Missing one declaration fails
    const missingDecl = verifyDocumentAcceptance({
      pdsAccepted: true,
      saAccepted: true,
      declarationsAccepted: SA_DECLARATIONS.slice(0, 3),
    })
    expect(missingDecl.ok).toBe(false)

    // All accepted passes
    const allAccepted = verifyDocumentAcceptance({
      pdsAccepted: true,
      saAccepted: true,
      declarationsAccepted: [...SA_DECLARATIONS],
    })
    expect(allAccepted.ok).toBe(true)
  })
})

describe('Step 8a — Identity and Checkout gates', () => {
  const fullAcceptance = {
    pdsAccepted: true,
    saAccepted: true,
    declarationsAccepted: [...SA_DECLARATIONS],
  }

  it('starts Stripe Identity for unverified accounts, skips when verified, and refuses when failed', async () => {
    const store = createInMemoryPurchaseStore()
    await seedAvailableDsl(store)
    const stripe = fakeStripe()

    const account = await store.insertAccount({
      id: 'acc-kyc',
      fullName: 'Wiremu Kingi',
      email: 'wiremu@example.co.nz',
      kycStatus: 'unverified',
    })

    // 1. Unverified starts Stripe Identity and flips account to pending
    const startRes = await beginOrConfirmIdentity(
      {
        accountId: account.id,
        acceptance: fullAcceptance,
        returnUrl: 'https://www.evolutionstables.nz/marketplace/lady-ketchikan',
      },
      store,
      stripe,
    )
    expect(startRes.ok).toBe(true)
    if (startRes.ok) {
      expect(startRes.value.status).toBe('verification_required')
    }
    expect(stripe.identityCalls).toBe(1)
    expect((await store.findAccountById(account.id))?.kycStatus).toBe('pending')

    // 1b. Pending blocks progression to Checkout without opening another Identity session
    const pendingRes = await beginOrConfirmIdentity(
      {
        accountId: account.id,
        acceptance: fullAcceptance,
        returnUrl: 'https://www.evolutionstables.nz/marketplace/lady-ketchikan',
      },
      store,
      stripe,
    )
    expect(pendingRes.ok).toBe(false)
    expect(stripe.identityCalls).toBe(1)

    // 2. Verified skips Stripe Identity once full name is confirmed
    await store.updateAccountKycStatus(account.id, 'verified')
    const wrongName = await beginOrConfirmIdentity(
      {
        accountId: account.id,
        acceptance: fullAcceptance,
        confirmedFullName: 'Someone Else',
        returnUrl: 'https://www.evolutionstables.nz/marketplace/lady-ketchikan',
      },
      store,
      stripe,
    )
    expect(wrongName.ok).toBe(false)

    const confirmed = await beginOrConfirmIdentity(
      {
        accountId: account.id,
        acceptance: fullAcceptance,
        confirmedFullName: 'Wiremu Kingi',
        returnUrl: 'https://www.evolutionstables.nz/marketplace/lady-ketchikan',
      },
      store,
      stripe,
    )
    expect(confirmed.ok).toBe(true)
    if (confirmed.ok) {
      expect(confirmed.value.status).toBe('verified')
    }
    expect(stripe.identityCalls).toBe(1)

    // 3. Failed stops the sale
    await store.updateAccountKycStatus(account.id, 'failed')
    const failed = await beginOrConfirmIdentity(
      {
        accountId: account.id,
        acceptance: fullAcceptance,
        returnUrl: 'https://www.evolutionstables.nz/marketplace/lady-ketchikan',
      },
      store,
      stripe,
    )
    expect(failed.ok).toBe(false)
  })

  it('blocks Checkout unless kycStatus is verified, and writes no sale row on session creation', async () => {
    const store = createInMemoryPurchaseStore()
    const { dsl } = await seedAvailableDsl(store)
    const stripe = fakeStripe()

    const account = await store.insertAccount({
      id: 'acc-checkout',
      fullName: 'Hanaoka Mei',
      email: 'mei@example.co.nz',
      kycStatus: 'pending',
    })

    const blocked = await openCheckoutSession(
      {
        dslId: dsl.id,
        accountId: account.id,
        stake: 2.5,
        acceptance: fullAcceptance,
        successUrl: 'https://www.evolutionstables.nz/mystable',
        cancelUrl: 'https://www.evolutionstables.nz/marketplace/lady-ketchikan',
      },
      store,
      stripe,
    )
    expect(blocked.ok).toBe(false)
    expect(stripe.checkoutCalls).toBe(0)

    await store.updateAccountKycStatus(account.id, 'verified')
    const opened = await openCheckoutSession(
      {
        dslId: dsl.id,
        accountId: account.id,
        stake: 2.5,
        acceptance: fullAcceptance,
        successUrl: 'https://www.evolutionstables.nz/mystable',
        cancelUrl: 'https://www.evolutionstables.nz/marketplace/lady-ketchikan',
      },
      store,
      stripe,
    )
    expect(opened.ok).toBe(true)
    expect(stripe.checkoutCalls).toBe(1)
    expect(store.dump().sales).toHaveLength(0)
  })
})

describe('Step 8a — frozen sale documents survive later horse rename and DSL edits', () => {
  it('keeps sold PDS/SA markdown and hashes untouched when the horse is renamed or re-priced', async () => {
    const store = createInMemoryPurchaseStore()
    const { dsl, trainer, owner } = await seedAvailableDsl(store, {
      listedStake: 10,
      minStake: 2.5,
      step: 2.5,
    })

    const account = await store.insertAccount({
      id: 'acc-freeze',
      fullName: 'charlotte Taylor',
      email: 'charlotte@example.co.nz',
      kycStatus: 'verified',
    })

    const webhookRes = await recordWebhookEvent(
      {
        id: 'evt_sale_1',
        type: 'checkout.session.completed',
        data: {
          object: {
            id: 'cs_live_freeze_1',
            metadata: {
              dsl_id: dsl.id,
              account_id: account.id,
              stake: '5',
              executed_date: '2026-10-21',
              stripe_identity_id: 'vs_123',
            },
          },
        },
      },
      store,
    )
    expect(webhookRes.ok).toBe(true)

    const salesBefore = await store.listSalesByUserId(account.id)
    expect(salesBefore).toHaveLength(1)
    const frozen = salesBefore[0]
    expect(frozen.pdsMarkdown).toContain('Lady Ketchikan')
    expect(frozen.saMarkdown).toContain('Lady Ketchikan')

    // Now edit the horse (rename + soft prose) and re-price the DSL
    const base = baseSaveInput()
    const edited = await updateDsl(
      {
        dslId: dsl.id,
        horse: {
          ...base.horse,
          legalName: 'Renamed Star',
          aboutHorse: 'Completely rewritten about text after sale.',
        },
        trainer: {
          name: trainer.name,
          stable: trainer.stable,
          location: trainer.location,
          website: trainer.website,
          bio: trainer.bio,
        },
        owner: {
          entity: owner.entity,
          contact: owner.contact,
          website: owner.website,
          profile: owner.profile,
        },
        dsl: {
          ...base.dsl,
          wholesaleMonthlyPerPercent: 95,
        },
      },
      store,
    )
    expect(edited.ok).toBe(true)

    const salesAfter = await store.listSalesByUserId(account.id)
    expect(salesAfter).toHaveLength(1)
    expect(salesAfter[0].pdsMarkdown).toBe(frozen.pdsMarkdown)
    expect(salesAfter[0].saMarkdown).toBe(frozen.saMarkdown)
    expect(salesAfter[0].pdsHash).toBe(frozen.pdsHash)
    expect(salesAfter[0].saHash).toBe(frozen.saHash)
    expect(salesAfter[0].pdsMarkdown).toContain('Lady Ketchikan')
    expect(salesAfter[0].pdsMarkdown).not.toContain('Renamed Star')
  })
})
