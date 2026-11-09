import Link from 'next/link'
import { notFound } from 'next/navigation'

import type { DslRow } from '@/lib/dslStore'
import { imageKeys, publicImageUrl } from '@/lib/storage'

import { SummaryRow } from '../../_components/forms'
import { recordStore } from '../../records/store'

export const dynamic = 'force-dynamic'

function statusLabel(status: DslRow['status']): string {
  return status.replaceAll('_', ' ')
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const store = recordStore()

  const horse = await store.findHorseById(id)
  if (horse === null) notFound()

  const [trainer, dsls, owners] = await Promise.all([
    horse.trainerId === null ? Promise.resolve(null) : store.findTrainerById(horse.trainerId),
    store.listDsls(),
    store.listOwners(),
  ])

  const horseDsls = dsls.filter((dsl) => dsl.horseId === horse.id)
  const ownerNames = new Map(owners.map((owner) => [owner.id, owner.entity]))
  const horseOwners = [
    ...new Map(
      horseDsls
        .filter((dsl) => dsl.ownerId !== null)
        .map((dsl) => [dsl.ownerId as string, ownerNames.get(dsl.ownerId as string) ?? 'Owner not found']),
    ).entries(),
  ]

  const publicUrlBase = process.env.R2_PUBLIC_URL ?? ''
  const images = publicUrlBase.startsWith('https://')
    ? imageKeys(horse.slug, horse.imageCount).map((key, index) => ({
        key,
        number: index + 1,
        url: publicImageUrl(key, publicUrlBase),
      }))
    : []

  return (
    <main className="grid gap-8">
      <header>
        <p className="text-caption uppercase tracking-caption text-low">
          <Link href="/horses">Horses</Link> / Profile
        </p>
        <div className="mt-1 flex flex-wrap items-baseline justify-between gap-3">
          <h1>{horse.legalName}</h1>
          <div className="flex items-center gap-3">
            <span className="rounded-sm border border-line px-2 py-1 text-caption uppercase tracking-caption text-muted">
              {horse.registered ? 'Registered' : 'Unregistered'}
            </span>
            <Link
              href={`/horses/${horse.id}/edit`}
              className="rounded-sm border border-line px-3 py-1 text-caption uppercase tracking-caption text-body"
            >
              Edit
            </Link>
          </div>
        </div>
        <p className="mt-1 font-figure text-caption text-low">{horse.slug}</p>
      </header>

      <section className="rounded-md border border-line bg-panel p-5">
        <h3 className="mb-3">Identity</h3>
        <dl className="grid gap-0">
          <SummaryRow label="Foaling date" value={horse.foalingDate} />
          <SummaryRow label="Sex" value={horse.sex} />
          <SummaryRow label="Colour" value={horse.colour} />
          <SummaryRow label="Breeder" value={horse.breeder ?? '—'} />
          <SummaryRow label="Sire" value={horse.sireName} />
          <SummaryRow label="Dam" value={horse.damName} />
          <SummaryRow label="Microchip" value={horse.microchip ?? '—'} />
          <SummaryRow label="Life number" value={horse.lifeNumber ?? '—'} />
          <SummaryRow label="Loveracing id" value={horse.loveracingId ?? '—'} />
        </dl>
      </section>

      <div className="grid gap-6 md:grid-cols-2">
        <section className="rounded-md border border-line bg-panel p-5">
          <h3 className="mb-3">Trainer</h3>
          {trainer === null ? (
            <p className="text-body text-low">No trainer assigned.</p>
          ) : (
            <div className="grid gap-1">
              <Link href={`/trainers/${trainer.id}`} className="text-body">
                {trainer.name}
              </Link>
              <p className="text-caption text-muted">{trainer.stable}</p>
              <p className="text-caption text-low">{trainer.location}</p>
            </div>
          )}
        </section>

        <section className="rounded-md border border-line bg-panel p-5">
          <h3 className="mb-3">Owner</h3>
          {horseOwners.length === 0 ? (
            <p className="text-body text-low">
              No owner yet. An owner is a party to a deal and attaches to the DSL.
            </p>
          ) : (
            <ul className="grid gap-2">
              {horseOwners.map(([ownerId, entity]) => (
                <li key={ownerId}>
                  <Link href={`/owners/${ownerId}`} className="text-body">
                    {entity}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="rounded-md border border-line bg-panel p-5">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h3>Images</h3>
          <span className="font-figure text-caption text-muted">
            {horse.imageCount} in the bucket
          </span>
        </div>

        {images.length === 0 ? (
          <p className="text-body text-low">
            {horse.imageCount === 0
              ? 'No images yet. Upload them from the DSL page.'
              : 'The public image host is not configured in this environment.'}
          </p>
        ) : (
          <ol className="grid grid-cols-[repeat(auto-fill,minmax(8rem,1fr))] gap-3">
            {images.map((image) => (
              <li key={image.key} className="overflow-hidden rounded-sm border border-line">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={image.url}
                  alt={`${horse.legalName} image ${String(image.number)}`}
                  width={240}
                  height={180}
                  className="h-full w-full object-cover"
                />
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="rounded-md border border-line bg-panel p-5">
        <h3 className="mb-3">DSLs</h3>

        {horseDsls.length === 0 ? (
          <p className="text-body text-low">No deal attached yet.</p>
        ) : (
          <ul className="grid">
            {horseDsls.map((dsl) => (
              <li
                key={dsl.id}
                className="flex flex-wrap items-baseline justify-between gap-3 border-b border-line py-2 last:border-b-0"
              >
                <Link href={`/dsl/${dsl.id}`} className="text-body">
                  {statusLabel(dsl.status)}
                </Link>
                <span className="font-figure text-caption text-muted">
                  {dsl.listedStake === null ? 'stake not set' : `${dsl.listedStake}%`}
                  {' · '}
                  {dsl.endDate ?? 'no end date'}
                  {dsl.ownerId === null
                    ? ''
                    : ` · ${ownerNames.get(dsl.ownerId) ?? 'owner not found'}`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  )
}
