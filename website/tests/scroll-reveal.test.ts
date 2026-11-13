import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const APP_ROOT = fileURLToPath(new URL('..', import.meta.url))
const componentSource = readFileSync(
  resolve(APP_ROOT, 'src/components/ScrollReveal.tsx'),
  'utf8',
)
const pageSource = readFileSync(resolve(APP_ROOT, 'src/app/page.tsx'), 'utf8')
const layoutSource = readFileSync(resolve(APP_ROOT, 'src/app/layout.tsx'), 'utf8')
const cssSource = readFileSync(resolve(APP_ROOT, 'src/app/globals.css'), 'utf8')

describe('landing scroll reveal', () => {
  it('uses a native reveal-once observer with reduced-motion and browser fallbacks', () => {
    expect(componentSource).toContain('new IntersectionObserver')
    expect(componentSource).toContain("matchMedia('(prefers-reduced-motion: reduce)')")
    expect(componentSource).toContain("!('IntersectionObserver' in window)")
    expect(componentSource).toContain('observer.unobserve(entry.target)')
    expect(componentSource).toContain('usePathname')
    expect(componentSource).toContain('[pathname]')
    expect(componentSource).not.toMatch(/gsap|ScrollTrigger/)
  })

  it('keeps content visible until the client enhancement is ready', () => {
    expect(componentSource).toContain("root.setAttribute('data-reveal-ready', '')")
    expect(cssSource).toContain("html[data-reveal-ready] [data-reveal='armed']")
    expect(cssSource).toContain('translate: 0 var(--reveal-travel, 12px)')
    expect(cssSource).toContain('var(--duration-reveal)')
    expect(cssSource).toContain('--duration-reveal: 750ms')
    expect(layoutSource).toContain('<ScrollReveal />')
    expect(pageSource).not.toContain('<ScrollReveal />')
  })

  it('keeps the hero static and reveals selected landing groups only', () => {
    const heroStart = pageSource.indexOf('id="hero"')
    const aboutStart = pageSource.indexOf('id="about"')
    const heroSource = pageSource.slice(heroStart, aboutStart)

    expect(heroSource).not.toContain('data-reveal')
    expect((pageSource.match(/data-reveal(?:\s|>)/g) ?? []).length).toBeGreaterThanOrEqual(6)
    expect(pageSource).toContain('revealDelay(index)')
  })
})
