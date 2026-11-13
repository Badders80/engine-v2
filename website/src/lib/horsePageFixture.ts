import type { DslStatus } from './listings'

export type HorseFact = {
  label: string
  value: string
}

export type HorseDetails = {
  overview: {
    title: string
    paragraphs: readonly string[]
  }
  pedigree: {
    rows: readonly HorseFact[]
    note: string
  }
  trainer: {
    name: string
    location: string
    website: string
    paragraphs: readonly string[]
  }
  raceRecord: {
    summary: string
    note: string
  }
  documents: {
    title: string
    body: string
    restrictedTitle: string
    restrictedBody: string
  }
}

export type HorsePageFixture = {
  slug: string
  legalName: string
  status: DslStatus
  gallery: readonly string[]
  facts: readonly HorseFact[]
  story: readonly string[]
  details: HorseDetails
  offer: {
    listedStake: string
    price: string
    priceUnit: string
    investorReturn: string
    expiry: string
    benefits: readonly {
      title: string
      body: string
    }[]
    ctaLabel: string
    ctaHref: string
  }
}

const MULAN: HorsePageFixture = {
  slug: 'mulan-the-brave',
  legalName: 'Mulan The Brave (NZ)',
  status: 'available',
  gallery: [
    '/images/marketplace/horse/mulan-the-brave/01.png',
    '/images/marketplace/horse/mulan-the-brave/02.webp',
    '/images/marketplace/horse/mulan-the-brave/03.jpg',
  ],
  facts: [
    { label: 'Age', value: '3yr' },
    { label: 'Sex', value: 'Filly' },
    { label: 'Colour', value: 'Bay' },
    { label: 'Sire', value: 'Turn Me Loose (NZ)' },
    { label: 'Dam', value: 'Yearn (NZ)' },
  ],
  story: [
    "Mulan The Brave (NZ) is a bay 2YO filly by triple Group 1-winning miler Turn Me Loose out of Group 2 Auckland Thoroughbred Breeders' Stakes winner Yearn, by Champion Sire Savabeel. Foaled on 17 August 2023, she represents a deliberate cross of proven Australian miler speed with the durable, black-type form of a New Zealand staying mare.",
    "Her immediate family combines precocity with resilience: Turn Me Loose won Group 1 races between 1400 metres and 1600 metres, while Yearn was a stakes-performed miler who banked $339,895 in prizemoney. In early education at Copper Belt Lodge, Mulan has shown the alertness and balanced action that fit the typical early-2YO campaign of her pedigree.",
  ],
  details: {
    overview: {
      title: 'Pedigree and campaign',
      paragraphs: [
        "By Turn Me Loose, a three-time Group 1 winner in New Zealand and Australia, out of Yearn, a Group 2 Auckland Thoroughbred Breeders' Stakes winner by Champion Sire Savabeel.",
        "Mulan's pedigree profile fits an early 2YO speed campaign through late spring and summer, with the scope to stretch to mile-graded company as a 3YO filly. The target pathway is a 2YO introduction over sprint-to-mile distances, then progression into autumn 3YO fillies' events.",
      ],
    },
    pedigree: {
      rows: [
        { label: 'Subject', value: 'Mulan The Brave (NZ)' },
        { label: 'Sire', value: 'Turn Me Loose (NZ)' },
        { label: 'Dam', value: 'Yearn (NZ)' },
        { label: 'Sex', value: 'Filly' },
        { label: 'Colour', value: 'Bay' },
        { label: 'Foaled', value: '17 Aug 2023' },
      ],
      note: 'The stored campaign record identifies the immediate pedigree. A full black-type record remains an operator-supplied source document.',
    },
    trainer: {
      name: 'Stephen Gray Racing',
      location: 'Copper Belt Lodge, Palmerston North, NZ',
      website: 'https://stephengrayracing.com/contact/',
      paragraphs: [
        "Mulan is prepared by Stephen Gray Racing from Copper Belt Lodge in Palmerston North. A Group 1-winning international trainer, Stephen returned to New Zealand after a long Singapore career and now trains from the family yard alongside his father, Kevin Gray.",
      ],
    },
    raceRecord: {
      summary: '0 wins · 0 places',
      note: 'No recent starts recorded. Mulan is currently in pre-training preparation.',
    },
    documents: {
      title: 'Legal disclosures and Investor Pack',
      body: 'Ownership is governed by the Product Disclosure Statement and Syndicate Agreement. The combined Investor Pack becomes available after account verification.',
      restrictedTitle: 'Verified investors only',
      restrictedBody: 'Sign in to access the frozen Investor Pack and its document record.',
    },
  },
  offer: {
    listedStake: '5%',
    price: '$65',
    priceUnit: 'per 1% / month',
    investorReturn: '75%',
    expiry: 'Jun 2028',
    benefits: [
      {
        title: 'Stable access',
        body: 'Quarterly visits to the training facility and trackside privileges.',
      },
      {
        title: 'Regular updates',
        body: 'Audio and video reports from the stable through the campaign.',
      },
    ],
    ctaLabel: 'Become an owner',
    ctaHref: '/login?next=%2Fmarketplace%2Fmulan-the-brave',
  },
}

const FIXTURES: Readonly<Record<string, HorsePageFixture>> = {
  [MULAN.slug]: MULAN,
}

export function getHorsePageFixture(slug: string): HorsePageFixture | null {
  return FIXTURES[slug] ?? null
}
