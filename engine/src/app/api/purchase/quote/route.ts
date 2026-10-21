/**
 * Engine quote endpoint for the investor buy workflow. PLAN.md step 8.
 */

import { NextResponse } from 'next/server'

import { computeQuote } from '@/lib/purchase'
import { createSupabasePurchaseStore } from '@/lib/purchaseStoreSupabase'

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const body = (await request.json()) as { dslId?: unknown; stake?: unknown }
    const dslId = typeof body.dslId === 'string' ? body.dslId.trim() : ''
    if (dslId === '') {
      return NextResponse.json({ ok: false, reason: 'dslId is required' }, { status: 400 })
    }

    const stake =
      typeof body.stake === 'number' && Number.isFinite(body.stake) ? body.stake : undefined

    const store = createSupabasePurchaseStore()
    const result = await computeQuote({ dslId, stake }, store)
    if (!result.ok) {
      return NextResponse.json(result, { status: 400 })
    }

    return NextResponse.json(result, { status: 200 })
  } catch (error) {
    return NextResponse.json(
      { ok: false, reason: error instanceof Error ? error.message : 'quote request failed' },
      { status: 500 },
    )
  }
}
