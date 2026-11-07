import Link from 'next/link'

import { createTrainerAction } from '../../records/actions'

export default function Page() {
  return (
    <main>
      <p className="mb-2 text-sm">
        <Link href="/trainers" className="underline">
          Trainers
        </Link>
      </p>
      <h1 className="mb-6 text-2xl">New trainer</h1>

      <form action={createTrainerAction} className="grid max-w-xl gap-4">
        <label className="grid gap-1">
          <span className="text-sm">Name</span>
          <input name="name" required className="border border-black/20 p-2" />
        </label>

        <label className="grid gap-1">
          <span className="text-sm">Stable</span>
          <input name="stable" required className="border border-black/20 p-2" />
        </label>

        <label className="grid gap-1">
          <span className="text-sm">Location</span>
          <input name="location" required className="border border-black/20 p-2" />
        </label>

        <label className="grid gap-1">
          <span className="text-sm">Website</span>
          <input name="website" type="url" className="border border-black/20 p-2" />
        </label>

        <label className="grid gap-1">
          <span className="text-sm">Bio</span>
          <textarea name="bio" rows={6} className="border border-black/20 p-2" />
        </label>

        <button type="submit" className="justify-self-start border border-black/40 px-4 py-2">
          Save trainer
        </button>
      </form>
    </main>
  )
}
