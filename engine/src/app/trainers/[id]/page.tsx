import Link from 'next/link'
import { notFound } from 'next/navigation'

import { socialHandle } from '@/lib/social'

import { SummaryRow } from '../../_components/forms'
import { recordStore } from '../../records/store'

export const dynamic = 'force-dynamic'

function TextBlock({ value }: { value: string | null }) {
  return value === null ? (
    <p className="text-body text-low">—</p>
  ) : (
    <p className="whitespace-pre-wrap text-body">{value}</p>
  )
}

function SocialRow({ label, url }: { label: string; url: string | null }) {
  return (
    <SummaryRow
      label={label}
      value={
        url === null ? '—' : (
          <a href={url} title={url}>
            {socialHandle(url)}
          </a>
        )
      }
    />
  )
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const party = await recordStore().findPartyById(id)

  if (party === null || !party.roles.includes('trainer')) notFound()

  return (
    <main className="grid gap-8">
      <header>
        <p className="text-caption uppercase tracking-caption text-low">
          <Link href="/trainers">Trainers</Link> / Profile
        </p>
        <div className="mt-1 flex flex-wrap items-baseline justify-between gap-3">
          <h1>{party.displayName}</h1>
          <Link
            href={`/trainers/${party.id}/edit`}
            className="rounded-sm border border-line px-3 py-1 text-caption uppercase tracking-caption text-body"
          >
            Edit
          </Link>
        </div>
      </header>

      <div className="grid gap-6 md:grid-cols-2">
        <section className="rounded-md border border-line bg-panel p-5">
          <h3 className="mb-3">Trainer</h3>
          <dl className="grid gap-0">
            <SummaryRow label="Company / stable" value={party.company ?? '—'} />
            <SummaryRow label="Location" value={party.location ?? '—'} />
            <SummaryRow
              label="Website"
              value={
                party.website === null ? (
                  '—'
                ) : (
                  <a href={party.website} className="break-all">
                    {party.website}
                  </a>
                )
              }
            />
          </dl>
        </section>

        <section className="rounded-md border border-line bg-panel p-5">
          <h3 className="mb-3">Social</h3>
          <dl className="grid gap-0">
            <SocialRow label="X / Twitter" url={party.xUrl} />
            <SocialRow label="Facebook" url={party.facebookUrl} />
            <SocialRow label="Instagram" url={party.instagramUrl} />
          </dl>
        </section>
      </div>

      <section className="rounded-md border border-line bg-panel p-5">
        <h3 className="mb-3">Profile</h3>
        <TextBlock value={party.bio} />
      </section>

      <div className="grid gap-6 md:grid-cols-2">
        <section className="rounded-md border border-line bg-panel p-5">
          <h3 className="mb-3">Achievements</h3>
          <TextBlock value={party.achievements} />
        </section>
        <section className="rounded-md border border-line bg-panel p-5">
          <h3 className="mb-3">Other</h3>
          <TextBlock value={party.other} />
        </section>
      </div>

      <section className="rounded-md border border-line bg-panel p-5">
        <h3 className="mb-3">Links</h3>
        {party.links.length === 0 ? (
          <p className="text-body text-low">—</p>
        ) : (
          <ul className="grid gap-2">
            {party.links.map((link) => (
              <li key={`${link.label}-${link.url}`}>
                <a href={link.url} className="break-all">
                  {link.url}
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  )
}
