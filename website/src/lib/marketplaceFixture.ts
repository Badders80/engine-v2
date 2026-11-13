import { sortForMarketplace } from './listings'
import type { MarketplaceCard } from './marketplace'

/**
 * Local visual-proof data for the Marketplace checkpoint.
 *
 * This is public production content copied into an explicit preview fixture. It
 * is never selected unless `WEBSITE_MARKETPLACE_FIXTURE=true`, and it performs no
 * database writes. Status order still comes from the application's one
 * `sortForMarketplace` function rather than from this file's array order.
 */
const FIXTURE: readonly MarketplaceCard[] = [
  {
    id: 'fixture-i-stole-a-manolo',
    status: 'coming_soon',
    endDate: '2027-04-30',
    horse: { slug: 'i-stole-a-manolo', legalName: 'I Stole A Manolo (NZ)' },
    hook: 'Deep speed pedigree by Group 1 sire Satono Aladdin, conditioned at Wexford Stables.',
    tags: [
      'By Gr.1 Sire Satono Aladdin',
      'Dam by Jimmy Choux',
      'Wexford Stables',
      'Spring 3YO Progression',
    ],
    imageSrc: '/images/marketplace/fixture/i-stole-a-manolo-BG.png',
  },
  {
    id: 'fixture-lady-ketchikan',
    status: 'coming_soon',
    endDate: '2027-05-31',
    horse: { slug: 'lady-ketchikan', legalName: 'Lady Ketchikan (NZ)' },
    hook: 'Classic 3YO filly by European Champion sire Almanzor, in active race preparation at Byerley Park.',
    tags: [
      'By Almanzor (FR)',
      'Classic Frame & Scope',
      'Byerley Park Trained',
      'Autumn 3YO Progression',
    ],
    imageSrc: '/images/marketplace/fixture/lady-ketchikan-BG.png',
  },
  {
    id: 'fixture-mulan-the-brave',
    status: 'available',
    endDate: '2028-06-30',
    horse: { slug: 'mulan-the-brave', legalName: 'Mulan The Brave (NZ)' },
    hook: 'Precocious 2YO filly by triple Gr.1 winner Turn Me Loose out of Gr.2 winner Yearn ($339k).',
    tags: [
      'Out of Gr.2 Winner Yearn ($339k)',
      'Triple Gr.1 Sire Line',
      'Precocious 2YO Target',
      'Stephen Gray Racing',
    ],
    imageSrc: '/images/marketplace/fixture/mulan-the-brave-BG.png',
  },
  {
    id: 'fixture-hottathanafantasy',
    status: 'fully_allocated',
    endDate: '2027-03-31',
    horse: { slug: 'hottathanafantasy', legalName: 'Hottathanafantasy (NZ)' },
    hook: 'Promising 2YO filly by champion sire Contributer out of winning dam Whiffle.',
    tags: [
      'By Champion Sire Contributer',
      'Family 13 Speed Line',
      'Wexford Stables Prep',
      'Resuming Jan 2026',
    ],
    imageSrc: '/images/marketplace/fixture/hottathanafantasy-BG.png',
  },
  {
    id: 'fixture-prudentia',
    status: 'fully_allocated',
    endDate: '2027-02-28',
    horse: { slug: 'prudentia', legalName: 'Prudentia (NZ)' },
    hook: 'Race-winning daughter of champion sire Proisir with proven Rating 65 Benchmark form.',
    tags: [
      '1400m Tauranga Winner',
      'Heavy Track Proven',
      'Rating 65 Progressor',
      'Wexford Stables Prep',
    ],
    imageSrc: '/images/marketplace/fixture/prudentia-cover.png',
  },
  {
    id: 'fixture-first-gear',
    status: 'completed',
    endDate: '2026-06-30',
    horse: { slug: 'first-gear', legalName: 'First Gear (NZ)' },
    hook: 'Completed campaign. Derryn gelding prepared by Stephen Gray Racing at Copper Belt Lodge, Palmerston North.',
    tags: ['By Derryn (AUS)', 'Stephen Gray Racing', 'Copper Belt Lodge', 'Completed Campaign'],
    imageSrc: '/images/marketplace/fixture/first-gear-BG.png',
  },
]

export const MARKETPLACE_VISUAL_FIXTURE = sortForMarketplace(FIXTURE)
