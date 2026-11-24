import type { DslStatus, Listing } from './listings'
import { heroImageUrl } from './site'

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
  href: string | null
  isPlaceholder?: boolean
}

export type ParsedHorseName = {
  name: string
  country: string | null
  year: string | null
  display: string
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const

const SMALL_WORDS = new Set(['of', 'the', 'and', 'in', 'a', 'an', 'de', 'du', 'la', 'le', 'von'])

function titleCaseToken(token: string, index: number): string {
  if (/^[A-Z]{2,3}$/.test(token) && ['NZ', 'AUS', 'GB', 'IRE', 'USA', 'FR', 'JPN', 'GER'].includes(token)) {
    return token
  }
  const lower = token.toLowerCase()
  if (index > 0 && SMALL_WORDS.has(lower)) return lower
  return lower.replace(/(^|['’-])([a-z])/g, (_, prefix: string, ch: string) => `${prefix}${ch.toUpperCase()}`)
}

function normalizeHorseWords(raw: string): string {
  const trimmed = raw.trim().replace(/\s+/g, ' ')
  if (trimmed === '') return ''
  const isAllCaps = trimmed === trimmed.toUpperCase() && /[A-Z]/.test(trimmed)
  if (!isAllCaps) return trimmed
  return trimmed.split(' ').map(titleCaseToken).join(' ')
}

/**
 * Parses Loveracing names such as `TURN ME LOOSE (NZ) 2011` or `Mulan The Brave (NZ)`
 * into display-ready name, country code and optional foaling year.
 */
export function formatHorseName(raw: string | null | undefined): ParsedHorseName {
  if (!raw || raw.trim() === '') {
    return { name: '—', country: null, year: null, display: '—' }
  }
  const match = raw.trim().match(/^(.*?)(?:\s*\(([A-Z]{2,4})\))?(?:\s+(\d{4}))?$/)
  const baseRaw = match?.[1]?.trim() ?? raw.trim()
  const country = match?.[2] ?? null
  const year = match?.[3] ?? null
  const name = normalizeHorseWords(baseRaw)
  const display = country ? `${name} (${country})` : name
  return { name, country, year, display }
}

/** Formats ISO `YYYY-MM-DD` as `Mon YYYY` (locked public date style). */
export function formatMonthYear(isoDate: string | null | undefined): string | null {
  if (!isoDate) return null
  const match = isoDate.match(/^(\d{4})-(\d{2})/)
  if (!match) return isoDate
  const year = match[1]
  const monthIndex = Number(match[2]) - 1
  const month = MONTHS[monthIndex]
  if (!month) return isoDate
  return `${month} ${year}`
}

/** Formats ISO `YYYY-MM-DD` as `17 Aug 2023`. */
export function formatFullDate(isoDate: string | null | undefined): string | null {
  if (!isoDate) return null
  const match = isoDate.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!match) return isoDate
  const day = Number(match[3])
  const month = MONTHS[Number(match[2]) - 1]
  if (!month) return isoDate
  return `${String(day)} ${month} ${match[1]}`
}

/**
 * Computes Southern Hemisphere thoroughbred age (all horses advance on 1 August).
 */
export function formatThoroughbredAge(
  foalingDate: string | null | undefined,
  referenceDate: Date = new Date(),
): string | null {
  if (!foalingDate) return null
  const match = foalingDate.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!match) return null
  const foalYear = Number(match[1])
  const foalMonth = Number(match[2])
  // Thoroughbred season year starts 1 August.
  const foalSeasonYear = foalMonth >= 8 ? foalYear : foalYear - 1
  const nowYear = referenceDate.getUTCFullYear()
  const nowMonth = referenceDate.getUTCMonth() + 1
  const currentSeasonYear = nowMonth >= 8 ? nowYear : nowYear - 1
  const age = Math.max(0, currentSeasonYear - foalSeasonYear)
  return `${String(age)}yr`
}

export function splitParagraphs(text: string | null | undefined): string[] {
  if (!text) return []
  return text
    .split(/\n{2,}/)
    .map((chunk) => chunk.trim())
    .filter((chunk) => chunk.length > 0)
}

export function extractHook(aboutHorse: string | null | undefined): string | null {
  const firstParagraph = splitParagraphs(aboutHorse)[0]
  if (!firstParagraph) return null
  const sentenceMatch = firstParagraph.match(/^(.+?[.!?])(?:\s|$)/)
  const sentence = sentenceMatch?.[1] ?? firstParagraph
  if (sentence.length <= 185) return sentence
  return `${sentence.slice(0, 182).trimEnd()}…`
}

export function buildHorseTags(listing: Listing): string[] {
  const { horse } = listing
  const tags: string[] = []

  if (horse.sireName) {
    tags.push(`By ${formatHorseName(horse.sireName).display}`)
  }
  if (horse.damName) {
    tags.push(`Out of ${formatHorseName(horse.damName).display}`)
  }
  const age = formatThoroughbredAge(horse.foalingDate)
  const descriptor = [age, horse.colour, horse.sex].filter(Boolean).join(' ')
  if (descriptor) {
    tags.push(descriptor)
  }
  const starts = horse.raceRecord?.summary?.starts
  if (typeof starts === 'number') {
    tags.push(starts === 0 ? 'Unraced' : `${String(starts)} ${starts === 1 ? 'start' : 'starts'}`)
  } else if (horse.breeder) {
    tags.push(`Bred by ${horse.breeder}`)
  }

  return tags.slice(0, 4)
}

export function buildCardFromListing(
  listing: Listing,
  r2PublicUrl?: string,
): MarketplaceCard {
  const { horse } = listing
  const about = listing.narrative.aboutHorse ?? horse.aboutHorse

  return {
    id: listing.id,
    status: listing.status,
    endDate: listing.endDate,
    horse: {
      slug: horse.slug,
      legalName: horse.legalName,
    },
    hook: extractHook(about),
    tags: buildHorseTags(listing),
    imageSrc: heroImageUrl(horse.slug, horse.imageCount, r2PublicUrl, horse.imageOrder),
    href: `/marketplace/${horse.slug}`,
  }
}

export function filterMarketplaceCards(
  cards: readonly MarketplaceCard[],
  filter: MarketplaceFilter,
): MarketplaceCard[] {
  if (filter === 'all') return [...cards]
  return cards.filter((card) => card.status === filter)
}

/**
 * Local-dev-only placeholder cards appended behind `WEBSITE_PREVIEW_STACK=true`
 * so multi-card stacking and status filters can be reviewed while only one
 * horse is published locally. Never enabled in CI or production.
 */
export const PREVIEW_STACK_PLACEHOLDERS: readonly MarketplaceCard[] = [
  {
    id: 'preview-slot-coming-soon',
    status: 'coming_soon',
    endDate: '2027-06-30',
    horse: {
      slug: 'preview-upcoming-offering',
      legalName: 'Upcoming Thoroughbred (Preview Slot)',
    },
    hook: 'Placeholder profile for reviewing the stacked Marketplace layout and Coming Soon filter before additional horses publish.',
    tags: ['Preview layout slot', 'Coming Soon state', 'Awaiting published DSL'],
    imageSrc: null,
    href: null,
    isPlaceholder: true,
  },
  {
    id: 'preview-slot-allocated',
    status: 'fully_allocated',
    endDate: '2027-06-30',
    horse: {
      slug: 'preview-allocated-offering',
      legalName: 'Syndicated Thoroughbred (Preview Slot)',
    },
    hook: 'Second placeholder profile showing full vertical card rhythm and settled-state badge contrast across the Marketplace stack.',
    tags: ['Preview layout slot', 'Allocated state', 'Awaiting published DSL'],
    imageSrc: null,
    href: null,
    isPlaceholder: true,
  },
]
