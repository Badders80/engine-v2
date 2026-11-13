import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { filterMarketplaceCards } from '../src/lib/marketplace'
import { MARKETPLACE_VISUAL_FIXTURE } from '../src/lib/marketplaceFixture'

const APP_ROOT = fileURLToPath(new URL('..', import.meta.url))

describe('the Marketplace visual fixture', () => {
  it('uses the ruled status order and puts Mulan first as the available proof', () => {
    expect(MARKETPLACE_VISUAL_FIXTURE.map((card) => card.status)).toEqual([
      'available',
      'coming_soon',
      'coming_soon',
      'fully_allocated',
      'fully_allocated',
      'completed',
    ])
    expect(MARKETPLACE_VISUAL_FIXTURE[0]?.horse.slug).toBe('mulan-the-brave')
  })

  it('filters without mutating the complete ordered set', () => {
    const available = filterMarketplaceCards(MARKETPLACE_VISUAL_FIXTURE, 'available')
    const comingSoon = filterMarketplaceCards(MARKETPLACE_VISUAL_FIXTURE, 'coming_soon')

    expect(available.map((card) => card.horse.slug)).toEqual(['mulan-the-brave'])
    expect(comingSoon).toHaveLength(2)
    expect(MARKETPLACE_VISUAL_FIXTURE).toHaveLength(6)
  })

  it('keeps the visual fixture behind an explicit environment switch', () => {
    const page = readFileSync(resolve(APP_ROOT, 'src/app/marketplace/page.tsx'), 'utf8')

    expect(page).toContain("process.env.WEBSITE_MARKETPLACE_FIXTURE === 'true'")
    expect(page).toContain('listPublishedListings()')
    expect(page).toContain('MarketplaceBrowser')
  })
})
