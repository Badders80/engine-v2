import Link from 'next/link'

import type { HorsePageFixture } from '../lib/horsePageFixture'
import { HorseDetailsTabs } from './HorseDetailsTabs'
import { HorseGallery } from './HorseGallery'
import { HorseMobileBar, HorseOfferRail } from './HorseConversion'
import { PageSection, PageShell } from './PagePrimitives'

export function HorseFixturePage({ horse }: { horse: HorsePageFixture }) {
  return (
    <>
      <PageShell className="pb-28 md:pb-0">
        <PageSection className="pt-32 pb-32">
          <nav aria-label="Breadcrumb" className="label-eyebrow flex flex-wrap items-center gap-2 text-muted-foreground">
            <Link
              href="/marketplace"
              className="inline-flex min-h-11 items-center text-gold focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-edge"
            >
              Marketplace
            </Link>
            <span aria-hidden="true">/</span>
            <span aria-current="page" className="text-heading">
              {horse.legalName}
            </span>
          </nav>

          <div className="mt-8 flex flex-wrap items-end justify-between gap-6">
            <div>
              <p className="label-eyebrow text-muted-foreground">Marketplace horse</p>
              <h1 className="mt-4 max-w-4xl text-display leading-display tracking-display text-heading">
                {horse.legalName}
              </h1>
            </div>
            <Link
              href="/marketplace"
              className="label-action inline-flex min-h-11 items-center text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-edge"
            >
              <span aria-hidden="true">←</span> Back to Marketplace
            </Link>
          </div>

          <div
            className="mt-12 grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start"
            data-reveal
            data-reveal-mode="fade"
          >
            <div className="min-w-0 space-y-12">
              <HorseGallery images={horse.gallery} horseName={horse.legalName} />

              <dl className="grid grid-cols-2 gap-x-8 gap-y-5 rounded-md border border-border bg-surface p-6 sm:grid-cols-3 lg:grid-cols-5">
                {horse.facts.map((fact) => (
                  <div key={fact.label}>
                    <dt className="label-spec text-muted-foreground">{fact.label}</dt>
                    <dd className="mt-2 text-body-small leading-body text-heading">{fact.value}</dd>
                  </div>
                ))}
              </dl>

              <section aria-labelledby="horse-story-heading">
                <p className="label-eyebrow text-muted-foreground">The story</p>
                <h2
                  id="horse-story-heading"
                  className="mt-4 text-section-heading leading-display tracking-display text-heading"
                >
                  Campaign and pedigree
                </h2>
                <div className="mt-6 max-w-2xl space-y-4">
                  {horse.story.map((paragraph) => (
                    <p key={paragraph} className="text-body-small leading-body text-ink">
                      {paragraph}
                    </p>
                  ))}
                </div>
              </section>

              <section aria-labelledby="horse-details-heading">
                <p className="label-eyebrow text-muted-foreground">The detail</p>
                <h2
                  id="horse-details-heading"
                  className="mt-4 text-section-heading leading-display tracking-display text-heading"
                >
                  Campaign details
                </h2>
                <div className="mt-8">
                  <HorseDetailsTabs details={horse.details} />
                </div>
              </section>
            </div>

            <HorseOfferRail horse={horse} />
          </div>
        </PageSection>
      </PageShell>
      <HorseMobileBar horse={horse} />
    </>
  )
}
