/**
 * The purchase domain. PLAN.md step 8 (`PLAN.md:224-239`, `:316`, `:349`).
 *
 * Pure business logic over `PurchaseStore` and `StripeGateway`:
 * - `computeQuote` wires `effectiveMinStake` (`engine/src/lib/pricing.ts:120`)
 *   and `validateStake`, deriving initial and monthly figures from the DSL's
 *   stored `retailMonthlyPerPercent` without recomputing `wholesale * 1.05 * 1.03`
 *   and without any `'75'` split fallback.
 * - `compileBuyerDocuments` compiles the PDS and SA with `account.fullName` and
 *   validates the buyer's acceptance of the PDS, the SA, and the four mandatory
 *   SA declarations (`PLAN.md:232`).
 * - `beginOrConfirmIdentity` enforces the KYC gate (`PLAN.md:234`).
 * - `openCheckoutSession` creates the hosted Stripe Checkout session in
 *   `payment` mode and writes no sale row (`PLAN.md:222`, `:236`).
 * - `recordWebhookEvent` handles Identity status updates and idempotently
 *   writes the frozen sale row on `checkout.session.completed`, drawing down
 *   `stakeRemaining` and flipping `status` to `'fully_allocated'` at 0 (`PLAN.md:316`).
 */

import type { DslRow, PaymentModel } from './dslStore'
import { compileLegalPack, type LegalPack } from './legal/compile'
import type { LegalCorpus } from './legal/templates'
import {
  effectiveMinStake,
  floatTotal,
  investorReturnPctFrom,
  REFUND_SENTENCE,
  totalForStake,
  upfrontTotal,
  validateStake,
} from './pricing'
import type { AccountRow, PurchaseStore, SaleRow } from './purchaseStore'
import type { StripeGateway, StripeWebhookEvent } from './stripe'
import { termMonthsBetween } from './term'

export type Result<T> = { ok: true; value: T } | { ok: false; reason: string }

/**
 * The four mandatory SA declarations from `PLAN.md:232`, verbatim.
 */
export const SA_DECLARATIONS = [
  'not disqualified or suspended under the NZTR Rules of Racing',
  'acquiring the stake as the true beneficial owner',
  'bound by the NZTR Rules of Racing and the Welfare Guidelines',
  'Evolution Stables Limited is the syndicate manager',
] as const

export type SaDeclaration = (typeof SA_DECLARATIONS)[number]

export type DocumentAcceptanceInput = {
  pdsAccepted: boolean
  saAccepted: boolean
  declarationsAccepted: readonly string[]
}

export type PurchaseQuote = {
  dslId: string
  horseLegalName: string
  paymentModel: PaymentModel
  stake: number
  effectiveMinStake: number
  maxStake: number
  step: number
  initialPaymentNzd: number
  monthlyPaymentNzd: number
  termStart: string
  endDate: string
  termMonths: number
  investorSplit: number
  refundSentence: string
}

export function validatePurchaseStake(dsl: DslRow, stake: number): Result<{ effectiveMin: number }> {
  if (dsl.status !== 'available' || !dsl.published) {
    return { ok: false, reason: 'this listing is not available for purchase' }
  }
  if (!(dsl.stakeRemaining > 0)) {
    return { ok: false, reason: 'no stake remains on this listing' }
  }

  const effectiveMin = effectiveMinStake(dsl.minStake, dsl.stakeRemaining)

  if (!Number.isFinite(stake) || stake <= 0) {
    return { ok: false, reason: 'stake must be a positive number' }
  }
  if (Math.round(stake * 100) < Math.round(effectiveMin * 100)) {
    return {
      ok: false,
      reason: `stake ${stake}% is below the minimum of ${effectiveMin}%`,
    }
  }
  if (Math.round(stake * 100) > Math.round(dsl.stakeRemaining * 100)) {
    return {
      ok: false,
      reason: `stake ${stake}% exceeds the remaining ${dsl.stakeRemaining}%`,
    }
  }

  try {
    validateStake(stake, dsl.step)
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : 'invalid stake step' }
  }

  return { ok: true, value: { effectiveMin } }
}

export async function computeQuote(
  input: { dslId: string; stake?: number },
  store: PurchaseStore,
): Promise<Result<PurchaseQuote>> {
  const dsl = await store.findDslById(input.dslId)
  if (dsl === null) {
    return { ok: false, reason: `DSL ${input.dslId} does not exist` }
  }

  const horse = await store.findHorseById(dsl.horseId)
  if (horse === null) {
    return { ok: false, reason: `horse ${dsl.horseId} does not exist` }
  }

  const split = investorReturnPctFrom(dsl.investorSplit)
  if (split === null) {
    return { ok: false, reason: 'missing required value for dsl.investor_split' }
  }

  const termMonths = termMonthsBetween(dsl.termStart, dsl.endDate)
  if (termMonths === null || termMonths < 1) {
    return { ok: false, reason: 'term dates are invalid' }
  }

  const effectiveMin = effectiveMinStake(dsl.minStake, dsl.stakeRemaining)
  const chosenStake = input.stake ?? effectiveMin

  const checked = validatePurchaseStake(dsl, chosenStake)
  if (!checked.ok) return checked

  const retailRate = dsl.retailMonthlyPerPercent
  const initialPaymentNzd =
    dsl.paymentModel === 'upfront'
      ? upfrontTotal(termMonths, retailRate, chosenStake)
      : floatTotal(retailRate, chosenStake)
  const monthlyPaymentNzd =
    dsl.paymentModel === 'upfront' ? 0 : totalForStake(retailRate, chosenStake)

  return {
    ok: true,
    value: {
      dslId: dsl.id,
      horseLegalName: horse.legalName,
      paymentModel: dsl.paymentModel,
      stake: chosenStake,
      effectiveMinStake: effectiveMin,
      maxStake: dsl.stakeRemaining,
      step: dsl.step,
      initialPaymentNzd,
      monthlyPaymentNzd,
      termStart: dsl.termStart,
      endDate: dsl.endDate,
      termMonths,
      investorSplit: split,
      refundSentence: REFUND_SENTENCE,
    },
  }
}

export function verifyDocumentAcceptance(acceptance: DocumentAcceptanceInput): Result<true> {
  if (!acceptance.pdsAccepted) {
    return { ok: false, reason: 'you must accept the Product Disclosure Statement' }
  }
  if (!acceptance.saAccepted) {
    return { ok: false, reason: 'you must accept the Syndicate Agreement' }
  }

  const acceptedSet = new Set(acceptance.declarationsAccepted)
  for (const requiredDeclaration of SA_DECLARATIONS) {
    if (!acceptedSet.has(requiredDeclaration)) {
      return {
        ok: false,
        reason: `missing required declaration: ${requiredDeclaration}`,
      }
    }
  }

  return { ok: true, value: true }
}

export type CompiledBuyerDocuments = {
  account: AccountRow
  quote: PurchaseQuote
  pack: LegalPack
  declarations: readonly string[]
}

export async function compileBuyerDocuments(
  input: {
    dslId: string
    accountId: string
    stake: number
    executedDate?: string
  },
  store: PurchaseStore,
  corpus?: LegalCorpus,
): Promise<Result<CompiledBuyerDocuments>> {
  const account = await store.findAccountById(input.accountId)
  if (account === null) {
    return { ok: false, reason: `account ${input.accountId} does not exist` }
  }

  const quoteResult = await computeQuote({ dslId: input.dslId, stake: input.stake }, store)
  if (!quoteResult.ok) return quoteResult

  const dsl = await store.findDslById(input.dslId)
  if (dsl === null) return { ok: false, reason: `DSL ${input.dslId} does not exist` }

  const horse = await store.findHorseById(dsl.horseId)
  if (horse === null) return { ok: false, reason: `horse ${dsl.horseId} does not exist` }

  const trainer = await store.findTrainerById(horse.trainerId)
  if (trainer === null) return { ok: false, reason: 'horse has no trainer row' }

  const owner = await store.findOwnerById(horse.ownerId)
  if (owner === null) return { ok: false, reason: 'horse has no owner row' }

  const executedDate = input.executedDate ?? new Date().toISOString().slice(0, 10)

  try {
    const pack = compileLegalPack(
      {
        account: { fullName: account.fullName },
        dsl,
        horse,
        trainer,
        owner,
        sale: { stake: input.stake, executedDate },
      },
      corpus,
    )

    return {
      ok: true,
      value: {
        account,
        quote: quoteResult.value,
        pack,
        declarations: SA_DECLARATIONS,
      },
    }
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? error.message : 'failed to compile buyer documents',
    }
  }
}

export type IdentityStepOutcome =
  | { status: 'verified'; fullName: string; stripeIdentityId: string | null }
  | { status: 'verification_required'; verificationSessionId: string; verificationUrl: string }

export async function beginOrConfirmIdentity(
  input: {
    accountId: string
    acceptance: DocumentAcceptanceInput
    confirmedFullName?: string
    returnUrl: string
  },
  store: PurchaseStore,
  stripe: StripeGateway,
): Promise<Result<IdentityStepOutcome>> {
  const accepted = verifyDocumentAcceptance(input.acceptance)
  if (!accepted.ok) return accepted

  const account = await store.findAccountById(input.accountId)
  if (account === null) {
    return { ok: false, reason: `account ${input.accountId} does not exist` }
  }

  if (account.kycStatus === 'failed' || account.kycStatus === 'pending') {
    return {
      ok: false,
      reason: `identity verification is ${account.kycStatus}; this purchase cannot proceed to checkout`,
    }
  }

  if (account.kycStatus === 'verified') {
    if (
      typeof input.confirmedFullName !== 'string' ||
      input.confirmedFullName.trim() !== account.fullName
    ) {
      return {
        ok: false,
        reason: `confirm your full legal name (${account.fullName}) to continue`,
      }
    }
    return {
      ok: true,
      value: {
        status: 'verified',
        fullName: account.fullName,
        stripeIdentityId: null,
      },
    }
  }

  const session = await stripe.createIdentitySession({
    accountId: account.id,
    email: account.email,
    returnUrl: input.returnUrl,
  })

  await store.updateAccountKycStatus(account.id, 'pending')

  return {
    ok: true,
    value: {
      status: 'verification_required',
      verificationSessionId: session.id,
      verificationUrl: session.url,
    },
  }
}

export async function openCheckoutSession(
  input: {
    dslId: string
    accountId: string
    stake: number
    acceptance: DocumentAcceptanceInput
    stripeIdentityId?: string | null
    executedDate?: string
    successUrl: string
    cancelUrl: string
  },
  store: PurchaseStore,
  stripe: StripeGateway,
): Promise<Result<{ checkoutSessionId: string; checkoutUrl: string; quote: PurchaseQuote }>> {
  const accepted = verifyDocumentAcceptance(input.acceptance)
  if (!accepted.ok) return accepted

  const account = await store.findAccountById(input.accountId)
  if (account === null) {
    return { ok: false, reason: `account ${input.accountId} does not exist` }
  }

  if (account.kycStatus !== 'verified') {
    return {
      ok: false,
      reason: `identity verification is required before checkout (current status: ${account.kycStatus})`,
    }
  }

  const quoteResult = await computeQuote({ dslId: input.dslId, stake: input.stake }, store)
  if (!quoteResult.ok) return quoteResult

  const executedDate = input.executedDate ?? new Date().toISOString().slice(0, 10)
  const session = await stripe.createCheckoutSession({
    dslId: input.dslId,
    accountId: account.id,
    horseLegalName: quoteResult.value.horseLegalName,
    stake: quoteResult.value.stake,
    amountNzd: quoteResult.value.initialPaymentNzd,
    executedDate,
    stripeIdentityId: input.stripeIdentityId ?? null,
    successUrl: input.successUrl,
    cancelUrl: input.cancelUrl,
  })

  return {
    ok: true,
    value: {
      checkoutSessionId: session.id,
      checkoutUrl: session.url,
      quote: quoteResult.value,
    },
  }
}

export type WebhookResult =
  | { action: 'sale_written'; sale: SaleRow; idempotentReplay: boolean }
  | { action: 'kyc_updated'; accountId: string; kycStatus: AccountRow['kycStatus'] }
  | { action: 'ignored'; eventType: string }

function metadataString(metadata: Record<string, unknown>, key: string): string {
  const raw = metadata[key]
  return typeof raw === 'string' ? raw.trim() : ''
}

export async function recordWebhookEvent(
  event: StripeWebhookEvent,
  store: PurchaseStore,
  corpus?: LegalCorpus,
): Promise<Result<WebhookResult>> {
  const obj = event.data.object ?? {}
  const metadata =
    typeof obj.metadata === 'object' && obj.metadata !== null
      ? (obj.metadata as Record<string, unknown>)
      : {}

  if (event.type === 'identity.verification_session.verified') {
    const accountId = metadataString(metadata, 'account_id')
    if (accountId === '') {
      return { ok: false, reason: 'identity event is missing metadata.account_id' }
    }
    const updated = await store.updateAccountKycStatus(accountId, 'verified')
    return {
      ok: true,
      value: { action: 'kyc_updated', accountId: updated.id, kycStatus: updated.kycStatus },
    }
  }

  if (
    event.type === 'identity.verification_session.requires_input' ||
    event.type === 'identity.verification_session.canceled'
  ) {
    const accountId = metadataString(metadata, 'account_id')
    if (accountId === '') {
      return { ok: false, reason: 'identity event is missing metadata.account_id' }
    }
    const updated = await store.updateAccountKycStatus(accountId, 'failed')
    return {
      ok: true,
      value: { action: 'kyc_updated', accountId: updated.id, kycStatus: updated.kycStatus },
    }
  }

  if (event.type === 'payment_intent.payment_failed' || event.type === 'checkout.session.expired') {
    // Card declines and expired checkouts write no sale and send no founder alert (PLAN.md:236).
    return { ok: true, value: { action: 'ignored', eventType: event.type } }
  }

  if (event.type !== 'checkout.session.completed') {
    return { ok: true, value: { action: 'ignored', eventType: event.type } }
  }

  const stripeSessionId = typeof obj.id === 'string' ? obj.id.trim() : ''
  if (stripeSessionId === '') {
    return { ok: false, reason: 'checkout.session.completed is missing session id' }
  }

  const existingSale = await store.findSaleByStripeSessionId(stripeSessionId)
  if (existingSale !== null) {
    return {
      ok: true,
      value: { action: 'sale_written', sale: existingSale, idempotentReplay: true },
    }
  }

  const dslId = metadataString(metadata, 'dsl_id')
  const accountId = metadataString(metadata, 'account_id')
  const stake = Number(metadataString(metadata, 'stake'))
  const executedDateRaw = metadataString(metadata, 'executed_date')
  const executedDate =
    executedDateRaw !== '' ? executedDateRaw : new Date().toISOString().slice(0, 10)
  const stripeIdentityIdRaw = metadataString(metadata, 'stripe_identity_id')
  const stripeIdentityId = stripeIdentityIdRaw !== '' ? stripeIdentityIdRaw : null

  if (dslId === '' || accountId === '' || !Number.isFinite(stake) || stake <= 0) {
    return {
      ok: false,
      reason: 'checkout.session.completed is missing required metadata (dsl_id, account_id, stake)',
    }
  }

  const compiled = await compileBuyerDocuments(
    { dslId, accountId, stake, executedDate },
    store,
    corpus,
  )
  if (!compiled.ok) return compiled

  const { account, quote, pack } = compiled.value
  const dsl = await store.findDslById(dslId)
  if (dsl === null) return { ok: false, reason: `DSL ${dslId} does not exist` }

  const sale = await store.insertSale({
    dslId: dsl.id,
    userId: account.id,
    printedName: account.fullName,
    email: account.email,
    stake: quote.stake,
    amount: quote.initialPaymentNzd,
    stripeSessionId,
    stripeIdentityId,
    pdsMarkdown: pack.pds.markdown,
    saMarkdown: pack.sa.markdown,
    pdsHash: pack.pds.hash,
    saHash: pack.sa.hash,
  })

  const remainingCents = Math.round(dsl.stakeRemaining * 100) - Math.round(quote.stake * 100)
  const nextRemaining = Math.max(0, remainingCents) / 100
  const nextStatus = nextRemaining === 0 ? 'fully_allocated' : dsl.status

  await store.updateDsl(dsl.id, {
    stakeRemaining: nextRemaining,
    status: nextStatus,
  })

  return {
    ok: true,
    value: { action: 'sale_written', sale, idempotentReplay: false },
  }
}
