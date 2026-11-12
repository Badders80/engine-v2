'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV_LINKS = [
  { label: 'About', href: '/#about' },
  { label: 'Mission', href: '/#mission' },
  { label: 'Model', href: '/#digital-syndication' },
  { label: 'Marketplace', href: '/marketplace' },
  { label: 'MyStable', href: '/mystable' },
  { label: 'FAQ', href: '/#faq' },
] as const

export function NavBar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const pathname = usePathname()

  useEffect(() => {
    if (!mobileMenuOpen) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileMenuOpen(false)
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [mobileMenuOpen])

  const closeMenu = () => setMobileMenuOpen(false)

  return (
    <header className="fixed inset-x-0 top-0 z-nav min-h-28 w-full overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-canvas/40 backdrop-blur-2xl"
        style={{
          maskImage: 'linear-gradient(to bottom, black 0%, black 58%, transparent 100%)',
          WebkitMaskImage: 'linear-gradient(to bottom, black 0%, black 58%, transparent 100%)',
        }}
      />

      <div className="relative mx-auto flex h-20 max-w-6xl items-center px-12 md:px-16 lg:px-20">
        <div className="flex flex-1 items-center">
          <Link
            href="/"
            onClick={closeMenu}
            className="flex items-center rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-edge"
          >
            <Image
              src="/brand/wordmark/wordmark-muted-grey.svg"
              alt="Evolution Stables"
              width={1534}
              height={488}
              priority
              className="h-7 w-auto object-contain"
            />
          </Link>
        </div>

        <nav aria-label="Main Navigation" className="hidden flex-1 items-center justify-center md:flex">
          {NAV_LINKS.map((item) => {
            const isRoute = !item.href.includes('#')
            const active = isRoute && pathname === item.href
            return (
              <Link
                key={item.label}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={`label-eyebrow whitespace-nowrap px-2.5 py-4 transition-colors duration-hover focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-edge ${
                  active ? 'text-gold' : 'text-ink hover:text-heading'
                }`}
              >
                {item.label}
              </Link>
            )
          })}
        </nav>

        <div className="flex flex-1 items-center justify-end">
          <Link
            href="/marketplace"
            className="label-action hidden rounded-full border border-edge/70 bg-surface px-6 py-2.5 text-heading transition-colors duration-hover hover:border-edge hover:bg-raised focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-edge md:inline-flex"
          >
            Get Started
          </Link>

          <button
            type="button"
            onClick={() => setMobileMenuOpen((open) => !open)}
            aria-label={mobileMenuOpen ? 'Close Navigation Menu' : 'Open Navigation Menu'}
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-navigation"
            className="flex h-11 w-11 items-center justify-center rounded-lg text-muted-foreground transition-colors duration-hover hover:bg-surface hover:text-heading focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-edge md:hidden"
          >
            {mobileMenuOpen ? (
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {mobileMenuOpen ? (
        <div id="mobile-navigation" className="border-t border-border bg-canvas/95 backdrop-blur-md md:hidden">
          <nav aria-label="Mobile Navigation" className="mx-auto flex max-w-6xl flex-col px-8 py-6 md:hidden">
            {NAV_LINKS.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                onClick={closeMenu}
                className="label-eyebrow rounded-lg px-4 py-3.5 text-ink transition-colors duration-hover hover:bg-surface hover:text-heading focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-edge"
              >
                {item.label}
              </Link>
            ))}
            <div className="mt-4 border-t border-border pt-6">
              <Link
                href="/marketplace"
                onClick={closeMenu}
                className="label-action block w-full rounded-full border border-edge/70 bg-surface py-3 text-center text-heading transition-colors duration-hover hover:border-edge hover:bg-raised focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-edge"
              >
                Get Started
              </Link>
            </div>
          </nav>
        </div>
      ) : null}
    </header>
  )
}
