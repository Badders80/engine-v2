/**
 * MyStable reader (`website/src/lib/mystable.ts`). PLAN.md step 8 (`PLAN.md:238`, `:316`).
 *
 * This is the single file in `website/src/` that queries `accounts` and `sales`
 * under the signed-in investor's JWT (migration `00009_website_read_policies.sql:70-78`).
 * Every other `.from(...)` in `website/src/` targets `dsls`.
 *
 * A checkout return (`?session_id=cs_...`) whose `stripe_session_id` has not
 * yet been written by the webhook is reported as `pending` and never described
 * as owned (`PLAN.md:222`, `:238`).
 */

import type { SupabaseClient } from '@supabase/supabase-js'

import { createUserClient } from './auth'

export type KycStatus = string

export type AccountWireRow = {
  id: string
  full_name: string
  email: string
  kyc_status: KycStatus
  created_at: string
}

export type AccountProfile = {
  id: string
  fullName: string
  email: string
  kycStatus: KycStatus
  createdAt: string
}

export type SaleWireRow = {
  id: string
  dsl_id: string
  user_id: string
  printed_name: string
  email: string
  stake: number
  amount: number
  stripe_session_id: string
  stripe_identity_id: string | null
  pds_markdown: string
  sa_markdown: string
  pds_hash: string
  sa_hash: string
  created_at: string
}

export type SaleRecord = {
  id: string
  dslId: string
  userId: string
  printedName: string
  email: string
  stake: number
  amount: number
  stripeSessionId: string
  stripeIdentityId: string | null
  pdsMarkdown: string
  saMarkdown: string
  pdsHash: string
  saHash: string
  createdAt: string
}

export type MyStableView = {
  account: AccountProfile | null
  sales: SaleRecord[]
  pendingSessionId: string | null
  pendingNotice: string | null
}

export const PENDING_CHECKOUT_NOTICE =
  'Payment confirmation is pending from Stripe. This stake is pending settlement and is not recorded until the sale row is written.'

const ACCOUNT_SELECT = 'id, full_name, email, kyc_status, created_at'

const SALE_SELECT = [
  'id',
  'dsl_id',
  'user_id',
  'printed_name',
  'email',
  'stake',
  'amount',
  'stripe_session_id',
  'stripe_identity_id',
  'pds_markdown',
  'sa_markdown',
  'pds_hash',
  'sa_hash',
  'created_at',
].join(', ')

export function toAccountProfile(row: AccountWireRow): AccountProfile {
  return {
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    kycStatus: row.kyc_status,
    createdAt: row.created_at,
  }
}

export function toSaleRecord(row: SaleWireRow): SaleRecord {
  return {
    id: row.id,
    dslId: row.dsl_id,
    userId: row.user_id,
    printedName: row.printed_name,
    email: row.email,
    stake: Number(row.stake),
    amount: Number(row.amount),
    stripeSessionId: row.stripe_session_id,
    stripeIdentityId: row.stripe_identity_id,
    pdsMarkdown: row.pds_markdown,
    saMarkdown: row.sa_markdown,
    pdsHash: row.pds_hash,
    saHash: row.sa_hash,
    createdAt: row.created_at,
  }
}

/**
 * Pure projection of the MyStable state.
 * When `checkoutSessionId` is present on return from Stripe Checkout and no
 * `sales` row carries that `stripeSessionId` yet, `pendingSessionId` is set
 * and `pendingNotice` states the purchase is pending — never owned.
 */
export function resolveMyStableView(input: {
  account: AccountProfile | null
  sales: SaleRecord[]
  checkoutSessionId?: string | null
}): MyStableView {
  const sessionId =
    typeof input.checkoutSessionId === 'string' && input.checkoutSessionId.trim() !== ''
      ? input.checkoutSessionId.trim()
      : null

  const matchedSale =
    sessionId !== null
      ? input.sales.some((sale) => sale.stripeSessionId === sessionId)
      : false

  const isPending = sessionId !== null && !matchedSale

  return {
    account: input.account,
    sales: input.sales,
    pendingSessionId: isPending ? sessionId : null,
    pendingNotice: isPending ? PENDING_CHECKOUT_NOTICE : null,
  }
}

export async function readMyStable(options: {
  accessToken?: string | null
  checkoutSessionId?: string | null
  client?: SupabaseClient
}): Promise<MyStableView> {
  if (!options.accessToken && !options.client) {
    return resolveMyStableView({
      account: null,
      sales: [],
      checkoutSessionId: options.checkoutSessionId,
    })
  }

  const client = options.client ?? createUserClient(options.accessToken)

  const { data: accountData, error: accountError } = await client
    .from('accounts')
    .select(ACCOUNT_SELECT)
    .maybeSingle()

  if (accountError) {
    throw new Error(`readMyStable accounts failed: ${accountError.message}`)
  }

  const { data: salesData, error: salesError } = await client
    .from('sales')
    .select(SALE_SELECT)

  if (salesError) {
    throw new Error(`readMyStable sales failed: ${salesError.message}`)
  }

  const account = accountData
    ? toAccountProfile(accountData as unknown as AccountWireRow)
    : null
  const sales = ((salesData ?? []) as unknown as SaleWireRow[]).map(toSaleRecord)

  return resolveMyStableView({
    account,
    sales,
    checkoutSessionId: options.checkoutSessionId,
  })
}
