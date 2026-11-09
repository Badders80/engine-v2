/**
 * Edit one DSL. Chunk 2, ruling 11.
 *
 * The same form as create, with the horse, the parties and the DSL already in
 * place. Records owns the entities; this page writes one `dsls` row.
 */

import Link from 'next/link'
import { notFound } from 'next/navigation'

import { DslForm } from '../../DslForm'
import { updateDslAction } from '../../actions'
import { loadDslView } from '../../data'
import { recordStore } from '../../../records/store'

export const dynamic = 'force-dynamic'

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ error?: string }>
}) {
  const { id } = await params
  const { error } = await searchParams

  const view = await loadDslView(id)

  if (!view.ok) {
    return (
      <main>
        <h1>Edit DSL</h1>
        <p role="alert">{view.reason}</p>
        <p>
          <Link href="/dsl/new">New DSL</Link>
        </p>
      </main>
    )
  }

  if (!view.found) notFound()

  const { dsl, horse, trainer, owner } = view

  const store = recordStore()
  const [horses, trainers, owners] = await Promise.all([
    store.listHorses(),
    store.listPartiesByRole('trainer'),
    store.listPartiesByRole('owner'),
  ])

  return (
    <main>
      <h1>Edit {horse.legalName}</h1>
      <p>
        <Link href={`/dsl/${dsl.id}`}>Back to the DSL</Link>
      </p>

      <p>
        The horse and the parties are edited in Records; this page only links them. The
        stake remaining is left where the sales put it.
      </p>

      <DslForm
        action={updateDslAction}
        submitLabel="Save changes"
        dslId={dsl.id}
        error={error ?? null}
        defaults={{ dsl }}
        horseOptions={horses.map((h) => ({
          id: h.id,
          legalName: h.legalName,
          slug: h.slug,
        }))}
        trainerOptions={trainers.map((t) => ({
          id: t.id,
          displayName: t.displayName,
          company: t.company,
        }))}
        ownerOptions={owners.map((o) => ({ id: o.id, displayName: o.displayName }))}
        currentHorseId={horse.id}
        currentTrainerId={dsl.trainerId ?? trainer?.id ?? null}
        currentOwnerId={dsl.ownerId ?? owner?.id ?? null}
      />
    </main>
  )
}
