/**
 * Checkout-hold expiry. B6, `DSL-ENGINE-BRIEF-2026-11-07.md` §3.
 *
 * A Checkout attempt holds its stake for five minutes. This route returns
 * every overdue hold to the listing. It is called by
 * `.github/workflows/expire-checkouts.yml`, and lazily by `openCheckoutSession`
 * so a dead cron cannot starve a listing.
 *
 * Guarded by a bearer secret, compared in constant time. With no secret set
 * the route refuses rather than running open.
 */

import { timingSafeEqual } from 'node:crypto'

import { NextResponse } from 'next/server'

import { createSupabasePurchaseStore } from '@/lib/purchaseStoreSupabase'

const ENGINE_EXPIRE_SECRET_ENV = 'ENGINE_EXPIRE_SECRET'

function authorised(header: string | null, secret: string): boolean {
  if (secret.trim() === '') return false
  if (header === null || !header.startsWith('Bearer ')) return false

  const given = Buffer.from(header.slice('Bearer '.length).trim(), 'utf8')
  const expected = Buffer.from(secret, 'utf8')
  if (given.length !== expected.length) return false
  return timingSafeEqual(given, expected)
}

export async function POST(request: Request): Promise<NextResponse> {
  const secret = process.env[ENGINE_EXPIRE_SECRET_ENV] ?? ''
  if (!authorised(request.headers.get('authorization'), secret)) {
    return NextResponse.json({ ok: false, reason: 'unauthorised' }, { status: 401 })
  }

  try {
    const store = createSupabasePurchaseStore()
    const expired = await store.expireCheckoutSessions()
    return NextResponse.json({ ok: true, expired }, { status: 200 })
  } catch (error) {
    return NextResponse.json(
      { ok: false, reason: error instanceof Error ? error.message : 'expiry failed' },
      { status: 500 },
    )
  }
}
