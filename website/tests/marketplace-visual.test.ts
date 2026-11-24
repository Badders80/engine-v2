import { describe, expect, it } from 'vitest'

import { toListing, type ListingRow } from '../src/lib/listings'
import {
  buildCardFromListing,
  buildHorseTags,
  extractHook,
  filterMarketplaceCards,
  formatFullDate,
  formatHorseName,
  formatMonthYear,
  formatThoroughbredAge,
  PREVIEW_STACK_PLACEHOLDERS,
  splitParagraphs,
} from '../src/lib/marketplace'

const SAMPLE_ROW: ListingRow = {
  id: 'dsl-mulan',
  status: 'available',
  end_date: '2027-06-30',
  term_start: null,
  payment_model: 'subscription_float',
  close_style: 'fourteen_day',
  investor_split: 75,
  listed_stake: 5,
  min_stake: 0.5,
  step: 0.5,
  stake_remaining: 5,
  retail_monthly_per_percent: 65,
  narrative_about_horse: null,
  narrative_racing_outlook: null,
  narrative_race_expectation: null,
  horses: {
    id: 'horse-mulan',
    slug: 'mulan-the-brave',
    legal_name: 'Mulan The Brave (NZ)',
    registered: true,
    image_count: 3,
    image_order: [1, 2, 3],
    foaling_date: '2023-08-17',
    sex: 'Filly',
    colour: 'Bay',
    breeder: 'C W Kwok',
    sire_name: 'TURN ME LOOSE (NZ) 2011',
    dam_name: 'YEARN (NZ) 2013',
    loveracing_id: '460867',
    about_horse:
      'Mulan The Brave is a bay filly foaled on 17 August 2023, by the triple Group 1 winner Turn Me Loose out of the Savabeel mare Yearn.\n\nSecond paragraph.',
    racing_outlook_and_pedigree: 'Outlook paragraph.',
    race_expectation: 'Expectation paragraph.',
    race_record: {
      summary: { starts: 1, wins: 0, seconds: 0, thirds: 0, stakesNzd: 370 },
      resultLines: [],
    },
    pedigree: null,
  },
}

describe('marketplace formatting helpers', () => {
  it('cleans uppercase Loveracing horse names while keeping mixed-case names intact', () => {
    expect(formatHorseName('TURN ME LOOSE (NZ) 2011')).toEqual({
      name: 'Turn Me Loose',
      country: 'NZ',
      year: '2011',
      display: 'Turn Me Loose (NZ)',
    })
    expect(formatHorseName('Mulan The Brave (NZ)')).toEqual({
      name: 'Mulan The Brave',
      country: 'NZ',
      year: null,
      display: 'Mulan The Brave (NZ)',
    })
  })

  it('formats dates as Mon YYYY and full day-month-year', () => {
    expect(formatMonthYear('2027-06-30')).toBe('Jun 2027')
    expect(formatMonthYear(null)).toBeNull()
    expect(formatFullDate('2023-08-17')).toBe('17 Aug 2023')
  })

  it('calculates Southern Hemisphere thoroughbred age using 1 August season boundary', () => {
    expect(formatThoroughbredAge('2023-08-17', new Date('2026-11-24T00:00:00Z'))).toBe('3yr')
    expect(formatThoroughbredAge('2023-08-17', new Date('2026-07-15T00:00:00Z'))).toBe('2yr')
  })

  it('extracts a single-sentence hook and splits paragraphs cleanly', () => {
    const listing = toListing(SAMPLE_ROW)
    expect(extractHook(listing.horse.aboutHorse)).toBe(
      'Mulan The Brave is a bay filly foaled on 17 August 2023, by the triple Group 1 winner Turn Me Loose out of the Savabeel mare Yearn.',
    )
    expect(splitParagraphs(listing.horse.aboutHorse)).toHaveLength(2)
  })

  it('builds factual tags and a clickable card from a live listing', () => {
    const listing = toListing(SAMPLE_ROW)
    const tags = buildHorseTags(listing)
    expect(tags).toEqual([
      'By Turn Me Loose (NZ)',
      'Out of Yearn (NZ)',
      expect.stringMatching(/yr Bay Filly$/),
      '1 start',
    ])

    const card = buildCardFromListing(listing, 'https://cdn.example.com')
    expect(card.imageSrc).toBe('https://cdn.example.com/mulan-the-brave/01')
    expect(card.href).toBe('/marketplace/mulan-the-brave')
    expect(card.status).toBe('available')
  })

  it('filters marketplace cards by status including preview placeholders', () => {
    const liveCard = buildCardFromListing(toListing(SAMPLE_ROW), 'https://cdn.example.com')
    const combined = [liveCard, ...PREVIEW_STACK_PLACEHOLDERS]

    expect(filterMarketplaceCards(combined, 'all')).toHaveLength(3)
    expect(filterMarketplaceCards(combined, 'available')).toHaveLength(1)
    expect(filterMarketplaceCards(combined, 'coming_soon')).toHaveLength(1)
  })
})
