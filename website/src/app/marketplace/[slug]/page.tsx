import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { cache } from 'react'

import BuyFlowModal from '../../../components/BuyFlowModal'
import {
  HorseMobileBar,
  HorseOfferRail,
  type HorseOfferSummary,
} from '../../../components/HorseConversion'
import { HorseDetailsTabs, type HorseDetailsData } from '../../../components/HorseDetailsTabs'
import { HorseGallery } from '../../../components/HorseGallery'
import { PageSection, PageShell } from '../../../components/PagePrimitives'
import { AUTH_TOKEN_COOKIE } from '../../../lib/auth'
import {
  canRenderBuyNow,
  fetchEngineQuote,
  requireInvestorSplit,
  WEBSITE_BUY_ENABLED_ENV,
  WEBSITE_ENGINE_URL_ENV,
} from '../../../lib/engineClient'
import { getListingsBySlug, sortForMarketplace, type Listing } from '../../../lib/listings'
import {
  formatFullDate,
  formatHorseName,
  formatMonthYear,
  formatThoroughbredAge,
  splitParagraphs,
} from '../../../lib/marketplace'
import { readMyStable, type AccountProfile } from '../../../lib/mystable'
import {
  galleryImageUrls,
  heroImageUrl,
  OG_IMAGE,
  R2_PUBLIC_URL_ENV,
  SITE_URL,
} from '../../../lib/site'
import { viewForStatus } from '../../../lib/status'

/**
 * The horse page.
 *
 * One URL per horse (`PLAN.md:297`), one semantic `h1` carrying the horse's
 * legal name, and `force-dynamic` so CI builds without database env vars while
 * runtime requests render live published DSL data on first response.
 */
export const dynamic = 'force-dynamic'

const readListings = cache(async (slug: string): Promise<Listing[]> => getListingsBySlug(slug))

function describe(listing: Listing): string {
  const { horse } = listing
  const { label } = viewForStatus(listing.status)
  const endDisplay = formatMonthYear(listing.endDate) ?? listing.endDate
  const startDisplay = formatMonthYear(listing.termStart)
  const termClause = startDisplay
    ? `term from ${startDisplay} to ${endDisplay}`
    : `campaign through ${endDisplay}`

  return `${horse.legalName} — ${label} on the Evolution Stables marketplace. Listed stake ${String(listing.listedStake)}%, minimum ${String(listing.minStake)}%, ${termClause}.`
}

function ctaLabelForStatus(status: Listing['status']): string {
  if (status === 'available') return 'Become an owner'
  if (status === 'coming_soon') return 'Register interest'
  return 'Notify me'
}

function buildOfferSummary(listing: Listing): HorseOfferSummary {
  const splitDisplay =
    listing.investorSplit !== null ? `${String(requireInvestorSplit(listing.investorSplit))}%` : null

  return {
    status: listing.status,
    price: `$${String(listing.retailMonthlyPerPercent)}`,
    priceUnit: 'per month per 1%',
    investorReturn: splitDisplay,
    listedStake: `${String(listing.listedStake)}%`,
    expiry: formatMonthYear(listing.endDate),
    ctaLabel: ctaLabelForStatus(listing.status),
    ctaHref: `/login?next=${encodeURIComponent(`/marketplace/${listing.horse.slug}`)}`,
  }
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

async function renderBuyFlowIfEnabled(listing: Listing, account: AccountProfile | null) {
  const buyEnabled = canRenderBuyNow(
    listing.status,
    process.env[WEBSITE_BUY_ENABLED_ENV],
    listing.stakeRemaining,
  )
  if (!buyEnabled) return null

  const initialQuote = await fetchEngineQuote({ dslId: listing.id })
  return (
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
  )
}

export default async function HorsePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const listings = sortForMarketplace(await readListings(slug))
  const primary = listings.at(0)

  if (!primary) notFound()

  const anyBuyEnabled = listings.some((listing) =>
    canRenderBuyNow(
      listing.status,
      process.env[WEBSITE_BUY_ENABLED_ENV],
      listing.stakeRemaining,
    ),
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

  const { horse } = primary
  const r2PublicUrl = process.env[R2_PUBLIC_URL_ENV]
  const hero = heroImageUrl(horse.slug, horse.imageCount, r2PublicUrl, horse.imageOrder)
  const galleryTail = galleryImageUrls(horse.slug, horse.imageCount, r2PublicUrl, horse.imageOrder)
  const allImages = hero ? [hero, ...galleryTail] : galleryTail

  const age = formatThoroughbredAge(horse.foalingDate)
  const foaled = formatFullDate(horse.foalingDate)

  const facts = [
    { label: 'Age', value: age ?? '—' },
    { label: 'Sex', value: horse.sex ?? '—' },
    { label: 'Colour', value: horse.colour ?? '—' },
    { label: 'Sire', value: formatHorseName(horse.sireName).display },
    { label: 'Dam', value: formatHorseName(horse.damName).display },
  ] as const

  const storyParagraphs = splitParagraphs(primary.narrative.aboutHorse ?? horse.aboutHorse)
  const overviewParagraphs = splitParagraphs(
    primary.narrative.racingOutlook ?? horse.racingOutlookAndPedigree,
  )
  const raceExpectationParagraphs = splitParagraphs(
    primary.narrative.raceExpectation ?? horse.raceExpectation,
  )

  const details: HorseDetailsData = {
    legalName: horse.legalName,
    sireName: horse.sireName,
    damName: horse.damName,
    sex: horse.sex,
    colour: horse.colour,
    age,
    foaled,
    breeder: horse.breeder,
    pedigree: horse.pedigree,
    overviewParagraphs,
    raceRecord: horse.raceRecord,
    raceExpectationParagraphs,
  }

  const railEntries = await Promise.all(
    listings.map(async (listing) => ({
      id: listing.id,
      offer: buildOfferSummary(listing),
      buyFlow: await renderBuyFlowIfEnabled(listing, account),
    })),
  )

  const primaryOffer = railEntries[0]?.offer ?? buildOfferSummary(primary)

  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: horse.legalName,
    description: describe(primary),
    url: `${SITE_URL}/marketplace/${horse.slug}`,
    ...(hero ? { image: [hero] } : {}),
    additionalProperty: [
      { '@type': 'PropertyValue', name: 'Status', value: viewForStatus(primary.status).label },
    ],
  }

  const factsStrip = (
    <dl className="grid grid-cols-2 gap-x-6 gap-y-4 rounded-md border border-border bg-surface px-5 py-4 sm:grid-cols-3 lg:grid-cols-[auto_auto_auto_minmax(0,1fr)_minmax(0,1fr)] lg:gap-x-8">
      {facts.map((fact) => (
        <div key={fact.label} className="min-w-0">
          <dt className="label-spec text-muted-foreground">{fact.label}</dt>
          <dd className="mt-1.5 text-body-small font-light text-heading">{fact.value}</dd>
        </div>
      ))}
    </dl>
  )

  return (
    <>
      <PageShell className="pb-28 lg:pb-0">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />

        <PageSection className="pt-28 pb-32 md:pt-32">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <nav
              aria-label="Breadcrumb"
              className="label-eyebrow flex flex-wrap items-center gap-2 text-muted-foreground"
            >
              <Link
                href="/marketplace"
                className="inline-flex min-h-11 items-center text-muted-foreground transition-colors duration-hover hover:text-gold focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-edge"
              >
                Marketplace
              </Link>
              <span aria-hidden="true">/</span>
              <span aria-current="page" className="text-heading">
                {horse.legalName}
              </span>
            </nav>

            <Link
              href="/marketplace"
              className="label-action inline-flex min-h-11 items-center gap-1.5 text-muted-foreground transition-colors duration-hover hover:text-heading focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-edge"
            >
              <span aria-hidden="true">←</span> Back to Marketplace
            </Link>
          </div>

          <div
            className="mt-6 grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start lg:gap-12"
            data-reveal
            data-reveal-mode="fade"
          >
            <div className="min-w-0 space-y-12">
              <HorseGallery
                images={allImages}
                horseName={horse.legalName}
                factsSlot={factsStrip}
              />

              <section aria-labelledby="horse-story-heading">
                <p className="label-eyebrow text-muted-foreground">The story</p>
                <h1
                  id="horse-story-heading"
                  className="mt-3 text-section-heading font-light leading-display tracking-display text-heading"
                >
                  {horse.legalName}
                </h1>
                {storyParagraphs.length > 0 ? (
                  <div className="mt-6 max-w-2xl space-y-4 text-body-small font-light leading-body text-ink">
                    {storyParagraphs.map((paragraph) => (
                      <p key={paragraph}>{paragraph}</p>
                    ))}
                  </div>
                ) : (
                  <p className="mt-6 max-w-2xl text-body-small font-light leading-body text-muted-foreground">
                    Campaign story notes will appear here once published.
                  </p>
                )}
              </section>

              <section aria-label="Campaign details">
                <HorseDetailsTabs details={details} />
              </section>
            </div>

            <div className="space-y-6 lg:sticky lg:top-28">
              {railEntries.map((entry) => (
                <HorseOfferRail key={entry.id} offer={entry.offer} buyFlow={entry.buyFlow} />
              ))}
            </div>
          </div>
        </PageSection>
      </PageShell>

      <HorseMobileBar offer={primaryOffer} />
    </>
  )
}
