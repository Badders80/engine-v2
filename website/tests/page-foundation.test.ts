import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const APP_ROOT = fileURLToPath(new URL('..', import.meta.url))
const read = (path: string) => readFileSync(resolve(APP_ROOT, path), 'utf8')

const primitives = read('src/components/PagePrimitives.tsx')
const design = read('DESIGN.md')

describe('shared page foundation', () => {
  it('owns the page container, shell, intro and section primitives', () => {
    expect(primitives).toContain('export const PAGE_CONTAINER')
    expect(primitives).toContain('export function PageShell')
    expect(primitives).toContain('export function PageIntro')
    expect(primitives).toContain('export function PageSection')
    expect(primitives).toContain('data-reveal')
  })

  it('is consumed by the public commerce pages', () => {
    for (const path of [
      'src/app/marketplace/page.tsx',
      'src/app/marketplace/[slug]/page.tsx',
      'src/app/mystable/page.tsx',
    ]) {
      expect(read(path)).toContain('PagePrimitives')
    }
  })

  it('locks the reveal token and page separation rule in DESIGN.md', () => {
    expect(design).toContain('duration-reveal: 750ms')
    expect(design).toContain('--duration-reveal')
    expect(design).toContain("**25 · Don't draw a rule between page-level sections")
  })
})
