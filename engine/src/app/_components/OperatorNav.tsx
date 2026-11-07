import Link from 'next/link'

/**
 * The operator sidebar. DSL engine decision 2026-11-07.
 *
 * Three sections, in the order the data flows: the static records, the
 * listings assembled from them, and the sales that come out of a listing.
 */

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

export function OperatorNav() {
  return (
    <nav aria-label="Operator sections" className="border-r border-black/10 p-4">
      {SECTIONS.map((section) => (
        <div key={section.heading} className="mb-6">
          <p className="mb-2 text-xs uppercase tracking-wide opacity-60">{section.heading}</p>
          <ul className="space-y-1">
            {section.items.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="underline-offset-4 hover:underline">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  )
}
