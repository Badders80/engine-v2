import Link from 'next/link'

import { createSupabasePurchaseStore } from '@/lib/purchaseStoreSupabase'

export const dynamic = 'force-dynamic'

/**
 * The Sales section. DSL engine decision 2026-11-07.
 *
 * Read-only by design: a sale is the audit trail, not an editable row. One row
 * per purchase, so a partly-sold DSL appears once per investor.
 */
export default async function Page() {
  const sales = await createSupabasePurchaseStore().listSales()

  return (
    <main>
      <h1 className="mb-6">Sales</h1>

      <table className="w-full max-w-4xl text-left text-body">
        <thead>
          <tr className="border-b border-line">
            <th className="py-3 text-caption uppercase tracking-caption text-muted">DSL</th>
            <th className="py-3 text-caption uppercase tracking-caption text-muted">Stake</th>
            <th className="py-3 text-caption uppercase tracking-caption text-muted">Amount</th>
            <th className="py-3 text-caption uppercase tracking-caption text-muted">Written</th>
          </tr>
        </thead>
        <tbody>
          {sales.map((sale) => (
            <tr key={sale.id} className="border-b border-line">
              <td className="py-3 font-figure text-caption">
                <Link href={`/dsl/${sale.dslId}`}>{sale.dslId}</Link>
              </td>
              <td className="py-3 font-figure">{sale.stake}%</td>
              <td className="py-3 font-figure">{sale.amount}</td>
              <td className="py-3 font-figure">{sale.createdAt}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {sales.length === 0 ? <p className="mt-6 text-body text-muted">No sales yet.</p> : null}
    </main>
  )
}
