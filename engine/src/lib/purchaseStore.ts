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

export const CHECKOUT_STATUS_VALUES = [
  'open',
  'completed',
  'expired',
  'released',
  'paid_unfulfilled',
] as const

export type CheckoutStatus = (typeof CHECKOUT_STATUS_VALUES)[number]

/**
 * One Checkout attempt, frozen before Stripe is called (migration `00016`).
 * The webhook reads this row instead of re-deriving the quote from live DSL
 * state, so the document the buyer received is the document the sale records.
 */
export type NewCheckoutSession = {
  dslId: string
  accountId: string
  printedName: string
  email: string
  horseLegalName: string
  stake: number
  amountNzd: number
  executedDate: string
  pdsMarkdown: string
  saMarkdown: string
  pdsHash: string
  saHash: string
  expiresAt: string
}

export type CheckoutSessionRow = NewCheckoutSession & {
  id: string
  stripeSessionId: string | null
  status: CheckoutStatus
  createdAt: string
  closedAt: string | null
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
  checkoutSessionId: string | null
  stripeAmountTotal: number | null
  stripeCurrency: string | null
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
  /** Every sale, newest first. The operator's read-only Sales section. */
  listSales(): Promise<SaleRow[]>
  insertSale(row: NewSale): Promise<SaleRow>
  deleteSaleById(id: string): Promise<void>
  insertCheckoutSession(row: NewCheckoutSession): Promise<CheckoutSessionRow>
  attachStripeSession(
    checkoutId: string,
    stripeSessionId: string,
  ): Promise<CheckoutSessionRow>
  findCheckoutSessionById(id: string): Promise<CheckoutSessionRow | null>
  findCheckoutSessionByStripeSessionId(stripeSessionId: string): Promise<CheckoutSessionRow | null>
  /** `open` -> `completed`. Returns null when the row was not open (replay or expiry). */
  completeCheckoutSession(id: string): Promise<CheckoutSessionRow | null>
  /** `open` -> `released`. Returns null when the row was not open. */
  releaseCheckoutSession(id: string): Promise<CheckoutSessionRow | null>
  /** `open` -> `paid_unfulfilled`: Stripe took money the sale may not record. */
  markCheckoutPaidUnfulfilled(id: string): Promise<CheckoutSessionRow | null>
}

export type PurchaseStoreSnapshot = StoreSnapshot & {
  accounts: AccountRow[]
  sales: SaleRow[]
  checkoutSessions: CheckoutSessionRow[]
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

/** A transition off `open` is a single statement: the first writer wins. */
function mustFindCheckout(
  row: CheckoutSessionRow | undefined,
  id: string,
): CheckoutSessionRow {
  if (row === undefined) {
    throw new Error(`checkout session ${id} does not exist`)
  }
  return row
}

export function createInMemoryPurchaseStore(): InMemoryPurchaseStore {
  const base = createInMemoryDslStore()
  const accounts: AccountRow[] = []
  const sales: SaleRow[] = []
  const checkoutSessions: CheckoutSessionRow[] = []

  function transition(id: string, next: CheckoutStatus): CheckoutSessionRow | null {
    const index = checkoutSessions.findIndex((row) => row.id === id && row.status === 'open')
    if (index === -1) return null
    const updated: CheckoutSessionRow = {
      ...checkoutSessions[index],
      status: next,
      closedAt: nowIso(),
    }
    checkoutSessions[index] = updated
    return { ...updated }
  }

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

    async listSales() {
      return [...sales].reverse().map((row) => ({ ...row }))
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

    async insertCheckoutSession(row) {
      const created: CheckoutSessionRow = {
        ...row,
        id: newId(),
        stripeSessionId: null,
        status: 'open',
        createdAt: nowIso(),
        closedAt: null,
      }
      checkoutSessions.push(created)
      return { ...created }
    },

    async attachStripeSession(checkoutId, stripeSessionId) {
      if (checkoutSessions.some((row) => row.stripeSessionId === stripeSessionId)) {
        throw new Error(`checkout session with stripe id ${stripeSessionId} already exists`)
      }
      const index = checkoutSessions.findIndex((row) => row.id === checkoutId)
      const found = mustFindCheckout(checkoutSessions[index], checkoutId)
      const updated: CheckoutSessionRow = { ...found, stripeSessionId }
      checkoutSessions[index] = updated
      return { ...updated }
    },

    async findCheckoutSessionById(id) {
      const found = checkoutSessions.find((row) => row.id === id)
      return found === undefined ? null : { ...found }
    },

    async findCheckoutSessionByStripeSessionId(stripeSessionId) {
      const found = checkoutSessions.find((row) => row.stripeSessionId === stripeSessionId)
      return found === undefined ? null : { ...found }
    },

    async completeCheckoutSession(id) {
      return transition(id, 'completed')
    },

    async releaseCheckoutSession(id) {
      return transition(id, 'released')
    },

    async markCheckoutPaidUnfulfilled(id) {
      return transition(id, 'paid_unfulfilled')
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
        checkoutSessions: checkoutSessions.map((row) => ({ ...row })),
      }
    },
  }
}
