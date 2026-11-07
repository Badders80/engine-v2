import Link from 'next/link'
import { notFound } from 'next/navigation'

import { updateOwnerAction } from '../../records/actions'
import { recordStore } from '../../records/store'

export const dynamic = 'force-dynamic'

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const owner = await recordStore().findOwnerById(id)

  if (owner === null) notFound()

  return (
    <main>
      <p className="mb-2 text-sm">
        <Link href="/owners" className="underline">
          Owners
        </Link>
      </p>
      <h1 className="mb-6 text-2xl">{owner.entity}</h1>

      <dl className="grid max-w-xl grid-cols-[8rem_1fr] gap-y-2">
        <dt className="opacity-60">Contact</dt>
        <dd>{owner.contact}</dd>
        <dt className="opacity-60">Website</dt>
        <dd>{owner.website ?? '—'}</dd>
        <dt className="opacity-60">Profile</dt>
        <dd className="whitespace-pre-wrap">{owner.profile ?? '—'}</dd>
      </dl>

      <details className="mt-8 max-w-xl">
        <summary className="cursor-pointer underline">Edit</summary>

        <form action={updateOwnerAction} className="mt-4 grid gap-4">
          <input type="hidden" name="id" value={owner.id} />

          <label className="grid gap-1">
            <span className="text-sm">Entity</span>
            <input name="entity" defaultValue={owner.entity} required className="border border-black/20 p-2" />
          </label>

          <label className="grid gap-1">
            <span className="text-sm">Contact person</span>
            <input name="contact" defaultValue={owner.contact} required className="border border-black/20 p-2" />
          </label>

          <label className="grid gap-1">
            <span className="text-sm">Website</span>
            <input
              name="website"
              type="url"
              defaultValue={owner.website ?? ''}
              className="border border-black/20 p-2"
            />
          </label>

          <label className="grid gap-1">
            <span className="text-sm">Profile</span>
            <textarea
              name="profile"
              rows={6}
              defaultValue={owner.profile ?? ''}
              className="border border-black/20 p-2"
            />
          </label>

          <button type="submit" className="justify-self-start border border-black/40 px-4 py-2">
            Save changes
          </button>
        </form>
      </details>
    </main>
  )
}
