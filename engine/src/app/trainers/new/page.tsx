import Link from 'next/link'

import {
  Button,
  ErrorSlot,
  Field,
  FormShell,
  TextInput,
} from '../../_components/forms'
import { ProfileFields } from '../../_components/ProfileFields'
import { TrainerNames } from '../../_components/TrainerNames'
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
          <div className="grid gap-4">
            <Field
              label="Company name"
              htmlFor="stable"
              help="The stable or business, for example Wexford Stables."
            >
              <TextInput id="stable" name="stable" required />
            </Field>

            <TrainerNames defaultNames={[]} />

            <Field label="Location" htmlFor="location">
              <TextInput id="location" name="location" required />
            </Field>
            <Field label="Website" htmlFor="website">
              <TextInput id="website" name="website" type="url" />
            </Field>
          </div>

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
