import Link from 'next/link'

import { loadLoveracingPage } from '@/lib/loveracingFetch'

import { Button, ErrorSlot } from '../../_components/forms'
import { createHorseAction } from '../../records/actions'
import { recordStore } from '../../records/store'
import { HorseForm } from '../_components/HorseForm'

export const dynamic = 'force-dynamic'

/**
 * Add a horse (U12). Horse only: identity, registration, the loveracing load,
 * and an optional current trainer picked from the existing rows. No owner — an
 * owner is a party to a deal and attaches to the DSL. Confirm lands on the new
 * profile; no DSL is created.
 *
 * The fields themselves live in `HorseForm`, shared with the edit page so the
 * two can never drift.
 */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ loveracing?: string; error?: string }>
}) {
  const params = await searchParams
  const link = (params.loveracing ?? '').trim()
  const loaded = link === '' ? null : await loadLoveracingPage(link)

  const trainers = await recordStore().listTrainers()
  const horse = loaded !== null && loaded.ok ? loaded.value.horse : null
  const raceRecordJson =
    loaded !== null && loaded.ok ? JSON.stringify(loaded.value.raceRecord, null, 2) : '{}'

  return (
    <main className="grid gap-8">
      <header>
        <p className="text-caption uppercase tracking-caption text-low">
          <Link href="/horses">Horses</Link> / New
        </p>
        <h1 className="mt-1">Add a horse</h1>
        <p className="mt-2 max-w-2xl text-body text-muted">
          The horse is the record. Its owner is a party to a deal and is attached to the
          DSL later, so nothing here creates a listing.
        </p>
      </header>

      <section className="rounded-md border border-line bg-panel p-5">
        <h3 className="mb-3">Start from a loveracing.nz link</h3>
        <form method="get" className="flex flex-wrap items-end gap-3">
          <label className="grid min-w-64 flex-1 gap-1">
            <span className="text-caption uppercase tracking-caption text-muted">
              loveracing.nz link
            </span>
            <input
              type="url"
              name="loveracing"
              defaultValue={link}
              placeholder="https://loveracing.nz/..."
            />
          </label>
          <Button type="submit">Load</Button>
        </form>

        {loaded !== null && !loaded.ok ? (
          <div className="mt-4">
            <ErrorSlot message={loaded.reason} />
          </div>
        ) : null}

        {loaded !== null && loaded.ok ? (
          <p className="mt-4 text-body text-muted">
            Loaded {loaded.value.horse.legalName}, foaled {loaded.value.horse.foalingDate}.
            Correct anything that is wrong before saving.
          </p>
        ) : null}
      </section>

      <HorseForm
        action={createHorseAction}
        trainers={trainers}
        horse={horse}
        raceRecordJson={raceRecordJson}
        submitLabel="Save horse"
        error={params.error ?? null}
      />
    </main>
  )
}
