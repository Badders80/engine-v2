import { readFileSync, readdirSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { DSL_STATUS_VALUES } from '../src/lib/listings'
import { STATUS_VIEWS, viewForStatus } from '../src/lib/status'

// Hermetic by construction: pure functions, one source scan, no connection and no
// database driver. The mapping itself is data, so most of this file is literal
// assertions rather than behaviour.

const APP_ROOT = fileURLToPath(new URL('..', import.meta.url))
const SRC = join(APP_ROOT, 'src')
const STATUS_MODULE = join(SRC, 'lib', 'status.ts')
// The theme declares the tokens and documents the variant enum, so it is allowed
// to name both. Same exemption scripts/assert-design-tokens.sh makes.
const THEME = join(SRC, 'app', 'globals.css')

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) return sourceFiles(full)
    return /\.(ts|tsx|css)$/.test(entry.name) ? [full] : []
  })
}

const SOURCES = sourceFiles(SRC).map((path) => ({ path, text: readFileSync(path, 'utf8') }))

/** Comments are prose about a rule; this file's check is about code. */
function stripComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
}

const STATUS_SOURCE = stripComments(readFileSync(STATUS_MODULE, 'utf8'))

describe('the ruled status map', () => {
  it('transcribes PLAN.md:286 row for row', () => {
    expect(STATUS_VIEWS).toEqual({
      coming_soon: {
        key: 'coming_soon',
        label: 'COMING SOON',
        variant: 'active',
        className: 'bg-status-active',
        glow: true,
      },
      available: {
        key: 'listed',
        label: 'AVAILABLE',
        variant: 'active',
        className: 'bg-status-active',
        glow: true,
      },
      fully_allocated: {
        key: 'fully_subscribed',
        label: 'FULLY ALLOCATED',
        variant: 'pending',
        className: 'bg-status-pending',
        glow: false,
      },
      completed: {
        key: 'completed',
        label: 'COMPLETED',
        variant: 'settled',
        className: 'bg-status-closed',
        glow: false,
      },
    })
  })

  it('covers every member of the database enum, with nothing left over', () => {
    // A fifth database status must break this test rather than reach a page and
    // render as a missing badge. `Record<DslStatus, StatusView>` breaks the build
    // first; this catches the other direction, a row for a status that is not real.
    expect(Object.keys(STATUS_VIEWS).sort()).toEqual([...DSL_STATUS_VALUES].sort())
  })

  it('binds the settled variant to the closed token and the active variant to the active token', () => {
    // Ruled 2026-10-17. The variant vocabulary is active/pending/settled and the
    // token vocabulary is active/pending/closed, so the two names differ on the
    // terminal state and the binding is what holds them together. Asserted as a
    // literal because nothing else in the app can catch a swap.
    expect(viewForStatus('completed').variant).toBe('settled')
    expect(viewForStatus('completed').className).toBe('bg-status-closed')
    expect(viewForStatus('available').variant).toBe('active')
    expect(viewForStatus('available').className).toBe('bg-status-active')
    expect(viewForStatus('fully_allocated').variant).toBe('pending')
    expect(viewForStatus('fully_allocated').className).toBe('bg-status-pending')
  })

  it('carries the glow on the active variant only', () => {
    // DESIGN.md's badge anatomy makes the glow conditional and ties it to the
    // active variant. Coming Soon is active too, and glows for the same reason.
    expect(viewForStatus('coming_soon').glow).toBe(true)
    expect(viewForStatus('available').glow).toBe(true)
    expect(viewForStatus('fully_allocated').glow).toBe(false)
    expect(viewForStatus('completed').glow).toBe(false)
  })
})

describe('an unrecognised value is an error, not a fallback', () => {
  it('throws rather than returning a default view', () => {
    // DESIGN.md: a default that renders the one state which must never be public is
    // worse than a visible failure. The read layer carries an off-enum value through
    // verbatim precisely so that this is where it stops.
    expect(() => viewForStatus('something_else')).toThrow(/untranslatable DSL status/)
    expect(() => viewForStatus('')).toThrow(/untranslatable DSL status/)
    expect(() => viewForStatus('draft')).toThrow(/untranslatable DSL status/)
    expect(() => viewForStatus('coming_soon_details')).toThrow(/untranslatable DSL status/)
  })

  it('has no fallback operator in its code', () => {
    // Comments in the module name these constructs while explaining why they are
    // absent, so the scan runs on comment-stripped source. A check that matched its
    // own documentation would pass for the wrong reason.
    expect(STATUS_SOURCE).not.toContain('??')
    expect(STATUS_SOURCE).not.toContain('?.')
    expect(STATUS_SOURCE).not.toMatch(/default\s*:/)
    expect(STATUS_SOURCE).not.toMatch(/\bswitch\b/)
  })

  it('never emits the two states the site has no database equivalent for', () => {
    // PLAN.md:295. `draft` is `published = false`, which is an absence from the
    // marketplace rather than a status to render. The scan runs on comment-stripped
    // source, because the module's own comment names both of them while explaining
    // why they are absent.
    const text = JSON.stringify(STATUS_VIEWS)
    expect(text).not.toContain('draft')
    expect(text).not.toContain('coming_soon_details')
    for (const { path, text: source } of SOURCES) {
      expect(stripComments(source), `${path} names a status the site never emits`).not.toContain(
        'coming_soon_details',
      )
    }
  })
})

describe('the status vocabulary lives in one place', () => {
  it('keeps the labels and variant names inside the status module and the theme', () => {
    const labels = ['COMING SOON', 'AVAILABLE', 'FULLY ALLOCATED', 'COMPLETED']
    const variants = ["'active'", "'pending'", "'settled'"]

    for (const { path, text } of SOURCES) {
      if (path === STATUS_MODULE || path === THEME) continue
      for (const token of [...labels, ...variants]) {
        expect(text, `${path} names ${token}`).not.toContain(token)
      }
    }
  })

  it('is the only module that reads the enum for display', () => {
    // The read layer carries the enum raw; exactly one module turns it into words.
    // Two consumers are expected and no more: the badge, which is the one ruled
    // component, and the horse page, which needs the label for its structured data.
    const allowed = new Set(['components/StatusBadge.tsx', 'app/marketplace/[slug]/page.tsx'])
    const importers = SOURCES.filter(
      ({ path, text }) => path !== STATUS_MODULE && /from\s+'[^']*\/status'/.test(text),
    ).map(({ path }) => relative(SRC, path))

    expect(importers.length).toBeGreaterThan(0)
    for (const importer of importers) {
      expect(allowed.has(importer), `${importer} imports the status map`).toBe(true)
    }
  })
})
