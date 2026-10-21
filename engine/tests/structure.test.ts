/**
 * The negative constraints on step 4, asserted against the tree itself.
 *
 * Step 4 belongs inside `engine/`. Horse, trainer, and owner do not get screens
 * of their own; the DSL page is the only operator surface, and it is the only
 * thing that writes those rows. The website app is not touched by this step.
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

describe('horse, trainer, and owner get no screens of their own', () => {
  it('has no horses, trainers, or owners route on the engine', () => {
    const routes = appRoutes('engine')
    expect(routes).not.toContain('horses')
    expect(routes).not.toContain('trainers')
    expect(routes).not.toContain('owners')
  })

  it('has no list, admin, or management route on the engine', () => {
    const routes = appRoutes('engine')
    for (const banned of ['admin', 'manage', 'management', 'crud', 'registry']) {
      expect(routes).not.toContain(banned)
    }
  })
})

describe('step 4 stays inside the engine app', () => {
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

describe('one DSL page, not a suite of them', () => {
  it('keeps the dsl route and the purchase/stripe api route and nothing beside them', () => {
    const routes = appRoutes('engine')
    const unexpected = routes.filter((name) => !['dsl', 'api'].includes(name))
    expect(unexpected).toEqual([])
  })
})
