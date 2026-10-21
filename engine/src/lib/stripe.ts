/**
 * Zero-SDK Stripe gateway and HMAC-SHA256 webhook signature verifier.
 * PLAN.md step 8.
 *
 * All Stripe credentials (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`) live on
 * the engine only. The website never holds a Stripe secret.
 */

import { createHmac, timingSafeEqual } from 'node:crypto'

export const STRIPE_SECRET_KEY_ENV = 'STRIPE_SECRET_KEY'
export const STRIPE_WEBHOOK_SECRET_ENV = 'STRIPE_WEBHOOK_SECRET'
export const STRIPE_API_BASE = 'https://api.stripe.com/v1'
export const STRIPE_SIGNATURE_TOLERANCE_SECONDS = 300

export type StripeIdentitySessionInput = {
  accountId: string
  email: string
  returnUrl: string
}

export type StripeIdentitySession = {
  id: string
  url: string
  status: 'requires_input' | 'processing' | 'verified' | 'canceled'
}

export type StripeCheckoutSessionInput = {
  dslId: string
  accountId: string
  horseLegalName: string
  stake: number
  amountNzd: number
  executedDate: string
  stripeIdentityId: string | null
  successUrl: string
  cancelUrl: string
}

export type StripeCheckoutSession = {
  id: string
  url: string
}

export interface StripeGateway {
  createIdentitySession(input: StripeIdentitySessionInput): Promise<StripeIdentitySession>
  retrieveIdentitySession(sessionId: string): Promise<StripeIdentitySession>
  createCheckoutSession(input: StripeCheckoutSessionInput): Promise<StripeCheckoutSession>
}

export type StripeWebhookEvent = {
  id: string
  type: string
  data: {
    object: Record<string, unknown>
  }
}

/**
 * Verifies a `Stripe-Signature` header (`t=<unix>,v1=<hex>`) against the raw
 * request payload using HMAC-SHA256 and a 300-second replay tolerance.
 */
export function verifyStripeSignature(
  rawBody: string,
  signatureHeader: string | null,
  webhookSecret: string,
  nowUnixSeconds: number = Math.floor(Date.now() / 1000),
): StripeWebhookEvent {
  if (!webhookSecret || webhookSecret.trim() === '') {
    throw new Error(`${STRIPE_WEBHOOK_SECRET_ENV} must be configured to verify webhooks`)
  }
  if (!signatureHeader || signatureHeader.trim() === '') {
    throw new Error('missing Stripe-Signature header')
  }

  let timestampRaw: string | null = null
  const signatures: string[] = []

  for (const part of signatureHeader.split(',')) {
    const [key, value] = part.trim().split('=', 2)
    if (key === 't' && value) {
      timestampRaw = value
    } else if (key === 'v1' && value) {
      signatures.push(value)
    }
  }

  if (timestampRaw === null || signatures.length === 0) {
    throw new Error('malformed Stripe-Signature header')
  }

  const timestamp = Number(timestampRaw)
  if (!Number.isFinite(timestamp) || timestamp <= 0) {
    throw new Error('invalid Stripe-Signature timestamp')
  }

  if (Math.abs(nowUnixSeconds - timestamp) > STRIPE_SIGNATURE_TOLERANCE_SECONDS) {
    throw new Error('Stripe-Signature timestamp is outside tolerance')
  }

  const signedPayload = `${timestampRaw}.${rawBody}`
  const expectedHex = createHmac('sha256', webhookSecret).update(signedPayload, 'utf8').digest('hex')
  const expectedBuf = Buffer.from(expectedHex, 'hex')

  const matched = signatures.some((candidate) => {
    if (!/^[0-9a-fA-F]+$/.test(candidate) || candidate.length !== expectedHex.length) {
      return false
    }
    const candidateBuf = Buffer.from(candidate, 'hex')
    return timingSafeEqual(expectedBuf, candidateBuf)
  })

  if (!matched) {
    throw new Error('Stripe-Signature HMAC verification failed')
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(rawBody)
  } catch {
    throw new Error('webhook payload is not valid JSON')
  }

  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    typeof (parsed as Record<string, unknown>).type !== 'string' ||
    typeof (parsed as Record<string, unknown>).data !== 'object' ||
    (parsed as Record<string, unknown>).data === null
  ) {
    throw new Error('webhook payload does not match a Stripe Event shape')
  }

  return parsed as StripeWebhookEvent
}

function encodeForm(pairs: [string, string][]): string {
  const params = new URLSearchParams()
  for (const [k, v] of pairs) {
    params.append(k, v)
  }
  return params.toString()
}

export function createStripeGatewayFromEnv(
  env: Record<string, string | undefined> = process.env,
): StripeGateway {
  const secretKey = env[STRIPE_SECRET_KEY_ENV]
  if (!secretKey || secretKey.trim() === '') {
    throw new Error(`${STRIPE_SECRET_KEY_ENV} must be set on the engine`)
  }

  async function postForm(path: string, pairs: [string, string][]): Promise<Record<string, unknown>> {
    const response = await fetch(`${STRIPE_API_BASE}${path}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: encodeForm(pairs),
    })

    const body = (await response.json()) as Record<string, unknown>
    if (!response.ok) {
      const errObj = (body.error ?? {}) as Record<string, unknown>
      const message = typeof errObj.message === 'string' ? errObj.message : `HTTP ${response.status}`
      throw new Error(`Stripe API ${path} failed: ${message}`)
    }
    return body
  }

  async function getResource(path: string): Promise<Record<string, unknown>> {
    const response = await fetch(`${STRIPE_API_BASE}${path}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${secretKey}`,
      },
    })

    const body = (await response.json()) as Record<string, unknown>
    if (!response.ok) {
      const errObj = (body.error ?? {}) as Record<string, unknown>
      const message = typeof errObj.message === 'string' ? errObj.message : `HTTP ${response.status}`
      throw new Error(`Stripe API ${path} failed: ${message}`)
    }
    return body
  }

  return {
    async createIdentitySession(input) {
      const data = await postForm('/identity/verification_sessions', [
        ['type', 'document'],
        ['return_url', input.returnUrl],
        ['metadata[account_id]', input.accountId],
        ['metadata[email]', input.email],
        ['options[document][allowed_types][0]', 'driving_license'],
        ['options[document][allowed_types][1]', 'passport'],
      ])
      return {
        id: String(data.id ?? ''),
        url: String(data.url ?? ''),
        status: (data.status as StripeIdentitySession['status']) ?? 'requires_input',
      }
    },

    async retrieveIdentitySession(sessionId) {
      const data = await getResource(`/identity/verification_sessions/${encodeURIComponent(sessionId)}`)
      return {
        id: String(data.id ?? ''),
        url: String(data.url ?? ''),
        status: (data.status as StripeIdentitySession['status']) ?? 'requires_input',
      }
    },

    async createCheckoutSession(input) {
      const amountCents = Math.round(input.amountNzd * 100)
      const pairs: [string, string][] = [
        ['mode', 'payment'],
        ['success_url', input.successUrl],
        ['cancel_url', input.cancelUrl],
        ['line_items[0][quantity]', '1'],
        ['line_items[0][price_data][currency]', 'nzd'],
        ['line_items[0][price_data][unit_amount]', String(amountCents)],
        [
          'line_items[0][price_data][product_data][name]',
          `${input.horseLegalName} — ${input.stake}% Leasehold Stake`,
        ],
        ['metadata[dsl_id]', input.dslId],
        ['metadata[account_id]', input.accountId],
        ['metadata[stake]', String(input.stake)],
        ['metadata[amount_nzd]', String(input.amountNzd)],
        ['metadata[executed_date]', input.executedDate],
      ]
      if (input.stripeIdentityId !== null) {
        pairs.push(['metadata[stripe_identity_id]', input.stripeIdentityId])
      }

      const data = await postForm('/checkout/sessions', pairs)
      return {
        id: String(data.id ?? ''),
        url: String(data.url ?? ''),
      }
    },
  }
}
