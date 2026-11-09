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
import { createTrainerAction } from '../../records/actions'

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
          <Link href="/trainers">Trainers</Link> / New
        </p>
        <h1 className="mt-1">New trainer</h1>
      </header>

      <FormShell>
        <ErrorSlot message={error ?? null} />

        <form action={createTrainerAction} className="grid gap-8">
          <FieldGroup legend="Identity">
            <Field label="Name" htmlFor="name">
              <TextInput id="name" name="name" required />
            </Field>
            <Field label="Stable" htmlFor="stable">
              <TextInput id="stable" name="stable" required />
            </Field>
            <Field label="Location" htmlFor="location">
              <TextInput id="location" name="location" required />
            </Field>
            <Field label="Website" htmlFor="website">
              <TextInput id="website" name="website" type="url" />
            </Field>
          </FieldGroup>

          <ProfileFields
            profileName="bio"
            profileLabel="Profile"
            profileHelp="The bio the PDS reads. Blank a bio only while no Available DSL depends on it."
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
              Save trainer
            </Button>
          </div>
        </form>
      </FormShell>
    </main>
  )
}
