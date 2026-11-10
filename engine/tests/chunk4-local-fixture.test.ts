/**
 * TEMPORARY local-stack fixture. Not part of the gate. Run with:
 *   SUPABASE_URL=http://127.0.0.1:54421 SUPABASE_SERVICE_ROLE_KEY=<local> \
 *   pnpm exec vitest run tests/chunk4-local-fixture.test.ts
 */

import { createClient } from '@supabase/supabase-js'
import { describe, expect, it } from 'vitest'

import { saveDsl } from '../src/lib/dsl'
import { openCheckoutSession, recordWebhookEvent, SA_DECLARATIONS } from '../src/lib/purchase'
import { createSupabasePurchaseStore } from '../src/lib/purchaseStoreSupabase'
import type { StripeGateway } from '../src/lib/stripe'
import { approvedDraft, seedStore } from './helpers/dsl-fixture'

const LOCAL = process.env.CHUNK4_LOCAL === '1'

describe.skipIf(!LOCAL)('local-stack synthetic ledger fixture', () => {
  it('reserves and sells a dateless listing through the real path', async () => {
    const store = createSupabasePurchaseStore()
    const stamp = Date.now()
    const { horse, trainer, owner } = await seedStore(store, {
      horse: {
        slug: `synthetic-ledger-${stamp}`,
        legalName: `Synthetic Ledger Proof ${stamp} (SYNTHETIC)`,
        foalingDate: '2022-10-02',
        sex: 'Filly',
        colour: 'Brown',
        breeder: 'Synthetic Breeder (SYNTHETIC)',
        sireName: 'Synthetic Sire',
        damName: 'Synthetic Dam',
        microchip: null,
        lifeNumber: null,
        loveracingId: null,
        registered: true,
        aboutHorse: 'Synthetic fixture content for the ledger walk. Not a real horse.',
        racingOutlookAndPedigree: 'Synthetic fixture content for the ledger walk.',
        raceExpectation: 'Synthetic fixture content for the ledger walk.',
        imageCount: 3,
        raceRecord: {},
      },
      trainer: { displayName: `Synthetic Trainer ${stamp}` },
      owner: { displayName: `Synthetic Owner ${stamp}` },
    })

    const saved = await saveDsl(
      {
        horseId: horse.id,
        trainerId: trainer.id,
        ownerId: owner.id,
        dsl: approvedDraft({
          termStart: '',
          endDate: '2028-06-30',
          paymentModel: 'subscription_float',
          closeStyle: 'fourteen_day',
          status: 'available',
          published: true,
          wholesaleMonthlyPerPercent: 70,
          investorSplit: 75,
          listedStake: 10,
          minStake: 5,
          step: 5,
          distributionSchedule: 'Monthly within 14 days of NZTR settlement (synthetic)',
        }),
      },
      store,
    )
    if (!saved.ok) throw new Error(saved.reason)

    const admin = createClient(
      process.env.SUPABASE_URL ?? '',
      process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
      { auth: { persistSession: false, autoRefreshToken: false } },
    )
    const created = await admin.auth.admin.createUser({
      email: `synthetic-investor-${stamp}@example.test`,
      email_confirm: true,
      user_metadata: { full_name: 'Synthetic Investor (SYNTHETIC)' },
    })
    if (created.error) throw new Error(created.error.message)
    const accountId = created.data.user.id
    await store.updateAccountKycStatus(accountId, 'verified')

    let n = 0
    const stripe: StripeGateway = {
      async createIdentitySession() {
        throw new Error('not used')
      },
      async retrieveIdentitySession() {
        throw new Error('not used')
      },
      async createCheckoutSession() {
        n += 1
        return {
          id: `cs_synthetic_${stamp}_${n}`,
          url: `https://checkout.stripe.com/c/pay/cs_synthetic_${stamp}_${n}`,
        }
      },
    }

    const opened = await openCheckoutSession(
      {
        dslId: saved.value.dsl.id,
        accountId,
        stake: 5,
        acceptance: {
          pdsAccepted: true,
          saAccepted: true,
          declarationsAccepted: [...SA_DECLARATIONS],
        },
        executedDate: '2026-11-15',
        successUrl: 'https://example.test/ok',
        cancelUrl: 'https://example.test/cancel',
      },
      store,
      stripe,
      undefined,
      { countImages: async () => 3 },
    )
    if (!opened.ok) throw new Error(opened.reason)

    const checkout = await store.findCheckoutSessionByStripeSessionId(
      opened.value.checkoutSessionId,
    )
    if (checkout === null) throw new Error('no bound checkout')

    const res = await recordWebhookEvent(
      {
        id: `evt_synthetic_${stamp}`,
        type: 'checkout.session.completed',
        data: {
          object: {
            id: opened.value.checkoutSessionId,
            payment_status: 'paid',
            amount_total: Math.round(checkout.amountNzd * 100),
            currency: 'nzd',
            metadata: { checkout_id: checkout.id },
          },
        },
      },
      store,
    )
    if (!res.ok) throw new Error(res.reason)
    if (res.value.action !== 'sale_written') {
      throw new Error(`expected sale_written, got ${res.value.action}`)
    }

    const sale = res.value.sale
    console.log(
      JSON.stringify(
        {
          dslId: saved.value.dsl.id,
          saleId: sale.id,
          termStart: sale.termStart,
          termEnd: sale.termEnd,
          termMonths: sale.termMonths,
          model: sale.paymentModelAtSale,
          amount: sale.amount,
          pdsHash: sale.pdsHash,
          saHash: sale.saHash,
          pdsHasStart: sale.pdsMarkdown.includes('2026-11-01'),
          saHasStart: sale.saMarkdown.includes('2026-11-01'),
          dslTermStart: (await store.findDslById(saved.value.dsl.id))?.termStart ?? null,
        },
        null,
        2,
      ),
    )

    expect(sale.termStart).toBe('2026-11-01')
    expect(sale.termMonths).toBe(20)
    expect(sale.paymentModelAtSale).toBe('subscription_float')
  })
})
