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
 * No ordering is applied. Neither PLAN.md nor OUTCOME.md states a marketplace
 * sort order, so none is invented here; the grid's order is a 6b-ii question.
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

/** One published DSL by its horse's slug. Null when the slug names nothing published. */
export async function getListingBySlug(slug: string): Promise<Listing | null> {
  const { data, error } = await createReadClient()
    .from('dsls')
    .select(LISTING_SELECT)
    .eq('published', true)
    .eq('horses.slug', slug)

  if (error) {
    throw new Error(`getListingBySlug failed: ${error.message}`)
  }

  const rows = data as unknown as ListingRow[]
  return rows.length > 0 ? toListing(rows[0]) : null
}
