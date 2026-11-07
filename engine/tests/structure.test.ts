/**
 * The negative constraints on the operator surface, asserted against the tree.
 *
 * Amended 2026-11-07. The original rule was "horse, trainer and owner get no
 * screens of their own; the DSL page is the only operator surface". The model
 * that replaced it makes those three independent records, so they do have
 * lists and edit pages. What survives, and is asserted here, is that the
 * surface stays small, deliberate, and never grows an admin suite.
 */

import { existsSync, readdirSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const ENGINE = new URL('..', import.meta.url)
const REPO = new URL('../..', import.meta.url)

/** The route folders under an app, ignoring files such as page.tsx and css. */
function appRoutes(app: 'engine' | 'website'): string[] {
  const dir = new URL(`src/app/`, new URL(`${app}/`, REPO))
  if (!existsSync(dir)) return []
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
    .map((entry) => entry.name)
    .sort()
}

describe('the operator surface is three sections', () => {
  it('has a records section for each static table', () => {
    const routes = appRoutes('engine')
    expect(routes).toEqual(expect.arrayContaining(['horses', 'trainers', 'owners']))
  })

  it('has a listings section and a sales section', () => {
    const routes = appRoutes('engine')
    expect(routes).toEqual(expect.arrayContaining(['dsl', 'sales']))
  })

  it('has no admin, management or registry route', () => {
    const routes = appRoutes('engine')
    for (const banned of ['admin', 'manage', 'management', 'crud', 'registry']) {
      expect(routes).not.toContain(banned)
    }
  })
})

describe('the engine app owns the operator surface', () => {
  it('leaves the website app without a DSL or operator route', () => {
    const routes = appRoutes('website')
    for (const banned of ['dsl', 'dsls', 'engine', 'operator', 'admin']) {
      expect(routes).not.toContain(banned)
    }
  })
})

describe('the two files step 4 must not add', () => {
  it('adds no AGENTS.md', () => {
    expect(existsSync(new URL('AGENTS.md', ENGINE))).toBe(false)
  })

  it('adds no CLAUDE.md', () => {
    expect(existsSync(new URL('CLAUDE.md', ENGINE))).toBe(false)
  })
})

describe('the operator guide stays single', () => {
  it('keeps engine/OPERATIONS.md', () => {
    expect(existsSync(new URL('OPERATIONS.md', ENGINE))).toBe(true)
  })

  it('adds no second copy in the website app', () => {
    expect(existsSync(new URL('website/OPERATIONS.md', REPO))).toBe(false)
  })
})

describe('the route set stays closed', () => {
  it('adds no route beyond the three sections, the API and the shared folder', () => {
    const routes = appRoutes('engine')
    const allowed = ['_components', 'api', 'dsl', 'horses', 'owners', 'records', 'sales', 'trainers']
    expect(routes.filter((name) => !allowed.includes(name))).toEqual([])
  })
})
