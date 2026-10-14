/**
 * Create a DSL. PLAN.md step 4.
 *
 * The registered path starts here: paste the loveracing.nz link, press Load, and
 * the page comes back with the fields it found and the race record it will store
 * as one blob. The operator confirms or edits them, fills the soft slots by
 * hand, and saves. The unregistered path is the same form with nothing loaded.
 */

import Link from 'next/link'

import { loadLoveracingPage } from '@/lib/loveracingFetch'

import { DslForm, type DslFormDefaults } from '../DslForm'
import { createDslAction } from '../actions'

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ loveracing?: string; error?: string }>
}) {
  const params = await searchParams
  const link = (params.loveracing ?? '').trim()

  const loaded = link === '' ? null : await loadLoveracingPage(link)

  const defaults: DslFormDefaults =
    loaded !== null && loaded.ok
      ? { horse: { ...loaded.value.horse, raceRecord: loaded.value.raceRecord } }
      : {}

  return (
    <main>
      <h1>New DSL</h1>
      <p>
        <Link href="/">Back</Link>
      </p>

      <section>
        <h2>Start from a loveracing.nz link</h2>
        <form method="get">
          <label>
            loveracing.nz link
            <input
              type="url"
              name="loveracing"
              defaultValue={link}
              placeholder="https://loveracing.nz/..."
            />
          </label>
          <button type="submit">Load</button>
        </form>

        {loaded !== null && !loaded.ok ? <p role="alert">{loaded.reason}</p> : null}

        {loaded !== null && loaded.ok ? (
          <div>
            <h3>Loaded, waiting for your confirmation</h3>
            <p>
              {loaded.value.horse.legalName}, foaled {loaded.value.horse.foalingDate}. The
              fields below are filled in from the page. Correct anything that is wrong. The
              race record is stored as one blob.
            </p>
            <pre>{JSON.stringify(loaded.value.raceRecord, null, 2)}</pre>
          </div>
        ) : null}
      </section>

      <section>
        <h2>Type the horse in by hand</h2>
        <p>
          An unregistered horse is typed here, with its sire and dam entered by hand. It saves
          at Coming Soon and no further until it is registered.
        </p>

        <DslForm
          action={createDslAction}
          submitLabel="Save the DSL"
          defaults={defaults}
          error={params.error ?? null}
        />
      </section>
    </main>
  )
}
