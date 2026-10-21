import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { cache } from 'react'

import BuyFlowModal from '../../../components/BuyFlowModal'
import StatusBadge from '../../../components/StatusBadge'
import { AUTH_TOKEN_COOKIE } from '../../../lib/auth'
import {
  canRenderBuyNow,
  fetchEngineQuote,
  requireInvestorSplit,
  WEBSITE_BUY_ENABLED_ENV,
  WEBSITE_ENGINE_URL_ENV,
} from '../../../lib/engineClient'
import { getListingsBySlug, type Listing } from '../../../lib/listings'
import { readMyStable, type AccountProfile } from '../../../lib/mystable'
import { heroImageUrl, OG_IMAGE, R2_PUBLIC_URL_ENV, SITE_URL } from '../../../lib/site'
import { viewForStatus } from '../../../lib/status'

/**
 * The horse page. PLAN.md step 6b-ii, deliverable D3.
 *
 * One URL per horse (`PLAN.md:297`), and the horse may carry more than one DSL —
 * the unique constraint on `dsls` is `(horse_id, end_date)`, not `horse_id` — so
 * every published DSL on the horse gets its own block. Dropping one would discard
 * a published offering, which is the one reading the law does not support.
 *
 * Two rules shape the page. **Exactly one `h1`**, carrying the horse's legal name
 * (`PLAN.md:86`); the per-DSL blocks are `h2`. And **no checkout control of any
 * kind** — ruled 2026-10-17. The purchase modal and the buy wiring are Step 8
 * (`PLAN.md:299`) and the buy path stays off until Step 10 (`PLAN.md:301`), so an
 * Available listing shows its status and its terms and nothing to click. A
 * disabled button would still be a control, so there is not one of those either.
 *
 * `force-dynamic` for the reason given on the marketplace page: CI builds with no
 * environment variables, and the read client throws rather than degrading.
 */

export const dynamic = 'force-dynamic'

/**
 * React's per-request memo, so `generateMetadata` and the page share one query
 * rather than issuing two against the same row set.
 */
const readListings = cache(async (slug: string): Promise<Listing[]> => getListingsBySlug(slug))

/** Composed from stored facts. The horse's own prose is not in the read layer's projection. */
function describe(listing: Listing): string {
  const { horse } = listing
  const { label } = viewForStatus(listing.status)

  return `${horse.legalName} — ${label} on the Evolution Stables marketplace. Listed stake ${String(listing.listedStake)}%, minimum ${String(listing.minStake)}%, term from ${listing.termStart} to ${listing.endDate}.`
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const listings = await readListings(slug)
  const first = listings.at(0)

  if (!first) {
    return { title: 'Not found — Evolution Stables', robots: { index: false } }
  }

  const title = `${first.horse.legalName} — Evolution Stables`
  const description = describe(first)

  return {
    title,
    description,
    alternates: { canonical: `/marketplace/${first.horse.slug}` },
    openGraph: {
      type: 'website',
      url: `/marketplace/${first.horse.slug}`,
      siteName: 'Evolution Stables',
      title,
      description,
      images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: first.horse.legalName }],
    },
  }
}

/**
 * One figure. DESIGN.md's figure-row variant `default`: the label is muted, the
 * value is in `heading`, and **the unit is never inside the value string** so it
 * can be positioned at all.
 *
 * The value is mono at weight 500 — a token decision, not a styling choice, because
 * a proportional face stops figures aligning down a column. The `money` variant is
 * deliberately not used: green there means a positive return, and none of these is
 * a return.
 */
function Figure({
  label,
  value,
  unit,
  sub,
}: {
  label: string
  value: string
  unit?: string
  sub?: string
}) {
  return (
    <div className="border-t border-border py-5">
      <dt className="label-spec text-muted-foreground">{label}</dt>
      <dd className="mt-2 flex items-baseline gap-2">
        <span className="font-mono text-card-heading font-medium text-heading">{value}</span>
        {unit ? <span className="label-spec text-muted-foreground">{unit}</span> : null}
      </dd>
      {sub ? <p className="label-spec mt-2 text-muted-foreground">{sub}</p> : null}
    </div>
  )
}

async function DslBlock({
  listing,
  account,
}: {
  listing: Listing
  account: AccountProfile | null
}) {
  const buyEnabled = canRenderBuyNow(listing.status, process.env[WEBSITE_BUY_ENABLED_ENV])
  const initialQuote = buyEnabled ? await fetchEngineQuote({ dslId: listing.id }) : null
  const splitDisplay =
    listing.investorSplit !== null ? `${String(requireInvestorSplit(listing.investorSplit))}%` : null

  return (
    <section className="mt-16 rounded-lg border border-border bg-surface p-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="label-eyebrow text-muted-foreground">Offer</h2>
        <StatusBadge status={listing.status} />
      </div>

      <dl className="mt-8 grid gap-x-16 sm:grid-cols-2">
        <Figure label="Listed stake" value={`${String(listing.listedStake)}%`} sub="Of the horse, in total" />
        <Figure label="Minimum stake" value={`${String(listing.minStake)}%`} />
        <Figure label="Step" value={`${String(listing.step)}%`} sub="Each additional stake moves in steps of this size" />
        <Figure label="Remaining" value={`${String(listing.stakeRemaining)}%`} sub="Not yet taken" />
        <Figure
          label="Retail rate"
          value={`$${String(listing.retailMonthlyPerPercent)}`}
          unit="per 1% / month"
        />
        <Figure
          label="Wholesale"
          value={`$${String(listing.wholesaleMonthlyTotal)}`}
          unit="at 100%"
        />
        {splitDisplay ? <Figure label="Investor split" value={splitDisplay} /> : null}
        <Figure label="Term start" value={listing.termStart} />
        <Figure label="End date" value={listing.endDate} />
        <Figure label="Payment model" value={listing.paymentModel} />
        <Figure label="Close style" value={listing.closeStyle} />
      </dl>

      {buyEnabled && initialQuote ? (
        <BuyFlowModal
          dslId={listing.id}
          status={listing.status}
          horseSlug={listing.horse.slug}
          horseLegalName={listing.horse.legalName}
          investorSplit={listing.investorSplit}
          initialQuote={initialQuote}
          accountId={account?.id ?? null}
          accountFullName={account?.fullName ?? null}
          accountKycStatus={account?.kycStatus ?? null}
          engineBaseUrl={process.env[WEBSITE_ENGINE_URL_ENV]}
          buyEnabled={buyEnabled}
        />
      ) : null}
    </section>
  )
}

export default async function HorsePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const listings = await readListings(slug)
  const first = listings.at(0)

  // An unpublished DSL is a 404, never an empty page. The read layer filters on
  // `published`, so a slug that names only unpublished work arrives here as an
  // empty array and leaves as a not-found.
  if (!first) notFound()

  const anyBuyEnabled = listings.some((listing) =>
    canRenderBuyNow(listing.status, process.env[WEBSITE_BUY_ENABLED_ENV]),
  )
  let account: AccountProfile | null = null
  if (anyBuyEnabled) {
    const cookieStore = await cookies()
    const token = cookieStore.get(AUTH_TOKEN_COOKIE)?.value ?? null
    if (token) {
      const stable = await readMyStable({ accessToken: token })
      account = stable.account
    }
  }

  const { horse } = first
  const hero = heroImageUrl(horse.slug, horse.imageCount, process.env[R2_PUBLIC_URL_ENV])

  /**
   * The horse, at its real page (`PLAN.md:85` — the current site points structured
   * data at a path that does not exist).
   *
   * No `offers` and no price. The law does not rule which stored figure is the
   * public price, and `listed_stake` is a percentage rather than money, so emitting
   * one would mean inventing the very fact a buyer would rely on.
   */
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: horse.legalName,
    description: describe(first),
    url: `${SITE_URL}/marketplace/${horse.slug}`,
    ...(hero ? { image: [hero] } : {}),
    additionalProperty: [
      { '@type': 'PropertyValue', name: 'Status', value: viewForStatus(first.status).label },
    ],
  }

  return (
    <main className="bg-canvas text-ink">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />

      <section className="mx-auto w-full max-w-6xl px-12 pt-32 pb-16 md:px-16 lg:px-20">
        <Link href="/marketplace" className="label-action text-muted-foreground">
          Marketplace
        </Link>

        <h1 className="mt-8 max-w-3xl text-display leading-display tracking-display text-heading">
          {horse.legalName}
        </h1>

        {hero ? (
          <div className="relative mt-16 h-80 w-full overflow-hidden rounded-lg bg-raised">
            <Image
              src={hero}
              alt={horse.legalName}
              fill
              priority
              sizes="(max-width: 1280px) 100vw, 1152px"
              className="object-cover"
            />
          </div>
        ) : null}
      </section>

      <div className="mx-auto w-full max-w-6xl px-12 pb-32 md:px-16 lg:px-20">
        {/* More than one block is a legal state, not a data error: one horse may
            carry a separate DSL per end date (`PLAN.md:297`). */}
        {listings.map((listing) => (
          <DslBlock key={listing.id} listing={listing} account={account} />
        ))}
      </div>
    </main>
  )
}
