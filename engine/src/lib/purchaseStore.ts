/**
 * The storage seam for the purchase flow. PLAN.md step 8.
 *
 * Extends `DslStore` with `accounts` and `sales` operations so the purchase
 * domain and the Stripe webhook stay pure and testable against the in-memory
 * implementation in CI, where no database and no credentials exist.
 *
 * Row types mirror `supabase/migrations/00006_accounts.sql` and
 * `00007_sales.sql`. Checkout never creates a second profile: accounts exist
 * from signup, and `sales.stripe_session_id` is unique so a retried webhook is
 * idempotent.
 */

import {
  createInMemoryDslStore,
  type DslRow,
  type DslStore,
  type HorseRow,
  type OwnerRow,
  type StoreSnapshot,
  type TrainerRow,
} from './dslStore'

export const KYC_STATUS_VALUES = ['unverified', 'pending', 'verified', 'failed'] as const
export type KycStatus = (typeof KYC_STATUS_VALUES)[number]

export type NewAccount = {
  id: string
  fullName: string
  email: string
  kycStatus?: KycStatus
}

export type AccountRow = {
  id: string
  fullName: string
  email: string
  kycStatus: KycStatus
  createdAt: string
}

export type NewSale = {
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
}

export type SaleRow = NewSale & {
  id: string
  createdAt: string
}

export interface PurchaseStore extends DslStore {
  findAccountById(id: string): Promise<AccountRow | null>
  insertAccount(row: NewAccount): Promise<AccountRow>
  updateAccountKycStatus(id: string, kycStatus: KycStatus): Promise<AccountRow>
  findSaleByStripeSessionId(stripeSessionId: string): Promise<SaleRow | null>
  listSalesByUserId(userId: string): Promise<SaleRow[]>
  insertSale(row: NewSale): Promise<SaleRow>
  deleteSaleById(id: string): Promise<void>
}

export type PurchaseStoreSnapshot = StoreSnapshot & {
  accounts: AccountRow[]
  sales: SaleRow[]
}

export type InMemoryPurchaseStore = PurchaseStore & {
  dump(): PurchaseStoreSnapshot
}

function newId(): string {
  return globalThis.crypto.randomUUID()
}

function nowIso(): string {
  return new Date().toISOString()
}

export function createInMemoryPurchaseStore(): InMemoryPurchaseStore {
  const base = createInMemoryDslStore()
  const accounts: AccountRow[] = []
  const sales: SaleRow[] = []

  return {
    ...base,

    async findAccountById(id) {
      const found = accounts.find((row) => row.id === id)
      return found === undefined ? null : { ...found }
    },

    async insertAccount(row) {
      if (accounts.some((existing) => existing.id === row.id)) {
        throw new Error(`account ${row.id} already exists`)
      }
      if (accounts.some((existing) => existing.email === row.email)) {
        throw new Error(`account email ${row.email} already exists`)
      }
      const created: AccountRow = {
        id: row.id,
        fullName: row.fullName,
        email: row.email,
        kycStatus: row.kycStatus ?? 'unverified',
        createdAt: nowIso(),
      }
      accounts.push(created)
      return { ...created }
    },

    async updateAccountKycStatus(id, kycStatus) {
      const index = accounts.findIndex((row) => row.id === id)
      if (index === -1) {
        throw new Error(`account ${id} does not exist`)
      }
      const updated: AccountRow = { ...accounts[index], kycStatus }
      accounts[index] = updated
      return { ...updated }
    },

    async findSaleByStripeSessionId(stripeSessionId) {
      const found = sales.find((row) => row.stripeSessionId === stripeSessionId)
      return found === undefined ? null : { ...found }
    },

    async listSalesByUserId(userId) {
      return sales.filter((row) => row.userId === userId).map((row) => ({ ...row }))
    },

    async insertSale(row) {
      if (sales.some((existing) => existing.stripeSessionId === row.stripeSessionId)) {
        throw new Error(`sale with stripe_session_id ${row.stripeSessionId} already exists`)
      }
      const created: SaleRow = {
        ...row,
        id: newId(),
        createdAt: nowIso(),
      }
      sales.push(created)
      return { ...created }
    },

    async deleteSaleById(id) {
      const index = sales.findIndex((row) => row.id === id)
      if (index !== -1) {
        sales.splice(index, 1)
      }
    },

    dump(): PurchaseStoreSnapshot {
      const dslDump = base.dump()
      return {
        horses: dslDump.horses as HorseRow[],
        trainers: dslDump.trainers as TrainerRow[],
        owners: dslDump.owners as OwnerRow[],
        dsls: dslDump.dsls as DslRow[],
        accounts: accounts.map((row) => ({ ...row })),
        sales: sales.map((row) => ({ ...row })),
      }
    },
  }
}
