import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'

import { PageContainer, PageIntro, PageSection, PageShell } from '../../components/PagePrimitives'
import StatusBadge from '../../components/StatusBadge'
import { listPublishedListings, sortForMarketplace, type Listing } from '../../lib/listings'
import { heroImageUrl, OG_IMAGE, R2_PUBLIC_URL_ENV, SITE_URL } from '../../lib/site'

/**
 * The marketplace. PLAN.md step 6b-ii, deliverable D2.
 *
 * Every card is a published DSL. The read layer filters `published = true` and
 * embeds the horse, so an unpublished DSL cannot reach this grid — and a
 * denormalised card cannot drift from the read layer, because there is only one
 * query shape in the app and this page uses it unchanged.
 *
 * `force-dynamic` is load-bearing, not stylistic. CI runs `pnpm run build` with no
 * environment variables, and the read client throws when its variables are absent
 * rather than returning an empty result. A page prerendered at build time would
 * therefore fail CI for a reason unrelated to the change. Server-rendering per
 * request also satisfies PLAN.md:90 — the first response carries the horse name,
 * the status, and the image as HTML.
 *
 * The grid's order is ruled, 2026-10-20: `available`, `coming_soon`,
 * `fully_allocated`, `completed`, and within a rank the soonest-closing offer
 * first. It is applied by `sortForMarketplace` — one pure function with its own
 * tests — so this page holds no ordering logic of its own.
 */

export const dynamic = 'force-dynamic'

const TITLE = 'Marketplace — Evolution Stables'
const DESCRIPTION =
  'Ownership stakes in thoroughbreds, with the split, the rate and the term published before the offer opens.'

/**
 * The page's own title, description and canonical. `PLAN.md:80` requires all three
 * per page, and the canonical is absolute through the root layout's `metadataBase`.
 * The Open Graph image is named again rather than inherited, so this page's card
 * does not depend on how metadata merges across segments.
 */
export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: '/marketplace' },
  openGraph: {
    type: 'website',
    url: '/marketplace',
    siteName: 'Evolution Stables',
    title: TITLE,
    description: DESCRIPTION,
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: 'Evolution Stables' }],
  },
}

/**
 * One card. DESIGN.md's listing-card anatomy: badge over the image frame, the
 * name, and exactly one call to action.
 *
 * Three of its rules shape this markup. **No figures inside the card** —
 * financials belong to the horse page, where mono is the ruled face for them.
 * **The card is never a link**: one anchor inside it, not a card-shaped one, which
 * is why the `article` is not wrapped in a `Link`. And **there is no disabled
 * card**, because an unsellable offering is a status rather than an absent card.
 *
 * The hook the anatomy also asks for is absent: it is horse soft prose, no soft
 * prose column is in the read layer's projection, and widening that projection is
 * not something this step's checklist authorises. Recorded in the plan's ledger
 * rather than filled with invented copy.
 */
function ListingCard({ listing }: { listing: Listing }) {
  const { horse } = listing
  const hero = heroImageUrl(horse.slug, horse.imageCount, process.env[R2_PUBLIC_URL_ENV])
  const href = `/marketplace/${horse.slug}`

  return (
    <article className="rounded-lg border border-border bg-surface p-8">
      <div className="relative h-56 w-full overflow-hidden rounded-md bg-raised">
        {hero ? (
          <Image
            src={hero}
            alt={horse.legalName}
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"
            className="object-cover"
          />
        ) : (
          <p className="label-spec absolute inset-0 flex items-center justify-center text-muted-foreground">
            No photograph
          </p>
        )}
        <span className="absolute right-4 top-4">
          <StatusBadge status={listing.status} />
        </span>
      </div>

      <h3 className="mt-8 text-card-heading leading-heading text-heading">{horse.legalName}</h3>

      <Link href={href} className="label-action mt-6 inline-block text-gold">
        View the horse
      </Link>
    </article>
  )
}

export default async function MarketplacePage() {
  const listings = sortForMarketplace(await listPublishedListings())

  return (
    <PageShell>
      <PageIntro
        eyebrow="Marketplace"
        title={
          <>
            The <span className="type-accent text-gold">Marketplace</span>
          </>
        }
        description="Every offer below is a published stake. Read the rate, the term and the split before you commit to anything."
      />

      <PageSection className="py-16">
        {listings.length === 0 ? (
          // An empty grid is a real state, not an error: a horse exists only once
          // it is registered and its DSL is published. Saying so is better than an
          // empty frame that reads as a broken page.
          <p className="text-body-small leading-body text-muted-foreground">
            No offers are published yet. Each one appears here the day it opens.
          </p>
        ) : (
          <ul className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {listings.map((listing) => (
              <li key={listing.id}>
                <ListingCard listing={listing} />
              </li>
            ))}
          </ul>
        )}
      </PageSection>

      <footer>
        <PageContainer className="py-16">
          <p className="label-spec text-muted-foreground">
            Evolution Stables · {SITE_URL.replace(/^https?:\/\//, '')}
          </p>
        </PageContainer>
      </footer>
    </PageShell>
  )
}
