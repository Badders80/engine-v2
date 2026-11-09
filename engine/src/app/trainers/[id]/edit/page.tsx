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
import { TrainerNames } from '../../../_components/TrainerNames'
import { updateTrainerAction } from '../../../records/actions'
import { recordStore } from '../../../records/store'

export const dynamic = 'force-dynamic'

/** A stored `A & B` name is edited as two boxes, which is how it was entered. */
function trainerNames(name: string): string[] {
  return name.split(/\s+&\s+/).filter((part) => part !== '')
}

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ error?: string }>
}) {
  const [{ id }, query] = await Promise.all([params, searchParams])
  const trainer = await recordStore().findTrainerById(id)

  if (trainer === null) notFound()

  return (
    <main className="grid gap-8">
      <header>
        <p className="text-caption uppercase tracking-caption text-low">
          <Link href="/trainers">Trainers</Link> /{' '}
          <Link href={`/trainers/${trainer.id}`}>{trainer.name}</Link> / Edit
        </p>
        <h1 className="mt-1">Edit a trainer</h1>
      </header>

      <FormShell>
        <ErrorSlot message={query.error ?? null} />

        <form action={updateTrainerAction} className="grid gap-8">
          <input type="hidden" name="id" value={trainer.id} />

          <div className="grid gap-4">
            <Field
              label="Company name"
              htmlFor="stable"
              help="The stable or business, for example Wexford Stables."
            >
              <TextInput id="stable" name="stable" defaultValue={trainer.stable} required />
            </Field>

            <TrainerNames defaultNames={trainerNames(trainer.name)} />

            <Field label="Location" htmlFor="location">
              <TextInput
                id="location"
                name="location"
                defaultValue={trainer.location}
                required
              />
            </Field>
            <Field label="Website" htmlFor="website">
              <TextInput
                id="website"
                name="website"
                type="url"
                defaultValue={trainer.website ?? ''}
              />
            </Field>
          </div>

          <ProfileFields
            profileName="bio"
            profileLabel="Profile"
            profileHelp="The bio the PDS reads. Blank a bio only while no Available DSL depends on it."
            profileValue={trainer.bio}
            defaults={trainer}
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
