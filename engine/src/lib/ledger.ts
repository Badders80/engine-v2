/**
 * The ledger's arithmetic. Chunk 4, U20.
 *
 * The cap-table identity, in horse points:
 *
 *   listed = sold + open holds + held paid_unfulfilled + remaining
 *
 * A `paid_unfulfilled` checkout contributes capacity only while its stake is
 * still held (`stakeReturnedAt === null`). Once release or expiry returned the
 * stake it is back in `remaining`, so counting it again would double count.
 *
 * Everything is compared in hundredths of a horse point, because the database
 * stores `numeric(5,2)` and IEEE-754 does not add 2.5 + 2.5 + 5 reliably.
 */

import type { DslRow } from './dslStore'
import type { Result } from './purchase'
import type { CheckoutSessionRow, PurchaseStore, SaleRow } from './purchaseStore'

export type CapTable = {
  listedStake: number
  soldStake: number
  openHoldStake: number
  heldPaidUnfulfilledStake: number
  remainingStake: number
  revenueNzd: number
  termEnd: string | null
}

function bp(value: number): number {
  return Math.round(value * 100)
}

/** `1.25` rather than `1.2500000000000002`. */
function horsePoints(value: number): number {
  return bp(value) / 100
}

export function capTableFor(
  dsl: DslRow,
  sales: readonly SaleRow[],
  checkouts: readonly CheckoutSessionRow[],
): CapTable {
  const sold = sales.filter((sale) => sale.dslId === dsl.id)
  const held = checkouts.filter(
    (checkout) =>
      checkout.dslId === dsl.id &&
      checkout.status === 'paid_unfulfilled' &&
      checkout.stakeReturnedAt === null,
  )
  const open = checkouts.filter(
    (checkout) => checkout.dslId === dsl.id && checkout.status === 'open',
  )

  return {
    listedStake: horsePoints(dsl.listedStake ?? 0),
    soldStake: horsePoints(sold.reduce((total, sale) => total + sale.stake, 0)),
    openHoldStake: horsePoints(open.reduce((total, row) => total + row.stake, 0)),
    heldPaidUnfulfilledStake: horsePoints(
      held.reduce((total, row) => total + row.stake, 0),
    ),
    remainingStake: horsePoints(dsl.stakeRemaining ?? 0),
    revenueNzd: horsePoints(sold.reduce((total, sale) => total + sale.amount, 0)),
    termEnd: dsl.endDate,
  }
}

export function capTableIdentityHolds(cap: CapTable): boolean {
  return (
    bp(cap.listedStake) ===
    bp(cap.soldStake) +
      bp(cap.openHoldStake) +
      bp(cap.heldPaidUnfulfilledStake) +
      bp(cap.remainingStake)
  )
}

/** P0: paid_unfulfilled rows that still block the close. */
export function unresolvedPaidUnfulfilled(
  dslId: string,
  checkouts: readonly CheckoutSessionRow[],
): CheckoutSessionRow[] {
  return checkouts.filter(
    (row) =>
      row.dslId === dslId &&
      row.status === 'paid_unfulfilled' &&
      row.resolvedAt === null,
  )
}

/**
 * P0: record that a paid_unfulfilled exception is settled. The store returns
 * any held stake and stamps who, when and why; a second resolution is refused.
 */
export async function resolveCheckout(
  input: { checkoutId: string; resolvedBy: string; resolution: string },
  store: PurchaseStore,
): Promise<Result<CheckoutSessionRow>> {
  if (input.resolvedBy.trim() === '') {
    return { ok: false, reason: 'the operator resolving the exception is required' }
  }
  if (input.resolution.trim() === '') {
    return { ok: false, reason: 'a resolution note is required' }
  }

  try {
    const row = await store.resolvePaidUnfulfilled(
      input.checkoutId,
      input.resolvedBy.trim(),
      input.resolution.trim(),
    )
    return { ok: true, value: row }
  } catch (error) {
    return {
      ok: false,
      reason:
        error instanceof Error ? error.message : 'the exception could not be resolved',
    }
  }
}

/**
 * U19: the operator close. The store sweeps this listing's stale holds, then
 * refuses while any open hold or unresolved paid_unfulfilled checkout exists —
 * held or returned, because money was taken without a sale.
 */
export async function closeListing(
  input: { dslId: string; reason: string; closedBy: string },
  store: PurchaseStore,
): Promise<Result<DslRow>> {
  if (input.reason.trim() === '') {
    return { ok: false, reason: 'a reason is required to close a listing' }
  }
  if (input.closedBy.trim() === '') {
    return { ok: false, reason: 'the operator closing the listing is required' }
  }

  try {
    const dsl = await store.closeDsl(input.dslId, input.reason.trim(), input.closedBy.trim())
    return { ok: true, value: dsl }
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? error.message : 'the listing could not be closed',
    }
  }
}
