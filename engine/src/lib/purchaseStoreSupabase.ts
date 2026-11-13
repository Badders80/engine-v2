/**
 * The Supabase-backed PurchaseStore. PLAN.md step 8.
 *
 * Uses the service-role client from `dslStoreSupabase.ts`. The website never
 * imports this file and never holds a service-role key.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

import { createSupabaseDslStore, supabaseClientFromEnv } from './dslStoreSupabase'
import {
  CHECKOUT_STATUS_VALUES,
  KYC_STATUS_VALUES,
  type AccountRow,
  type CheckoutSessionRow,
  type CheckoutStatus,
  type KycStatus,
  type NewAccount,
  type PurchaseStore,
  type RecordSaleResult,
  type SaleRecordOutcome,
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

function strArray(value: unknown): string[] {
  if (!Array.isArray(value) || !value.every((item) => typeof item === 'string')) {
    throw new Error('checkout_sessions.declarations_accepted is not a string array')
  }
  return value
}

function num(value: unknown): number {
  return typeof value === 'number' ? value : Number(value ?? 0)
}

function numOrNull(value: unknown): number | null {
  if (value === null || value === undefined) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function paymentModelAtSale(value: unknown): SaleRow['paymentModelAtSale'] {
  return value === 'upfront' || value === 'subscription_float' ? value : null
}

function closeStyleAtSale(value: unknown): SaleRow['closeStyle'] {
  return value === 'fourteen_day' || value === 'three_x_remaining' ? value : null
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
    checkoutSessionId: strOrNull(row.checkout_session_id),
    stripeAmountTotal: row.stripe_amount_total == null ? null : num(row.stripe_amount_total),
    stripeCurrency: strOrNull(row.stripe_currency),
    pdsMarkdown: str(row.pds_markdown),
    saMarkdown: str(row.sa_markdown),
    pdsHash: str(row.pds_hash),
    saHash: str(row.sa_hash),
    wholesaleMonthlyPerPercent: numOrNull(row.wholesale_monthly_per_percent),
    retailMonthlyPerPercent: numOrNull(row.retail_monthly_per_percent),
    investorSplit: numOrNull(row.investor_split),
    listedStake: numOrNull(row.listed_stake),
    minStake: numOrNull(row.min_stake),
    step: numOrNull(row.step),
    endDate: strOrNull(row.end_date),
    paymentModelAtSale: paymentModelAtSale(row.payment_model_at_sale),
    closeStyle: closeStyleAtSale(row.close_style),
    distributionSchedule: strOrNull(row.distribution_schedule),
    termStart: strOrNull(row.term_start),
    termEnd: strOrNull(row.term_end),
    termMonths: numOrNull(row.term_months),
    trainerId: strOrNull(row.trainer_id),
    ownerId: strOrNull(row.owner_id),
    createdAt: str(row.created_at),
  }
}

function checkoutStatus(value: unknown): CheckoutStatus {
  const raw = str(value)
  if (!(CHECKOUT_STATUS_VALUES as readonly string[]).includes(raw)) {
    throw new Error(`checkout_sessions.status: '${raw}' is not one of the five statuses`)
  }
  return raw as CheckoutStatus
}

function toCheckoutSession(value: unknown): CheckoutSessionRow {
  const row = record(value)
  const acceptanceRecordedAt = strOrNull(row.acceptance_recorded_at)
  return {
    id: str(row.id),
    stripeSessionId: strOrNull(row.stripe_session_id),
    dslId: str(row.dsl_id),
    accountId: str(row.account_id),
    printedName: str(row.printed_name),
    email: str(row.email),
    horseLegalName: str(row.horse_legal_name),
    stake: num(row.stake),
    amountNzd: num(row.amount_nzd),
    executedDate: str(row.executed_date),
    pdsMarkdown: str(row.pds_markdown),
    saMarkdown: str(row.sa_markdown),
    pdsHash: str(row.pds_hash),
    saHash: str(row.sa_hash),
    status: checkoutStatus(row.status),
    expiresAt: str(row.expires_at),
    createdAt: str(row.created_at),
    closedAt: strOrNull(row.closed_at),
    stakeReturnedAt: strOrNull(row.stake_returned_at),
    resolvedAt: strOrNull(row.resolved_at),
    resolvedBy: strOrNull(row.resolved_by),
    resolution: strOrNull(row.resolution),
    acceptance:
      acceptanceRecordedAt === null
        ? null
        : {
            pdsAcceptedAt: str(row.pds_accepted_at),
            saAcceptedAt: str(row.sa_accepted_at),
            declarationsAccepted: strArray(row.declarations_accepted),
            typedSignature: str(row.typed_signature),
            acceptanceRecordedAt,
          },
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

    async listSales() {
      const { data, error } = await client
        .from('sales')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) fail('sales', error.message)
      return (data ?? []).map(toSale)
    },

    recordSaleAtomically(input) {
      return recordSaleAtomically(client, input)
    },

    async closeDsl(dslId, reason, closedBy) {
      const { error } = await client.rpc('close_dsl', {
        p_dsl_id: dslId,
        p_reason: reason,
        p_closed_by: closedBy,
      })
      if (error) fail('close_dsl', error.message)
      const dsl = await base.findDslById(dslId)
      if (dsl === null) fail('dsls', `dsl ${dslId} vanished after close`)
      return dsl
    },

    async listCheckoutSessions() {
      const { data, error } = await client
        .from('checkout_sessions')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) fail('checkout_sessions', error.message)
      return (data ?? []).map(toCheckoutSession)
    },

    async reserveCheckoutSession(row) {
      const { data, error } = await client.rpc('reserve_checkout_stake', {
        p_dsl_id: row.dslId,
        p_account_id: row.accountId,
        p_printed_name: row.printedName,
        p_email: row.email,
        p_horse_legal_name: row.horseLegalName,
        p_stake: row.stake,
        p_amount_nzd: row.amountNzd,
        p_executed_date: row.executedDate,
        p_pds_markdown: row.pdsMarkdown,
        p_sa_markdown: row.saMarkdown,
        p_pds_hash: row.pdsHash,
        p_sa_hash: row.saHash,
        p_ttl_seconds: Math.max(
          1,
          Math.round((Date.parse(row.expiresAt) - Date.now()) / 1000),
        ),
      })
      if (error) fail('reserve_checkout_stake', error.message)
      return toCheckoutSession(data)
    },

    async recordCheckoutAcceptance(checkoutId, acceptance) {
      const { data, error } = await client.rpc('record_checkout_acceptance', {
        p_checkout_id: checkoutId,
        p_declarations: [...acceptance.declarationsAccepted],
        p_typed_signature: acceptance.typedSignature,
      })
      if (error) fail('record_checkout_acceptance', error.message)
      return toCheckoutSession(data)
    },

    async attachStripeSession(checkoutId, stripeSessionId) {
      const { data, error } = await client
        .from('checkout_sessions')
        .update({ stripe_session_id: stripeSessionId })
        .eq('id', checkoutId)
        .select('*')
        .single()
      if (error) fail('checkout_sessions', error.message)
      return toCheckoutSession(data)
    },

    async findCheckoutSessionById(id) {
      const { data, error } = await client
        .from('checkout_sessions')
        .select('*')
        .eq('id', id)
        .maybeSingle()
      if (error) fail('checkout_sessions', error.message)
      return data === null ? null : toCheckoutSession(data)
    },

    async findCheckoutSessionByStripeSessionId(stripeSessionId) {
      const { data, error } = await client
        .from('checkout_sessions')
        .select('*')
        .eq('stripe_session_id', stripeSessionId)
        .maybeSingle()
      if (error) fail('checkout_sessions', error.message)
      return data === null ? null : toCheckoutSession(data)
    },

    async releaseCheckoutSession(id) {
      const { data, error } = await client.rpc('release_checkout_stake', {
        p_checkout_id: id,
        p_terminal: 'released',
      })
      if (error) fail('release_checkout_stake', error.message)
      if (!data) return null
      const { data: row, error: readError } = await client
        .from('checkout_sessions')
        .select('*')
        .eq('id', id)
        .maybeSingle()
      if (readError) fail('checkout_sessions', readError.message)
      return row === null ? null : toCheckoutSession(row)
    },

    async resolvePaidUnfulfilled(id, resolvedBy, resolution) {
      const { data, error } = await client.rpc('resolve_paid_unfulfilled', {
        p_checkout_id: id,
        p_resolved_by: resolvedBy,
        p_resolution: resolution,
      })
      if (error) fail('resolve_paid_unfulfilled', error.message)
      if (data === null) fail('resolve_paid_unfulfilled', `checkout ${id} vanished`)
      return toCheckoutSession(data)
    },

    async expireCheckoutSessions() {
      const { data, error } = await client.rpc('expire_checkout_stakes')
      if (error) fail('expire_checkout_stakes', error.message)
      return Number(data ?? 0)
    },
  }
}

/**
 * `record_sale_atomically` returns a one-row table. PostgREST hands that back
 * as an array of rows whose `sale` column is the composite, in snake_case.
 */
async function recordSaleAtomically(
  client: SupabaseClient,
  input: {
    checkoutId: string | null
    stripeSessionId: string
    stripeAmountTotalCents: number
    stripeCurrency: string
    stripeIdentityId: string | null
  },
): Promise<RecordSaleResult> {
  const { data, error } = await client.rpc('record_sale_atomically', {
    p_checkout_id: input.checkoutId,
    p_stripe_session_id: input.stripeSessionId,
    p_stripe_amount_total_cents: input.stripeAmountTotalCents,
    p_stripe_currency: input.stripeCurrency,
    p_stripe_identity_id: input.stripeIdentityId,
  })
  if (error) throw new Error(`record_sale_atomically: ${error.message}`)

  const first = Array.isArray(data) ? data[0] : data
  const row = record(first)
  const outcome = str(row.outcome)
  const outcomes: readonly SaleRecordOutcome[] = [
    'sale_written',
    'idempotent_replay',
    'paid_unfulfilled',
  ]
  if (!(outcomes as readonly string[]).includes(outcome)) {
    throw new Error(
      `record_sale_atomically: '${outcome}' is not one of the three outcomes`,
    )
  }

  return {
    outcome: outcome as SaleRecordOutcome,
    sale: row.sale == null ? null : toSale(row.sale),
    reason: strOrNull(row.reason),
  }
}
