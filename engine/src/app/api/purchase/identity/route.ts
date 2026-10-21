/**
 * Engine identity step endpoint for Screen 3 ("Identity Verification").
 * PLAN.md step 8 (`PLAN.md:234`, `:316`).
 */

import { NextResponse } from 'next/server'

import { beginOrConfirmIdentity, type DocumentAcceptanceInput } from '@/lib/purchase'
import { createSupabasePurchaseStore } from '@/lib/purchaseStoreSupabase'
import { createStripeGatewayFromEnv } from '@/lib/stripe'

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const body = (await request.json()) as {
      accountId?: unknown
      acceptance?: Partial<DocumentAcceptanceInput>
      confirmedFullName?: unknown
      returnUrl?: unknown
    }

    const accountId = typeof body.accountId === 'string' ? body.accountId.trim() : ''
    const returnUrl = typeof body.returnUrl === 'string' ? body.returnUrl.trim() : ''
    const confirmedFullName =
      typeof body.confirmedFullName === 'string' ? body.confirmedFullName : undefined

    const acceptance: DocumentAcceptanceInput = {
      pdsAccepted: body.acceptance?.pdsAccepted === true,
      saAccepted: body.acceptance?.saAccepted === true,
      declarationsAccepted: Array.isArray(body.acceptance?.declarationsAccepted)
        ? body.acceptance.declarationsAccepted.filter((item): item is string => typeof item === 'string')
        : [],
    }

    if (accountId === '' || returnUrl === '') {
      return NextResponse.json(
        { ok: false, reason: 'accountId and returnUrl are required' },
        { status: 400 },
      )
    }

    const store = createSupabasePurchaseStore()
    const stripe = createStripeGatewayFromEnv()
    const result = await beginOrConfirmIdentity(
      { accountId, acceptance, confirmedFullName, returnUrl },
      store,
      stripe,
    )

    if (!result.ok) {
      return NextResponse.json(result, { status: 400 })
    }

    return NextResponse.json(result, { status: 200 })
  } catch (error) {
    return NextResponse.json(
      { ok: false, reason: error instanceof Error ? error.message : 'identity verification failed' },
      { status: 500 },
    )
  }
}
