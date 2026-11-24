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

  it('locks the global listing-card aperture, pill tags, hover lift and horse-page anatomy', () => {
    const css = read('src/app/globals.css')
    const browser = read('src/components/MarketplaceBrowser.tsx')
    const gallery = read('src/components/HorseGallery.tsx')
    const tabs = read('src/components/HorseDetailsTabs.tsx')

    expect(design).toContain('zero to four')
    expect(design).toContain('.listing-aperture')
    expect(design).toContain('after:absolute after:inset-0')
    expect(design).toContain('### Horse page — gallery, pedigree and offer rail')
    expect(design).toContain('never a gold border')
    expect(design).toContain("**26 · Don't shrink or crop horse cutouts on marketplace card resize")
    expect(design).toContain("**27 · Don't put scrollbars or horizontal slide-bars on navigation controls")

    expect(css).toContain('.listing-aperture')
    expect(css).toContain('.listing-aperture-stage')
    expect(css).toContain('clamp(210px, 36%, 360px)')
    expect(css).toContain('height: 210px;')

    expect(browser).toContain('listing-aperture')
    expect(browser).toContain('listing-aperture-stage')
    expect(browser).toContain('hover:shadow-card-hover')
    expect(browser).toContain('rounded-pill')
    expect(browser).not.toContain('clamp(')
    expect(gallery).not.toContain('border-gold')

    // Rule 27: tablist is a reactive flex-wrap strip with no overflow-x-auto or -mb-px scrollbar trigger.
    const tablistMatch = tabs.match(/role="tablist"[\s\S]*?>/)
    expect(tablistMatch?.[0]).toContain('flex-wrap')
    expect(tablistMatch?.[0]).not.toContain('overflow-x-auto')
    expect(tabs).not.toContain('-mb-px')
  })
})
