/**
 * Engine Stripe Checkout session endpoint for Screen 4 ("Pay").
 * PLAN.md step 8 (`PLAN.md:236`, `:316`).
 */

import { NextResponse } from 'next/server'

import { createEmailSenderFromEnv } from '@/lib/email'
import { openCheckoutSession, type DocumentAcceptanceInput } from '@/lib/purchase'
import { createSupabasePurchaseStore } from '@/lib/purchaseStoreSupabase'
import { createStripeGatewayFromEnv } from '@/lib/stripe'

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const body = (await request.json()) as {
      dslId?: unknown
      accountId?: unknown
      stake?: unknown
      acceptance?: Partial<DocumentAcceptanceInput>
      stripeIdentityId?: unknown
      executedDate?: unknown
      successUrl?: unknown
      cancelUrl?: unknown
    }

    const dslId = typeof body.dslId === 'string' ? body.dslId.trim() : ''
    const accountId = typeof body.accountId === 'string' ? body.accountId.trim() : ''
    const stake = typeof body.stake === 'number' ? body.stake : Number(body.stake)
    const successUrl = typeof body.successUrl === 'string' ? body.successUrl.trim() : ''
    const cancelUrl = typeof body.cancelUrl === 'string' ? body.cancelUrl.trim() : ''
    const stripeIdentityId =
      typeof body.stripeIdentityId === 'string' && body.stripeIdentityId.trim() !== ''
        ? body.stripeIdentityId.trim()
        : null
    const executedDate =
      typeof body.executedDate === 'string' && body.executedDate.trim() !== ''
        ? body.executedDate.trim()
        : undefined

    const acceptance: DocumentAcceptanceInput = {
      pdsAccepted: body.acceptance?.pdsAccepted === true,
      saAccepted: body.acceptance?.saAccepted === true,
      declarationsAccepted: Array.isArray(body.acceptance?.declarationsAccepted)
        ? body.acceptance.declarationsAccepted.filter((item): item is string => typeof item === 'string')
        : [],
    }

    if (
      dslId === '' ||
      accountId === '' ||
      !Number.isFinite(stake) ||
      successUrl === '' ||
      cancelUrl === ''
    ) {
      return NextResponse.json(
        { ok: false, reason: 'dslId, accountId, stake, successUrl, and cancelUrl are required' },
        { status: 400 },
      )
    }

    const store = createSupabasePurchaseStore()
    const stripe = createStripeGatewayFromEnv()
    const emailSender = createEmailSenderFromEnv()
    const result = await openCheckoutSession(
      {
        dslId,
        accountId,
        stake,
        acceptance,
        stripeIdentityId,
        executedDate,
        successUrl,
        cancelUrl,
      },
      store,
      stripe,
      emailSender,
    )

    if (!result.ok) {
      return NextResponse.json(result, { status: 400 })
    }

    return NextResponse.json(result, { status: 200 })
  } catch (error) {
    return NextResponse.json(
      { ok: false, reason: error instanceof Error ? error.message : 'checkout creation failed' },
      { status: 500 },
    )
  }
}
