/**
 * The legal preview. PLAN.md step 7; chunk 3, U10.
 *
 * This is the compiler's production call site: a server page that loads one
 * DSL, compiles the PDS and the SA from the locked templates, and shows both
 * documents with their hashes.
 *
 * Chunk 3 additions: the **DRAFT — not executed** banner, and the blocking
 * list on refusal. A chunk-3 deal stores no start (the sale stamps it), so the
 * draft is compiled against the current month's first day, clearly labelled as
 * a preview of what the buyer would receive.
 *
 * It is a preview only. It writes no sale row, stores no document, and creates
 * no PDF.
 */

import Link from 'next/link'
import { notFound } from 'next/navigation'

import { compileLegalPack, type LegalPack } from '@/lib/legal/compile'
import { isPricedDsl } from '@/lib/dslStore'
import { resolveNarrative } from '@/lib/narrative'
import { validateStake } from '@/lib/pricing'
import { currentMonthKey, firstDayOfMonthKey } from '@/lib/term'

import { loadDslView } from '../../data'

type StakeCheck = { ok: true; stake: number } | { ok: false; reason: string }

function present(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.trim() !== ''
}

function parseStake(raw: string, minStake: number, remaining: number, step: number): StakeCheck {
  const stake = Number(raw)

  if (!Number.isFinite(stake) || stake <= 0) {
    return { ok: false, reason: `stake '${raw}' is not a positive number` }
  }
  if (stake < minStake) {
    return { ok: false, reason: `stake ${stake} is below the minimum of ${minStake}` }
  }
  if (stake > remaining) {
    return { ok: false, reason: `stake ${stake} is above the remaining ${remaining}` }
  }

  try {
    validateStake(stake, step)
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : 'invalid stake' }
  }

  return { ok: true, stake }
}

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ stake?: string; buyer?: string; date?: string }>
}) {
  const { id } = await params
  const query = await searchParams
  const view = await loadDslView(id)

  if (!view.ok) {
    return (
      <main>
        <h1>Legal preview</h1>
        <p role="alert">{view.reason}</p>
        <p>
          <Link href="/dsl/new">New DSL</Link>
        </p>
      </main>
    )
  }

  if (!view.found) notFound()

  const { dsl, horse, trainer, owner } = view
  const resolved = resolveNarrative(horse, dsl, trainer)

  // Chunk 3 stores the expiry and no start. The draft prices the remaining
  // months from today, using the current month's first day. The sale (chunk 4)
  // stamps the buyer's real start and re-compiles with it.
  const previewStart = dsl.termStart ?? firstDayOfMonthKey(currentMonthKey())
  const previewDsl =
    previewStart === null || previewStart === dsl.termStart
      ? dsl
      : { ...dsl, termStart: previewStart }

  const blocking: string[] = []
  const add = (missing: boolean, label: string) => {
    if (missing) blocking.push(label)
  }

  add(owner === null, 'the owner on the term sheet')
  add(trainer === null, 'the trainer on the term sheet')
  add(dsl.endDate === null, 'the expiry')
  add(dsl.paymentModel === null, 'the payment model')
  add(dsl.closeStyle === null, 'the close style')
  add(dsl.wholesaleMonthlyPerPercent === null, 'the wholesale cost per 1%')
  add(dsl.investorSplit === null, "the investor's split")
  add(dsl.listedStake === null, 'the listed stake')
  add(dsl.minStake === null, 'the minimum stake')
  add(dsl.step === null, 'the stake step')
  add(!present(dsl.distributionSchedule), 'the distribution schedule')
  add(!present(resolved['horse.about_horse'].text), 'the about-the-horse paragraph')
  add(
    !present(resolved['horse.racing_outlook_and_pedigree'].text),
    'the racing outlook and pedigree paragraph',
  )
  add(!present(resolved['horse.race_expectation'].text), 'the race expectation paragraph')
  add(!present(resolved['trainer.bio'].text), "the trainer's bio")

  const stakeRaw =
    typeof query.stake === 'string' && query.stake !== ''
      ? query.stake
      : String(dsl.minStake ?? '')
  const buyer =
    typeof query.buyer === 'string' && query.buyer !== '' ? query.buyer : 'Preview'
  const date =
    typeof query.date === 'string' && query.date !== ''
      ? query.date
      : new Date().toISOString().slice(0, 10)

  let pack: LegalPack | null = null
  let error: string | null = null

  if (blocking.length > 0) {
    error = 'the documents are blocked until the fields below are filled in'
  } else if (!isPricedDsl(previewDsl)) {
    error = 'this listing does not have its commercial terms yet, so the documents cannot be compiled'
  } else if (trainer === null) {
    error = 'this horse has no trainer row, so the documents cannot be compiled'
  } else if (owner === null) {
    error = 'this horse has no owner row, so the documents cannot be compiled'
  } else {
    const checked = parseStake(stakeRaw, previewDsl.minStake, previewDsl.stakeRemaining, previewDsl.step)
    if (!checked.ok) {
      error = checked.reason
    } else {
      try {
        pack = compileLegalPack({
          account: { fullName: buyer },
          dsl: previewDsl,
          horse,
          trainer,
          owner,
          sale: { stake: checked.stake, executedDate: date },
        })
      } catch (caught) {
        error = caught instanceof Error ? caught.message : 'the compile failed'
      }
    }
  }

  return (
    <main>
      <p
        role="note"
        className="rounded-sm border border-line-strong bg-panel px-4 py-3 text-body"
      >
        <strong>DRAFT — not executed.</strong> This preview is compiled from the deal as it
        stands now. No sale row is written and no document is stored.
      </p>

      <h1 className="mt-4">Legal preview</h1>
      <p>
        <Link href={`/dsl/${id}`}>Back to the DSL</Link> · Expiry{' '}
        {dsl.endDate ?? '—'} · Draft start {previewDsl.termStart ?? '—'}
      </p>

      {blocking.length > 0 ? (
        <section className="mt-4 rounded-sm border border-line-strong bg-panel p-4">
          <h2 className="mb-2">Still needed</h2>
          <ul className="grid list-disc gap-1 pl-5 text-body">
            {blocking.map((field) => (
              <li key={field}>{field}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {error !== null ? <p role="alert">{error}</p> : null}

      <form method="get" className="mt-4 grid gap-3">
        <label>
          Stake %
          <input name="stake" defaultValue={stakeRaw} />
        </label>
        <label>
          Buyer name
          <input name="buyer" defaultValue={buyer} />
        </label>
        <label>
          Execution date
          <input type="date" name="date" defaultValue={date} />
        </label>
        <button type="submit">Compile</button>
      </form>

      {pack === null ? null : (
        <>
          <h2>Product Disclosure Statement</h2>
          <p>SHA-256 {pack.pds.hash}</p>
          <pre>{pack.pds.markdown}</pre>

          <h2>Syndicate Agreement</h2>
          <p>SHA-256 {pack.sa.hash}</p>
          <pre>{pack.sa.markdown}</pre>
        </>
      )}
    </main>
  )
}
