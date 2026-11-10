import Link from 'next/link'

import {
  capTableFor,
  capTableIdentityHolds,
  unresolvedPaidUnfulfilled,
} from '@/lib/ledger'
import { createSupabasePurchaseStore } from '@/lib/purchaseStoreSupabase'

import { closeListingAction, resolveCheckoutAction } from './actions'

export const dynamic = 'force-dynamic'

type SearchParams = Record<string, string | string[] | undefined>

function first(value: string | string[] | undefined): string | null {
  if (typeof value === 'string') return value
  if (Array.isArray(value) && typeof value[0] === 'string') return value[0]
  return null
}

function money(amount: number): string {
  return `$${amount.toFixed(2)}`
}

function shortHash(hash: string): string {
  return hash.length > 16 ? `${hash.slice(0, 12)}…` : hash
}

/**
 * The ledger. Chunk 4, U15.
 *
 * One section per DSL: the cap table, the investor rows, and the manual close.
 * Every number comes from the frozen sale snapshot or the checkout row, never
 * from recompiling a document or re-deriving a term from live DSL state.
 */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const params = await searchParams
  const closeError = first(params.close_error)
  const resolveError = first(params.resolve_error)
  const resolvedId = first(params.resolved)
  const closedId = first(params.closed)
  const dslFilter = first(params.dsl)

  const store = createSupabasePurchaseStore()
  const [dsls, sales, checkouts, horses] = await Promise.all([
    store.listDsls(),
    store.listSales(),
    store.listCheckoutSessions(),
    store.listHorses(),
  ])

  const horseName = new Map(horses.map((horse) => [horse.id, horse.legalName]))
  const salesByDsl = new Map<string, typeof sales>()
  for (const sale of sales) {
    const rows = salesByDsl.get(sale.dslId) ?? []
    rows.push(sale)
    salesByDsl.set(sale.dslId, rows)
  }

  const sections = dsls
    .filter((dsl) => dslFilter === null || dsl.id === dslFilter)
    .map((dsl) => ({
      dsl,
      rows: salesByDsl.get(dsl.id) ?? [],
      cap: capTableFor(dsl, sales, checkouts),
      exceptions: unresolvedPaidUnfulfilled(dsl.id, checkouts),
    }))

  return (
    <main>
      <div className="mb-6 flex items-baseline justify-between gap-3">
        <h1>Sales</h1>
        <p className="text-caption uppercase tracking-caption text-muted">
          {sales.length} sale{sales.length === 1 ? '' : 's'} · append-only
        </p>
      </div>

      {closedId !== null ? (
        <p className="mb-6 rounded-sm border border-line bg-row px-4 py-3 text-body">
          Listing closed. It can be sold no further, and the ledger keeps every
          sale it holds.
        </p>
      ) : null}

      {closeError !== null ? (
        <p
          role="alert"
          className="mb-6 rounded-sm border border-line-strong px-4 py-3 text-body"
        >
          Close refused: <span className="font-figure">{closeError}</span>
        </p>
      ) : null}

      {resolveError !== null ? (
        <p
          role="alert"
          className="mb-6 rounded-sm border border-line-strong px-4 py-3 text-body"
        >
          Resolution refused: <span className="font-figure">{resolveError}</span>
        </p>
      ) : null}

      {resolvedId !== null ? (
        <p className="mb-6 rounded-sm border border-line bg-row px-4 py-3 text-body">
          Exception resolved. The checkout no longer blocks a close.
        </p>
      ) : null}

      {sections.length === 0 ? (
        <p className="mt-6 text-body text-muted">
          No listings{dslFilter === null ? ' yet' : ' match this filter'}. A sale
          writes the first investor row.
        </p>
      ) : null}

      {sections.map(({ dsl, rows, cap, exceptions }) => {
        const identityHolds = capTableIdentityHolds(cap)
        const canClose =
          dsl.closedAt === null &&
          (dsl.status === 'coming_soon' ||
            dsl.status === 'available' ||
            dsl.status === 'fully_allocated') &&
          exceptions.length === 0
        const statusLabel =
          dsl.closedAt !== null && rows.length === 0
            ? 'archived'
            : dsl.status.replaceAll('_', ' ')

        return (
          <section key={dsl.id} className="mb-12 border-t border-line pt-6">
            <header className="mb-5 flex flex-wrap items-baseline justify-between gap-3">
              <div>
                <h2 className="text-heading">
                  <Link href={`/dsl/${dsl.id}`}>
                    {horseName.get(dsl.horseId) ?? dsl.id}
                  </Link>
                </h2>
                <p className="mt-1 font-figure text-caption text-muted">{dsl.id}</p>
              </div>
              <div className="text-right">
                <p className="text-caption uppercase tracking-caption text-muted">
                  {statusLabel}
                  {dsl.published ? ' · published' : ''}
                </p>
                <p className="font-figure text-caption text-muted">
                  ends {cap.termEnd ?? '—'}
                </p>
              </div>
            </header>

            <dl className="mb-6 grid max-w-4xl grid-cols-2 gap-x-6 gap-y-3 md:grid-cols-4">
              <div>
                <dt className="text-caption uppercase tracking-caption text-muted">Listed</dt>
                <dd className="font-figure">{cap.listedStake}%</dd>
              </div>
              <div>
                <dt className="text-caption uppercase tracking-caption text-muted">Sold</dt>
                <dd className="font-figure">{cap.soldStake}%</dd>
              </div>
              <div>
                <dt className="text-caption uppercase tracking-caption text-muted">
                  Open holds
                </dt>
                <dd className="font-figure">{cap.openHoldStake}%</dd>
              </div>
              <div>
                <dt className="text-caption uppercase tracking-caption text-muted">
                  Held paid-unfulfilled
                </dt>
                <dd className="font-figure">{cap.heldPaidUnfulfilledStake}%</dd>
              </div>
              <div>
                <dt className="text-caption uppercase tracking-caption text-muted">
                  Remaining
                </dt>
                <dd className="font-figure">{cap.remainingStake}%</dd>
              </div>
              <div>
                <dt className="text-caption uppercase tracking-caption text-muted">Revenue</dt>
                <dd className="font-figure">{money(cap.revenueNzd)}</dd>
              </div>
              <div>
                <dt className="text-caption uppercase tracking-caption text-muted">Term end</dt>
                <dd className="font-figure">{cap.termEnd ?? '—'}</dd>
              </div>
            </dl>

            {identityHolds ? null : (
              <p role="alert" className="mb-6 text-body">
                Cap table does not balance: listed {cap.listedStake}% ≠ sold{' '}
                {cap.soldStake}% + open holds {cap.openHoldStake}% + held{' '}
                {cap.heldPaidUnfulfilledStake}% + remaining {cap.remainingStake}%.
              </p>
            )}

            {rows.length === 0 ? (
              <p className="text-body text-muted">No investor rows yet.</p>
            ) : (
              <table className="w-full max-w-5xl text-left text-body">
                <thead>
                  <tr className="border-b border-line">
                    <th className="py-3 text-caption uppercase tracking-caption text-muted">
                      Investor
                    </th>
                    <th className="py-3 text-caption uppercase tracking-caption text-muted">
                      Stake
                    </th>
                    <th className="py-3 text-caption uppercase tracking-caption text-muted">
                      Amount
                    </th>
                    <th className="py-3 text-caption uppercase tracking-caption text-muted">
                      Date
                    </th>
                    <th className="py-3 text-caption uppercase tracking-caption text-muted">
                      Contract position
                    </th>
                    <th className="py-3 text-caption uppercase tracking-caption text-muted">
                      PDS
                    </th>
                    <th className="py-3 text-caption uppercase tracking-caption text-muted">
                      SA
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((sale) => (
                    <tr key={sale.id} className="border-b border-line align-top">
                      <td className="py-3">
                        <span className="block">{sale.printedName}</span>
                        <span className="block text-caption text-muted">{sale.email}</span>
                      </td>
                      <td className="py-3 font-figure">{sale.stake}%</td>
                      <td className="py-3 font-figure">{money(sale.amount)}</td>
                      <td className="py-3 font-figure">{sale.createdAt}</td>
                      <td className="py-3">
                        <span className="block font-figure">
                          {sale.termMonths ?? '—'} months ·{' '}
                          {sale.termStart ?? '—'} → {sale.termEnd ?? '—'}
                        </span>
                        <span className="block text-caption text-muted">
                          {sale.paymentModelAtSale?.replaceAll('_', ' ') ?? 'no snapshot'} ·{' '}
                          {sale.closeStyle?.replaceAll('_', ' ') ?? '—'} ·{' '}
                          {sale.investorSplit ?? '—'}% investor split
                        </span>
                      </td>
                      <td className="py-3 font-figure text-caption">
                        <code title={sale.pdsHash}>{shortHash(sale.pdsHash)}</code>
                      </td>
                      <td className="py-3 font-figure text-caption">
                        <code title={sale.saHash}>{shortHash(sale.saHash)}</code>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {rows.map((sale) => (
              <details key={`${sale.id}-docs`} className="mt-4 text-body">
                <summary className="cursor-pointer text-caption uppercase tracking-caption text-muted">
                  Stored documents · {sale.printedName} · {sale.stake}%
                </summary>
                <p className="mt-2 font-figure text-caption text-muted">
                  PDS SHA-256 {sale.pdsHash}
                  <br />
                  SA SHA-256 {sale.saHash}
                </p>
                <h3 className="mt-3 text-body">PDS</h3>
                <pre className="mt-1 max-h-96 overflow-auto whitespace-pre-wrap border border-line p-3 text-caption">
                  {sale.pdsMarkdown}
                </pre>
                <h3 className="mt-3 text-body">SA</h3>
                <pre className="mt-1 max-h-96 overflow-auto whitespace-pre-wrap border border-line p-3 text-caption">
                  {sale.saMarkdown}
                </pre>
              </details>
            ))}

            {exceptions.length > 0 && !dsl.closedAt ? (
              <div className="mt-6 border border-line-strong p-4">
                <h3 className="text-body">Unresolved checkout exceptions</h3>
                <p className="mt-1 text-caption text-muted">
                  Money was taken without a sale. Resolve each one before the
                  listing can close.
                </p>
                {exceptions.map((checkout) => (
                  <form
                    key={checkout.id}
                    action={resolveCheckoutAction}
                    className="mt-4 flex flex-wrap items-end gap-3 border-t border-line pt-4"
                  >
                    <input type="hidden" name="checkoutId" value={checkout.id} />
                    <input type="hidden" name="dslId" value={dsl.id} />
                    <p className="w-full font-figure text-caption text-muted">
                      {checkout.email} · {checkout.stake}% · ${checkout.amountNzd} ·{' '}
                      {checkout.stakeReturnedAt === null ? 'stake held' : 'stake returned'}
                    </p>
                    <label className="text-caption uppercase tracking-caption text-muted">
                      Resolution
                      <input
                        name="resolution"
                        required
                        placeholder="refunded 2026-11-12, ref …"
                        className="mt-1 block w-72 rounded-sm border border-line bg-canvas px-3 py-2 text-body text-ink"
                      />
                    </label>
                    <label className="text-caption uppercase tracking-caption text-muted">
                      Resolved by
                      <input
                        name="resolvedBy"
                        required
                        defaultValue="operator"
                        className="mt-1 block w-40 rounded-sm border border-line bg-canvas px-3 py-2 text-body text-ink"
                      />
                    </label>
                    <button
                      type="submit"
                      className="rounded-sm border border-line-strong px-4 py-2 text-caption uppercase tracking-caption hover:border-accent"
                    >
                      Resolve exception
                    </button>
                  </form>
                ))}
                <p className="mt-4 text-caption text-muted">
                  Close is blocked until every exception is resolved.
                </p>
              </div>
            ) : null}

            {dsl.closedAt ? (
              <p className="mt-5 text-caption text-muted">
                Closed {dsl.closedAt} by {dsl.closedBy ?? '—'}:{' '}
                {dsl.closedReason ?? '—'}
              </p>
            ) : canClose ? (
              <form action={closeListingAction} className="mt-6 flex flex-wrap items-end gap-3">
                <input type="hidden" name="dslId" value={dsl.id} />
                <label className="text-caption uppercase tracking-caption text-muted">
                  Reason
                  <input
                    name="reason"
                    required
                    className="mt-1 block w-64 rounded-sm border border-line bg-canvas px-3 py-2 text-body text-ink"
                  />
                </label>
                <label className="text-caption uppercase tracking-caption text-muted">
                  Closed by
                  <input
                    name="closedBy"
                    required
                    defaultValue="operator"
                    className="mt-1 block w-40 rounded-sm border border-line bg-canvas px-3 py-2 text-body text-ink"
                  />
                </label>
                <button
                  type="submit"
                  className="rounded-sm border border-line-strong px-4 py-2 text-caption uppercase tracking-caption hover:border-accent"
                >
                  Close listing
                </button>
              </form>
            ) : null}
          </section>
        )
      })}
    </main>
  )
}
