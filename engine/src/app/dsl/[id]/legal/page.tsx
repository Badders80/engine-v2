/**
 * The legal preview. PLAN.md step 7.
 *
 * This is the compiler's production call site: a server page that loads one
 * DSL, compiles the PDS and the SA from the locked templates, and shows both
 * documents with their hashes.
 *
 * It is a preview only. It writes no sale row, stores no document, and creates
 * no PDF. Step 8 replaces the stake, buyer, and date inputs with the real
 * account and the sale write.
 */

import Link from 'next/link'
import { notFound } from 'next/navigation'

import { compileLegalPack, type LegalPack } from '@/lib/legal/compile'
import { validateStake } from '@/lib/pricing'

import { loadDslView } from '../../data'

type StakeCheck = { ok: true; stake: number } | { ok: false; reason: string }

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

  const stakeRaw =
    typeof query.stake === 'string' && query.stake !== '' ? query.stake : String(dsl.minStake)
  const buyer =
    typeof query.buyer === 'string' && query.buyer !== '' ? query.buyer : 'Preview'
  const date =
    typeof query.date === 'string' && query.date !== ''
      ? query.date
      : new Date().toISOString().slice(0, 10)

  let pack: LegalPack | null = null
  let error: string | null = null

  if (trainer === null) {
    error = 'this horse has no trainer row, so the documents cannot be compiled'
  } else if (owner === null) {
    error = 'this horse has no owner row, so the documents cannot be compiled'
  } else {
    const checked = parseStake(stakeRaw, dsl.minStake, dsl.stakeRemaining, dsl.step)
    if (!checked.ok) {
      error = checked.reason
    } else {
      try {
        pack = compileLegalPack({
          account: { fullName: buyer },
          dsl,
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
      <h1>Legal preview</h1>
      <p>
        <Link href={`/dsl/${id}`}>Back to the DSL</Link> · Preview only. No sale row is written
        and no document is stored.
      </p>

      {error !== null ? <p role="alert">{error}</p> : null}

      <form method="get">
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
