import type { MetadataRoute } from 'next'

import { listPublishedListings } from '../lib/listings'
import { sitemapUrls } from '../lib/site'

/**
 * The sitemap. PLAN.md step 6b-ii.
 *
 * The set is ruled at `PLAN.md:88` and `:297`: the landing page, the marketplace,
 * and one URL per horse carrying at least one published DSL. "Each public horse"
 * and "every published DSL" are the same set, because the public URL is one page
 * per horse — so the read layer's rows are **deduplicated by slug** rather than
 * mapped straight through. A horse with two published DSLs is one URL, not two.
 *
 * Coming Soon **is** listed. Unpublished DSLs, unregistered horses, buyer
 * documents, MyStable, login and checkout are not: the read layer's `published`
 * filter removes the first, and `robots.ts` disallows the rest.
 *
 * `force-dynamic` for the same reason as the two pages: a metadata route is
 * prerendered by default, CI builds with no environment variables, and the read
 * client throws when they are absent rather than returning nothing.
 *
 * No `changeFrequency` or `priority` is emitted. The law rules which URLs are in
 * the set and says nothing about ranking them against each other, and a priority
 * number invented here would be an unruled claim about the site's own content.
 */
export const dynamic = 'force-dynamic'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const listings = await listPublishedListings()

  return sitemapUrls(listings.map((listing) => listing.horse.slug)).map((url) => ({ url }))
}
