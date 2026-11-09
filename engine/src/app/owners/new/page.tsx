import Link from 'next/link'

import { PartyForm } from '../../_components/PartyForm'
import { createPartyAction } from '../../records/actions'

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams

  return (
    <main className="grid gap-8">
      <header>
        <p className="text-caption uppercase tracking-caption text-low">
          <Link href="/owners">Owners</Link> / New
        </p>
        <h1 className="mt-1">New owner</h1>
      </header>

      <PartyForm
        action={createPartyAction}
        mode="owner"
        submitLabel="Save owner"
        error={error ?? null}
      />
    </main>
  )
}
