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
    <article className="group grid gap-8 rounded-lg border border-border bg-surface p-5 md:grid-cols-[minmax(0,1fr)_minmax(210px,360px)] md:items-center md:gap-12 md:p-8">
      <div className="relative order-first aspect-video overflow-hidden rounded-md bg-canvas p-3 md:order-last">
        {card.imageSrc ? (
          <div className="relative h-full w-full">
            <Image
              src={card.imageSrc}
              alt={card.horse.legalName}
              fill
              priority={priority}
              sizes="(max-width: 767px) calc(100vw - 136px), 360px"
              className="object-contain opacity-90 transition-opacity duration-hover group-hover:opacity-100"
            />
          </div>
        ) : (
          <p className="label-spec flex h-full items-center justify-center text-muted-foreground">
            No photograph
          </p>
        )}
        <span className="absolute right-4 top-4 z-10">
          <StatusBadge status={card.status} />
        </span>
      </div>

      <div className="min-w-0">
        <h2 className="text-card-heading leading-heading text-heading">{card.horse.legalName}</h2>
        {card.hook ? (
          <p className="mt-3 max-w-xl text-body-small leading-body text-ink">{card.hook}</p>
        ) : null}
        {card.tags.length > 0 ? (
          <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-2" aria-label="Horse highlights">
            {card.tags.map((tag) => (
              <li key={tag} className="label-spec text-muted-foreground">
                {tag}
              </li>
            ))}
          </ul>
        ) : null}
        <Link
          href={`/marketplace/${card.horse.slug}`}
          className="label-action mt-7 inline-flex min-h-11 items-center gap-2 text-gold transition-colors duration-hover hover:text-gold-hover focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-edge"
        >
          {cta}
          <span aria-hidden="true">→</span>
        </Link>
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
        className="flex flex-wrap gap-x-8 gap-y-1"
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
              className={`label-eyebrow relative min-h-11 pb-2.5 transition-colors duration-hover focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-edge ${
                active ? 'text-heading' : 'text-muted-foreground hover:text-heading'
              }`}
            >
              {item.label}
              {active ? (
                <span className="absolute inset-x-0 bottom-0 h-px bg-heading" aria-hidden="true" />
              ) : null}
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
        <ul className="mt-16 space-y-6">
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
