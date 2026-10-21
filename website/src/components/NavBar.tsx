'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV_LINDS = [
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

  const closeMenu = () => setMobileMenuOpen(false)

  return (
    <header className="sticky top-0 z-nav w-full border-b border-border bg-canvas/85 backdrop-blur-md">
      <div className="mx-auto flex h-20 max-w-6xl items-center justify-between px-12 md:px-16 lg:px-20">
        <Link href="/" onClick={closeMenu} className="flex items-center gap-3">
          <Image
            src="/brand/lockups/lockup-horizontal-gold.svg"
            alt="Evolution Stables"
            width={180}
            height={32}
            priority
            style={{ width: 'auto', height: '2rem' }}
            className="h-8 w-auto object-contain"
          />
        </Link>

        {/* Desktop Navigation */}
        <nav aria-label="Main Navigation" className="hidden items-center gap-8 md:flex">
          {NAV_LINDS.map((item) => {
            const isRoute = !item.href.includes('#')
            const active = isRoute && pathname === item.href
            return (
              <Link
                key={item.label}
                href={item.href}
                className={`label-eyebrow transition-colors duration-hover ${
                  active ? 'text-gold' : 'text-muted-foreground hover:text-heading'
                }`}
              >
                {item.label}
              </Link>
            )
          })}
        </nav>

        {/* Action Button */}
        <div className="hidden items-center gap-4 md:flex">
          <Link
            href="/marketplace"
            className="label-action rounded-full border border-gold/40 px-5 py-2 text-gold transition-colors duration-hover hover:border-gold hover:bg-surface"
          >
            Get Started
          </Link>
        </div>

        {/* Mobile Hamburger Toggle */}
        <button
          type="button"
          onClick={() => setMobileMenuOpen((prev) => !prev)}
          aria-label={mobileMenuOpen ? 'Close Navigation Menu' : 'Open Navigation Menu'}
          className="flex h-10 w-10 items-center justify-center rounded-lg border border-border text-heading md:hidden"
        >
          {mobileMenuOpen ? (
            <svg
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          )}
        </button>
      </div>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen ? (
        <div className="border-b border-border bg-surface px-12 py-6 md:hidden">
          <nav aria-label="Mobile Navigation" className="flex flex-col gap-4">
            {NAV_LINDS.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                onClick={closeMenu}
                className="label-eyebrow py-2 text-muted-foreground transition-colors duration-hover hover:text-heading"
              >
                {item.label}
              </Link>
            ))}
            <div className="pt-2">
              <Link
                href="/marketplace"
                onClick={closeMenu}
                className="label-action block w-full rounded-full border border-gold/40 py-2.5 text-center text-gold transition-colors duration-hover hover:border-gold hover:bg-canvas"
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
