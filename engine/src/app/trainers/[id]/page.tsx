import Link from 'next/link'
import { notFound } from 'next/navigation'

import {
  Button,
  ErrorSlot,
  Field,
  FormShell,
  SummaryRow,
  TextInput,
} from '../../_components/forms'
import { ProfileFields } from '../../_components/ProfileFields'
import { TrainerNames } from '../../_components/TrainerNames'
import { updateTrainerAction } from '../../records/actions'
import { recordStore } from '../../records/store'

export const dynamic = 'force-dynamic'

/** A stored `A & B` name is edited as two boxes, which is how it was entered. */
function trainerNames(name: string): string[] {
  return name.split(/\s+&\s+/).filter((part) => part !== '')
}

function TextBlock({ value }: { value: string | null }) {
  return value === null ? (
    <p className="text-body text-low">—</p>
  ) : (
    <p className="whitespace-pre-wrap text-body">{value}</p>
  )
}

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ error?: string }>
}) {
  const { id } = await params
  const { error } = await searchParams
  const trainer = await recordStore().findTrainerById(id)

  if (trainer === null) notFound()

  return (
    <main className="grid gap-8">
      <header>
        <p className="text-caption uppercase tracking-caption text-low">
          <Link href="/trainers">Trainers</Link> / Profile
        </p>
        <h1 className="mt-1">{trainer.name}</h1>
      </header>

      <div className="grid gap-6 md:grid-cols-2">
        <section className="rounded-md border border-line bg-panel p-5">
          <h3 className="mb-3">Identity</h3>
          <dl className="grid gap-0">
            <SummaryRow label="Stable" value={trainer.stable} />
            <SummaryRow label="Location" value={trainer.location} />
            <SummaryRow
              label="Website"
              value={
                trainer.website === null ? (
                  '—'
                ) : (
                  <a href={trainer.website} rel="noreferrer">
                    {trainer.website}
                  </a>
                )
              }
            />
          </dl>
        </section>

        <section className="rounded-md border border-line bg-panel p-5">
          <h3 className="mb-3">Social</h3>
          <dl className="grid gap-0">
            <SummaryRow
              label="X / Twitter"
              value={trainer.xUrl === null ? '—' : <a href={trainer.xUrl}>{trainer.xUrl}</a>}
            />
            <SummaryRow
              label="Facebook"
              value={
                trainer.facebookUrl === null ? (
                  '—'
                ) : (
                  <a href={trainer.facebookUrl}>{trainer.facebookUrl}</a>
                )
              }
            />
            <SummaryRow
              label="Instagram"
              value={
                trainer.instagramUrl === null ? (
                  '—'
                ) : (
                  <a href={trainer.instagramUrl}>{trainer.instagramUrl}</a>
                )
              }
            />
          </dl>
        </section>
      </div>

      <section className="rounded-md border border-line bg-panel p-5">
        <h3 className="mb-3">Profile</h3>
        <TextBlock value={trainer.bio} />
      </section>

      <div className="grid gap-6 md:grid-cols-2">
        <section className="rounded-md border border-line bg-panel p-5">
          <h3 className="mb-3">Achievements</h3>
          <TextBlock value={trainer.achievements} />
        </section>
        <section className="rounded-md border border-line bg-panel p-5">
          <h3 className="mb-3">Other</h3>
          <TextBlock value={trainer.other} />
        </section>
      </div>

      <section className="rounded-md border border-line bg-panel p-5">
        <h3 className="mb-3">Links</h3>
        {trainer.links.length === 0 ? (
          <p className="text-body text-low">—</p>
        ) : (
          <ul className="grid gap-2">
            {trainer.links.map((link) => (
              <li key={`${link.label}-${link.url}`} className="flex flex-wrap gap-3 text-body">
                <span className="text-muted">{link.label}</span>
                <a href={link.url}>{link.url}</a>
              </li>
            ))}
          </ul>
        )}
      </section>

      <details className="rounded-md border border-line bg-panel p-5">
        <summary className="cursor-pointer text-caption uppercase tracking-caption text-muted">
          Edit trainer
        </summary>

        <FormShell className="mt-5">
          <ErrorSlot message={error ?? null} />

          <form action={updateTrainerAction} className="grid gap-8">
            <input type="hidden" name="id" value={trainer.id} />

            <div className="grid gap-4">
              <Field
                label="Company name"
                htmlFor="stable"
                help="The stable or business, for example Wexford Stables."
              >
                <TextInput
                  id="stable"
                  name="stable"
                  defaultValue={trainer.stable}
                  required
                />
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
      </details>
    </main>
  )
}
