import Link from 'next/link'
import { notFound } from 'next/navigation'

import { updateTrainerAction } from '../../records/actions'
import { recordStore } from '../../records/store'

export const dynamic = 'force-dynamic'

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const trainer = await recordStore().findTrainerById(id)

  if (trainer === null) notFound()

  return (
    <main>
      <p className="mb-2 text-sm">
        <Link href="/trainers" className="underline">
          Trainers
        </Link>
      </p>
      <h1 className="mb-6 text-2xl">{trainer.name}</h1>

      <dl className="grid max-w-xl grid-cols-[8rem_1fr] gap-y-2">
        <dt className="opacity-60">Stable</dt>
        <dd>{trainer.stable}</dd>
        <dt className="opacity-60">Location</dt>
        <dd>{trainer.location}</dd>
        <dt className="opacity-60">Website</dt>
        <dd>{trainer.website ?? '—'}</dd>
        <dt className="opacity-60">Bio</dt>
        <dd className="whitespace-pre-wrap">{trainer.bio ?? '—'}</dd>
      </dl>

      <details className="mt-8 max-w-xl">
        <summary className="cursor-pointer underline">Edit</summary>

        <form action={updateTrainerAction} className="mt-4 grid gap-4">
          <input type="hidden" name="id" value={trainer.id} />

          <label className="grid gap-1">
            <span className="text-sm">Name</span>
            <input name="name" defaultValue={trainer.name} required className="border border-black/20 p-2" />
          </label>

          <label className="grid gap-1">
            <span className="text-sm">Stable</span>
            <input
              name="stable"
              defaultValue={trainer.stable}
              required
              className="border border-black/20 p-2"
            />
          </label>

          <label className="grid gap-1">
            <span className="text-sm">Location</span>
            <input
              name="location"
              defaultValue={trainer.location}
              required
              className="border border-black/20 p-2"
            />
          </label>

          <label className="grid gap-1">
            <span className="text-sm">Website</span>
            <input
              name="website"
              type="url"
              defaultValue={trainer.website ?? ''}
              className="border border-black/20 p-2"
            />
          </label>

          <label className="grid gap-1">
            <span className="text-sm">Bio</span>
            <textarea
              name="bio"
              rows={6}
              defaultValue={trainer.bio ?? ''}
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
