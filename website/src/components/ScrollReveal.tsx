'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

const REVEAL_QUERY = '[data-reveal]'
const OBSERVER_OPTIONS: IntersectionObserverInit = {
  rootMargin: '0px 0px -8% 0px',
  threshold: 0.12,
}

export function ScrollReveal() {
  const pathname = usePathname()

  useEffect(() => {
    const root = document.documentElement
    const nodes = Array.from(document.querySelectorAll<HTMLElement>(REVEAL_QUERY))
    const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)')

    if (nodes.length === 0 || motionPreference.matches || !('IntersectionObserver' in window)) {
      return
    }

    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue

        entry.target.setAttribute('data-reveal', 'revealed')
        observer.unobserve(entry.target)
      }
    }, OBSERVER_OPTIONS)

    for (const node of nodes) {
      const rect = node.getBoundingClientRect()
      const isInitiallyVisible = rect.top < window.innerHeight && rect.bottom > 0

      if (isInitiallyVisible) {
        node.setAttribute('data-reveal', 'revealed')
        continue
      }

      node.setAttribute('data-reveal', 'armed')
      observer.observe(node)
    }

    root.setAttribute('data-reveal-ready', '')

    const revealAll = (event: MediaQueryListEvent) => {
      if (!event.matches) return

      observer.disconnect()
      root.removeAttribute('data-reveal-ready')
      for (const node of nodes) node.setAttribute('data-reveal', 'revealed')
    }

    motionPreference.addEventListener('change', revealAll)

    return () => {
      observer.disconnect()
      motionPreference.removeEventListener('change', revealAll)
      root.removeAttribute('data-reveal-ready')
      for (const node of nodes) node.removeAttribute('data-reveal')
    }
  }, [pathname])

  return null
}
