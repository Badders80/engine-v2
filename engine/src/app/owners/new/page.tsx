import Link from 'next/link'

import { createOwnerAction } from '../../records/actions'

export default function Page() {
  return (
    <main>
      <p className="mb-2 text-sm">
        <Link href="/owners" className="underline">
          Owners
        </Link>
      </p>
      <h1 className="mb-6 text-2xl">New owner</h1>

      <form action={createOwnerAction} className="grid max-w-xl gap-4">
        <label className="grid gap-1">
          <span className="text-sm">Entity</span>
          <input name="entity" required className="border border-black/20 p-2" />
        </label>

        <label className="grid gap-1">
          <span className="text-sm">Contact person</span>
          <input name="contact" required className="border border-black/20 p-2" />
        </label>

        <label className="grid gap-1">
          <span className="text-sm">Website</span>
          <input name="website" type="url" className="border border-black/20 p-2" />
        </label>

        <label className="grid gap-1">
          <span className="text-sm">Profile</span>
          <textarea name="profile" rows={6} className="border border-black/20 p-2" />
        </label>

        <button type="submit" className="justify-self-start border border-black/40 px-4 py-2">
          Save owner
        </button>
      </form>
    </main>
  )
}
