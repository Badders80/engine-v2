import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { heroImageUrl, imageKey, OG_IMAGE, publicImageUrl, SITE_URL, sitemapUrls } from '../src/lib/site'

// Hermetic: pure functions and two source scans. Nothing here opens a connection,
// which is the point — CI runs `pnpm test` with no database service at all.

const APP_ROOT = fileURLToPath(new URL('..', import.meta.url))
const SRC = join(APP_ROOT, 'src')
const LISTINGS = join(SRC, 'lib', 'listings.ts')

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) return sourceFiles(full)
    return /\.(ts|tsx|css)$/.test(entry.name) ? [full] : []
  })
}

const SOURCES = sourceFiles(SRC).map((path) => ({ path, text: readFileSync(path, 'utf8') }))

describe('the public host', () => {
  it('is the www host, and never the apex', () => {
    // PLAN.md:84. The apex is a mistake the current site makes and this one does not
    // repeat, so it is asserted as a literal rather than trusted to review.
    expect(SITE_URL).toBe('https://www.evolutionstables.nz')
    expect(SITE_URL).not.toBe('https://evolutionstables.nz')
  })

  it('builds no apex URL anywhere in the app', () => {
    for (const { path, text } of SOURCES) {
      const apexUrls = [...text.matchAll(/https:\/\/evolutionstables\.nz/g)].map((match) => match[0])
      expect(apexUrls, `${path} builds an apex URL`).toEqual([])
    }
  })

  it('points at the Open Graph image 6a shipped', () => {
    expect(OG_IMAGE).toBe('/og/default.png')
  })
})

describe('the R2 key algebra, mirrored from the engine', () => {
  it('numbers files from 01, with no extension', () => {
    // The engine writes `{slug}/{NN}` (engine/src/lib/storage.ts). website/ may not
    // import engine/ source, so the read side mirrors the shape — and this pins it,
    // because a drift here is a 404 in a browser rather than a failing build.
    expect(imageKey('lady-ketchikan', 1)).toBe('lady-ketchikan/01')
    expect(imageKey('lady-ketchikan', 10)).toBe('lady-ketchikan/10')
    expect(imageKey('mulan-the-brave', 100)).toBe('mulan-the-brave/100')
  })

  it('refuses a slug or a number that is not the agreed shape', () => {
    expect(() => imageKey('Lady Ketchikan', 1)).toThrow(/lowercase words/)
    expect(() => imageKey('lady_ketchikan', 1)).toThrow(/lowercase words/)
    expect(() => imageKey('lady-ketchikan', 0)).toThrow(/whole number from 1 upward/)
    expect(() => imageKey('lady-ketchikan', 1.5)).toThrow(/whole number from 1 upward/)
  })

  it('joins an origin and a key, and strips a trailing slash from the origin', () => {
    expect(publicImageUrl('lady-ketchikan/01', 'https://cdn.example.com')).toBe(
      'https://cdn.example.com/lady-ketchikan/01',
    )
    expect(publicImageUrl('lady-ketchikan/01', 'https://cdn.example.com/')).toBe(
      'https://cdn.example.com/lady-ketchikan/01',
    )
    expect(publicImageUrl('lady-ketchikan/01', '  https://cdn.example.com//  ')).toBe(
      'https://cdn.example.com/lady-ketchikan/01',
    )
  })

  it('refuses a file extension, a private prefix, and a non-https origin', () => {
    const origin = 'https://cdn.example.com'

    // No extension: the key shape cannot express one, so a dot means a caller went
    // around the upload path.
    expect(() => publicImageUrl('lady-ketchikan/01.webp', origin)).toThrow(/no file extension/)

    // Private material belongs in private Supabase Storage, never on the public
    // image origin.
    expect(() => publicImageUrl('kyc/01', origin)).toThrow(/private document key/)
    expect(() => publicImageUrl('pds/01', origin)).toThrow(/private document key/)

    // A base with no default: a fallback would serve production URLs from a
    // development host.
    expect(() => publicImageUrl('lady-ketchikan/01', 'http://cdn.example.com')).toThrow(
      /must be an https origin/,
    )
  })
})

describe('the hero image', () => {
  it('is null when there is no image to show, which is a state and not an error', () => {
    // image_count is the only image fact in the database and it is zero for a horse
    // whose profile has no images yet. DESIGN.md's card anatomy handles that as the
    // no-photo placeholder.
    expect(heroImageUrl('lady-ketchikan', 0, 'https://cdn.example.com')).toBeNull()
    expect(heroImageUrl('lady-ketchikan', 4)).toBeNull()
    expect(heroImageUrl('lady-ketchikan', 4, '   ')).toBeNull()
  })

  it('resolves the first image when both a count and an origin are present', () => {
    expect(heroImageUrl('lady-ketchikan', 4, 'https://cdn.example.com')).toBe(
      'https://cdn.example.com/lady-ketchikan/01',
    )
  })

  it('still throws on an origin that is set and wrong', () => {
    // The distinction the function exists for: unset is "not configured yet" and
    // renders a placeholder; malformed is a configuration error and says so.
    expect(() => heroImageUrl('lady-ketchikan', 4, 'cdn.example.com')).toThrow(
      /must be an https origin/,
    )
  })
})

describe('the sitemap set', () => {
  it('is the landing page, the marketplace, and one URL per horse', () => {
    expect(sitemapUrls(['lady-ketchikan'])).toEqual([
      'https://www.evolutionstables.nz/',
      'https://www.evolutionstables.nz/marketplace',
      'https://www.evolutionstables.nz/marketplace/lady-ketchikan',
    ])
  })

  it('holds a horse with two published DSLs once, not twice', () => {
    // PLAN.md:297 — a horse may carry more than one DSL and the public URL is one
    // page per horse, so "each public horse" and "every published DSL" are the same
    // set. Deduplication is the whole of that ruling in code.
    expect(sitemapUrls(['lady-ketchikan', 'mulan-the-brave', 'lady-ketchikan'])).toEqual([
      'https://www.evolutionstables.nz/',
      'https://www.evolutionstables.nz/marketplace',
      'https://www.evolutionstables.nz/marketplace/lady-ketchikan',
      'https://www.evolutionstables.nz/marketplace/mulan-the-brave',
    ])
  })

  it('still lists the landing page and the marketplace with nothing published', () => {
    expect(sitemapUrls([])).toEqual([
      'https://www.evolutionstables.nz/',
      'https://www.evolutionstables.nz/marketplace',
    ])
  })
})

describe('the plurality fence', () => {
  const listings = readFileSync(LISTINGS, 'utf8')

  it('reads every published DSL on a horse, not just the first', () => {
    // The defect Moment 1 round 1 caught in the plan: a page claiming to render every
    // published DSL while the reader it named returned `rows[0]`. Restoring that line
    // must fail here.
    expect(listings).toContain('getListingsBySlug')
    expect(listings).not.toContain('getListingBySlug')
    expect(listings).not.toContain('rows[0]')
    expect(listings).not.toContain('.single()')
    expect(listings).not.toContain('.limit(1)')
  })

  it('reads through the one agreed query shape', () => {
    expect(listings).toContain('horses!inner(')
    expect(listings).toContain(".eq('published', true)")
  })
})
