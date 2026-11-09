import Link from 'next/link'

import { recordStore } from '../records/store'

export const dynamic = 'force-dynamic'

/** A role-filtered view of `parties` (ruling 10). */
export default async function Page() {
  const rows = await recordStore().listPartiesByRole('owner')

  return (
    <main className="grid gap-6">
      <header className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <p className="text-caption uppercase tracking-caption text-low">Records</p>
          <h1 className="mt-1">Owners</h1>
        </div>
        <p className="font-figure text-caption text-muted">{rows.length} records</p>
      </header>

      <div className="grid grid-cols-[repeat(auto-fill,minmax(16rem,1fr))] gap-4">
        <Link
          href="/owners/new"
          className="flex min-h-32 items-center justify-center rounded-md border border-dashed border-line-strong p-5 text-center text-body text-muted hover:border-accent hover:text-ink"
        >
          + New owner
        </Link>

        {rows.map((row) => (
          <Link
            key={row.id}
            href={`/owners/${row.id}`}
            className="grid min-h-32 gap-2 rounded-md border border-line bg-panel p-5 hover:border-line-strong"
          >
            <p className="text-body text-ink">{row.displayName}</p>
            <p className="text-caption text-muted">{row.contact ?? '—'}</p>
          </Link>
        ))}
      </div>

      {rows.length === 0 ? <p className="text-body text-muted">No owners yet.</p> : null}
    </main>
  )
}
