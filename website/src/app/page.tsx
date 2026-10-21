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
      'Ownership is the gateway to deeper engagement — turning one-time spectators into lifelong members, building revenue, and strengthening the sport’s future, all in one place.',
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

      {/* Hero Section */}
      <section
        id="hero"
        className="relative flex min-h-[90vh] items-center justify-center overflow-hidden px-12 py-32 text-center md:px-16 lg:px-20"
      >
        <div className="absolute inset-0 -z-10">
          <Image
            src="/images/landing/horse-double-black.webp"
            alt="Evolution Stables Thoroughbreds"
            fill
            priority
            sizes="100vw"
            className="object-cover object-center"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-canvas via-canvas/60 to-transparent" />
        </div>

        <div className="mx-auto max-w-4xl pt-16">
          <h1 className="text-display font-light uppercase tracking-tight text-heading sm:text-7xl md:text-8xl">
            Evolution
            <br />
            <span className="text-gold">Stables</span>
          </h1>

          <p className="label-eyebrow mt-8 text-gold/90">
            Grounded in tradition. Evolved through innovation. Ownership transformed.
          </p>
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="py-28">
        <div className="mx-auto w-full max-w-6xl px-12 md:px-16 lg:px-20">
          <p className="label-eyebrow text-muted-foreground">About</p>

          <h2 className="mt-8 text-section-heading font-light text-heading md:text-section-heading-wide">
            Own the Experience
          </h2>

          <p className="mt-8 max-w-3xl text-body font-light leading-body text-heading md:text-card-heading">
            Racehorse ownership has changed. Evolution Stables lists Thoroughbreds as Digital
            Syndication Leases — the horse, the trainer, and the commercial terms in one agreement.
            Being an owner is easier than you think.
          </p>
        </div>
      </section>

      {/* Divider 1 */}
      <PhotographicDivider
        src="/images/landing/hooves-black-white.webp"
        alt="Thoroughbred hooves in motion"
      />

      {/* Our Mission / How It Works */}
      <section id="mission" className="py-28">
        <div className="mx-auto w-full max-w-6xl px-12 md:px-16 lg:px-20">
          <p className="label-eyebrow text-muted-foreground">Our Mission</p>

          <h2 className="mt-8 text-section-heading font-light text-heading md:text-section-heading-wide">
            How It Works
          </h2>

          <p className="mt-6 max-w-3xl text-body font-light leading-body text-muted-foreground">
            At Evolution Stables, we understand that ownership is the lifeblood of racing — and
            strengthening it benefits every part of the industry.
          </p>

          <div className="mt-16 grid gap-8 md:grid-cols-3">
            {AUDIENCE_CARDS.map((card) => (
              <div
                key={card.tag}
                className="flex flex-col rounded-lg border border-border bg-surface p-8 transition-colors duration-hover hover:border-gold/40"
              >
                <p className="label-eyebrow text-gold">{card.tag}</p>
                <h3 className="mt-4 text-card-heading font-light text-heading">{card.title}</h3>
                <p className="mt-4 text-body-small font-light leading-body text-muted-foreground">
                  {card.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Divider 2 */}
      <PhotographicDivider
        src="/images/landing/landscape-digital-overlay.webp"
        alt="Pastoral horse landscape"
      />

      {/* Our Model / Digital Syndication */}
      <section id="digital-syndication" className="py-28">
        <div className="mx-auto w-full max-w-6xl px-12 md:px-16 lg:px-20">
          <div className="grid gap-16 md:grid-cols-2 md:items-start">
            <div>
              <p className="label-eyebrow text-muted-foreground">Our Model</p>
              <h2 className="mt-8 text-section-heading font-light text-heading md:text-section-heading-wide">
                Digital Syndication
              </h2>
            </div>

            <div className="space-y-12">
              <div className="flex gap-6">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-border bg-surface text-gold">
                  <Image
                    src="/images/content/icons/increased-access.svg"
                    alt="Increased Access"
                    width={24}
                    height={24}
                    className="h-6 w-6"
                  />
                </div>
                <div>
                  <h3 className="label-action text-heading">Increased Access</h3>
                  <p className="mt-2 text-body font-light leading-body text-muted-foreground">
                    A digital platform that lowers barriers and opens ownership to everyone.
                  </p>
                </div>
              </div>

              <div className="flex gap-6">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-border bg-surface text-gold">
                  <Image
                    src="/images/content/icons/greater-than-equal.svg"
                    alt="Greater Transparency"
                    width={24}
                    height={24}
                    className="h-6 w-6"
                  />
                </div>
                <div>
                  <h3 className="label-action text-heading">Greater Transparency</h3>
                  <p className="mt-2 text-body font-light leading-body text-muted-foreground">
                    Real-time performance, clear costs, and open communication.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Divider 3 */}
      <PhotographicDivider
        src="/images/landing/horse-and-foal.webp"
        alt="Mare and newborn foal"
      />

      {/* Regulated Marketplace */}
      <section id="marketplace" className="py-28">
        <div className="mx-auto w-full max-w-6xl px-12 md:px-16 lg:px-20">
          <p className="label-eyebrow text-muted-foreground">Regulated Marketplace</p>

          <h2 className="mt-8 text-section-heading font-light text-heading md:text-section-heading-wide">
            Transformation Powered by <span className="text-spot-mint">Regulation</span>
          </h2>

          <p className="mt-6 max-w-3xl text-body font-light leading-body text-muted-foreground">
            Evolution Stables operates as an Authorised Syndicator — delivering regulated,
            financial-grade infrastructure built for modern racehorse owners.
          </p>

          <div className="mt-16 grid gap-8 md:grid-cols-2">
            <div className="rounded-lg border border-border bg-surface p-8">
              <h3 className="text-card-heading font-light text-heading">Discover Opportunities</h3>
              <p className="mt-4 text-body font-light leading-body text-muted-foreground">
                Explore available syndications and short-term leases — all clearly structured, fully
                transparent, and ready to invest in with confidence.
              </p>
            </div>

            <div className="rounded-lg border border-border bg-surface p-8">
              <h3 className="text-card-heading font-light text-heading">Trade with Confidence</h3>
              <p className="mt-4 text-body font-light leading-body text-muted-foreground">
                Our regulated platform ensures secure transactions, compliant ownership records,
                and integrated settlement — so every trade is safe, clear, and straightforward.
              </p>
            </div>
          </div>

          <div className="mt-12">
            <Link
              href="/marketplace"
              className="label-action inline-flex items-center gap-2 text-gold transition-colors duration-hover hover:text-gold-hover"
            >
              View Current Offerings <span>→</span>
            </Link>
          </div>
        </div>
      </section>

      {/* Divider 4 */}
      <PhotographicDivider
        src="/images/landing/hooves-on-grass.webp"
        alt="Hooves running on grass track"
      />

      {/* News and Updates Section */}
      <section id="news" className="py-28">
        <div className="mx-auto w-full max-w-6xl px-12 md:px-16 lg:px-20">
          <p className="label-eyebrow text-muted-foreground">News and Updates</p>

          <h2 className="mt-8 text-section-heading font-light text-heading md:text-section-heading-wide">
            From the Stable
          </h2>

          <div className="mt-16 grid gap-12 lg:grid-cols-12">
            {/* Featured Lead Card */}
            <div className="overflow-hidden rounded-lg border border-border bg-surface lg:col-span-7">
              <div className="relative h-64 w-full">
                <Image
                  src="/images/news/prudentia_te_rapa_may30.jpg"
                  alt="Prudentia campaigning at Te Rapa"
                  fill
                  sizes="(max-width: 1024px) 100vw, 600px"
                  className="object-cover"
                />
              </div>
              <div className="p-8">
                <div className="flex items-center gap-4 text-micro text-muted-foreground">
                  <span className="label-spec">10.06.2026</span>
                  <span>•</span>
                  <span className="label-spec">Evolution Stables</span>
                </div>
                <h3 className="mt-4 text-card-heading font-light text-heading">
                  Tauranga Target: Prudentia Pivots Campaign
                </h3>
                <p className="mt-4 text-body-small font-light leading-body text-muted-foreground">
                  A minor foot issue has prompted the stable to withdraw Prudentia from this
                  Saturday&apos;s engagement. She will continue low-impact swimming work to protect
                  her feet before targeting a benchmark 75 event at Tauranga on 27 June.
                </p>
              </div>
            </div>

            {/* Coverage List */}
            <div className="flex flex-col justify-between space-y-6 lg:col-span-5">
              <div className="divide-y divide-border border-y border-border">
                <div className="py-4">
                  <span className="label-spec text-gold">Investing.com</span>
                  <h4 className="mt-1 text-body-small font-light text-heading">
                    Digital Syndication Reimagines Thoroughbred Ownership Access
                  </h4>
                </div>
                <div className="py-4">
                  <span className="label-spec text-gold">Evolution Stables</span>
                  <h4 className="mt-1 text-body-small font-light text-heading">
                    Te Rapa Review: Prudentia Finishes Tenaciously
                  </h4>
                </div>
                <div className="py-4">
                  <span className="label-spec text-gold">Evolution Stables</span>
                  <h4 className="mt-1 text-body-small font-light text-heading">
                    Prudentia Wins at Te Rapa in Gutsy Heavy Track Performance
                  </h4>
                </div>
                <div className="py-4">
                  <span className="label-spec text-gold">Trackside NZ</span>
                  <h4 className="mt-1 text-body-small font-light text-heading">
                    Thoroughbred Ownership Reimagined for Modern Investors
                  </h4>
                </div>
              </div>

              <Link
                href="/marketplace"
                className="label-action inline-flex items-center gap-2 text-gold transition-colors duration-hover hover:text-gold-hover"
              >
                Explore Offerings <span>→</span>
              </Link>
            </div>
          </div>

          {/* As Featured In Marquee */}
          <div className="mt-28 border-t border-border pt-16">
            <p className="label-eyebrow text-center text-muted-foreground">As Featured In</p>

            <div className="relative mt-12 w-full overflow-hidden">
              <div className="flex w-max animate-marquee items-center gap-16 py-4">
                {[...PARTNERS, ...PARTNERS].map((partner, index) => (
                  <div
                    key={`${partner.alt}-${index}`}
                    className="relative flex h-10 w-36 shrink-0 items-center justify-center opacity-60 grayscale transition-opacity duration-hover hover:opacity-100"
                  >
                    <Image
                      src={partner.src}
                      alt={partner.alt}
                      width={partner.width}
                      height={partner.height}
                      className="max-h-8 w-auto object-contain"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="py-28">
        <div className="mx-auto w-full max-w-6xl px-12 md:px-16 lg:px-20">
          <p className="label-eyebrow text-muted-foreground">FAQ</p>

          <h2 className="mt-8 text-section-heading font-light text-heading md:text-section-heading-wide">
            Understanding Digital-Syndication
          </h2>

          <p className="mt-6 max-w-3xl text-body font-light leading-body text-muted-foreground">
            A considered guide to the essentials — how digital-syndication works, what it means for
            ownership, and where Evolution Stables fits in.
          </p>

          <div className="mt-16">
            <FaqAccordion items={FAQS} />
          </div>
        </div>
      </section>

      {/* Final Dramatic CTA */}
      <section className="border-t border-border py-32 text-center">
        <div className="mx-auto max-w-3xl px-12">
          <h2 className="text-section-heading font-light text-heading md:text-section-heading-wide">
            The Future of <span className="type-accent text-gold">Ownership</span> Has Arrived
          </h2>

          <p className="label-eyebrow mt-6 text-muted-foreground">
            Digital Syndication, by Evolution Stables
          </p>

          <div className="mt-10">
            <Link
              href="/marketplace"
              className="label-action inline-block rounded-full bg-gold px-8 py-3.5 text-on-gold transition-colors duration-hover hover:bg-gold-hover"
            >
              Explore the Marketplace
            </Link>
          </div>
        </div>
      </section>
    </main>
  )
}
