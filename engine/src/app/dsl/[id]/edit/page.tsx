/**
 * Edit one DSL. PLAN.md step 4.
 *
 * The same form as create, with the horse and the DSL already in place. The
 * engine refuses any status an unregistered horse may not hold, refuses a rename
 * onto a taken slug, and never resets the stake remaining.
 */

import Link from 'next/link'
import { notFound } from 'next/navigation'

import { DslForm } from '../../DslForm'
import { updateDslAction } from '../../actions'
import { loadDslView } from '../../data'

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

  return (
    <main>
      <h1>Edit {horse.legalName}</h1>
      <p>
        <Link href={`/dsl/${dsl.id}`}>Back to the DSL</Link>
      </p>

      <p>
        A rename changes the slug and the image folder, and a second horse holding that slug is
        refused. The stake remaining is left where the sales put it.
      </p>

      <DslForm
        action={updateDslAction}
        submitLabel="Save changes"
        dslId={dsl.id}
        error={error ?? null}
        defaults={{ horse, trainer: trainer ?? {}, owner: owner ?? {}, dsl }}
      />
    </main>
  )
}
