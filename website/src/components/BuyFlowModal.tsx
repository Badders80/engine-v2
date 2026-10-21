'use client'

import Link from 'next/link'
import { useState } from 'react'

import {
  allDocumentsAccepted,
  BUY_FLOW_REFUND_SENTENCE,
  BUY_FLOW_SA_DECLARATIONS,
  canRenderBuyNow,
  fetchEngineDocuments,
  fetchEngineQuote,
  postEngineCheckout,
  postEngineIdentity,
  requireInvestorSplit,
  type EngineCompiledDocuments,
  type EngineIdentityOutcome,
  type EnginePurchaseQuote,
} from '../lib/engineClient'
import { SITE_URL } from '../lib/site'

/**
 * The one responsive five-screen buy flow (`BuyFlowModal.tsx`).
 * PLAN.md step 8 (`PLAN.md:224-239`, `:316`).
 *
 * Screens (`BUY_FLOW_SCREENS`):
 * 1. `Terms` — stake stepper (`effectiveMinStake` .. `stakeRemaining` by `step`),
 *    four quote rows from the engine, verbatim refund sentence, NZTR syndicator footer.
 * 2. `Documents` — `Review & Sign Documents`, PDS then SA inside `.legal-doc`,
 *    PDS + SA + four verbatim SA declarations required before advancing.
 * 3. `Identity` — confirms name when `kycStatus === 'verified'`, starts Stripe
 *    Identity (`type: 'document'`) when `unverified`, blocks Checkout when
 *    `failed` or `pending`.
 * 4. `Pay` — repeats initial payment, monthly amount, lease period, investor
 *    split, and verbatim refund sentence; redirects to hosted Stripe Checkout.
 * 5. `Return` — MyStable pending return state until the webhook writes `sales`.
 */

export const BUY_FLOW_SCREENS = ['Terms', 'Documents', 'Identity', 'Pay', 'Return'] as const
export type BuyFlowScreen = (typeof BUY_FLOW_SCREENS)[number]

export type BuyFlowModalProps = {
  dslId: string
  status: string
  horseSlug: string
  horseLegalName: string
  investorSplit: number | null
  initialQuote: EnginePurchaseQuote
  accountId: string | null
  accountFullName: string | null
  accountKycStatus: string | null
  engineBaseUrl?: string
  buyEnabled?: boolean
}

export default function BuyFlowModal({
  dslId,
  status,
  horseSlug,
  horseLegalName,
  investorSplit,
  initialQuote,
  accountId,
  accountFullName,
  accountKycStatus,
  engineBaseUrl,
  buyEnabled = true,
}: BuyFlowModalProps) {
  const [open, setOpen] = useState(false)
  const [screen, setScreen] = useState<BuyFlowScreen>('Terms')
  const [quote, setQuote] = useState<EnginePurchaseQuote>(initialQuote)
  const [compiled, setCompiled] = useState<EngineCompiledDocuments | null>(null)
  const [pdsAccepted, setPdsAccepted] = useState(false)
  const [saAccepted, setSaAccepted] = useState(false)
  const [declarationsAccepted, setDeclarationsAccepted] = useState<string[]>([])
  const [confirmedName, setConfirmedName] = useState(accountFullName ?? '')
  const [identityOutcome, setIdentityOutcome] = useState<EngineIdentityOutcome | null>(null)
  const [busy, setBusy] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  if (!canRenderBuyNow(status, buyEnabled ? 'true' : 'false')) {
    return null
  }

  const split = requireInvestorSplit(investorSplit ?? quote.investorSplit)
  const docsReady = allDocumentsAccepted({
    pdsAccepted,
    saAccepted,
    declarationsAccepted,
  })

  async function handleStakeStep(direction: -1 | 1) {
    const nextCents =
      Math.round(quote.stake * 100) + direction * Math.round(quote.step * 100)
    const minCents = Math.round(quote.effectiveMinStake * 100)
    const maxCents = Math.round(quote.maxStake * 100)
    if (nextCents < minCents || nextCents > maxCents) return

    const nextStake = nextCents / 100
    setBusy(true)
    setErrorMessage(null)
    try {
      const updated = await fetchEngineQuote(
        { dslId, stake: nextStake },
        engineBaseUrl,
      )
      setQuote(updated)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to update quote')
    } finally {
      setBusy(false)
    }
  }

  async function handleProceedToDocuments() {
    if (!accountId) {
      window.location.assign(`/login?next=${encodeURIComponent(`/marketplace/${horseSlug}`)}`)
      return
    }
    setBusy(true)
    setErrorMessage(null)
    try {
      const docs = await fetchEngineDocuments(
        { dslId, accountId, stake: quote.stake },
        engineBaseUrl,
      )
      setCompiled(docs)
      setQuote(docs.quote)
      setScreen('Documents')
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to load legal documents')
    } finally {
      setBusy(false)
    }
  }

  function toggleDeclaration(declaration: string) {
    setDeclarationsAccepted((prev) =>
      prev.includes(declaration)
        ? prev.filter((item) => item !== declaration)
        : [...prev, declaration],
    )
  }

  function handleProceedToIdentity() {
    if (!docsReady) return
    setErrorMessage(null)
    setScreen('Identity')
  }

  async function handleIdentityStep() {
    if (!accountId) return
    setBusy(true)
    setErrorMessage(null)
    try {
      const outcome = await postEngineIdentity(
        {
          accountId,
          pdsAccepted,
          saAccepted,
          declarationsAccepted,
          confirmedFullName: confirmedName,
          returnUrl: `${SITE_URL}/marketplace/${horseSlug}`,
        },
        engineBaseUrl,
      )
      setIdentityOutcome(outcome)
      if (outcome.status === 'verified') {
        setScreen('Pay')
      } else {
        window.location.assign(outcome.verificationUrl)
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Identity verification cannot proceed')
    } finally {
      setBusy(false)
    }
  }

  async function handleOpenCheckout() {
    if (!accountId) return
    setBusy(true)
    setErrorMessage(null)
    try {
      const session = await postEngineCheckout(
        {
          dslId,
          accountId,
          stake: quote.stake,
          pdsAccepted,
          saAccepted,
          declarationsAccepted,
          stripeIdentityId:
            identityOutcome?.status === 'verified' ? identityOutcome.stripeIdentityId : null,
          successUrl: `${SITE_URL}/mystable?session_id={CHECKOUT_SESSION_ID}`,
          cancelUrl: `${SITE_URL}/marketplace/${horseSlug}`,
        },
        engineBaseUrl,
      )
      setScreen('Return')
      window.location.assign(session.checkoutUrl)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to start Stripe Checkout')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mt-8">
      <button
        type="button"
        onClick={() => {
          setOpen(true)
          setScreen('Terms')
        }}
        className="label-action min-h-11 rounded-pill bg-gold px-8 py-3 text-on-gold shadow-glow-gold transition duration-hover hover:bg-gold-hover"
      >
        Buy Now
      </button>

      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Lease stake in ${horseLegalName}`}
          className="fixed inset-0 z-modal flex items-center justify-center bg-canvas p-4 sm:p-8"
        >
          <div className="max-h-screen w-full max-w-3xl overflow-y-auto rounded-lg border border-border bg-surface p-6 shadow-modal duration-modal-enter sm:p-10">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-4">
              <div className="flex flex-wrap gap-2">
                {BUY_FLOW_SCREENS.map((stepName, index) => (
                  <span
                    key={stepName}
                    className={`label-spec rounded-pill px-3 py-1 ${
                      screen === stepName
                        ? 'bg-raised text-gold border border-gold'
                        : 'text-muted-foreground'
                    }`}
                  >
                    {index + 1}. {stepName}
                  </span>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="label-action min-h-11 rounded-pill border border-border px-4 py-2 text-muted-foreground hover:text-heading"
              >
                Close
              </button>
            </div>

            {errorMessage ? (
              <div
                role="alert"
                className="mt-6 rounded border border-destructive bg-raised p-4 text-body-small text-destructive"
              >
                {errorMessage}
              </div>
            ) : null}

            {screen === 'Terms' ? (
              <div className="mt-6 space-y-6">
                <div>
                  <p className="label-eyebrow text-gold">Screen 1 · Commercial Terms</p>
                  <h2 className="mt-2 text-section-heading leading-heading text-heading">
                    {horseLegalName}
                  </h2>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-4 rounded-md border border-border bg-raised p-6">
                  <div>
                    <p className="label-spec text-muted-foreground">Selected Leasehold Stake</p>
                    <p className="mt-2 font-mono text-section-heading font-medium text-heading">
                      {String(quote.stake)}%
                    </p>
                    <p className="label-spec mt-1 text-muted-foreground">
                      Minimum {String(quote.effectiveMinStake)}% · Step {String(quote.step)}% · Remaining{' '}
                      {String(quote.maxStake)}%
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      disabled={busy || quote.stake <= quote.effectiveMinStake}
                      onClick={() => void handleStakeStep(-1)}
                      className="label-action min-h-11 min-w-11 rounded-pill border border-border bg-surface px-4 py-2 text-heading disabled:text-disabled"
                    >
                      −
                    </button>
                    <button
                      type="button"
                      disabled={busy || quote.stake >= quote.maxStake}
                      onClick={() => void handleStakeStep(1)}
                      className="label-action min-h-11 min-w-11 rounded-pill border border-border bg-surface px-4 py-2 text-heading disabled:text-disabled"
                    >
                      +
                    </button>
                  </div>
                </div>

                <dl className="divide-y divide-border rounded-md border border-border bg-raised px-6">
                  <div className="py-4">
                    <dt className="label-spec text-muted-foreground">Initial payment</dt>
                    <dd className="mt-1 font-mono text-card-heading font-medium text-heading">
                      ${quote.initialPaymentNzd.toFixed(2)} NZD
                    </dd>
                    <p className="label-spec mt-1 text-muted-foreground">
                      {quote.paymentModel === 'upfront'
                        ? '100% of the lease term paid upfront at checkout'
                        : '5 months upfront (3 months deposit reserve + 2 months prepaid)'}
                    </p>
                  </div>

                  <div className="py-4">
                    <dt className="label-spec text-muted-foreground">Monthly thereafter</dt>
                    <dd className="mt-1 font-mono text-card-heading font-medium text-heading">
                      ${quote.monthlyPaymentNzd.toFixed(2)} NZD
                    </dd>
                    <p className="label-spec mt-1 text-muted-foreground">
                      {quote.paymentModel === 'upfront'
                        ? 'Nothing further billed after checkout'
                        : 'Billed monthly on the 1st starting Month 3'}
                    </p>
                  </div>

                  <div className="py-4">
                    <dt className="label-spec text-muted-foreground">Lease period</dt>
                    <dd className="mt-1 font-mono text-body text-heading">
                      {quote.termStart} to {quote.endDate}
                    </dd>
                  </div>

                  <div className="py-4">
                    <dt className="label-spec text-muted-foreground">Distribution share</dt>
                    <dd className="mt-1 font-mono text-body text-heading">
                      {String(split)}% of stakes won, from official NZTR results
                    </dd>
                  </div>
                </dl>

                <div className="rounded-md border border-border bg-raised p-4 text-body-small text-ink">
                  <p>Fixed monthly payment with no surprise capital calls.</p>
                  <p className="mt-2">{BUY_FLOW_REFUND_SENTENCE}</p>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border pt-6">
                  <p className="label-spec text-muted-foreground">
                    Evolution Stables is an NZTR-authorised syndicator.
                  </p>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void handleProceedToDocuments()}
                    className="label-action min-h-11 rounded-pill bg-gold px-6 py-3 text-on-gold transition duration-hover hover:bg-gold-hover"
                  >
                    Review Legal Documents
                  </button>
                </div>
              </div>
            ) : null}

            {screen === 'Documents' && compiled ? (
              <div className="mt-6 space-y-6">
                <div>
                  <p className="label-eyebrow text-gold">Screen 2 · Legal Pack</p>
                  <h2 className="mt-2 text-section-heading leading-heading text-heading">
                    Review &amp; Sign Documents
                  </h2>
                </div>

                <div className="legal-doc rounded-md border border-legal-border bg-legal-surface p-6 text-legal-ink">
                  <div className="border-b border-legal-border pb-3">
                    <p className="label-spec text-legal-ink">1. Product Disclosure Statement</p>
                    <p className="mt-1 font-mono text-micro break-all text-legal-ink">
                      SHA-256: {compiled.pds.hash}
                    </p>
                  </div>
                  <pre className="mt-4 max-h-60 overflow-y-auto font-mono text-micro whitespace-pre-wrap text-legal-ink">
                    {compiled.pds.markdown}
                  </pre>
                  <label className="mt-4 flex min-h-11 cursor-pointer items-center gap-3 border-t border-legal-border pt-4 text-body-small text-legal-ink">
                    <input
                      type="checkbox"
                      checked={pdsAccepted}
                      onChange={(e) => setPdsAccepted(e.target.checked)}
                      className="size-5 accent-legal-checkbox"
                    />
                    <span>I have read and accept the Product Disclosure Statement.</span>
                  </label>
                </div>

                <div className="legal-doc rounded-md border border-legal-border bg-legal-surface p-6 text-legal-ink">
                  <div className="border-b border-legal-border pb-3">
                    <p className="label-spec text-legal-ink">2. Syndicate Agreement</p>
                    <p className="mt-1 font-mono text-micro break-all text-legal-ink">
                      SHA-256: {compiled.sa.hash}
                    </p>
                  </div>
                  <pre className="mt-4 max-h-60 overflow-y-auto font-mono text-micro whitespace-pre-wrap text-legal-ink">
                    {compiled.sa.markdown}
                  </pre>
                  <label className="mt-4 flex min-h-11 cursor-pointer items-center gap-3 border-t border-legal-border pt-4 text-body-small text-legal-ink">
                    <input
                      type="checkbox"
                      checked={saAccepted}
                      onChange={(e) => setSaAccepted(e.target.checked)}
                      className="size-5 accent-legal-checkbox"
                    />
                    <span>I have read and accept the Syndicate Agreement.</span>
                  </label>

                  <div className="mt-4 space-y-2 rounded border border-legal-border bg-legal-surface-alt p-4">
                    <p className="label-spec text-legal-ink">Mandatory Declarations</p>
                    {BUY_FLOW_SA_DECLARATIONS.map((declaration) => (
                      <label
                        key={declaration}
                        className="flex min-h-11 cursor-pointer items-center gap-3 text-body-small text-legal-ink"
                      >
                        <input
                          type="checkbox"
                          checked={declarationsAccepted.includes(declaration)}
                          onChange={() => toggleDeclaration(declaration)}
                          className="size-5 accent-legal-checkbox"
                        />
                        <span>{declaration}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border pt-6">
                  <p className="label-spec text-muted-foreground">
                    Signed documents are hashed and stored for MyStable.
                  </p>
                  <button
                    type="button"
                    disabled={!docsReady || busy}
                    onClick={handleProceedToIdentity}
                    className="label-action min-h-11 rounded-pill bg-gold px-6 py-3 text-on-gold transition duration-hover hover:bg-gold-hover disabled:bg-raised disabled:text-disabled"
                  >
                    Continue to Identity Verification
                  </button>
                </div>
              </div>
            ) : null}

            {screen === 'Identity' ? (
              <div className="mt-6 space-y-6">
                <div>
                  <p className="label-eyebrow text-gold">Screen 3 · Identity Verification</p>
                  <h2 className="mt-2 text-section-heading leading-heading text-heading">
                    Confirm Your Identity
                  </h2>
                </div>

                {accountKycStatus === 'verified' ? (
                  <div className="rounded-md border border-border bg-raised p-6">
                    <p className="text-body text-heading">
                      Your identity is verified on this account. Confirm your full legal name to
                      continue to payment:
                    </p>
                    <label htmlFor="confirmFullName" className="label-spec mt-4 block text-muted-foreground">
                      Full legal name
                    </label>
                    <input
                      id="confirmFullName"
                      type="text"
                      value={confirmedName}
                      onChange={(e) => setConfirmedName(e.target.value)}
                      className="mt-2 min-h-11 w-full rounded border border-border bg-surface px-4 py-3 text-body text-heading"
                    />
                  </div>
                ) : accountKycStatus !== null && accountKycStatus !== 'unverified' ? (
                  <div className="rounded-md border border-destructive bg-raised p-6">
                    <p className="text-body text-heading">
                      Identity verification status is currently {accountKycStatus}. Checkout cannot
                      open until verification succeeds.
                    </p>
                  </div>
                ) : (
                  <div className="rounded-md border border-border bg-raised p-6">
                    <p className="text-body text-heading">
                      Stripe Identity verifies your driver licence or passport before payment.
                    </p>
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border pt-6">
                  <p className="label-spec text-muted-foreground">
                    Encrypted and handled under the NZ Privacy Act 2020.
                  </p>
                  <button
                    type="button"
                    disabled={
                      busy ||
                      (accountKycStatus !== null &&
                        accountKycStatus !== 'verified' &&
                        accountKycStatus !== 'unverified')
                    }
                    onClick={() => void handleIdentityStep()}
                    className="label-action min-h-11 rounded-pill bg-gold px-6 py-3 text-on-gold transition duration-hover hover:bg-gold-hover disabled:bg-raised disabled:text-disabled"
                  >
                    {accountKycStatus === 'verified'
                      ? 'Confirm Name & Continue to Payment'
                      : 'Verify with Stripe Identity'}
                  </button>
                </div>
              </div>
            ) : null}

            {screen === 'Pay' ? (
              <div className="mt-6 space-y-6">
                <div>
                  <p className="label-eyebrow text-gold">Screen 4 · Payment Summary</p>
                  <h2 className="mt-2 text-section-heading leading-heading text-heading">
                    Complete Payment via Stripe Checkout
                  </h2>
                </div>

                <dl className="divide-y divide-border rounded-md border border-border bg-raised px-6">
                  <div className="py-4">
                    <dt className="label-spec text-muted-foreground">Initial payment due today</dt>
                    <dd className="mt-1 font-mono text-card-heading font-medium text-heading">
                      ${quote.initialPaymentNzd.toFixed(2)} NZD
                    </dd>
                  </div>
                  <div className="py-4">
                    <dt className="label-spec text-muted-foreground">Monthly amount</dt>
                    <dd className="mt-1 font-mono text-card-heading font-medium text-heading">
                      ${quote.monthlyPaymentNzd.toFixed(2)} NZD
                    </dd>
                  </div>
                  <div className="py-4">
                    <dt className="label-spec text-muted-foreground">Lease period</dt>
                    <dd className="mt-1 font-mono text-body text-heading">
                      {quote.termStart} to {quote.endDate}
                    </dd>
                  </div>
                  <div className="py-4">
                    <dt className="label-spec text-muted-foreground">Investor split</dt>
                    <dd className="mt-1 font-mono text-body text-heading">
                      {String(split)}% of stakes won
                    </dd>
                  </div>
                </dl>

                <div className="rounded-md border border-border bg-raised p-4 text-body-small text-ink">
                  <p>Your card payment is processed by hosted Stripe Checkout.</p>
                  <p className="mt-2">{BUY_FLOW_REFUND_SENTENCE}</p>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border pt-6">
                  <span className="label-spec text-muted-foreground">
                    Cancelling Checkout returns to {horseLegalName} and writes no sale.
                  </span>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void handleOpenCheckout()}
                    className="label-action min-h-11 rounded-pill bg-gold px-6 py-3 text-on-gold transition duration-hover hover:bg-gold-hover"
                  >
                    Pay with Stripe Checkout
                  </button>
                </div>
              </div>
            ) : null}

            {screen === 'Return' ? (
              <div className="mt-6 space-y-6">
                <div>
                  <p className="label-eyebrow text-gold">Screen 5 · MyStable Return</p>
                  <h2 className="mt-2 text-section-heading leading-heading text-heading">
                    Redirecting to MyStable
                  </h2>
                </div>
                <p className="text-body text-ink">
                  Your purchase remains pending in MyStable until the Stripe webhook writes the
                  sale row with your frozen Product Disclosure Statement and Syndicate Agreement.
                </p>
                <Link
                  href="/mystable"
                  className="label-action min-h-11 inline-flex items-center rounded-pill bg-gold px-6 py-3 text-on-gold"
                >
                  Open MyStable
                </Link>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}
