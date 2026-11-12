import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const APP_ROOT = fileURLToPath(new URL('..', import.meta.url))
const NAVBAR_SOURCE = readFileSync(
  resolve(APP_ROOT, 'src/components/NavBar.tsx'),
  'utf8',
)

describe('mobile navigation motion', () => {
  it('keeps the drawer mounted and hidden from interaction when closed', () => {
    expect(NAVBAR_SOURCE).toContain('aria-hidden={!mobileMenuOpen}')
    expect(NAVBAR_SOURCE).toContain('inert={!mobileMenuOpen}')
    expect(NAVBAR_SOURCE).toContain('pointer-events-none')
  })

  it('uses asymmetric state-driven entry and exit transitions', () => {
    expect(NAVBAR_SOURCE).toContain('transition-[opacity,translate]')
    expect(NAVBAR_SOURCE).toContain('duration-step')
    expect(NAVBAR_SOURCE).toContain('duration-modal-exit')
    expect(NAVBAR_SOURCE).toContain('translate-y-0')
    expect(NAVBAR_SOURCE).toContain('-translate-y-1')
  })

  it('morphs a persistent icon and restores focus after Escape', () => {
    expect(NAVBAR_SOURCE).toContain('transition-[translate,rotate,opacity]')
    expect(NAVBAR_SOURCE).toContain('translate-y-[5px] rotate-45')
    expect(NAVBAR_SOURCE).toContain('-translate-y-[5px] -rotate-45')
    expect(NAVBAR_SOURCE).toContain(
      'window.requestAnimationFrame(() => menuButtonRef.current?.focus())',
    )
  })
})
