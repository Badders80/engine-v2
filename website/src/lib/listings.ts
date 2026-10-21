/**
 * The public read layer. PLAN.md step 6b-i.
 *
 * One rule shapes this whole file. `published` lives only on `dsls`, so every
 * read starts there and reaches the horse by embedding it — a join outward. The
 * horses table is readable to anon by design (migration 00009), including
 * unregistered and unpublished rows, so reading it directly would leak them.
 * scripts/assert-read-policies.sh fails the build if a direct read reappears.
 *
 * Status crosses this boundary raw. The database enum value is carried verbatim
 * as a four-member union; there is no translation table, no label, and no
 * colour here. Mapping the enum onto the design vocabulary is step 6b-ii's job,
 * and keeping it out of this file is what makes the two steps separable.
 *
 * Ordering is applied by `sortForMarketplace` and nowhere else. The query holds
 * no server-side order clause, so the ruled sequence is one pure function this
 * suite can see rather than a PostgREST clause no test can reach.
 */

import { createReadClient } from './supabaseRead'

export const DSL_STATUS_VALUES = [
  'coming_soon',
  'available',
  'fully_allocated',
  'completed',
] as const

export type DslStatus = (typeof DSL_STATUS_VALUES)[number]

/** The shape PostgREST returns for the select below. Not exported: callers take a Listing. */
export type ListingRow = {
  id: string
  status: string
  end_date: string
  term_start: string
  payment_model: string
  close_style: string
  investor_split: number | null
  listed_stake: number
  min_stake: number
  step: number
  stake_remaining: number
  retail_monthly_per_percent: number
  wholesale_monthly_total: number
  horses: {
    id: string
    slug: string
    legal_name: string
    registered: boolean
    image_count: number
  }
}

export type Listing = {
  id: string
  status: DslStatus
  endDate: string
  termStart: string
  paymentModel: string
  closeStyle: string
  investorSplit: number | null
  listedStake: number
  minStake: number
  step: number
  stakeRemaining: number
  retailMonthlyPerPercent: number
  wholesaleMonthlyTotal: number
  horse: {
    id: string
    slug: string
    legalName: string
    registered: boolean
    imageCount: number
  }
}

/**
 * The one query shape in this app. It starts at `dsls`, filters on `published`,
 * and embeds the horse. `!inner` is required so that filtering on the embedded
 * horse's slug also constrains the parent row rather than returning a DSL with
 * a null horse.
 */
const LISTING_SELECT = [
  'id',
  'status',
  'end_date',
  'term_start',
  'payment_model',
  'close_style',
  'investor_split',
  'listed_stake',
  'min_stake',
  'step',
  'stake_remaining',
  'retail_monthly_per_percent',
  'wholesale_monthly_total',
  'horses!inner(id, slug, legal_name, registered, image_count)',
].join(', ')

/**
 * Pure. Maps the wire row onto the app's shape and does nothing else: no
 * defaulting, no coercion, no status translation. A value outside the four
 * members is carried through as-is so the caller can fail loudly on it.
 */
export function toListing(row: ListingRow): Listing {
  return {
    id: row.id,
    status: row.status as DslStatus,
    endDate: row.end_date,
    termStart: row.term_start,
    paymentModel: row.payment_model,
    closeStyle: row.close_style,
    investorSplit: row.investor_split,
    listedStake: row.listed_stake,
    minStake: row.min_stake,
    step: row.step,
    stakeRemaining: row.stake_remaining,
    retailMonthlyPerPercent: row.retail_monthly_per_percent,
    wholesaleMonthlyTotal: row.wholesale_monthly_total,
    horse: {
      id: row.horses.id,
      slug: row.horses.slug,
      legalName: row.horses.legal_name,
      registered: row.horses.registered,
      imageCount: row.horses.image_count,
    },
  }
}

/**
 * The ruled marketplace order. Founder ruling 2026-10-20.
 *
 * Ranked by status, most buyable first, and keyed on the database enum — the
 * value `Listing.status` already carries — so no design key and no label enters
 * the read layer. `fully_allocated` precedes `completed` because a fully
 * subscribed offer is still a live record of the horse; `completed` is terminal.
 */
export const MARKETPLACE_STATUS_RANK: Record<DslStatus, number> = {
  available: 0,
  coming_soon: 1,
  fully_allocated: 2,
  completed: 3,
}

/**
 * The rank of a status, or an error. A value outside the four members is a
 * translation failure rather than an ordering question: the design law makes an
 * unrecognised status an error, so it throws here too instead of sorting to an
 * arbitrary place.
 */
export function marketplaceRank(status: string): number {
  const rank = (MARKETPLACE_STATUS_RANK as Record<string, number | undefined>)[status]
  if (rank === undefined) {
    throw new Error(`No marketplace rank for DSL status: ${status}`)
  }
  return rank
}

/**
 * The marketplace grid's order, and the only place it is applied. Pure, and it
 * returns a new array: the read layer's rows are never rearranged in place.
 *
 * Within a status rank the soonest-closing offer comes first (`end_date`
 * ascending). Ties fall back to the horse's legal name, then to the DSL id, so
 * the order is total even when two rows share a status, a date and a name. The
 * sitemap is deliberately unaffected — it consumes `listPublishedListings()`
 * directly, and a sitemap has no order to rule.
 */
export function sortForMarketplace(listings: Listing[]): Listing[] {
  // Validate before sorting. A comparator only runs when there are two or more
  // rows, so a lone unrecognised status would otherwise reach the grid
  // unchallenged — and the design law makes that value an error, not a row.
  for (const listing of listings) marketplaceRank(listing.status)

  return [...listings].sort((a, b) => {
    const byRank = marketplaceRank(a.status) - marketplaceRank(b.status)
    if (byRank !== 0) return byRank

    if (a.endDate !== b.endDate) return a.endDate < b.endDate ? -1 : 1

    const byName = a.horse.legalName.localeCompare(b.horse.legalName)
    if (byName !== 0) return byName

    return a.id.localeCompare(b.id)
  })
}

/** Every published DSL, Coming Soon included. Unpublished rows are absent by policy. */
export async function listPublishedListings(): Promise<Listing[]> {
  const { data, error } = await createReadClient()
    .from('dsls')
    .select(LISTING_SELECT)
    .eq('published', true)

  if (error) {
    throw new Error(`listPublishedListings failed: ${error.message}`)
  }

  return (data as unknown as ListingRow[]).map(toListing)
}

/**
 * Every published DSL on the horse named by `slug`.
 *
 * Plural on purpose. `PLAN.md:297` rules that a horse may carry more than one DSL
 * and that the public URL is one page per horse, so the page needs all of them: a
 * reader returning the first row would silently drop a published offering. The
 * unique constraint on `dsls` is `(horse_id, end_date)`, not `horse_id`, so a
 * second row is a legal state rather than a data error. An empty array means the
 * slug names nothing published, and the caller decides that is a 404.
 */
export async function getListingsBySlug(slug: string): Promise<Listing[]> {
  const { data, error } = await createReadClient()
    .from('dsls')
    .select(LISTING_SELECT)
    .eq('published', true)
    .eq('horses.slug', slug)

  if (error) {
    throw new Error(`getListingsBySlug failed: ${error.message}`)
  }

  return (data as unknown as ListingRow[]).map(toListing)
}
