import Link from 'next/link'

import { recordStore } from '../records/store'

export const dynamic = 'force-dynamic'

export default async function Page() {
  const dsls = await recordStore().listDsls()

  return (
    <main>
      <div className="mb-6 flex items-baseline justify-between">
        <h1 className="text-2xl">DSLs</h1>
        <Link href="/dsl/new" className="border border-black/40 px-4 py-2 text-sm">
          + New DSL
        </Link>
      </div>

      <table className="w-full max-w-4xl border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-black/20">
            <th className="py-2">Status</th>
            <th className="py-2">Listed</th>
            <th className="py-2">Terms</th>
            <th className="py-2">End date</th>
            <th className="py-2" />
          </tr>
        </thead>
        <tbody>
          {dsls.map((dsl) => (
            <tr key={dsl.id} className="border-b border-black/10">
              <td className="py-2">{dsl.status}</td>
              <td className="py-2">{dsl.published ? 'yes' : 'no'}</td>
              <td className="py-2">{dsl.listedStake === null ? 'not set' : `${dsl.listedStake}%`}</td>
              <td className="py-2">{dsl.endDate ?? '—'}</td>
              <td className="py-2">
                <Link href={`/dsl/${dsl.id}`} className="underline">
                  Open
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {dsls.length === 0 ? <p className="mt-6 opacity-70">No DSLs yet.</p> : null}
    </main>
  )
}
