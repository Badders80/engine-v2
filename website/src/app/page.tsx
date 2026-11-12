import Image from 'next/image'
import Link from 'next/link'

import { FaqAccordion, type FaqItem } from '../components/FaqAccordion'
import { PhotographicDivider } from '../components/PhotographicDivider'
import { SITE_URL } from '../lib/site'

type AudienceCard = {
  tag: string
  title: string
  description: string
}

type MarketplaceFeature = {
  title: string
  description: string
  icon: 'search' | 'shield' | 'eye'
}

const AUDIENCE_CARDS: readonly AudienceCard[] = [
  {
    tag: 'INVESTORS & FANS',
    title: 'Experience the thrill — without the hassle.',
    description:
      'Ownership, on your terms. Simplified terms and conditions give you the full thrill of ownership in a transparent, regulated marketplace — where risk and return are clear before you buy.',
  },
  {
    tag: 'BREEDERS & SYNDICATORS',
    title: 'Unlock new income — same control, zero extra effort.',
    description:
      'Expand your reach and retain full control, with offers structured, managed, and delivered — all in one place.',
  },
  {
    tag: 'CLUBS & ORGANISATIONS',
    title: 'From spectators to invested stakeholders.',
    description:
      "Ownership is the gateway to deeper engagement — turning one-time spectators into lifelong members, building revenue, and strengthening the sport's future, all in one place.",
  },
]

const BENEFITS = [
  {
    src: '/images/content/icons/increased-access.svg',
    alt: 'Increased Access',
    title: 'Increased Access',
    description: 'A digital platform that lowers barriers and opens ownership to everyone.',
  },
  {
    src: '/images/content/icons/greater-than-equal.svg',
    alt: 'Greater Transparency',
    title: 'Greater Transparency',
    description: 'Real-time performance, clear costs, and open communication.',
  },
  {
    src: '/images/content/icons/untitled-36.svg',
    alt: 'Borderless Flexibility',
    title: 'Borderless Flexibility',
    description: 'Fractional shares and short-term commitments for modern investors.',
  },
] as const

const MARKETPLACE_FEATURES: readonly MarketplaceFeature[] = [
  {
    title: 'Discover Opportunities',
    description:
      'Explore available syndications and short-term leases — all clearly structured, fully transparent, and ready to invest in with confidence.',
    icon: 'search',
  },
  {
    title: 'Trade with Confidence',
    description:
      'Our regulated platform ensures secure transactions, compliant ownership records, and integrated settlements — so every trade is safe, clear, and straightforward.',
    icon: 'shield',
  },
  {
    title: 'Real-Time Insight',
    description:
      'Follow your horses, track performance, and manage your positions in real time — with ownership data, updates, and key information always at your fingertips.',
    icon: 'eye',
  },
]

const PARTNERS = [
  { src: '/images/partners/nztr-white.png', alt: 'NZTR', width: 140, height: 40 },
  { src: '/images/partners/tokinvest-light.png', alt: 'Tokinvest', width: 160, height: 40 },
  { src: '/images/partners/stephen-grey-racing.png', alt: 'Stephen Grey Racing', width: 180, height: 40 },
  { src: '/images/partners/arabian-business.png', alt: 'Arabian Business', width: 160, height: 40 },
  { src: '/images/partners/trackside-nz.png', alt: 'Trackside NZ', width: 150, height: 40 },
  { src: '/images/partners/businessdesk.jpg', alt: 'BusinessDesk', width: 170, height: 40 },
  { src: '/images/partners/singularry.webp', alt: 'Singularry', width: 160, height: 40 },
  { src: '/images/partners/wexford-stables.jpg', alt: 'Wexford Stables', width: 150, height: 40 },
  { src: '/images/partners/investing-com.png', alt: 'Investing.com', width: 160, height: 40 },
] as const

const FAQS: readonly FaqItem[] = [
  {
    question: 'Who is Evolution Stables?',
    answer:
      'Evolution Stables offers Digital-Syndication of Thoroughbreds: regulated fractional leasehold stakes in racehorses, managed online. Stakes, terms, and campaign documents sit in one place — clear and verifiable.',
  },
  {
    question: 'What is Evolution Stables here to do?',
    answer:
      'We give Thoroughbreds a Digital-Syndication platform: owners list horses as Digital Syndication Leases, and investors hold a stake in the syndicate with direct rights to prize money.',
  },
  {
    question: 'How is Evolution Stables different?',
    answer:
      'Clear terms and direct participation. Each campaign publishes its stake percentages, the monthly lease payment, and the lease period up front, and the Syndicate Agreement governs the term from sign-off to settlement.',
  },
  {
    question: 'What does digital-syndication mean?',
    answer:
      'Digital-Syndication is a leasehold stake in a Thoroughbred, held and managed online. Each DSL is a regulated campaign: a horse, its owner, its trainer, and the commercial terms in one agreement.',
  },
  {
    question: 'Can I trade or sell my stake?',
    answer:
      'Your stake is governed by the Syndicate Agreement, which sets out how the lease concludes and how interests are handled at its end. The terms for each campaign are published before you commit.',
  },
  {
    question: 'What are the risks?',
    answer:
      'Racehorse ownership carries risk: horses can be injured and performance varies. Every campaign operates under NZTR Authorised Syndicator rules and the Financial Markets Conduct (Equine Syndicating Schemes) Exemption, with the PDS and Syndicate Agreement published for each horse.',
  },
]

function MarketplaceIcon({ icon }: { icon: MarketplaceFeature['icon'] }) {
  if (icon === 'search') {
    return (
      <svg className="h-8 w-8 text-heading" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
      </svg>
    )
  }

  if (icon === 'shield') {
    return (
      <svg className="h-8 w-8 text-heading" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.623 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
      </svg>
    )
  }

  return (
    <svg className="h-8 w-8 text-heading" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  )
}

export default function HomePage() {
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'Evolution Stables',
    url: SITE_URL,
    description:
      'Digital syndication for thoroughbred racing. Regulated structure, published economics, and a record that holds.',
    publisher: {
      '@type': 'Organization',
      name: 'Evolution Stables Limited',
      url: SITE_URL,
    },
  }

  return (
    <main className="bg-canvas text-ink">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />

      <section
        id="hero"
        className="relative flex min-h-screen items-center justify-center overflow-hidden pt-24 pb-48"
      >
        <div className="absolute inset-0 -z-10">
          <Image
            src="/images/landing/horse-double-black.webp"
            alt="Majestic racehorses representing Evolution Stables digital ownership"
            fill
            priority
            sizes="100vw"
            className="object-cover object-center"
          />
          <div className="absolute inset-0 bg-canvas/35" />
        </div>

        <div className="relative z-10 mx-auto flex w-full max-w-5xl flex-col items-start gap-4 px-8 pb-16 md:px-12">
          <h1 className="w-full max-w-3xl">
            <Image
              src="/brand/lockups/lockup-horizontal-gold.svg"
              alt="Evolution Stables — Digital Racehorse Ownership"
              width={1200}
              height={400}
              priority
              className="h-auto w-full"
            />
          </h1>

          <p className="mt-10 max-w-3xl text-label font-medium uppercase leading-body tracking-label text-edge">
            <span className="whitespace-nowrap">Grounded in tradition.</span>
            <br />
            <span className="whitespace-nowrap">Evolved through innovation.</span>
            <br />
            Ownership transformed.
          </p>
        </div>
      </section>

      <section id="about" className="bg-canvas py-section">
        <div className="mx-auto w-full max-w-6xl px-12 md:px-16 lg:px-20">
          <p className="label-eyebrow mb-12 text-muted-foreground">About</p>
          <h2 className="mb-8 text-section-heading font-light leading-display tracking-display text-heading md:text-section-heading-wide">
            Own the Experience
          </h2>
          <p className="mt-6 text-body font-light leading-body text-ink">
            Racehorse ownership has changed. Evolution Stables lists Thoroughbreds as Digital
            Syndication Leases — the horse, the trainer, and the commercial terms in one agreement.
            Being an owner is easier than you think.
          </p>
        </div>
      </section>

      <PhotographicDivider
        src="/images/landing/hooves-black-white.webp"
        alt="Thoroughbred hooves in motion"
      />

      <section id="mission" className="bg-canvas py-section">
        <div className="mx-auto w-full max-w-6xl px-12 md:px-16 lg:px-20">
          <div className="mb-16">
            <p className="label-eyebrow mb-12 text-muted-foreground">Our Mission</p>
            <h2 className="mb-8 text-section-heading font-light leading-display tracking-display text-heading md:text-section-heading-wide">
              How It Works
            </h2>
            <p className="text-body font-light leading-body text-ink">
              At Evolution Stables, we understand that ownership is the lifeblood of racing — and
              strengthening it benefits every part of the industry.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {AUDIENCE_CARDS.map((card) => (
              <article
                key={card.tag}
                className="group flex flex-col overflow-hidden rounded-lg border border-border bg-surface transition-colors duration-hover hover:border-edge lg:h-[340px]"
              >
                <div className="flex h-28 flex-col justify-center border-b border-border bg-surface p-6">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="label-spec mb-2 text-muted-foreground">{card.tag}</p>
                      <h3 className="text-body font-light leading-heading text-heading">
                        {card.title}
                      </h3>
                    </div>
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors duration-hover group-hover:border-edge group-hover:text-hover">
                      +
                    </span>
                  </div>
                </div>
                <div className="flex-1 bg-canvas/40 p-6">
                  <p className="text-body-small font-light leading-body text-muted-foreground transition-colors duration-hover group-hover:text-hover">
                    {card.description}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <PhotographicDivider
        src="/images/landing/landscape-digital-overlay.webp"
        alt="Pastoral horse landscape"
      />

      <section id="digital-syndication" className="bg-canvas py-section">
        <div className="mx-auto w-full max-w-6xl px-12 md:px-16 lg:px-20">
          <p className="label-eyebrow mb-12 text-muted-foreground">Our Model</p>

          <div className="grid gap-16 lg:grid-cols-2 lg:gap-32">
            <div className="space-y-8">
              <h2 className="text-section-heading font-light leading-display tracking-display text-heading md:text-section-heading-wide">
                Digital Syndication
              </h2>
              <p className="text-body font-light leading-body text-ink">
                Syndication has always been the heartbeat of racehorse ownership — sharing risk,
                reward, and the thrill of the sport. But the way people participate has changed.
              </p>
              <p className="text-body font-light leading-body text-ink">
                Our digital-syndication model builds on that legacy — lowering barriers, increasing
                transparency, and unlocking new ways for owners, investors, and fans to participate —
                without replacing what works.
              </p>
            </div>

            <div className="flex flex-col justify-end">
              <div className="space-y-6">
                {BENEFITS.map((benefit) => (
                  <div key={benefit.title} className="py-2">
                    <div className="flex items-center gap-6">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center">
                        <Image
                          src={benefit.src}
                          alt={benefit.alt}
                          width={48}
                          height={48}
                          className="h-10 w-10 brightness-0 invert opacity-80"
                        />
                      </div>
                      <div>
                        <h3 className="label-eyebrow mb-3 text-heading">{benefit.title}</h3>
                        <p className="text-body-small font-light leading-body text-muted-foreground">
                          {benefit.description}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <PhotographicDivider
        src="/images/landing/horse-and-foal.webp"
        alt="Mare and newborn foal"
      />

      <section id="marketplace" className="bg-canvas py-section">
        <div className="mx-auto w-full max-w-6xl px-12 md:px-16 lg:px-20">
          <p className="label-eyebrow mb-12 text-muted-foreground">Regulated Marketplace</p>
          <h2 className="mb-6 text-section-heading font-light leading-display tracking-display text-heading md:text-section-heading-wide">
            Transformation Powered
            <br />
            by <span className="text-spot-mint">Regulation</span>
          </h2>
          <p className="mb-16 max-w-3xl text-body font-light leading-body text-muted-foreground">
            Evolution Stables operates as an Authorised Syndicator — delivering regulated,
            financial-grade infrastructure built for modern racehorse owners.
          </p>

          <div className="mt-32 grid grid-cols-1 md:grid-cols-3">
            {MARKETPLACE_FEATURES.map((feature) => (
              <article
                key={feature.title}
                className="flex flex-col gap-6 border-l border-border px-8 py-12 transition-colors duration-hover hover:border-gold md:px-10 md:py-16"
              >
                <MarketplaceIcon icon={feature.icon} />
                <div className="space-y-4">
                  <h3 className="text-card-heading font-light leading-heading text-heading">
                    {feature.title}
                  </h3>
                  <p className="text-body-small font-light italic leading-body text-muted-foreground">
                    {feature.description}
                  </p>
                </div>
              </article>
            ))}
          </div>

          <div className="mt-20">
            <Link
              href="/marketplace"
              className="label-action inline-flex items-center gap-2 text-heading transition-colors duration-hover hover:text-gold"
            >
              <span>View current offerings</span>
              <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>
      </section>

      <PhotographicDivider
        src="/images/landing/hooves-on-grass.webp"
        alt="Hooves running on grass track"
      />

      <section id="news" className="relative overflow-hidden bg-canvas py-24">
        <div className="mx-auto w-full max-w-6xl space-y-24 px-12 md:px-16 lg:px-20">
          <div>
            <p className="label-eyebrow mb-12 text-muted-foreground">News and Updates</p>

            <div className="grid grid-cols-1 gap-0 lg:grid-cols-[6fr_4fr]">
              <div className="flex flex-col justify-center py-8 lg:pr-12">
                <div className="space-y-8">
                  <div className="flex items-center gap-4">
                    <span className="label-eyebrow text-muted-foreground">Coming soon</span>
                    <span className="h-px w-8 bg-border" aria-hidden="true" />
                    <span className="label-eyebrow text-ink">Evolution Stables</span>
                  </div>

                  <div className="relative flex h-96 w-full items-center justify-center overflow-hidden rounded-sm border border-border bg-surface">
                    <div className="max-w-md px-8 text-center">
                      <p className="label-eyebrow text-gold">The stable journal</p>
                      <p className="mt-4 text-body font-light leading-body text-heading">
                        Stable stories, race updates and press coverage will appear here.
                      </p>
                    </div>
                  </div>

                  <h3 className="text-section-heading font-light leading-display tracking-display text-heading">
                    News from the Stable
                  </h3>
                  <p className="text-body-small font-light leading-body text-muted-foreground">
                    We are preparing the next chapter of campaign news, race reports and industry
                    coverage. Nothing is published yet.
                  </p>
                </div>
              </div>

              <div className="flex flex-col py-8 lg:pl-12">
                <div className="border-y border-border" aria-hidden="true">
                  {[0, 1, 2, 3].map((index) => (
                    <div
                      key={index}
                      className={`flex items-center justify-between gap-6 py-6 ${
                        index === 3 ? '' : 'border-b border-border'
                      }`}
                    >
                      <div className="flex-1 space-y-3">
                        <span className="block h-2 w-20 rounded-full bg-raised" />
                        <span className="block h-3 w-full max-w-sm rounded-full bg-raised" />
                      </div>
                      <span className="text-muted-foreground">+</span>
                    </div>
                  ))}
                </div>
                <p className="label-eyebrow mt-10 text-muted-foreground">More stories coming soon</p>
              </div>
            </div>
          </div>

          <div>
            <p className="label-eyebrow mb-12 text-muted-foreground">As Featured In</p>
            <div className="relative w-full overflow-hidden pb-6">
              <div className="flex w-max animate-marquee items-center gap-16 py-4 motion-reduce:animate-none">
                {[...PARTNERS, ...PARTNERS].map((partner, index) => (
                  <div
                    key={`${partner.alt}-${index}`}
                    className="relative flex h-10 w-36 shrink-0 items-center justify-center opacity-60 grayscale transition-opacity duration-hover hover:opacity-100"
                    aria-hidden={index >= PARTNERS.length}
                  >
                    <Image
                      src={partner.src}
                      alt={index < PARTNERS.length ? partner.alt : ''}
                      width={partner.width}
                      height={partner.height}
                      loading="eager"
                      className="max-h-8 w-auto object-contain"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="faq" className="bg-canvas py-section">
        <div className="mx-auto w-full max-w-6xl px-12 md:px-16 lg:px-20">
          <p className="label-eyebrow mb-12 text-muted-foreground">FAQ</p>
          <h2 className="mb-6 text-section-heading font-light leading-display tracking-display text-heading md:text-section-heading-wide">
            Understanding
            <br />
            Digital-Syndication
          </h2>
          <p className="mb-24 max-w-xl text-card-heading font-light leading-body text-muted-foreground">
            A considered guide to the essentials — how digital-syndication works, what it means for
            ownership, and where Evolution Stables fits in.
          </p>
          <div className="mx-auto max-w-3xl">
            <FaqAccordion items={FAQS} />
          </div>
        </div>
      </section>

      <section className="border-t border-border bg-canvas py-32 text-center">
        <div className="mx-auto max-w-3xl px-12">
          <h2 className="text-section-heading font-light leading-display tracking-display text-heading md:text-section-heading-wide">
            The Future of <span className="text-gold">Ownership</span>
            <br />
            Has Arrived
          </h2>
          <p className="label-eyebrow mt-8 text-muted-foreground">
            Digital-Syndication, by Evolution Stables
          </p>
        </div>
      </section>
    </main>
  )
}
