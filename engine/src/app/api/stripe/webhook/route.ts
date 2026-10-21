/**
 * Engine Stripe webhook endpoint. PLAN.md step 8 (`PLAN.md:232-238`, `:316`).
 *
 * Verifies `Stripe-Signature` with HMAC-SHA256 against the raw body, then
 * delegates to `recordWebhookEvent` to update KYC status or write the frozen
 * sale row (`sales`) and decrement `dsls.stake_remaining`.
 */

import { NextResponse } from 'next/server'

import { createEmailSenderFromEnv } from '@/lib/email'
import { recordWebhookEvent } from '@/lib/purchase'
import { createSupabasePurchaseStore } from '@/lib/purchaseStoreSupabase'
import { STRIPE_WEBHOOK_SECRET_ENV, verifyStripeSignature } from '@/lib/stripe'

export async function POST(request: Request): Promise<NextResponse> {
  const rawBody = await request.text()
  const signature = request.headers.get('stripe-signature')
  const secret = process.env[STRIPE_WEBHOOK_SECRET_ENV] ?? ''

  let event
  try {
    event = verifyStripeSignature(rawBody, signature, secret)
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        reason: error instanceof Error ? error.message : 'webhook signature verification failed',
      },
      { status: 400 },
    )
  }

  try {
    const store = createSupabasePurchaseStore()
    const emailSender = createEmailSenderFromEnv()
    const result = await recordWebhookEvent(event, store, undefined, emailSender)
    if (!result.ok) {
      return NextResponse.json(result, { status: 400 })
    }
    return NextResponse.json(result, { status: 200 })
  } catch (error) {
    return NextResponse.json(
      { ok: false, reason: error instanceof Error ? error.message : 'webhook execution failed' },
      { status: 500 },
    )
  }
}
