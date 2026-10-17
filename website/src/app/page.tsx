import Image from 'next/image'
import Link from 'next/link'

import { LOGO_PATH, SITE_URL } from '../lib/site'

// Step 6a landing page. The nine sections locked in audit/design/README.md
// (decision 2, 2026-10-15). Reads zero rows from Postgres — nothing here waits
// on a policy or on data.
//
// Step 6b-ii added the site half of the search layer: the organisation and the
// website are carried here (PLAN.md:80), and the two marketplace calls to action
// are links at last rather than paragraphs. The nine sections are otherwise
// untouched, and the page still reads zero rows.
//
// Note on the hero: no horse or divider photography exists on disk (OPEN-2), so
// the hero image stage is not built in 6a. The stage treatment is the lockup on
// canvas. This is a deliberate omission, not a placeholder.

type Audience = { label: string; heading: string; body: string }
type Feature = { title: string; body: string }
type Step = { index: string; title: string; body: string }
type Update = { date: string; author: string; publisher: string; title: string }
type Faq = { question: string; answer: string }

const AUDIENCES: Audience[] = [
  {
    label: 'Owners',
    heading: 'Own the horse, not the paperwork',
    body: 'Hold a registered share with the split, the fees and the return band written down before you commit.',
  },
  {
    label: 'Trainers',
    heading: 'One place for every stake',
    body: 'Your stable page carries the horses, the owners and the updates. No spreadsheets passed between parties.',
  },
  {
    label: 'Syndicators',
    heading: 'Raise without the admin drag',
    body: 'Structured offers, regulated disclosure, and a settlement record that stands up to scrutiny.',
  },
]

const FEATURES: Feature[] = [
  {
    title: 'Regulated by design',
    body: 'Every offer is built to the disclosure standard, not retrofitted to it.',
  },
  {
    title: 'Transparent economics',
    body: 'The split, the per-percent rate and the reserve are figures you can read before you sign.',
  },
  {
    title: 'Settled on the record',
    body: 'Every stake, transfer and payout leaves a trail that survives an audit.',
  },
]

const STEPS: Step[] = [
  { index: '01', title: 'Browse', body: 'See available horses with the numbers attached.' },
  { index: '02', title: 'Stake', body: 'Choose a percentage. The rate and the term are fixed at that moment.' },
  { index: '03', title: 'Settle', body: 'Ownership is recorded, and the updates follow the horse.' },
]

const UPDATES: Update[] = [
  { date: 'Coming soon', author: 'Evolution Stables', publisher: 'Newsroom', title: 'News and updates land here' },
  { date: 'Coming soon', author: 'Evolution Stables', publisher: 'Newsroom', title: 'Race results and stable notes' },
  { date: 'Coming soon', author: 'Evolution Stables', publisher: 'Newsroom', title: 'Ownership and syndication news' },
]

const FAQS: Faq[] = [
  {
    question: 'What exactly am I buying?',
    answer: 'A registered percentage of a thoroughbred, with the split, the per-percent rate and the term recorded at the point of purchase.',
  },
  {
    question: 'Who looks after the horse?',
    answer: 'A licensed trainer. The stable page carries the horse, its owners and its updates in one place.',
  },
  {
    question: 'How is the price set?',
    answer: 'Each percentage has a rate derived from the wholesale figure. It is published before the offer opens.',
  },
  {
    question: 'What is the return band?',
    answer: 'A published range for investor return. It is a band, not a promise, and it is written into the offer.',
  },
  {
    question: 'When can I sell?',
    answer: 'Transfers are recorded on the platform, so a stake can change hands without rebuilding the record.',
  },
  {
    question: 'Is this regulated?',
    answer: 'The offer structure is built to the disclosure standard. Documents are provided for every open stake.',
  },
]

const PARTNERS = [
  { src: '/images/partners/arabian-business.png', alt: 'Arabian Business', width: 160, height: 40 },
  { src: '/images/partners/businessdesk.jpg', alt: 'BusinessDesk', width: 160, height: 40 },
  { src: '/images/partners/investing-com.png', alt: 'Investing.com', width: 160, height: 40 },
  { src: '/images/partners/nztr-white.png', alt: 'NZTR', width: 100, height: 40 },
  { src: '/images/partners/singularry.webp', alt: 'Singularry', width: 140, height: 40 },
  { src: '/images/partners/stephen-grey-racing.png', alt: 'Stephen Grey Racing', width: 160, height: 40 },
  { src: '/images/partners/tokinvest-light.png', alt: 'Tokinvest', width: 150, height: 40 },
  { src: '/images/partners/trackside-nz.png', alt: 'Trackside NZ', width: 150, height: 40 },
  { src: '/images/partners/wexford-stables.jpg', alt: 'Wexford Stables', width: 150, height: 40 },
]

const SHELL = 'mx-auto w-full max-w-6xl px-12 md:px-16 lg:px-20'

/**
 * The organisation and the website, and nothing else.
 *
 * `PLAN.md:80` puts both on the landing page. The horse's own structured data
 * lives on its horse page at `/marketplace/[slug]`, never here (`PLAN.md:85`).
 *
 * Every URL is absolute and built from `SITE_URL`, because a canonical on the
 * apex host is the mistake `PLAN.md:84` rules out. The logo is a path composed
 * with the same origin rather than written out, so the `www` host has one home.
 */
const STRUCTURED_DATA = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': `${SITE_URL}/#organization`,
      name: 'Evolution Stables',
      url: SITE_URL,
      description:
        'Digital syndication for thoroughbred ownership. Regulated, transparent, and built on the horse.',
      logo: `${SITE_URL}${LOGO_PATH}`,
    },
    {
      '@type': 'WebSite',
      '@id': `${SITE_URL}/#website`,
      url: SITE_URL,
      name: 'Evolution Stables',
      publisher: { '@id': `${SITE_URL}/#organization` },
    },
  ],
}

export default function Page() {
  return (
    <main className="bg-canvas text-ink">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(STRUCTURED_DATA) }}
      />

      {/* 1 · Hero — horizontal brand lockup over the stage. No button. */}
      <section className={`${SHELL} pt-32 pb-24`}>
        <Image
          src="/brand/lockups/lockup-horizontal-gold.svg"
          alt="Evolution Stables"
          width={420}
          height={96}
          priority
        />
        <h1 className="mt-16 max-w-3xl text-display leading-display tracking-display text-heading">
          The Future of <span className="type-accent text-gold">Ownership</span> Has Arrived
        </h1>
        <p className="mt-8 max-w-xl text-body-small leading-body text-muted-foreground">
          Digital syndication for thoroughbred racing. Regulated structure, published economics, and a
          record that holds.
        </p>
      </section>

      {/* 2 · About */}
      <section className={`${SHELL} border-t border-border py-24`}>
        <p className="label-eyebrow text-muted-foreground">About</p>
        <h2 className="mt-6 max-w-2xl text-section-heading leading-heading text-heading">
          Own the Experience
        </h2>
      </section>

      {/* 3 · Our Mission */}
      <section className={`${SHELL} border-t border-border py-24`}>
        <p className="label-eyebrow text-muted-foreground">Our Mission</p>
        <h2 className="mt-6 text-section-heading leading-heading text-heading">How It Works</h2>
        <ul className="mt-16 grid gap-8 md:grid-cols-3">
          {AUDIENCES.map((audience) => (
            <li key={audience.label} className="rounded-lg border border-border bg-surface p-8">
              <p className="label-badge text-gold">{audience.label}</p>
              <h3 className="mt-6 text-card-heading leading-heading text-heading">{audience.heading}</h3>
              <p className="mt-4 text-body-small leading-body text-muted-foreground">{audience.body}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* 4 · Our Model */}
      <section className={`${SHELL} border-t border-border py-24`}>
        <p className="label-eyebrow text-muted-foreground">Our Model</p>
        <h2 className="mt-6 text-section-heading leading-heading text-heading">Digital Syndication</h2>
        <ul className="mt-16 grid gap-8 md:grid-cols-3">
          {FEATURES.map((feature) => (
            <li key={feature.title} className="rounded-md border border-border bg-raised p-8">
              <span aria-hidden className="block h-1 w-10 rounded-pill bg-gold" />
              <h3 className="mt-8 text-card-heading leading-heading text-heading">{feature.title}</h3>
              <p className="mt-4 text-body-small leading-body text-muted-foreground">{feature.body}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* 5 · Marketplace */}
      <section className={`${SHELL} border-t border-border py-24`}>
        <p className="label-eyebrow text-muted-foreground">Marketplace</p>
        <h2 className="mt-6 max-w-2xl text-section-heading leading-heading text-heading">
          Transformation Powered by Regulation
        </h2>
        <ol className="mt-16 grid gap-8 md:grid-cols-3">
          {STEPS.map((step) => (
            <li key={step.index} className="rounded-lg border border-border p-8">
              <p className="label-spec text-gold">{step.index}</p>
              <h3 className="mt-6 text-card-heading leading-heading text-heading">{step.title}</h3>
              <p className="mt-4 text-body-small leading-body text-muted-foreground">{step.body}</p>
            </li>
          ))}
        </ol>
        <Link
          href="/marketplace"
          className="label-action mt-16 inline-block rounded-pill border border-gold px-8 py-4 text-gold"
        >
          Browse the marketplace
        </Link>
      </section>

      {/* 6 · News & Updates — static shell in 6a, zero rows read. */}
      <section className={`${SHELL} border-t border-border py-24`}>
        <p className="label-eyebrow text-muted-foreground">News &amp; Updates</p>
        <h2 className="mt-6 text-section-heading leading-heading text-heading">From the stable</h2>
        <ul className="mt-16 grid gap-8 md:grid-cols-3">
          {UPDATES.map((update) => (
            <li key={update.title} className="rounded-lg border border-border bg-surface p-8">
              <h3 className="text-card-heading leading-heading text-heading">{update.title}</h3>
              <p className="label-spec mt-6 text-muted-foreground">
                {update.date} · {update.author} · {update.publisher}
              </p>
            </li>
          ))}
        </ul>
      </section>

      {/* 7 · As Featured In — looping marquee, monochrome. Gold is not spent here. */}
      <section className="border-t border-border py-24">
        <p className={`${SHELL} label-eyebrow text-muted-foreground`}>As Featured In</p>
        <div className="mt-16 overflow-hidden">
          <div className="animate-marquee flex w-max items-center gap-16">
            {[...PARTNERS, ...PARTNERS].map((partner, index) => (
              <Image
                key={`${partner.src}-${index}`}
                src={partner.src}
                alt={partner.alt}
                width={partner.width}
                height={partner.height}
                className="h-10 w-auto opacity-50"
              />
            ))}
          </div>
        </div>
      </section>

      {/* 8 · FAQ */}
      <section className={`${SHELL} border-t border-border py-24`}>
        <p className="label-eyebrow text-muted-foreground">FAQ</p>
        <h2 className="mt-6 text-section-heading leading-heading text-heading">Questions</h2>
        <dl className="mt-16 max-w-3xl">
          {FAQS.map((faq) => (
            <details key={faq.question} className="border-b border-border py-6">
              <summary className="label-action cursor-pointer text-heading">{faq.question}</summary>
              <dd className="mt-4 text-body-small leading-body text-muted-foreground">{faq.answer}</dd>
            </details>
          ))}
        </dl>
      </section>

      {/* 9 · Closing CTA */}
      <section className={`${SHELL} border-t border-border py-32`}>
        <h2 className="max-w-3xl text-section-heading-wide leading-display tracking-display text-heading">
          The Future of Ownership Has Arrived
        </h2>
        <Link
          href="/marketplace"
          className="label-action mt-12 inline-block rounded-pill bg-gold px-8 py-4 text-on-gold"
        >
          Explore the marketplace
        </Link>
      </section>

      <footer className={`${SHELL} border-t border-border py-16`}>
        <Image src="/brand/wordmark/wordmark-muted-grey.svg" alt="Evolution Stables" width={180} height={40} />
        <p className="label-spec mt-8 text-muted-foreground">
          Evolution Stables · Digital syndication for thoroughbred racing
        </p>
      </footer>
    </main>
  )
}
