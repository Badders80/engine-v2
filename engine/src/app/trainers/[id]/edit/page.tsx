import Link from 'next/link'
import { notFound } from 'next/navigation'

import { PartyForm } from '../../../_components/PartyForm'
import { updatePartyAction } from '../../../records/actions'
import { recordStore } from '../../../records/store'

export const dynamic = 'force-dynamic'

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ error?: string }>
}) {
  const [{ id }, query] = await Promise.all([params, searchParams])
  const party = await recordStore().findPartyById(id)

  if (party === null || !party.roles.includes('trainer')) notFound()

  return (
    <main className="grid gap-8">
      <header>
        <p className="text-caption uppercase tracking-caption text-low">
          <Link href="/trainers">Trainers</Link> /{' '}
          <Link href={`/trainers/${party.id}`}>{party.displayName}</Link> / Edit
        </p>
        <h1 className="mt-1">Edit a trainer</h1>
      </header>

      <PartyForm
        action={updatePartyAction}
        mode="trainer"
        party={party}
        submitLabel="Save changes"
        error={query.error ?? null}
      />
    </main>
  )
}
