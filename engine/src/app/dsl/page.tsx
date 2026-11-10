import Link from 'next/link'

import { recordStore } from '../records/store'

export const dynamic = 'force-dynamic'

export default async function Page() {
  const store = recordStore()
  const [dsls, horses] = await Promise.all([store.listDsls(), store.listHorses()])
  const horseName = new Map(horses.map((horse) => [horse.id, horse.legalName]))

  return (
    <main>
      <div className="mb-6 flex items-baseline justify-between gap-3">
        <h1>DSLs</h1>
        <Link
          href="/dsl/new"
          className="rounded-sm border border-line-strong px-4 py-2 text-caption uppercase tracking-caption hover:border-accent"
        >
          + New DSL
        </Link>
      </div>

      <table className="w-full max-w-4xl text-left text-body">
        <thead>
          <tr className="border-b border-line">
            <th className="py-3 text-caption uppercase tracking-caption text-muted">Horse</th>
            <th className="py-3 text-caption uppercase tracking-caption text-muted">Price</th>
            <th className="py-3 text-caption uppercase tracking-caption text-muted">Investor</th>
            <th className="py-3 text-caption uppercase tracking-caption text-muted">
              Investor return %
            </th>
            <th className="py-3 text-caption uppercase tracking-caption text-muted">Expiry</th>
            <th className="py-3 text-caption uppercase tracking-caption text-muted">Status</th>
            <th className="py-3" />
          </tr>
        </thead>
        <tbody>
          {dsls.map((dsl) => (
            <tr key={dsl.id} className="border-b border-line">
              <td className="py-3">{horseName.get(dsl.horseId) ?? '—'}</td>
              <td className="py-3 font-figure">
                {dsl.retailMonthlyPerPercent === null
                  ? 'not priced'
                  : `$${dsl.retailMonthlyPerPercent}`}
              </td>
              {/* The investor is the buyer. No sale exists at listing time; the
                  ledger joins the buyer in chunk 4. */}
              <td className="py-3 text-muted">—</td>
              <td className="py-3 font-figure">
                {dsl.investorSplit === null ? '—' : `${dsl.investorSplit}%`}
              </td>
              <td className="py-3 font-figure">{dsl.endDate ?? '—'}</td>
              <td className="py-3">{dsl.status.replaceAll('_', ' ')}</td>
              <td className="py-3">
                <Link href={`/dsl/${dsl.id}`}>Open</Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {dsls.length === 0 ? <p className="mt-6 text-body text-muted">No DSLs yet.</p> : null}
    </main>
  )
}
