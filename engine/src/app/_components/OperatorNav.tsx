'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

/**
 * The operator sidebar. DSL engine decision 2026-11-07.
 *
 * Home first, then the three sections in the order the data flows: the static
 * records, the listings assembled from them, and the sales that come out of a
 * listing (PLAN.md §3).
 */

const HOME = { href: '/', label: 'Home' }

const SECTIONS = [
  {
    heading: 'Records',
    items: [
      { href: '/horses', label: 'Horses' },
      { href: '/trainers', label: 'Trainers' },
      { href: '/owners', label: 'Owners' },
    ],
  },
  {
    heading: 'Listings',
    items: [{ href: '/dsl', label: 'DSLs' }],
  },
  {
    heading: 'Sales',
    items: [{ href: '/sales', label: 'Sales' }],
  },
]

function active(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/'
  return pathname === href || pathname.startsWith(`${href}/`)
}

function NavLink({ href, label }: { href: string; label: string }) {
  const pathname = usePathname()
  const isActive = active(pathname, href)

  return (
    <Link
      href={href}
      aria-current={isActive ? 'page' : undefined}
      className={`block rounded-sm px-3 py-2 text-body transition-colors ${
        isActive ? 'bg-row text-ink' : 'text-muted hover:bg-row hover:text-ink'
      }`}
    >
      {label}
    </Link>
  )
}

export function OperatorNav() {
  return (
    <nav
      aria-label="Operator sections"
      className="border-b border-line bg-rail p-4 md:border-b-0 md:border-r md:p-6"
    >
      <NavLink {...HOME} />

      {SECTIONS.map((section) => (
        <div key={section.heading} className="mt-8">
          <p className="mb-2 px-3 text-caption uppercase tracking-caption text-low">
            {section.heading}
          </p>
          <ul>
            {section.items.map((item) => (
              <li key={item.href}>
                <NavLink {...item} />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  )
}
