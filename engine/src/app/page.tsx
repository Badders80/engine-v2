import Link from 'next/link'

import { recordStore } from './records/store'

export const dynamic = 'force-dynamic'

type IndexRow = {
  id: string
  primary: string
  secondary: string
}

function IndexSection({
  title,
  href,
  newHref,
  rows,
}: {
  title: string
  href: string
  newHref: string
  rows: IndexRow[]
}) {
  return (
    <section className="overflow-hidden rounded-md border border-line bg-panel p-5">
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <h2 className="text-heading-sm">{title}</h2>
        <span className="font-figure text-caption text-muted">{rows.length}</span>
      </div>

      {rows.length === 0 ? (
        <p className="text-body text-low">Nothing yet.</p>
      ) : (
        <ul className="grid">
          {rows.map((row) => (
            <li key={row.id} className="border-b border-line last:border-b-0">
              <Link
                href={`${href}/${row.id}`}
                className="flex items-baseline justify-between gap-3 py-2 text-body hover:text-accent"
              >
                <span className="min-w-0 truncate text-ink">{row.primary}</span>
                <span className="min-w-0 truncate font-figure text-caption text-low">
                  {row.secondary}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 flex items-center justify-between gap-3">
        <Link href={href} className="text-caption uppercase tracking-caption">
          View all
        </Link>
        <Link href={newHref} className="text-caption uppercase tracking-caption">
          + New
        </Link>
      </div>
    </section>
  )
}

export default async function Page() {
  const store = recordStore()
  const [horses, trainers, owners] = await Promise.all([
    store.listHorses(),
    store.listTrainers(),
    store.listOwners(),
  ])

  const trainerNames = new Map(trainers.map((trainer) => [trainer.id, trainer.name]))

  return (
    <main className="grid gap-8">
      <header className="min-w-0">
        <p className="text-caption uppercase tracking-caption text-low">Records</p>
        <h1 className="mt-1">Operator console</h1>
        <p className="mt-2 max-w-2xl text-body text-muted">
          Records → Listings → Sales. Every deal is assembled from these three record
          kinds, so they are the first thing to keep straight.
        </p>
      </header>

      <div className="grid min-w-0 gap-6 md:grid-cols-3">
        <IndexSection
          title="Horses"
          href="/horses"
          newHref="/horses/new"
          rows={horses.map((horse) => ({
            id: horse.id,
            primary: horse.legalName,
            secondary:
              horse.trainerId === null
                ? horse.slug
                : (trainerNames.get(horse.trainerId) ?? horse.slug),
          }))}
        />
        <IndexSection
          title="Trainers"
          href="/trainers"
          newHref="/trainers/new"
          rows={trainers.map((trainer) => ({
            id: trainer.id,
            primary: trainer.name,
            secondary: trainer.stable,
          }))}
        />
        <IndexSection
          title="Owners"
          href="/owners"
          newHref="/owners/new"
          rows={owners.map((owner) => ({
            id: owner.id,
            primary: owner.entity,
            secondary: owner.contact,
          }))}
        />
      </div>
    </main>
  )
}
