import Link from 'next/link'

import { imageKey, publicImageUrl } from '@/lib/storage'

import { recordStore } from '../records/store'

export const dynamic = 'force-dynamic'

function HeroImage({ slug, imageCount }: { slug: string; imageCount: number }) {
  const publicUrlBase = process.env.R2_PUBLIC_URL ?? ''
  const showable = imageCount > 0 && publicUrlBase.startsWith('https://')

  return (
    <div className="flex aspect-[4/3] items-center justify-center overflow-hidden rounded-sm border border-line bg-raised">
      {showable ? (
        // The bucket serves the object; Next's image optimiser has no origin
        // configured for it, so a plain img is correct here.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={publicImageUrl(imageKey(slug, 1), publicUrlBase)}
          alt=""
          width={480}
          height={360}
          className="h-full w-full object-cover"
        />
      ) : (
        <span className="text-caption uppercase tracking-caption text-low">
          {imageCount === 0 ? 'No image' : `${imageCount} images`}
        </span>
      )}
    </div>
  )
}

export default async function Page() {
  const store = recordStore()
  const [horses, trainers] = await Promise.all([store.listHorses(), store.listTrainers()])
  const trainerNames = new Map(trainers.map((trainer) => [trainer.id, trainer.name]))

  return (
    <main className="grid gap-6">
      <header className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <p className="text-caption uppercase tracking-caption text-low">Records</p>
          <h1 className="mt-1">Horses</h1>
        </div>
        <p className="font-figure text-caption text-muted">{horses.length} records</p>
      </header>

      <div className="grid grid-cols-[repeat(auto-fill,minmax(16rem,1fr))] gap-4">
        <Link
          href="/horses/new"
          className="flex min-h-48 items-center justify-center rounded-md border border-dashed border-line-strong p-5 text-center text-body text-muted hover:border-accent hover:text-ink"
        >
          + New horse
        </Link>

        {horses.map((horse) => (
          <Link
            key={horse.id}
            href={`/horses/${horse.id}`}
            className="grid gap-3 rounded-md border border-line bg-panel p-3 hover:border-line-strong"
          >
            <HeroImage slug={horse.slug} imageCount={horse.imageCount} />

            <div className="grid gap-2">
              <p className="truncate text-body text-ink">{horse.legalName}</p>

              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-sm border border-line px-2 py-1 text-caption uppercase tracking-caption text-muted">
                  {horse.registered ? 'Registered' : 'Unregistered'}
                </span>
                <span className="font-figure text-caption text-low">{horse.slug}</span>
              </div>

              <p className="truncate text-caption text-muted">
                {horse.trainerId === null
                  ? 'No trainer assigned'
                  : (trainerNames.get(horse.trainerId) ?? 'Trainer not found')}
              </p>
            </div>
          </Link>
        ))}
      </div>

      {horses.length === 0 ? <p className="text-body text-muted">No horses yet.</p> : null}
    </main>
  )
}
