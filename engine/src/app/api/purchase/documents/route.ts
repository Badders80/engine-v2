/**
 * Engine document compilation endpoint for Screen 2 ("Review & Sign Documents").
 * PLAN.md step 8 (`PLAN.md:232`, `:316`).
 */

import { NextResponse } from 'next/server'

import { compileBuyerDocuments } from '@/lib/purchase'
import { createSupabasePurchaseStore } from '@/lib/purchaseStoreSupabase'

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const body = (await request.json()) as {
      dslId?: unknown
      accountId?: unknown
      stake?: unknown
      executedDate?: unknown
    }
    const dslId = typeof body.dslId === 'string' ? body.dslId.trim() : ''
    const accountId = typeof body.accountId === 'string' ? body.accountId.trim() : ''
    const stake = typeof body.stake === 'number' ? body.stake : Number(body.stake)
    const executedDate =
      typeof body.executedDate === 'string' && body.executedDate.trim() !== ''
        ? body.executedDate.trim()
        : undefined

    if (dslId === '' || accountId === '' || !Number.isFinite(stake)) {
      return NextResponse.json(
        { ok: false, reason: 'dslId, accountId, and stake are required' },
        { status: 400 },
      )
    }

    const store = createSupabasePurchaseStore()
    const result = await compileBuyerDocuments({ dslId, accountId, stake, executedDate }, store)
    if (!result.ok) {
      return NextResponse.json(result, { status: 400 })
    }

    return NextResponse.json(result, { status: 200 })
  } catch (error) {
    return NextResponse.json(
      { ok: false, reason: error instanceof Error ? error.message : 'document compilation failed' },
      { status: 500 },
    )
  }
}
