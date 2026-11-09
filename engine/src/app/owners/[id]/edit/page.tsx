import Link from 'next/link'
import { notFound } from 'next/navigation'

import {
  Button,
  ErrorSlot,
  Field,
  FormShell,
  TextInput,
} from '../../../_components/forms'
import { ProfileFields } from '../../../_components/ProfileFields'
import { updateOwnerAction } from '../../../records/actions'
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
  const owner = await recordStore().findOwnerById(id)

  if (owner === null) notFound()

  return (
    <main className="grid gap-8">
      <header>
        <p className="text-caption uppercase tracking-caption text-low">
          <Link href="/owners">Owners</Link> /{' '}
          <Link href={`/owners/${owner.id}`}>{owner.entity}</Link> / Edit
        </p>
        <h1 className="mt-1">Edit an owner</h1>
      </header>

      <FormShell>
        <ErrorSlot message={query.error ?? null} />

        <form action={updateOwnerAction} className="grid gap-8">
          <input type="hidden" name="id" value={owner.id} />

          <div className="grid gap-4">
            <Field label="Entity" htmlFor="entity">
              <TextInput id="entity" name="entity" defaultValue={owner.entity} required />
            </Field>
            <Field label="Contact person" htmlFor="contact">
              <TextInput id="contact" name="contact" defaultValue={owner.contact} required />
            </Field>
            <Field label="Website" htmlFor="website">
              <TextInput
                id="website"
                name="website"
                type="url"
                defaultValue={owner.website ?? ''}
              />
            </Field>
          </div>

          <ProfileFields
            profileName="profile"
            profileLabel="Profile"
            profileValue={owner.profile}
            defaults={owner}
          />

          <div>
            <Button type="submit" variant="primary">
              Save changes
            </Button>
          </div>
        </form>
      </FormShell>
    </main>
  )
}
