import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { toListing, type ListingRow } from '../src/lib/listings'

// Hermetic by construction. Nothing here opens a connection and nothing imports
// a database driver: CI runs `pnpm test` with no database service at all, so the
// policies themselves are proven by the recorded probe in engine/OPERATIONS.md,
// not from here. What this file holds is the shape of the read layer and the two
// fences that are invisible at runtime.

const APP_ROOT = fileURLToPath(new URL('..', import.meta.url))
const SRC = join(APP_ROOT, 'src')
const LISTINGS = join(SRC, 'lib', 'listings.ts')
// The one file allowed to declare a status colour, because it is where the tokens
// are defined. Same exemption scripts/assert-design-tokens.sh already makes.
const THEME = join(SRC, 'app', 'globals.css')
// Step 6b-ii. The one component that owns the status mapping, and therefore the
// only file besides the theme that may name a status label or a status colour.
// Two fences below existed so 6b-ii could not inherit a half-built map; 6b-ii built
// the map, so each is narrowed to this single path rather than removed.
const STATUS_MODULE = join(SRC, 'lib', 'status.ts')

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) return sourceFiles(full)
    return /\.(ts|tsx|css)$/.test(entry.name) ? [full] : []
  })
}

const SOURCES = sourceFiles(SRC).map((path) => ({ path, text: readFileSync(path, 'utf8') }))

const ROW: ListingRow = {
  id: 'dsl-1',
  status: 'coming_soon',
  end_date: '2027-06-30',
  term_start: '2026-07-01',
  payment_model: 'upfront',
  close_style: 'fourteen_day',
  listed_stake: 100,
  min_stake: 2.5,
  step: 0.1,
  stake_remaining: 62.5,
  retail_monthly_per_percent: 109,
  wholesale_monthly_total: 10000,
  horses: {
    id: 'horse-1',
    slug: 'lady-ketchikan',
    legal_name: 'Lady Ketchikan',
    registered: true,
    image_count: 4,
  },
}

describe('the listing projection', () => {
  it('maps a wire row onto the app shape', () => {
    expect(toListing(ROW)).toEqual({
      id: 'dsl-1',
      status: 'coming_soon',
      endDate: '2027-06-30',
      termStart: '2026-07-01',
      paymentModel: 'upfront',
      closeStyle: 'fourteen_day',
      listedStake: 100,
      minStake: 2.5,
      step: 0.1,
      stakeRemaining: 62.5,
      retailMonthlyPerPercent: 109,
      wholesaleMonthlyTotal: 10000,
      horse: {
        id: 'horse-1',
        slug: 'lady-ketchikan',
        legalName: 'Lady Ketchikan',
        registered: true,
        imageCount: 4,
      },
    })
  })

  it('carries status through verbatim rather than defaulting it', () => {
    // A value outside the four members must survive the projection so the caller
    // can fail loudly on it. Coercing it here would hide the error until a page
    // rendered the wrong state, which is the failure the design law forbids.
    expect(toListing({ ...ROW, status: 'something_else' }).status).toBe('something_else')
  })

  it('keeps every financial figure exactly as stored', () => {
    // The website never prices and never compiles: retail and wholesale totals are
    // generated columns, read and never recomputed.
    const listing = toListing(ROW)
    expect(listing.retailMonthlyPerPercent).toBe(ROW.retail_monthly_per_percent)
    expect(listing.wholesaleMonthlyTotal).toBe(ROW.wholesale_monthly_total)
  })
})

describe('the reads originate at dsls', () => {
  it('never reads a fenced table directly', () => {
    // `published` lives only on dsls. horses, trainers and owners are readable to
    // anon in full, so reaching them directly leaks unpublished and unregistered
    // rows. Every read starts at dsls and embeds outward.
    const reads = SOURCES.flatMap(({ path, text }) =>
      [...text.matchAll(/\.from\(\s*['"]([a-z_]+)['"]/g)].map((match) => ({
        path,
        table: match[1],
      })),
    )

    expect(reads.length).toBeGreaterThan(0)
    for (const { path, table } of reads) {
      expect(table, `${path} reads ${table} directly`).toBe('dsls')
    }
  })

  it('reaches the horse by embedding rather than by a second query', () => {
    expect(readFileSync(LISTINGS, 'utf8')).toContain('horses!inner(')
  })

  it('applies no ordering, because no ordering rule exists', () => {
    // Neither PLAN.md nor OUTCOME.md states a marketplace sort order. Sorting here
    // would be an invented rule; the grid's order is a 6b-ii question.
    expect(readFileSync(LISTINGS, 'utf8')).not.toMatch(/\.order\(/)
  })

  it('opens no database connection', () => {
    for (const { path, text } of SOURCES) {
      const specs = [...text.matchAll(/from\s+['"]([^'"]+)['"]/g)].map((match) => match[1])
      for (const spec of specs) {
        expect(spec, `${path} imports ${spec}`).not.toMatch(/(^|\/)(pg|postgres|postgresql)$/)
      }
    }
  })
})

describe('the fences that fail silently', () => {
  it('imports nothing from engine/', () => {
    for (const { path, text } of SOURCES) {
      const specs = [...text.matchAll(/from\s+['"]([^'"]+)['"]/g)].map((match) => match[1])
      for (const spec of specs) {
        expect(spec, `${path} imports ${spec}`).not.toMatch(/(^|\/)engine\//)
      }
    }
  })

  it('holds no privileged credential', () => {
    for (const { path, text } of SOURCES) {
      expect(text, `${path} names a privileged credential`).not.toMatch(
        /SERVICE_ROLE|sb_secret_|service_role/,
      )
    }
  })

  it('renders a status label only in the status module', () => {
    // DESIGN.md applies uppercase in the component and keeps source strings in
    // sentence case, so the uppercase forms are the ones that matter. 6b-i held
    // this fence open for 6b-ii; the map now lives at src/lib/status.ts, so a
    // status label anywhere else means a second, competing map has appeared.
    const labels = ['COMING SOON', 'AVAILABLE', 'FULLY ALLOCATED', 'COMPLETED']
    for (const { path, text } of SOURCES) {
      if (path === STATUS_MODULE) continue
      for (const label of labels) {
        expect(text, `${path} carries the status label ${label}`).not.toContain(label)
      }
    }
  })

  it('carries a status colour or design status key only in the theme and the status module', () => {
    // globals.css declares --color-status-active/pending/closed; that is the token
    // file doing its job, and 6a put them there. src/lib/status.ts is the ruled
    // translation, which is where those keys are meant to be consumed. Anywhere
    // else, a status colour or a DESIGN.md status key means a component has grown
    // its own private map.
    const statusKeys = ['status-active', 'status-pending', 'status-closed', 'fully_subscribed', 'coming_soon_details']
    for (const { path, text } of SOURCES) {
      if (path === THEME || path === STATUS_MODULE) continue
      for (const key of statusKeys) {
        expect(text, `${path} carries ${key}`).not.toContain(key)
      }
    }
  })
})
