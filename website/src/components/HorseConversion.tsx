'use client'

import Link from 'next/link'
import { useEffect } from 'react'

import type { HorsePageFixture } from '../lib/horsePageFixture'
import StatusBadge from './StatusBadge'

function OfferFigure({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-t border-border py-4">
      <dt className="label-spec text-muted-foreground">{label}</dt>
      <dd className="mt-2 font-mono text-card-heading font-medium text-heading">{value}</dd>
    </div>
  )
}

export function HorseOfferRail({ horse }: { horse: HorsePageFixture }) {
  const { offer } = horse

  return (
    <aside id="offer" className="rounded-lg border border-border bg-surface p-6 lg:sticky lg:top-32">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="label-eyebrow text-muted-foreground">Digital syndication</p>
        <StatusBadge status={horse.status} />
      </div>

      <h2 className="mt-6 text-section-heading leading-display tracking-display text-heading">
        Own the experience
      </h2>

      <div className="mt-8 flex items-end gap-3">
        <p className="font-mono text-section-heading font-medium text-heading">{offer.price}</p>
        <p className="label-spec pb-2 text-muted-foreground">{offer.priceUnit}</p>
      </div>

      <dl className="mt-5">
        <OfferFigure label="Listed stake" value={offer.listedStake} />
        <OfferFigure label="Investor return" value={offer.investorReturn} />
        <OfferFigure label="Campaign term" value={`Through ${offer.expiry}`} />
      </dl>

      <ul className="mt-7 space-y-5">
        {offer.benefits.map((benefit) => (
          <li key={benefit.title}>
            <p className="text-body-small text-heading">{benefit.title}</p>
            <p className="mt-1 text-body-small leading-body text-muted-foreground">{benefit.body}</p>
          </li>
        ))}
      </ul>

      <Link
        href={offer.ctaHref}
        className="label-action mt-8 flex min-h-11 w-full items-center justify-center rounded-pill bg-heading px-6 py-3 text-canvas focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-edge"
      >
        {offer.ctaLabel}
      </Link>

      <p className="mt-5 text-micro leading-body text-muted-foreground">
        The Product Disclosure Statement and Syndicate Agreement set out the full offer, risks,
        declarations and campaign terms.
      </p>
    </aside>
  )
}

export function HorseMobileBar({ horse }: { horse: HorsePageFixture }) {
  const { offer } = horse

  useEffect(() => {
    document.body.classList.add('has-horse-conversion-bar')
    return () => document.body.classList.remove('has-horse-conversion-bar')
  }, [])

  return (
    <aside
      aria-label="Ownership action"
      className="fixed inset-x-0 bottom-0 z-sticky border-t border-border bg-canvas/95 px-4 pt-3 backdrop-blur-md md:hidden"
      style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
    >
      <div className="mx-auto flex max-w-6xl items-center gap-4">
        <div className="min-w-0 flex-1">
          <p className="font-mono text-body-small font-medium text-heading">{offer.price}</p>
          <p className="label-spec truncate text-muted-foreground">{offer.priceUnit}</p>
        </div>
        <Link
          href={offer.ctaHref}
          className="label-action flex min-h-11 shrink-0 items-center justify-center rounded-pill bg-heading px-5 py-3 text-canvas focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-edge"
        >
          {offer.ctaLabel}
        </Link>
      </div>
    </aside>
  )
}
