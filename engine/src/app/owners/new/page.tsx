import Link from 'next/link'

import {
  Button,
  ErrorSlot,
  Field,
  FieldGroup,
  FormShell,
  TextInput,
} from '../../_components/forms'
import { ProfileFields } from '../../_components/ProfileFields'
import { createOwnerAction } from '../../records/actions'

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

      <FormShell>
        <ErrorSlot message={error ?? null} />

        <form action={createOwnerAction} className="grid gap-8">
          <FieldGroup legend="Identity">
            <Field label="Entity" htmlFor="entity">
              <TextInput id="entity" name="entity" required />
            </Field>
            <Field label="Contact person" htmlFor="contact">
              <TextInput id="contact" name="contact" required />
            </Field>
            <Field label="Website" htmlFor="website">
              <TextInput id="website" name="website" type="url" />
            </Field>
          </FieldGroup>

          <ProfileFields
            profileName="profile"
            profileLabel="Profile"
            profileValue={null}
            defaults={{
              achievements: null,
              other: null,
              xUrl: null,
              facebookUrl: null,
              instagramUrl: null,
              links: [],
            }}
          />

          <div>
            <Button type="submit" variant="primary">
              Save owner
            </Button>
          </div>
        </form>
      </FormShell>
    </main>
  )
}
