/**
 * The storage seam for the purchase flow. PLAN.md step 8.
 *
 * Extends `DslStore` with `accounts` and `sales` operations so the purchase
 * domain and the Stripe webhook stay pure and testable against the in-memory
 * implementation in CI, where no database and no credentials exist.
 *
 * Row types mirror the migrations. `00024_ledger.sql` is the authority for the
 * snapshot columns, the close columns and `record_sale_atomically`.
 */

import {
  createInMemoryDslStore,
  type CloseStyle,
  type DslRow,
  type DslStore,
  type HorseRow,
  type PartyRow,
  type PaymentModel,
  type StoreSnapshot,
} from './dslStore'
import { termMonthsBetween } from './term'

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
 *
 * `stakeReturnedAt` is U20: null while the stake is still held; set when a
 * release or expiry returned it.
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
  stakeReturnedAt: string | null
  /** P0: a paid_unfulfilled exception is settled; null while unresolved. */
  resolvedAt: string | null
  resolvedBy: string | null
  resolution: string | null
}

/** U18: the executed terms frozen onto the sale. None is recomputed later. */
export type SaleSnapshot = {
  wholesaleMonthlyPerPercent: number | null
  retailMonthlyPerPercent: number | null
  investorSplit: number | null
  listedStake: number | null
  minStake: number | null
  step: number | null
  endDate: string | null
  paymentModelAtSale: PaymentModel | null
  closeStyle: CloseStyle | null
  distributionSchedule: string | null
  termStart: string | null
  termEnd: string | null
  termMonths: number | null
  trainerId: string | null
  ownerId: string | null
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
} & SaleSnapshot

export type SaleRow = NewSale & {
  id: string
  createdAt: string
}

/** The one call that replaces insertSale + completeCheckoutSession + sellStake. */
export type RecordSaleInput = {
  checkoutId: string | null
  stripeSessionId: string
  stripeAmountTotalCents: number
  stripeCurrency: string
  stripeIdentityId: string | null
}

export type SaleRecordOutcome = 'sale_written' | 'idempotent_replay' | 'paid_unfulfilled'

export type RecordSaleResult = {
  outcome: SaleRecordOutcome
  sale: SaleRow | null
  reason: string | null
}

export interface PurchaseStore extends DslStore {
  findAccountById(id: string): Promise<AccountRow | null>
  insertAccount(row: NewAccount): Promise<AccountRow>
  updateAccountKycStatus(id: string, kycStatus: KycStatus): Promise<AccountRow>
  findSaleByStripeSessionId(stripeSessionId: string): Promise<SaleRow | null>
  listSalesByUserId(userId: string): Promise<SaleRow[]>
  /** Every sale, newest first. The operator's read-only Sales section. */
  listSales(): Promise<SaleRow[]>
  /**
   * H6: writes the sale snapshot and claims the hold in one transaction,
   * mirroring `record_sale_atomically` in `00024`. There is deliberately no
   * standalone insert, delete, complete or sell operation: the sale is
   * written once, atomically, and is append-only.
   */
  recordSaleAtomically(input: RecordSaleInput): Promise<RecordSaleResult>
  /**
   * U19: sweeps this listing's stale holds, then refuses while any open or
   * paid_unfulfilled checkout exists. Throws with the refusal reason.
   */
  closeDsl(dslId: string, reason: string, closedBy: string): Promise<DslRow>
  /** Every checkout row, newest first. The ledger's cap-table read. */
  listCheckoutSessions(): Promise<CheckoutSessionRow[]>
  /**
   * B6: takes `stake` out of the DSL and writes the binding row in one step.
   * Throws when the DSL is not available or has less than `stake` left, so two
   * buyers cannot take the same last percent.
   */
  reserveCheckoutSession(row: NewCheckoutSession): Promise<CheckoutSessionRow>
  attachStripeSession(
    checkoutId: string,
    stripeSessionId: string,
  ): Promise<CheckoutSessionRow>
  findCheckoutSessionById(id: string): Promise<CheckoutSessionRow | null>
  findCheckoutSessionByStripeSessionId(stripeSessionId: string): Promise<CheckoutSessionRow | null>
  /**
   * P0: an operator records that a paid_unfulfilled exception is settled.
   * A held stake goes back to the listing; the row stays paid_unfulfilled but
   * carries who, when and why. A second resolution is refused.
   */
  resolvePaidUnfulfilled(
    checkoutId: string,
    resolvedBy: string,
    resolution: string,
  ): Promise<CheckoutSessionRow>
  /** `open` -> `released`, and the stake goes back. Null when the row was not open. */
  releaseCheckoutSession(id: string): Promise<CheckoutSessionRow | null>
  /** Every open hold past `now` becomes `expired` and returns its stake. */
  expireCheckoutSessions(now?: string): Promise<number>
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

function cents(value: number): number {
  return Math.round(value * 100)
}

function firstDayOfMonth(iso: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null
  return `${iso.slice(0, 7)}-01`
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

  /**
   * The in-memory analogue of the RPC's `select ... for update`: one atomic
   * write at a time, so a replayed or concurrent webhook sees committed state.
   */
  let saleQueue: Promise<unknown> = Promise.resolve()
  function serialise<T>(task: () => Promise<T>): Promise<T> {
    const run = saleQueue.then(task, task)
    saleQueue = run.then(
      () => undefined,
      () => undefined,
    )
    return run
  }

  function transition(
    id: string,
    next: CheckoutStatus,
    from: readonly CheckoutStatus[] = ['open'],
    returnsStake = false,
  ): CheckoutSessionRow | null {
    const index = checkoutSessions.findIndex(
      (row) => row.id === id && from.includes(row.status),
    )
    if (index === -1) return null
    const updated: CheckoutSessionRow = {
      ...checkoutSessions[index],
      status: next,
      closedAt: nowIso(),
      stakeReturnedAt: returnsStake ? nowIso() : checkoutSessions[index].stakeReturnedAt,
    }
    checkoutSessions[index] = updated
    return { ...updated }
  }

  /** A released hold returns its stake, never above the listing's own total. */
  async function restoreStake(row: CheckoutSessionRow): Promise<void> {
    const dsl = await base.findDslById(row.dslId)
    if (dsl === null) return
    const cappedCents = Math.min(
      Math.round((dsl.listedStake ?? 0) * 100),
      Math.round((dsl.stakeRemaining ?? 0) * 100) + Math.round(row.stake * 100),
    )
    await base.updateDsl(dsl.id, { stakeRemaining: cappedCents / 100 })
  }

  async function markPaidUnfulfilled(checkout: CheckoutSessionRow): Promise<void> {
    transition(checkout.id, 'paid_unfulfilled', ['open', 'expired', 'released'])
  }

  async function writeSale(input: RecordSaleInput): Promise<RecordSaleResult> {
    if (
      typeof input.stripeSessionId !== 'string' ||
      input.stripeSessionId.trim() === ''
    ) {
      throw new Error('recordSaleAtomically: a Stripe session id is required')
    }

    let checkout: CheckoutSessionRow | null = null
    if (input.checkoutId !== null) {
      checkout = await findCheckout(input.checkoutId)
    }
    if (checkout === null) {
      checkout = await findCheckoutByStripeSession(input.stripeSessionId)
    }

    // Idempotency, read after the "lock" so a replay sees the committed sale.
    const existing = sales.find((row) => row.stripeSessionId === input.stripeSessionId)
    if (existing !== undefined) {
      return { outcome: 'idempotent_replay', sale: { ...existing }, reason: null }
    }

    if (checkout === null) {
      return {
        outcome: 'paid_unfulfilled',
        sale: null,
        reason:
          'no checkout session is bound to this Stripe session; no sale was written',
      }
    }

    if (checkout.status === 'completed') {
      return {
        outcome: 'paid_unfulfilled',
        sale: null,
        reason: `checkout ${checkout.id} is already completed but no sale records this Stripe session`,
      }
    }
    if (checkout.status === 'paid_unfulfilled') {
      return {
        outcome: 'paid_unfulfilled',
        sale: null,
        reason: `checkout ${checkout.id} is already marked paid_unfulfilled`,
      }
    }

    const currency = input.stripeCurrency.trim().toLowerCase()
    let reason: string | null = null

    if (currency !== 'nzd') {
      reason = `checkout ${checkout.id} was charged in ${
        input.stripeCurrency || 'no currency'
      }, not nzd; no sale was written`
    } else if (
      !Number.isFinite(input.stripeAmountTotalCents) ||
      cents(checkout.amountNzd) !== input.stripeAmountTotalCents
    ) {
      reason = `checkout ${checkout.id}: Stripe reports ${
        Number.isFinite(input.stripeAmountTotalCents)
          ? `${input.stripeAmountTotalCents} cents`
          : 'no amount'
      } but the bound quote is ${cents(checkout.amountNzd)} cents; no sale was written`
    }

    if (reason !== null) {
      await markPaidUnfulfilled(checkout)
      return { outcome: 'paid_unfulfilled', sale: null, reason }
    }

    if (checkout.status !== 'open') {
      reason = `checkout ${checkout.id} is ${checkout.status}: its stake was returned before the money arrived; no sale was written`
      if (checkout.status === 'expired' || checkout.status === 'released') {
        await markPaidUnfulfilled(checkout)
      }
      return { outcome: 'paid_unfulfilled', sale: null, reason }
    }

    const dsl = await base.findDslById(checkout.dslId)
    if (dsl === null) {
      reason = `dsl ${checkout.dslId} does not exist; no sale was written`
      await markPaidUnfulfilled(checkout)
      return { outcome: 'paid_unfulfilled', sale: null, reason }
    }

    if (dsl.closedAt !== null && dsl.closedAt !== undefined) {
      reason = `dsl ${dsl.id} is closed; no sale was written`
      await markPaidUnfulfilled(checkout)
      return { outcome: 'paid_unfulfilled', sale: null, reason }
    }

    if (dsl.status !== 'available' && dsl.status !== 'fully_allocated') {
      reason = `dsl ${dsl.id} is ${dsl.status} and cannot be sold; no sale was written`
      await markPaidUnfulfilled(checkout)
      return { outcome: 'paid_unfulfilled', sale: null, reason }
    }

    // The snapshot is all-or-nothing (00024): a listing missing its expiry or
    // retail rate cannot produce a contract, so it is refused rather than
    // written half-empty.
    if (dsl.endDate === null || dsl.retailMonthlyPerPercent === null) {
      reason = `dsl ${dsl.id} does not have its commercial terms; no sale was written`
      await markPaidUnfulfilled(checkout)
      return { outcome: 'paid_unfulfilled', sale: null, reason }
    }

    const sold = sales
      .filter((row) => row.dslId === dsl.id)
      .reduce((total, row) => total + row.stake, 0)
    if (cents(sold) + cents(checkout.stake) > cents(dsl.listedStake ?? 0)) {
      reason = `dsl ${dsl.id} has ${sold}% already sold and no stake remains for this ${checkout.stake}% sale; no sale was written`
      await markPaidUnfulfilled(checkout)
      return { outcome: 'paid_unfulfilled', sale: null, reason }
    }

    // U21: the start is the first day of the executed month, never the listing.
    const termStart = firstDayOfMonth(checkout.executedDate)
    const termMonths =
      termStart === null ? null : termMonthsBetween(termStart, dsl.endDate)
    if (termStart === null || termMonths === null || termMonths < 1) {
      reason = `dsl ${dsl.id} ends ${dsl.endDate}, before the sale month; no sale was written`
      await markPaidUnfulfilled(checkout)
      return { outcome: 'paid_unfulfilled', sale: null, reason }
    }

    const paymentModelAtSale: PaymentModel =
      dsl.paymentModel === 'upfront' || termMonths <= 5
        ? 'upfront'
        : 'subscription_float'

    const expectedCents = cents(
      dsl.retailMonthlyPerPercent *
        checkout.stake *
        (paymentModelAtSale === 'upfront' ? termMonths : 5),
    )
    if (cents(checkout.amountNzd) !== expectedCents) {
      reason = `checkout ${checkout.id} binds $${checkout.amountNzd} but the executed terms price $${
        expectedCents / 100
      }; no sale was written`
      await markPaidUnfulfilled(checkout)
      return { outcome: 'paid_unfulfilled', sale: null, reason }
    }

    const sale: SaleRow = {
      id: newId(),
      dslId: dsl.id,
      userId: checkout.accountId,
      printedName: checkout.printedName,
      email: checkout.email,
      stake: checkout.stake,
      amount: checkout.amountNzd,
      stripeSessionId: input.stripeSessionId,
      stripeIdentityId: input.stripeIdentityId,
      checkoutSessionId: checkout.id,
      stripeAmountTotal: expectedCents / 100,
      stripeCurrency: currency,
      pdsMarkdown: checkout.pdsMarkdown,
      saMarkdown: checkout.saMarkdown,
      pdsHash: checkout.pdsHash,
      saHash: checkout.saHash,
      wholesaleMonthlyPerPercent: dsl.wholesaleMonthlyPerPercent,
      retailMonthlyPerPercent: dsl.retailMonthlyPerPercent,
      investorSplit: dsl.investorSplit,
      listedStake: dsl.listedStake,
      minStake: dsl.minStake,
      step: dsl.step,
      endDate: dsl.endDate,
      paymentModelAtSale,
      closeStyle: dsl.closeStyle,
      distributionSchedule: dsl.distributionSchedule,
      termStart,
      termEnd: dsl.endDate,
      termMonths,
      trainerId: dsl.trainerId,
      ownerId: dsl.ownerId,
      createdAt: nowIso(),
    }
    sales.push(sale)

    transition(checkout.id, 'completed')

    const dslAfterSale = await base.findDslById(dsl.id)
    if (
      dslAfterSale !== null &&
      (dslAfterSale.stakeRemaining ?? 0) === 0 &&
      dslAfterSale.status === 'available'
    ) {
      await base.updateDsl(dsl.id, { status: 'fully_allocated' })
    }

    return { outcome: 'sale_written', sale: { ...sale }, reason: null }
  }

  async function findCheckout(id: string): Promise<CheckoutSessionRow | null> {
    const found = checkoutSessions.find((row) => row.id === id)
    return found === undefined ? null : { ...found }
  }

  async function findCheckoutByStripeSession(
    stripeSessionId: string,
  ): Promise<CheckoutSessionRow | null> {
    const found = checkoutSessions.find((row) => row.stripeSessionId === stripeSessionId)
    return found === undefined ? null : { ...found }
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

    recordSaleAtomically(input) {
      return serialise(() => writeSale(input))
    },

    async closeDsl(dslId, reason, closedBy) {
      if (reason.trim() === '') {
        throw new Error('closeDsl: a reason is required')
      }
      if (closedBy.trim() === '') {
        throw new Error('closeDsl: a closer is required')
      }

      const dsl = await base.findDslById(dslId)
      if (dsl === null) throw new Error(`dsl ${dslId} does not exist`)
      if (dsl.closedAt !== null && dsl.closedAt !== undefined) {
        throw new Error(`dsl ${dslId} is already closed`)
      }
      if (dsl.status !== 'available' && dsl.status !== 'fully_allocated') {
        throw new Error(
          `dsl ${dslId} is ${dsl.status} and cannot be closed; only an available or fully allocated listing closes`,
        )
      }

      // Sweep this listing's stale holds only.
      const now = nowIso()
      for (const row of checkoutSessions) {
        if (row.dslId !== dslId || row.status !== 'open' || row.expiresAt > now) continue
        const expired = transition(row.id, 'expired', ['open'], true)
        if (expired !== null) await restoreStake(expired)
      }

      const blocking = checkoutSessions.filter(
        (row) =>
          row.dslId === dslId &&
          (row.status === 'open' ||
            (row.status === 'paid_unfulfilled' && row.resolvedAt === null)),
      )
      if (blocking.length > 0) {
        const held = blocking.filter((row) => row.stakeReturnedAt === null).length
        const returned = blocking.length - held
        throw new Error(
          `dsl ${dslId} cannot be closed: ${held} held and ${returned} returned open or paid_unfulfilled checkout(s) exist`,
        )
      }

      return base.updateDsl(dslId, {
        status: 'completed',
        closedAt: nowIso(),
        closedReason: reason,
        closedBy,
      })
    },

    async listCheckoutSessions() {
      return [...checkoutSessions].reverse().map((row) => ({ ...row }))
    },

    async reserveCheckoutSession(row) {
      const dsl = await base.findDslById(row.dslId)
      if (dsl === null) {
        throw new Error(`checkout reserve: dsl ${row.dslId} does not exist`)
      }
      const remainingCents = Math.round((dsl.stakeRemaining ?? 0) * 100)
      const stakeCents = Math.round(row.stake * 100)
      if (dsl.status !== 'available' || !dsl.published || remainingCents < stakeCents) {
        throw new Error(`no stake available on dsl ${row.dslId}`)
      }

      await base.updateDsl(dsl.id, { stakeRemaining: (remainingCents - stakeCents) / 100 })

      const created: CheckoutSessionRow = {
        ...row,
        id: newId(),
        stripeSessionId: null,
        status: 'open',
        createdAt: nowIso(),
        closedAt: null,
        stakeReturnedAt: null,
        resolvedAt: null,
        resolvedBy: null,
        resolution: null,
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

    async releaseCheckoutSession(id) {
      const released = transition(id, 'released', ['open'], true)
      if (released === null) return null
      await restoreStake(released)
      return released
    },

    async resolvePaidUnfulfilled(id, resolvedBy, resolution) {
      if (resolvedBy.trim() === '') {
        throw new Error('resolvePaidUnfulfilled: a resolver is required')
      }
      if (resolution.trim() === '') {
        throw new Error('resolvePaidUnfulfilled: a resolution is required')
      }
      const index = checkoutSessions.findIndex((row) => row.id === id)
      const row = mustFindCheckout(checkoutSessions[index], id)
      if (row.status !== 'paid_unfulfilled') {
        throw new Error(`checkout ${id} is ${row.status}, not paid_unfulfilled`)
      }
      if (row.resolvedAt !== null) {
        throw new Error(`checkout ${id} is already resolved`)
      }
      if (row.stakeReturnedAt === null) {
        await restoreStake(row)
      }
      const resolved: CheckoutSessionRow = {
        ...row,
        resolvedAt: nowIso(),
        resolvedBy: resolvedBy.trim(),
        resolution: resolution.trim(),
        stakeReturnedAt: row.stakeReturnedAt ?? nowIso(),
      }
      checkoutSessions[index] = resolved
      return { ...resolved }
    },

    async expireCheckoutSessions(now = nowIso()) {
      const due = checkoutSessions.filter(
        (row) => row.status === 'open' && row.expiresAt <= now,
      )
      let expired = 0
      for (const row of due) {
        const closed = transition(row.id, 'expired', ['open'], true)
        if (closed === null) continue
        await restoreStake(closed)
        expired += 1
      }
      return expired
    },

    dump(): PurchaseStoreSnapshot {
      const dslDump = base.dump()
      return {
        horses: dslDump.horses as HorseRow[],
        parties: dslDump.parties as PartyRow[],
        dsls: dslDump.dsls as DslRow[],
        accounts: accounts.map((row) => ({ ...row })),
        sales: sales.map((row) => ({ ...row })),
        checkoutSessions: checkoutSessions.map((row) => ({ ...row })),
      }
    },
  }
}
