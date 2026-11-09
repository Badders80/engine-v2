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
  const trainer = await recordStore().findTrainerById(id)

  if (trainer === null) notFound()

  return (
    <main className="grid gap-8">
      <header>
        <p className="text-caption uppercase tracking-caption text-low">
          <Link href="/trainers">Trainers</Link> / Profile
        </p>
        <div className="mt-1 flex flex-wrap items-baseline justify-between gap-3">
          <h1>{trainer.name}</h1>
          <Link
            href={`/trainers/${trainer.id}/edit`}
            className="rounded-sm border border-line px-3 py-1 text-caption uppercase tracking-caption text-body"
          >
            Edit
          </Link>
        </div>
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
                  <a href={trainer.website} className="break-all">
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
            <SocialRow label="X / Twitter" url={trainer.xUrl} />
            <SocialRow label="Facebook" url={trainer.facebookUrl} />
            <SocialRow label="Instagram" url={trainer.instagramUrl} />
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
