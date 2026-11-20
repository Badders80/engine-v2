import Link from 'next/link'

import { loadLoveracingPage } from '@/lib/loveracingFetch'

import { Button, ErrorSlot } from '../../_components/forms'
import { createHorseAction } from '../../records/actions'
import { HorseForm } from '../_components/HorseForm'

export const dynamic = 'force-dynamic'

/**
 * Add a horse (U12). Horse only: identity, registration and the loveracing
 * load. No trainer and no owner — both are links on the deal and attach to the
 * DSL (R1). Confirm lands on the new profile; no DSL is created.
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

  const horse = loaded !== null && loaded.ok ? loaded.value.horse : null
  const raceRecordJson =
    loaded !== null && loaded.ok ? JSON.stringify(loaded.value.raceRecord, null, 2) : '{}'
  const raceSummary = loaded !== null && loaded.ok ? loaded.value.raceRecord.summary : null
  const pedigree = loaded !== null && loaded.ok ? loaded.value.pedigree : null
  const pedigreeJson = pedigree === null ? '' : JSON.stringify(pedigree)

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
          <div className="mt-4 grid gap-2 text-body text-muted">
            <p>
              Loaded {loaded.value.horse.legalName}, foaled {loaded.value.horse.foalingDate}, with
              a 15-node pedigree (1 horse, 2 parents, 4 grandparents, 8 great-grandparents).
              Correct anything that is wrong before saving.
            </p>
            {raceSummary === null ? null : (
              <p>
                NZTR race summary: {raceSummary.starts} starts, {raceSummary.wins} wins,{' '}
                {raceSummary.seconds} seconds, {raceSummary.thirds} thirds, $
                {raceSummary.stakesNzd.toLocaleString('en-NZ')} stakes. Runner-by-runner result
                lines are not imported yet.
              </p>
            )}
          </div>
        ) : null}

        {pedigree === null ? null : (
          <details className="mt-4 border-t border-line pt-4">
            <summary className="cursor-pointer text-caption uppercase tracking-caption text-muted">
              Review the pedigree snapshot
            </summary>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {[0, 1, 2, 3].map((generation) => (
                <div key={generation}>
                  <p className="text-caption uppercase tracking-caption text-low">
                    Generation {generation}
                  </p>
                  <ul className="mt-1 text-body text-muted">
                    {pedigree.nodes
                      .filter((node) => node.generation === generation)
                      .map((node) => (
                        <li key={node.path}>
                          {node.name} <span className="text-low">#{node.horseId}</span>
                        </li>
                      ))}
                  </ul>
                </div>
              ))}
            </div>
          </details>
        )}
      </section>

      <HorseForm
        action={createHorseAction}
        horse={horse}
        raceRecordJson={raceRecordJson}
        pedigreeJson={pedigreeJson}
        submitLabel="Save horse"
        error={params.error ?? null}
      />
    </main>
  )
}
