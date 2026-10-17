/**
 * The site's public identity, and the image-URL algebra. PLAN.md step 6b-ii.
 *
 * Three constants and three pure functions, and nothing here reads a file, opens
 * a connection, or touches the network.
 *
 * Why the image algebra lives here rather than being imported from `engine/`:
 * `website/` may not import `engine/` source (`PLAN.md:282`), and both halves need
 * to agree on one key shape — the slug names the folder, the number names the
 * file, and there is no extension. The engine owns the upload side
 * (`engine/src/lib/storage.ts`); this module owns the read side. The shape is
 * mirrored deliberately and pinned by `website/tests/search.test.ts`, so a drift
 * fails a test here rather than 404ing in a browser later.
 *
 * The key carries no extension, so nothing downstream can infer the type. Public
 * images are served as `image/webp`; a dot in a key means a caller went around the
 * upload path, and the pattern refuses it.
 */

/**
 * The public host, and the only one.
 *
 * `PLAN.md:84` rules that canonicals, the sitemap and structured data all use the
 * `www` host, and that the apex is not a second canonical. The current site uses
 * the apex; that mistake stays behind, so nothing here ever builds an apex URL.
 */
export const SITE_URL = 'https://www.evolutionstables.nz'

/**
 * The one Open Graph image.
 *
 * `PLAN.md:78` lists "an Open Graph image" once, at the site level, beside
 * `robots.txt` and the sitemap — not one per page and not one per horse. 6a
 * already shipped this file, so 6b-ii adds no image generator.
 */
export const OG_IMAGE = '/og/default.png'

/**
 * The brand lockup, for the organisation's structured data.
 *
 * A path rather than a URL: the only consumer composes it with `SITE_URL`, and
 * keeping the path literal means the asset sweep in `scripts/assert-search-layer.sh`
 * can see it the same way it sees every other path in the app.
 */
export const LOGO_PATH = '/brand/lockups/lockup-horizontal-gold.svg'

/** The R2 public origin. A name only; the value never appears in the repo. */
export const R2_PUBLIC_URL_ENV = 'WEBSITE_R2_PUBLIC_URL'

/** Two digits, so a folder reads and sorts the way the operator expects: 01, 02, … 10. */
const IMAGE_NUMBER_DIGITS = 2

/** A slug: lowercase ASCII words joined by single hyphens. */
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/** A public image key: `{slug}/{NN}`, and nothing else. A dot cannot match. */
const PUBLIC_KEY_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*\/\d{2,}$/

/**
 * First path segments reserved for private material. These belong in private
 * Supabase Storage, never on the public image origin. Mirrored from the engine so
 * that a caller cannot widen the public surface by taking the read path instead.
 */
const PRIVATE_KEY_PREFIXES = [
  'kyc',
  'private',
  'identity',
  'documents',
  'document',
  'proof-of-address',
  'poa',
  'legal',
  'pds',
  'sa',
]

function assertSlug(slug: string): void {
  if (!SLUG_PATTERN.test(slug)) {
    throw new Error(`a horse slug is lowercase words joined by single hyphens (received ${slug})`)
  }
}

/** The storage key for one image: `{slug}/{NN}`, no extension. */
export function imageKey(slug: string, imageNumber: number): string {
  assertSlug(slug)

  if (!Number.isInteger(imageNumber) || imageNumber < 1) {
    throw new Error(`an image number is a whole number from 1 upward (received ${String(imageNumber)})`)
  }

  return `${slug}/${String(imageNumber).padStart(IMAGE_NUMBER_DIGITS, '0')}`
}

/**
 * The public URL for an image key.
 *
 * The base has no default. A built-in fallback would serve production URLs from a
 * development host, so a malformed origin throws here instead.
 */
export function publicImageUrl(key: string, publicUrlBase: string): string {
  const base = publicUrlBase.trim().replace(/\/+$/, '')

  if (!base.startsWith('https://')) {
    throw new Error(`public base URL must be an https origin (received ${publicUrlBase})`)
  }

  const prefix = key.split('/')[0]
  if (prefix !== undefined && PRIVATE_KEY_PREFIXES.includes(prefix)) {
    throw new Error(
      `refusing a private document key on the public image origin: ${String(key)} (private files stay in Supabase Storage)`,
    )
  }

  if (!PUBLIC_KEY_PATTERN.test(key)) {
    throw new Error(`public image key must be {slug}/{NN} with no file extension (received ${String(key)})`)
  }

  return `${base}/${key}`
}

/**
 * The horse's hero image, or null when there is none to show.
 *
 * Null is not a fallback for an error — it is the two states the data actually
 * has. `image_count` is the only image fact in the database (`OUTCOME.md:68`) and
 * it is zero for a horse whose profile has no images yet, which DESIGN.md's card
 * anatomy already handles as the no-photo placeholder. An unset origin is a
 * configuration absence, not a malformed value: it produces the same placeholder
 * rather than a hard failure, so a build and a CI run need no R2 credentials.
 *
 * A malformed origin — one that IS set and is not an https origin — still throws,
 * through `publicImageUrl`. That distinction is the whole reason this function
 * exists separately.
 */
export function heroImageUrl(slug: string, imageCount: number, publicUrlBase?: string): string | null {
  if (!Number.isInteger(imageCount) || imageCount < 1) return null

  const base = (publicUrlBase ?? '').trim()
  if (base === '') return null

  return publicImageUrl(imageKey(slug, 1), base)
}

/**
 * The sitemap's URL set, from the horse slugs that carry a published DSL.
 *
 * `PLAN.md:88` and `:297` rule the set — the landing page, the marketplace, and
 * one URL per horse — and the two halves of that ruling are the same set, because
 * the public URL is one page per horse. So slugs are **deduplicated**: a horse with
 * two published DSLs is one URL, not two.
 *
 * Pure, and separated from the query on purpose: the deduplication is the part
 * with a rule in it and it should be assertable without a database.
 *
 * No `changeFrequency` and no `priority` — the law rules which URLs are in the set
 * and says nothing about ranking them, and a priority invented here would be an
 * unruled claim about the site's own content.
 */
export function sitemapUrls(slugs: readonly string[]): string[] {
  return [
    `${SITE_URL}/`,
    `${SITE_URL}/marketplace`,
    ...[...new Set(slugs)].map((slug) => `${SITE_URL}/marketplace/${slug}`),
  ]
}
