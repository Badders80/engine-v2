import type { Metadata } from 'next'

import { FaqAccordion, type FaqItem } from '../../components/FaqAccordion'
import { MarketplaceBrowser } from '../../components/MarketplaceBrowser'
import { PageContainer, PageIntro, PageSection, PageShell } from '../../components/PagePrimitives'
import { listPublishedListings, sortForMarketplace } from '../../lib/listings'
import {
  buildCardFromListing,
  PREVIEW_STACK_PLACEHOLDERS,
  type MarketplaceCard,
} from '../../lib/marketplace'
import { OG_IMAGE, R2_PUBLIC_URL_ENV } from '../../lib/site'

/**
 * The public Marketplace.
 *
 * Production supplies the editorial hierarchy and stacked row composition; v2
 * supplies the read layer (`dsls` -> `horses!inner`), token authority, ruled
 * status ordering and accessible controls.
 *
 * `force-dynamic` is load-bearing so CI builds without database env vars while
 * runtime requests serve live published listings on first response.
 */
export const dynamic = 'force-dynamic'

const TITLE = 'Marketplace — Evolution Stables'
const DESCRIPTION =
  'Ownership stakes in thoroughbreds, with the split, the rate and the term published before the offer opens.'

const OWNERSHIP_FAQS: readonly FaqItem[] = [
  {
    question: 'What is a Digitally Syndicated Lease (DSL)?',
    answer:
      'A DSL is a regulated fractional leasehold of a thoroughbred racehorse. You hold a stake as a percentage of the syndicate, with direct rights to official NZTR gross prize money at the published investor split. Minimums and exact percentages are shown on each horse page.',
  },
  {
    question: 'How does the 5×M Join Float Model work?',
    answer:
      'When joining a syndicate under the Subscription Float Model, you pay an initial float equal to five months of lease payments: three months of security deposit reserve and two months prepaid. Monthly billing starts in month two, and unused funds are settled pro-rata when the lease concludes.',
  },
  {
    question: 'How is prize money calculated and distributed?',
    answer:
      'Prize money is calculated from officially published NZTR gross stakes at the published investor split pro-rata to your stake. The remaining share is retained by the lessor to absorb jockey, trainer, nomination, acceptance and operational overheads.',
  },
  {
    question: 'Who decides where and when the horse races?',
    answer:
      'Under the Syndicate Agreement, the licensed trainer holds authority over race placement, training, spelling periods and horse welfare decisions.',
  },
  {
    question: 'Is Evolution Stables regulated in New Zealand?',
    answer:
      'Yes. Evolution Stables operates as an Authorised Syndicator under New Zealand Thoroughbred Racing, in accordance with the Financial Markets Conduct (Equine Syndicating Schemes) Exemption Notice.',
  },
]

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

export default async function MarketplacePage() {
  const listings = sortForMarketplace(await listPublishedListings())
  const r2PublicUrl = process.env[R2_PUBLIC_URL_ENV]
  const liveCards: MarketplaceCard[] = listings.map((listing) =>
    buildCardFromListing(listing, r2PublicUrl),
  )

  const previewStackEnabled = process.env.WEBSITE_PREVIEW_STACK === 'true'
  const cards = previewStackEnabled
    ? [...liveCards, ...PREVIEW_STACK_PLACEHOLDERS]
    : liveCards

  return (
    <PageShell>
      <PageIntro
        eyebrow="Evolution Stables"
        title={
          <>
            Ownership,
            <br />
            evolved.
          </>
        }
        description={
          <>
            Browse active offerings, coming-soon offerings and completed track record. For a deeper
            dive into our ownership model, read the{' '}
            <a
              href="#ownership-faq"
              className="inline-flex min-h-11 items-center text-gold underline decoration-border underline-offset-4 transition-colors duration-hover hover:text-heading focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-edge"
            >
              Ownership FAQ
            </a>{' '}
            below.
          </>
        }
      />

      <PageSection className="pt-8 pb-32">
        <MarketplaceBrowser cards={cards} />
      </PageSection>

      <section id="ownership-faq" className="bg-canvas py-section">
        <PageContainer>
          <div data-reveal data-reveal-mode="fade">
            <p className="label-eyebrow text-muted-foreground">Ownership FAQ</p>
            <h2 className="mt-6 max-w-3xl text-section-heading font-light leading-display tracking-display text-heading md:text-section-heading-wide">
              Ownership, explained.
            </h2>
            <p className="mt-6 max-w-2xl text-body-small font-light leading-body text-muted-foreground">
              The mechanics of a Digital Syndication Lease — what you hold, how prize money flows,
              and who governs the term.
            </p>
            <div className="mt-16">
              <FaqAccordion items={OWNERSHIP_FAQS} />
            </div>
          </div>
        </PageContainer>
      </section>
    </PageShell>
  )
}
