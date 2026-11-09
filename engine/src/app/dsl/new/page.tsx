/**
 * Create a DSL. Chunk 2, ruling 11.
 *
 * The horse, the trainer and the owner are Records. This page links them by
 * id and writes the deal. The horse is created on `/horses/new`; the DSL form
 * no longer authors one.
 */

import Link from 'next/link'

import { recordStore } from '../../records/store'
import { DslForm, type DslFormDefaults } from '../DslForm'
import { createDslAction } from '../actions'

export const dynamic = 'force-dynamic'

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const params = await searchParams
  const store = recordStore()
  const [horses, trainers, owners] = await Promise.all([
    store.listHorses(),
    store.listPartiesByRole('trainer'),
    store.listPartiesByRole('owner'),
  ])

  const defaults: DslFormDefaults = {}

  return (
    <main>
      <h1>New DSL</h1>
      <p>
        <Link href="/">Back</Link>
      </p>

      <p>
        A DSL links records that already exist. Add the horse on{' '}
        <Link href="/horses/new">/horses/new</Link> first; add the trainer and the owner on
        their Records pages. Nothing here authors one.
      </p>

      <DslForm
        action={createDslAction}
        submitLabel="Save the DSL"
        defaults={defaults}
        error={params.error ?? null}
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
      />
    </main>
  )
}
