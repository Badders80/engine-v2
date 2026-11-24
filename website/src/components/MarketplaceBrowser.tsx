'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useMemo, useState } from 'react'

import {
  filterMarketplaceCards,
  type MarketplaceCard,
  type MarketplaceFilter,
} from '../lib/marketplace'
import StatusBadge from './StatusBadge'

const FILTERS: readonly { key: MarketplaceFilter; label: string }[] = [
  { key: 'all', label: 'All Thoroughbreds' },
  { key: 'available', label: 'Available' },
  { key: 'coming_soon', label: 'Coming Soon' },
]

function ListingCard({ card, priority }: { card: MarketplaceCard; priority: boolean }) {
  const cta = card.status === 'coming_soon' ? 'Register interest' : 'View offering'

  return (
    <article
      className={`group relative flex flex-col items-stretch gap-6 rounded-lg border border-border bg-surface p-5 transition duration-hover ease-enter md:flex-row md:items-center md:gap-10 md:p-8 ${
        card.href
          ? 'hover:-translate-y-1 hover:border-edge/40 hover:shadow-card-hover'
          : 'opacity-80'
      }`}
    >
      <div className="listing-aperture relative order-first overflow-hidden rounded-md bg-canvas p-3 md:order-last">
        {card.imageSrc ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-3">
            <div className="listing-aperture-stage relative">
              <Image
                src={card.imageSrc}
                alt={card.horse.legalName}
                fill
                priority={priority}
                sizes="(max-width: 767px) calc(100vw - 120px), 360px"
                className="object-contain opacity-90 transition-opacity duration-hover group-hover:opacity-100"
              />
            </div>
          </div>
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 rounded-sm border border-dashed border-border text-center">
            <span className="label-spec text-muted-foreground">
              {card.isPlaceholder ? 'Preview card slot' : 'No photograph'}
            </span>
          </div>
        )}
        <span className="absolute right-4 top-4 z-10">
          <StatusBadge status={card.status} />
        </span>
      </div>

      <div className="min-w-0 flex-1 md:order-first">
        <h2 className="text-2xl font-light leading-heading tracking-tight text-heading">
          {card.horse.legalName}
        </h2>

        {card.hook ? (
          <p className="mt-3 max-w-xl text-body-small font-light leading-body text-ink">
            {card.hook}
          </p>
        ) : null}

        {card.tags.length > 0 ? (
          <ul className="mt-6 flex flex-wrap gap-2" aria-label="Horse highlights">
            {card.tags.map((tag) => (
              <li
                key={tag}
                className="label-spec rounded-pill border border-border bg-canvas/60 px-3 py-1 text-muted-foreground"
              >
                {tag}
              </li>
            ))}
          </ul>
        ) : null}

        {card.href ? (
          <Link
            href={card.href}
            className="label-action mt-7 inline-flex min-h-11 items-center gap-2 text-muted-foreground transition-colors duration-hover after:absolute after:inset-0 group-hover:text-gold focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-edge"
          >
            {cta}
            <span
              aria-hidden="true"
              className="transition-transform duration-hover group-hover:translate-x-1"
            >
              →
            </span>
          </Link>
        ) : (
          <p className="label-spec mt-7 inline-flex min-h-11 items-center text-muted-foreground">
            Layout preview only · not published
          </p>
        )}
      </div>
    </article>
  )
}

export function MarketplaceBrowser({ cards }: { cards: readonly MarketplaceCard[] }) {
  const [filter, setFilter] = useState<MarketplaceFilter>('all')
  const visibleCards = useMemo(() => filterMarketplaceCards(cards, filter), [cards, filter])

  return (
    <>
      <div
        className="flex flex-wrap gap-x-5 gap-y-1 border-b border-border sm:gap-x-8"
        role="group"
        aria-label="Filter marketplace listings"
      >
        {FILTERS.map((item) => {
          const active = filter === item.key
          return (
            <button
              key={item.key}
              type="button"
              aria-pressed={active}
              onClick={() => setFilter(item.key)}
              className={`label-eyebrow relative -mb-px min-h-11 border-b-2 pb-3 transition-colors duration-hover focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-edge ${
                active
                  ? 'border-heading text-heading'
                  : 'border-transparent text-muted-foreground hover:text-heading'
              }`}
            >
              {item.label}
            </button>
          )
        })}
      </div>

      <p className="sr-only" aria-live="polite">
        {visibleCards.length} {visibleCards.length === 1 ? 'listing' : 'listings'}
      </p>

      {visibleCards.length === 0 ? (
        <p className="mt-16 max-w-xl text-body-small leading-body text-muted-foreground">
          No offers are published in this view yet. Each one appears here when its campaign opens.
        </p>
      ) : (
        <ul className="mt-12 space-y-6">
          {visibleCards.map((card, index) => (
            <li key={card.id}>
              <ListingCard card={card} priority={index === 0} />
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
