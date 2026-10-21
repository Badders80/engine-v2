/**
 * HTTP client from the public website to the engine's purchase API
 * (`website/src/lib/engineClient.ts`). PLAN.md step 8 (`PLAN.md:23`, `:224-239`, `:290`).
 *
 * The website never imports from `engine/`, never holds a payment credential,
 * never computes retail or checkout prices, and never compiles legal templates.
 * Every quote figure, compiled document, identity session, and checkout URL
 * comes from the engine over HTTP.
 */

export const WEBSITE_ENGINE_URL_ENV = 'WEBSITE_ENGINE_URL'
export const WEBSITE_BUY_ENABLED_ENV = 'WEBSITE_BUY_ENABLED'

/**
 * Verbatim refund sentence (`OUTCOME.md:56`). Contains zero day-count expressions.
 */
export const BUY_FLOW_REFUND_SENTENCE =
  'If the horse is retired or the lease ends early, the leaseholder receives a pro-rata refund of the unused lease fee for the full months remaining.'

/**
 * The four mandatory SA declarations from `PLAN.md:232`, verbatim.
 */
export const BUY_FLOW_SA_DECLARATIONS = [
  'not disqualified or suspended under the NZTR Rules of Racing',
  'acquiring the stake as the true beneficial owner',
  'bound by the NZTR Rules of Racing and the Welfare Guidelines',
  'Evolution Stables Limited is the syndicate manager',
] as const

export type EnginePurchaseQuote = {
  dslId: string
  horseLegalName: string
  paymentModel: 'subscription_float' | 'upfront'
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

export type EngineCompiledDocuments = {
  quote: EnginePurchaseQuote
  pds: { markdown: string; hash: string }
  sa: { markdown: string; hash: string }
  declarations: readonly string[]
  account: { id: string; fullName: string; email: string; kycStatus: string }
}

export type EngineIdentityOutcome =
  | { status: 'verified'; fullName: string; stripeIdentityId: string | null }
  | { status: 'verification_required'; verificationSessionId: string; verificationUrl: string }

export type EngineCheckoutSession = {
  checkoutSessionId: string
  checkoutUrl: string
  quote: EnginePurchaseQuote
}

/**
 * Determines whether the Buy Now control may render on a listing (`PLAN.md:226`, `:318`).
 * Only `available` listings may ever show Buy Now, and only when `WEBSITE_BUY_ENABLED === 'true'`.
 * `coming_soon`, `fully_allocated`, and `completed` listings never render Buy Now under any flag.
 */
export function canRenderBuyNow(
  status: string,
  buyEnabledEnv: string | undefined = process.env[WEBSITE_BUY_ENABLED_ENV],
): boolean {
  if (status !== 'available') {
    return false
  }
  return buyEnabledEnv === 'true'
}

/**
 * Enforces that a listing's `investorSplit` is present before rendering buy copy (`PLAN.md:219`, `:230`).
 * Never falls back to any default percentage.
 */
export function requireInvestorSplit(investorSplit: number | null): number {
  if (investorSplit === null || !Number.isFinite(investorSplit)) {
    throw new Error('Listing is missing required investor_split')
  }
  return investorSplit
}

/**
 * Verifies that the buyer has ticked PDS acceptance, SA acceptance, and all four
 * mandatory SA declarations before advancing past Screen 2 (`PLAN.md:232`).
 */
export function allDocumentsAccepted(input: {
  pdsAccepted: boolean
  saAccepted: boolean
  declarationsAccepted: readonly string[]
}): boolean {
  if (!input.pdsAccepted || !input.saAccepted) return false
  const accepted = new Set(input.declarationsAccepted)
  return BUY_FLOW_SA_DECLARATIONS.every((declaration) => accepted.has(declaration))
}

function resolveEngineBaseUrl(baseUrl?: string): string {
  const raw = baseUrl ?? process.env[WEBSITE_ENGINE_URL_ENV] ?? ''
  const trimmed = raw.trim().replace(/\/+$/, '')
  if (!trimmed) {
    throw new Error(`${WEBSITE_ENGINE_URL_ENV} must be configured to call the engine purchase API`)
  }
  return trimmed
}

async function postEngineJson<T>(
  path: string,
  payload: Record<string, unknown>,
  baseUrl?: string,
): Promise<T> {
  const origin = resolveEngineBaseUrl(baseUrl)
  const response = await fetch(`${origin}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    cache: 'no-store',
  })

  const data = (await response.json()) as { ok?: boolean; error?: string } & T
  if (!response.ok || data.ok === false) {
    throw new Error(data.error ?? `Engine request ${path} failed with HTTP ${response.status}`)
  }
  return data
}

export async function fetchEngineQuote(
  input: { dslId: string; stake?: number },
  baseUrl?: string,
): Promise<EnginePurchaseQuote> {
  const res = await postEngineJson<{ quote: EnginePurchaseQuote }>(
    '/api/purchase/quote',
    input,
    baseUrl,
  )
  return res.quote
}

export async function fetchEngineDocuments(
  input: { dslId: string; accountId: string; stake: number; executedDate?: string },
  baseUrl?: string,
): Promise<EngineCompiledDocuments> {
  return postEngineJson<EngineCompiledDocuments>('/api/purchase/documents', input, baseUrl)
}

export async function postEngineIdentity(
  input: {
    accountId: string
    pdsAccepted: boolean
    saAccepted: boolean
    declarationsAccepted: readonly string[]
    confirmedFullName?: string
    returnUrl: string
  },
  baseUrl?: string,
): Promise<EngineIdentityOutcome> {
  const res = await postEngineJson<{ identity: EngineIdentityOutcome }>(
    '/api/purchase/identity',
    input,
    baseUrl,
  )
  return res.identity
}

export async function postEngineCheckout(
  input: {
    dslId: string
    accountId: string
    stake: number
    pdsAccepted: boolean
    saAccepted: boolean
    declarationsAccepted: readonly string[]
    stripeIdentityId?: string | null
    successUrl: string
    cancelUrl: string
  },
  baseUrl?: string,
): Promise<EngineCheckoutSession> {
  return postEngineJson<EngineCheckoutSession>('/api/purchase/checkout', input, baseUrl)
}
