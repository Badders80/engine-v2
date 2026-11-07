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
      <h1 className="mb-6 text-2xl">Sales</h1>

      <table className="w-full max-w-4xl border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-black/20">
            <th className="py-2">DSL</th>
            <th className="py-2">Stake</th>
            <th className="py-2">Amount</th>
            <th className="py-2">Written</th>
          </tr>
        </thead>
        <tbody>
          {sales.map((sale) => (
            <tr key={sale.id} className="border-b border-black/10">
              <td className="py-2 font-mono text-xs">{sale.dslId}</td>
              <td className="py-2">{sale.stake}%</td>
              <td className="py-2">{sale.amount}</td>
              <td className="py-2">{sale.createdAt}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {sales.length === 0 ? <p className="mt-6 opacity-70">No sales yet.</p> : null}
    </main>
  )
}
