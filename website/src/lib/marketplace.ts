import type { DslStatus } from './listings'

export type MarketplaceFilter = 'all' | 'available' | 'coming_soon'

export type MarketplaceCard = {
  id: string
  status: DslStatus
  endDate: string
  horse: {
    slug: string
    legalName: string
  }
  hook: string | null
  tags: readonly string[]
  imageSrc: string | null
}

export function filterMarketplaceCards(
  cards: readonly MarketplaceCard[],
  filter: MarketplaceFilter,
): MarketplaceCard[] {
  if (filter === 'all') return [...cards]
  return cards.filter((card) => card.status === filter)
}
