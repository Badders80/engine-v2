/**
 * The Supabase-backed PurchaseStore. PLAN.md step 8.
 *
 * Uses the service-role client from `dslStoreSupabase.ts`. The website never
 * imports this file and never holds a service-role key.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

import { createSupabaseDslStore, supabaseClientFromEnv } from './dslStoreSupabase'
import {
  KYC_STATUS_VALUES,
  type AccountRow,
  type KycStatus,
  type NewAccount,
  type NewSale,
  type PurchaseStore,
  type SaleRow,
} from './purchaseStore'

type Db = Record<string, unknown>

function record(value: unknown): Db {
  return (value ?? {}) as Db
}

function str(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function strOrNull(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

function num(value: unknown): number {
  return typeof value === 'number' ? value : Number(value ?? 0)
}

function kycStatus(value: unknown): KycStatus {
  const raw = str(value)
  if (!(KYC_STATUS_VALUES as readonly string[]).includes(raw)) {
    throw new Error(`accounts.kyc_status: '${raw}' is not one of the four KYC statuses`)
  }
  return raw as KycStatus
}

function toAccount(value: unknown): AccountRow {
  const row = record(value)
  return {
    id: str(row.id),
    fullName: str(row.full_name),
    email: str(row.email),
    kycStatus: kycStatus(row.kyc_status),
    createdAt: str(row.created_at),
  }
}

function toSale(value: unknown): SaleRow {
  const row = record(value)
  return {
    id: str(row.id),
    dslId: str(row.dsl_id),
    userId: str(row.user_id),
    printedName: str(row.printed_name),
    email: str(row.email),
    stake: num(row.stake),
    amount: num(row.amount),
    stripeSessionId: str(row.stripe_session_id),
    stripeIdentityId: strOrNull(row.stripe_identity_id),
    pdsMarkdown: str(row.pds_markdown),
    saMarkdown: str(row.sa_markdown),
    pdsHash: str(row.pds_hash),
    saHash: str(row.sa_hash),
    createdAt: str(row.created_at),
  }
}

function accountColumns(row: NewAccount) {
  return {
    id: row.id,
    full_name: row.fullName,
    email: row.email,
    ...(row.kycStatus !== undefined ? { kyc_status: row.kycStatus } : {}),
  }
}

function saleColumns(row: NewSale) {
  return {
    dsl_id: row.dslId,
    user_id: row.userId,
    printed_name: row.printedName,
    email: row.email,
    stake: row.stake,
    amount: row.amount,
    stripe_session_id: row.stripeSessionId,
    stripe_identity_id: row.stripeIdentityId,
    pds_markdown: row.pdsMarkdown,
    sa_markdown: row.saMarkdown,
    pds_hash: row.pdsHash,
    sa_hash: row.saHash,
  }
}

export function createSupabasePurchaseStore(
  client: SupabaseClient = supabaseClientFromEnv(),
): PurchaseStore {
  const base = createSupabaseDslStore(client)

  function fail(table: string, message: string): never {
    throw new Error(`${table}: ${message}`)
  }

  return {
    ...base,

    async findAccountById(id) {
      const { data, error } = await client.from('accounts').select('*').eq('id', id).maybeSingle()
      if (error) fail('accounts', error.message)
      return data === null ? null : toAccount(data)
    },

    async insertAccount(row) {
      const { data, error } = await client
        .from('accounts')
        .insert(accountColumns(row))
        .select('*')
        .single()
      if (error) fail('accounts', error.message)
      return toAccount(data)
    },

    async updateAccountKycStatus(id, nextStatus) {
      const { data, error } = await client
        .from('accounts')
        .update({ kyc_status: nextStatus })
        .eq('id', id)
        .select('*')
        .single()
      if (error) fail('accounts', error.message)
      return toAccount(data)
    },

    async findSaleByStripeSessionId(stripeSessionId) {
      const { data, error } = await client
        .from('sales')
        .select('*')
        .eq('stripe_session_id', stripeSessionId)
        .maybeSingle()
      if (error) fail('sales', error.message)
      return data === null ? null : toSale(data)
    },

    async listSalesByUserId(userId) {
      const { data, error } = await client
        .from('sales')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
      if (error) fail('sales', error.message)
      return (data ?? []).map(toSale)
    },

    async insertSale(row) {
      const { data, error } = await client
        .from('sales')
        .insert(saleColumns(row))
        .select('*')
        .single()
      if (error) fail('sales', error.message)
      return toSale(data)
    },
  }
}
