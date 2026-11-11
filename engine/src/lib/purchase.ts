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

import { isListableDsl, type ListableDsl, type PaymentModel } from './dslStore'
import {
  createInMemoryEmailSender,
  sendEngineEmail,
  type EmailSender,
} from './email'
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
import type { AccountRow, CheckoutSessionRow, PurchaseStore, SaleRow } from './purchaseStore'
import type { StripeGateway, StripeWebhookEvent } from './stripe'
import { termMonthsBetween } from './term'

export type Result<T> = { ok: true; value: T } | { ok: false; reason: string }

/**
 * How long a Checkout attempt holds its stake.
 *
 * The brief locked a five-minute hold; the founder moved it to ten on
 * 2026-11-07, because Stripe Identity (document photo plus liveness) is the
 * slow step and a hold that lapses mid-verification sends the buyer through
 * the backstop for no reason. Ten minutes covers reading, signing, Identity,
 * and card entry. An abandoned hold ties up stock for at most this plus one
 * cron interval.
 */
export const CHECKOUT_HOLD_SECONDS = 600

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

export function validatePurchaseStake(
  dsl: ListableDsl,
  stake: number,
): Result<{ effectiveMin: number }> {
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

export type SaleTimeTerms = {
  termStart: string
  termMonths: number
  paymentModel: PaymentModel
}

/**
 * U21 (ruling 25): the start and the model are a property of the sale, not of
 * the listing. A chunk-3 listing carries an expiry and no start, so at
 * checkout the start becomes the first day of the calendar month the investor
 * buys in, and the model becomes `upfront` when the listing is upfront or five
 * months or less remain. The listing's `term_start` is never written.
 */
export function saleTimeTerms(
  dsl: ListableDsl,
  executedDate: string,
): Result<SaleTimeTerms> {
  const termStart = /^\d{4}-\d{2}-\d{2}$/.test(executedDate)
    ? `${executedDate.slice(0, 7)}-01`
    : null
  if (termStart === null) {
    return { ok: false, reason: 'the execution date must be YYYY-MM-DD' }
  }

  const termMonths = termMonthsBetween(termStart, dsl.endDate)
  if (termMonths === null || termMonths < 1) {
    return { ok: false, reason: 'term dates are invalid' }
  }

  const paymentModel: PaymentModel =
    dsl.paymentModel === 'upfront' || termMonths <= 5
      ? 'upfront'
      : 'subscription_float'

  return { ok: true, value: { termStart, termMonths, paymentModel } }
}

export type PricedPurchase = {
  terms: SaleTimeTerms
  stake: number
  effectiveMinStake: number
  initialPaymentNzd: number
  monthlyPaymentNzd: number
}

/**
 * The one price a purchase pays: the stake guard plus the U21 sale-time start,
 * remaining months and effective model. The database's
 * `record_sale_atomically` derives the same numbers from the bound checkout.
 */
export function pricePurchase(
  dsl: ListableDsl,
  stake: number,
  executedDate: string,
): Result<PricedPurchase> {
  const checked = validatePurchaseStake(dsl, stake)
  if (!checked.ok) return checked

  const terms = saleTimeTerms(dsl, executedDate)
  if (!terms.ok) return terms

  const { termMonths, paymentModel } = terms.value
  const retailRate = dsl.retailMonthlyPerPercent

  return {
    ok: true,
    value: {
      terms: terms.value,
      stake,
      effectiveMinStake: checked.value.effectiveMin,
      initialPaymentNzd:
        paymentModel === 'upfront'
          ? upfrontTotal(termMonths, retailRate, stake)
          : floatTotal(retailRate, stake),
      monthlyPaymentNzd:
        paymentModel === 'upfront' ? 0 : totalForStake(retailRate, stake),
    },
  }
}

export async function computeQuote(
  input: { dslId: string; stake?: number; executedDate?: string },
  store: PurchaseStore,
): Promise<Result<PurchaseQuote>> {
  const dsl = await store.findDslById(input.dslId)
  if (dsl === null) {
    return { ok: false, reason: `DSL ${input.dslId} does not exist` }
  }
  if (!isListableDsl(dsl)) {
    return { ok: false, reason: 'this listing does not have its commercial terms yet' }
  }

  const horse = await store.findHorseById(dsl.horseId)
  if (horse === null) {
    return { ok: false, reason: `horse ${dsl.horseId} does not exist` }
  }

  const split = investorReturnPctFrom(dsl.investorSplit)
  if (split === null) {
    return { ok: false, reason: 'missing required value for dsl.investor_split' }
  }

  // A dated listing quotes from its own start unless the caller supplies the
  // month the buyer is executing in. The sale itself always uses the latter.
  const executedDate =
    input.executedDate ?? dsl.termStart ?? new Date().toISOString().slice(0, 10)

  const effectiveMin = effectiveMinStake(dsl.minStake, dsl.stakeRemaining)
  const chosenStake = input.stake ?? effectiveMin

  const priced = pricePurchase(dsl, chosenStake, executedDate)
  if (!priced.ok) return priced

  return {
    ok: true,
    value: {
      dslId: dsl.id,
      horseLegalName: horse.legalName,
      paymentModel: priced.value.terms.paymentModel,
      stake: chosenStake,
      effectiveMinStake: priced.value.effectiveMinStake,
      maxStake: dsl.stakeRemaining,
      step: dsl.step,
      initialPaymentNzd: priced.value.initialPaymentNzd,
      monthlyPaymentNzd: priced.value.monthlyPaymentNzd,
      termStart: priced.value.terms.termStart,
      endDate: dsl.endDate,
      termMonths: priced.value.terms.termMonths,
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

  const executedDate = input.executedDate ?? new Date().toISOString().slice(0, 10)

  const quoteResult = await computeQuote(
    { dslId: input.dslId, stake: input.stake, executedDate },
    store,
  )
  if (!quoteResult.ok) return quoteResult

  const dsl = await store.findDslById(input.dslId)
  if (dsl === null) return { ok: false, reason: `DSL ${input.dslId} does not exist` }
  if (!isListableDsl(dsl)) {
    return { ok: false, reason: 'this listing does not have its commercial terms yet' }
  }

  const horse = await store.findHorseById(dsl.horseId)
  if (horse === null) return { ok: false, reason: `horse ${dsl.horseId} does not exist` }

  const trainer =
    dsl.trainerId === null ? null : await store.findPartyById(dsl.trainerId)
  if (trainer === null) return { ok: false, reason: 'horse has no trainer row' }

  if (dsl.ownerId === null) return { ok: false, reason: 'dsl has no owner row' }
  const owner = await store.findPartyById(dsl.ownerId)
  if (owner === null) return { ok: false, reason: 'dsl has no owner row' }

  try {
    const pack = compileLegalPack(
      {
        account: { fullName: account.fullName },
        // The documents print the sale's start and the model actually charged
        // (U21), never the listing's absent start.
        dsl: {
          ...dsl,
          termStart: quoteResult.value.termStart,
          paymentModel: quoteResult.value.paymentModel,
        },
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
  emailSender: EmailSender = createInMemoryEmailSender(),
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

  // Lazy expiry: a hold that lapsed while nobody called the cron is returned
  // here, before this buyer is refused for stock that is actually free.
  await store.expireCheckoutSessions()

  const executedDate = input.executedDate ?? new Date().toISOString().slice(0, 10)

  const quoteResult = await computeQuote(
    { dslId: input.dslId, stake: input.stake, executedDate },
    store,
  )
  if (!quoteResult.ok) return quoteResult

  // Ruling 26: images never block. The checkout does not read the bucket.
  // B5: compile and freeze the exact documents the buyer is about to accept,
  // before Stripe is called. The webhook reads this row, never a fresh compile.
  const compiled = await compileBuyerDocuments(
    { dslId: input.dslId, accountId: account.id, stake: quoteResult.value.stake, executedDate },
    store,
  )
  if (!compiled.ok) return compiled

  let checkout: CheckoutSessionRow
  try {
    checkout = await store.reserveCheckoutSession({
      dslId: input.dslId,
      accountId: account.id,
      printedName: account.fullName,
      email: account.email,
      horseLegalName: quoteResult.value.horseLegalName,
      stake: quoteResult.value.stake,
      amountNzd: quoteResult.value.initialPaymentNzd,
      executedDate,
      pdsMarkdown: compiled.value.pack.pds.markdown,
      saMarkdown: compiled.value.pack.sa.markdown,
      pdsHash: compiled.value.pack.pds.hash,
      saHash: compiled.value.pack.sa.hash,
      expiresAt: new Date(Date.now() + CHECKOUT_HOLD_SECONDS * 1000).toISOString(),
    })
  } catch (error) {
    const reason =
      error instanceof Error ? error.message : 'failed to bind the checkout documents'
    await sendEngineEmail(
      { kind: 'founder_our_fault_failure', stage: 'checkout', reason },
      emailSender,
    )
    return { ok: false, reason }
  }

  let session: { id: string; url: string }
  try {
    session = await stripe.createCheckoutSession({
      dslId: input.dslId,
      accountId: account.id,
      checkoutId: checkout.id,
      horseLegalName: quoteResult.value.horseLegalName,
      stake: quoteResult.value.stake,
      amountNzd: quoteResult.value.initialPaymentNzd,
      executedDate,
      stripeIdentityId: input.stripeIdentityId ?? null,
      successUrl: input.successUrl,
      cancelUrl: input.cancelUrl,
    })
  } catch (error) {
    const reason =
      error instanceof Error ? error.message : 'failed to create Stripe Checkout session'
    await store.releaseCheckoutSession(checkout.id)
    await sendEngineEmail(
      {
        kind: 'founder_our_fault_failure',
        stage: 'checkout',
        reason,
      },
      emailSender,
    )
    return { ok: false, reason }
  }

  try {
    await store.attachStripeSession(checkout.id, session.id)
  } catch (error) {
    // Not fatal: the session metadata carries `checkout_id`, so the webhook can
    // still find the binding. Tell the founder rather than lose the link.
    await sendEngineEmail(
      {
        kind: 'founder_our_fault_failure',
        stage: 'checkout',
        reason: `checkout ${checkout.id} could not record stripe session ${session.id}: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      },
      emailSender,
    )
  }

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
  | { action: 'refused'; reason: string; eventType: string }
  | { action: 'ignored'; eventType: string }

function metadataString(metadata: Record<string, unknown>, key: string): string {
  const raw = metadata[key]
  return typeof raw === 'string' ? raw.trim() : ''
}

export async function recordWebhookEvent(
  event: StripeWebhookEvent,
  store: PurchaseStore,
  emailSender: EmailSender = createInMemoryEmailSender(),
): Promise<Result<WebhookResult>> {
  async function failWebhook(reason: string): Promise<Result<WebhookResult>> {
    await sendEngineEmail(
      {
        kind: 'founder_our_fault_failure',
        stage: 'webhook',
        reason,
      },
      emailSender,
    )
    return { ok: false, reason }
  }

  const obj = event.data.object ?? {}
  const metadata =
    typeof obj.metadata === 'object' && obj.metadata !== null
      ? (obj.metadata as Record<string, unknown>)
      : {}

  if (event.type === 'identity.verification_session.verified') {
    const accountId = metadataString(metadata, 'account_id')
    if (accountId === '') {
      return failWebhook('identity event is missing metadata.account_id')
    }
    try {
      const updated = await store.updateAccountKycStatus(accountId, 'verified')
      return {
        ok: true,
        value: { action: 'kyc_updated', accountId: updated.id, kycStatus: updated.kycStatus },
      }
    } catch (error) {
      return failWebhook(
        error instanceof Error ? error.message : 'failed to update verified KYC status',
      )
    }
  }

  if (
    event.type === 'identity.verification_session.requires_input' ||
    event.type === 'identity.verification_session.canceled'
  ) {
    const accountId = metadataString(metadata, 'account_id')
    if (accountId === '') {
      return failWebhook('identity event is missing metadata.account_id')
    }
    let updated: AccountRow
    try {
      updated = await store.updateAccountKycStatus(accountId, 'failed')
    } catch (error) {
      return failWebhook(
        error instanceof Error ? error.message : 'failed to update failed KYC status',
      )
    }
    await sendEngineEmail(
      {
        kind: 'buyer_kyc_failed',
        account: updated,
      },
      emailSender,
    )
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
    return failWebhook('checkout.session.completed is missing session id')
  }

  const checkoutId = metadataString(metadata, 'checkout_id')
  const bound =
    checkoutId !== ''
      ? await store.findCheckoutSessionById(checkoutId)
      : await store.findCheckoutSessionByStripeSessionId(stripeSessionId)

  const stripeIdentityIdRaw = metadataString(metadata, 'stripe_identity_id')
  const stripeIdentityId = stripeIdentityIdRaw !== '' ? stripeIdentityIdRaw : null

  const paymentStatus = typeof obj.payment_status === 'string' ? obj.payment_status.trim() : ''
  if (paymentStatus !== 'paid') {
    // No money moved: no sale, no paid_unfulfilled, and the hold stays open.
    const reason = `Stripe reports payment_status '${paymentStatus || 'missing'}'`
    await sendEngineEmail(
      {
        kind: 'founder_our_fault_failure',
        stage: 'webhook',
        reason: `checkout ${bound?.id ?? stripeSessionId} (${stripeSessionId}): ${reason}`,
      },
      emailSender,
    )
    return { ok: true, value: { action: 'refused', reason, eventType: event.type } }
  }

  // H6: one call writes the snapshot and claims the hold, or refuses. Amount
  // and currency are re-validated inside the transaction; nothing here writes
  // a sale row separately, and there is no delete to compensate with.
  let recorded
  try {
    recorded = await store.recordSaleAtomically({
      checkoutId: bound?.id ?? (checkoutId !== '' ? checkoutId : null),
      stripeSessionId,
      stripeAmountTotalCents:
        typeof obj.amount_total === 'number' ? obj.amount_total : Number.NaN,
      stripeCurrency: typeof obj.currency === 'string' ? obj.currency : '',
      stripeIdentityId,
    })
  } catch (error) {
    const reason =
      error instanceof Error ? error.message : 'failed to write the sale atomically'
    return failWebhook(reason)
  }

  if (recorded.outcome === 'paid_unfulfilled') {
    // The database wrote no sale and marked the checkout. The money is real;
    // a human resolves it.
    const reason = recorded.reason ?? 'the sale could not be recorded'
    await sendEngineEmail(
      {
        kind: 'founder_our_fault_failure',
        stage: 'webhook',
        reason: `checkout ${bound?.id ?? stripeSessionId} (${stripeSessionId}): ${reason}`,
      },
      emailSender,
    )
    return { ok: true, value: { action: 'refused', reason, eventType: event.type } }
  }

  const sale = recorded.sale
  if (sale === null) {
    return failWebhook(
      `record_sale_atomically returned ${recorded.outcome} without a sale row`,
    )
  }

  if (recorded.outcome === 'idempotent_replay') {
    return {
      ok: true,
      value: { action: 'sale_written', sale, idempotentReplay: true },
    }
  }

  let horseLegalName = bound?.horseLegalName ?? ''
  if (horseLegalName === '') {
    const dsl = await store.findDslById(sale.dslId)
    const horse = dsl === null ? null : await store.findHorseById(dsl.horseId)
    horseLegalName = horse?.legalName ?? 'your horse'
  }

  await sendEngineEmail(
    {
      kind: 'buyer_sale_written',
      sale,
      horseLegalName,
    },
    emailSender,
  )
  await sendEngineEmail(
    {
      kind: 'founder_sale_succeeded',
      sale,
      horseLegalName,
    },
    emailSender,
  )

  return {
    ok: true,
    value: { action: 'sale_written', sale, idempotentReplay: false },
  }
}
