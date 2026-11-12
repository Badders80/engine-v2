'use client'

import { useEffect, useRef, useState } from 'react'
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
  const menuButtonRef = useRef<HTMLButtonElement>(null)
  const pathname = usePathname()

  useEffect(() => {
    if (!mobileMenuOpen) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return

      setMobileMenuOpen(false)
      window.requestAnimationFrame(() => menuButtonRef.current?.focus())
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [mobileMenuOpen])

  const closeMenu = () => setMobileMenuOpen(false)

  return (
    <>
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
              ref={menuButtonRef}
              type="button"
              onClick={() => setMobileMenuOpen((open) => !open)}
              aria-label={mobileMenuOpen ? 'Close Navigation Menu' : 'Open Navigation Menu'}
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-navigation"
              className="flex h-11 w-11 items-center justify-center rounded-lg text-muted-foreground transition-colors duration-hover hover:bg-surface hover:text-heading focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-edge md:hidden"
            >
              <span aria-hidden="true" className="relative block h-4 w-5">
                <span
                  className={`absolute left-0 top-[3px] h-px w-5 origin-center bg-current transition-[translate,rotate,opacity] duration-micro ease-enter ${
                    mobileMenuOpen ? 'translate-y-[5px] rotate-45' : 'rotate-0'
                  }`}
                />
                <span
                  className={`absolute left-0 top-2 h-px w-5 bg-current transition-[translate,rotate,opacity] duration-micro ease-enter ${
                    mobileMenuOpen ? 'opacity-0' : 'opacity-100'
                  }`}
                />
                <span
                  className={`absolute left-0 top-[13px] h-px w-5 origin-center bg-current transition-[translate,rotate,opacity] duration-micro ease-enter ${
                    mobileMenuOpen ? '-translate-y-[5px] -rotate-45' : 'rotate-0'
                  }`}
                />
              </span>
            </button>
          </div>
        </div>
      </header>

      <div
        id="mobile-navigation"
        aria-hidden={!mobileMenuOpen}
        inert={!mobileMenuOpen}
        className={`fixed inset-x-0 top-20 z-drawer max-h-[calc(100dvh-5rem)] overflow-y-auto border-y border-border bg-canvas/95 backdrop-blur-md transition-[opacity,translate] ease-enter md:hidden ${
          mobileMenuOpen
            ? 'pointer-events-auto translate-y-0 opacity-100 duration-step'
            : 'pointer-events-none -translate-y-1 opacity-0 duration-modal-exit'
        }`}
      >
        <nav aria-label="Mobile Navigation" className="mx-auto flex max-w-6xl flex-col px-8 py-6">
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
    </>
  )
}
