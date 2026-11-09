import Link from 'next/link'
import { notFound } from 'next/navigation'

import {
  Button,
  ErrorSlot,
  Field,
  FieldGroup,
  FormShell,
  SummaryRow,
  TextInput,
} from '../../_components/forms'
import { ProfileFields } from '../../_components/ProfileFields'
import { updateOwnerAction } from '../../records/actions'
import { recordStore } from '../../records/store'

export const dynamic = 'force-dynamic'

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
  const owner = await recordStore().findOwnerById(id)

  if (owner === null) notFound()

  return (
    <main className="grid gap-8">
      <header>
        <p className="text-caption uppercase tracking-caption text-low">
          <Link href="/owners">Owners</Link> / Profile
        </p>
        <h1 className="mt-1">{owner.entity}</h1>
      </header>

      <div className="grid gap-6 md:grid-cols-2">
        <section className="rounded-md border border-line bg-panel p-5">
          <h3 className="mb-3">Identity</h3>
          <dl className="grid gap-0">
            <SummaryRow label="Contact" value={owner.contact} />
            <SummaryRow
              label="Website"
              value={
                owner.website === null ? '—' : <a href={owner.website}>{owner.website}</a>
              }
            />
          </dl>
        </section>

        <section className="rounded-md border border-line bg-panel p-5">
          <h3 className="mb-3">Social</h3>
          <dl className="grid gap-0">
            <SummaryRow
              label="X / Twitter"
              value={owner.xUrl === null ? '—' : <a href={owner.xUrl}>{owner.xUrl}</a>}
            />
            <SummaryRow
              label="Facebook"
              value={
                owner.facebookUrl === null ? '—' : (
                  <a href={owner.facebookUrl}>{owner.facebookUrl}</a>
                )
              }
            />
            <SummaryRow
              label="Instagram"
              value={
                owner.instagramUrl === null ? '—' : (
                  <a href={owner.instagramUrl}>{owner.instagramUrl}</a>
                )
              }
            />
          </dl>
        </section>
      </div>

      <section className="rounded-md border border-line bg-panel p-5">
        <h3 className="mb-3">Profile</h3>
        <TextBlock value={owner.profile} />
      </section>

      <div className="grid gap-6 md:grid-cols-2">
        <section className="rounded-md border border-line bg-panel p-5">
          <h3 className="mb-3">Achievements</h3>
          <TextBlock value={owner.achievements} />
        </section>
        <section className="rounded-md border border-line bg-panel p-5">
          <h3 className="mb-3">Other</h3>
          <TextBlock value={owner.other} />
        </section>
      </div>

      <section className="rounded-md border border-line bg-panel p-5">
        <h3 className="mb-3">Links</h3>
        {owner.links.length === 0 ? (
          <p className="text-body text-low">—</p>
        ) : (
          <ul className="grid gap-2">
            {owner.links.map((link) => (
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
          Edit owner
        </summary>

        <FormShell className="mt-5">
          <ErrorSlot message={error ?? null} />

          <form action={updateOwnerAction} className="grid gap-8">
            <input type="hidden" name="id" value={owner.id} />

            <FieldGroup legend="Identity">
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
            </FieldGroup>

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
      </details>
    </main>
  )
}
