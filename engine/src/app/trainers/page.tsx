import Link from 'next/link'

import { recordStore } from '../records/store'

export const dynamic = 'force-dynamic'

export default async function Page() {
  const rows = await recordStore().listTrainers()

  return (
    <main>
      <h1 className="mb-6 text-2xl">Trainers</h1>

      <div className="grid grid-cols-[repeat(auto-fill,minmax(14rem,1fr))] gap-4">
        <Link
          href="/trainers/new"
          className="flex min-h-24 items-center justify-center border border-dashed border-black/30 p-4 text-center"
        >
          + New trainer
        </Link>

        {rows.map((row) => (
          <Link
            key={row.id}
            href={`/trainers/${row.id}`}
            className="min-h-24 border border-black/10 p-4 hover:border-black/40"
          >
            <p className="font-medium">{row.name}</p>
            <p className="text-sm opacity-70">{row.stable}</p>
            <p className="text-sm opacity-70">{row.location}</p>
          </Link>
        ))}
      </div>

      {rows.length === 0 ? <p className="mt-6 opacity-70">No trainers yet.</p> : null}
    </main>
  )
}
