import Link from 'next/link'
import { notFound } from 'next/navigation'

import { updateHorseAction } from '../../../records/actions'
import { recordStore } from '../../../records/store'
import { HorseForm } from '../../_components/HorseForm'

export const dynamic = 'force-dynamic'

/** Edit a horse (1c). The trainer and barn name are authored here, per ruling 15. */
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ error?: string }>
}) {
  const [{ id }, query] = await Promise.all([params, searchParams])
  const store = recordStore()

  const horse = await store.findHorseById(id)
  if (horse === null) notFound()

  const trainers = await store.listTrainers()

  return (
    <main className="grid gap-8">
      <header>
        <p className="text-caption uppercase tracking-caption text-low">
          <Link href="/horses">Horses</Link> / <Link href={`/horses/${horse.id}`}>{horse.legalName}</Link> /
          Edit
        </p>
        <h1 className="mt-1">Edit a horse</h1>
        <p className="mt-2 max-w-2xl text-body text-muted">
          The slug is the official name and does not change here — a rename is a migration,
          not an edit.
        </p>
      </header>

      <HorseForm
        action={updateHorseAction}
        trainers={trainers}
        horse={horse}
        horseId={horse.id}
        raceRecordJson={JSON.stringify(horse.raceRecord, null, 2)}
        submitLabel="Save changes"
        error={query.error ?? null}
      />
    </main>
  )
}
