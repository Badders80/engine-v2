import Link from 'next/link'

import { recordStore } from '../records/store'

export const dynamic = 'force-dynamic'

export default async function Page() {
  const dsls = await recordStore().listDsls()

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
            <th className="py-3 text-caption uppercase tracking-caption text-muted">Status</th>
            <th className="py-3 text-caption uppercase tracking-caption text-muted">Listed</th>
            <th className="py-3 text-caption uppercase tracking-caption text-muted">Terms</th>
            <th className="py-3 text-caption uppercase tracking-caption text-muted">End date</th>
            <th className="py-3" />
          </tr>
        </thead>
        <tbody>
          {dsls.map((dsl) => (
            <tr key={dsl.id} className="border-b border-line">
              <td className="py-3">{dsl.status}</td>
              <td className="py-3">{dsl.published ? 'yes' : 'no'}</td>
              <td className="py-3 font-figure">
                {dsl.listedStake === null ? 'not set' : `${dsl.listedStake}%`}
              </td>
              <td className="py-3 font-figure">{dsl.endDate ?? '—'}</td>
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
