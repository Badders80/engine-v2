'use client'

import Link from 'next/link'
import { useEffect, type ReactNode } from 'react'

import type { DslStatus } from '../lib/listings'
import StatusBadge from './StatusBadge'

export type HorseOfferSummary = {
  status: DslStatus
  price: string
  priceUnit: string
  investorReturn: string | null
  listedStake: string
  expiry: string | null
  ctaLabel: string
  ctaHref: string
}

function StableAccessIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-4 shrink-0 text-muted-foreground"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M5 10v8M9 10v8M15 10v8M19 10v8M2 18h20M12 3l9 7H3l9-7z" />
    </svg>
  )
}

function RealtimeUpdatesIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-4 shrink-0 text-muted-foreground"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 12h4l2.5-6 4 12 2.5-6H21" />
    </svg>
  )
}

export function HorseOfferRail({
  offer,
  buyFlow,
}: {
  offer: HorseOfferSummary
  buyFlow?: ReactNode
}) {
  return (
    <aside
      id="offer"
      className="rounded-lg border border-border bg-surface p-6 shadow-panel md:p-7 lg:sticky lg:top-28"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="label-eyebrow text-muted-foreground">Digital syndication</p>
        <StatusBadge status={offer.status} />
      </div>

      <h2 className="mt-4 text-2xl font-light leading-heading tracking-tight text-heading">
        Own The Experience
      </h2>

      <div className="mt-7 space-y-6">
        <div>
          <p className="label-spec text-spot-mint">Price</p>
          <p className="mt-1 font-mono text-section-heading font-light leading-none tracking-tight text-heading">
            {offer.price}
          </p>
          <p className="mt-1.5 text-body-small font-light text-muted-foreground">
            {offer.priceUnit}
          </p>
        </div>

        {offer.investorReturn ? (
          <div>
            <p className="label-spec text-spot-mint">Return</p>
            <p className="mt-1 font-mono text-section-heading font-light leading-none tracking-tight text-heading">
              {offer.investorReturn}
            </p>
            <p className="mt-1.5 text-body-small font-light text-muted-foreground">
              return on stake won*
            </p>
          </div>
        ) : null}
      </div>

      <dl className="mt-6 grid grid-cols-[auto_1fr] gap-x-8 gap-y-4 border-y border-border py-4">
        <div>
          <dt className="label-spec text-muted-foreground">Listed stake</dt>
          <dd className="mt-1 whitespace-nowrap font-mono text-body-small font-light text-heading">
            {offer.listedStake}
          </dd>
        </div>
        {offer.expiry ? (
          <div>
            <dt className="label-spec text-muted-foreground">Campaign term</dt>
            <dd className="mt-1 whitespace-nowrap font-mono text-body-small font-light text-heading">
              Through {offer.expiry}
            </dd>
          </div>
        ) : null}
      </dl>

      <ul className="mt-6 space-y-5">
        <li className="flex items-start gap-3">
          <span className="mt-1">
            <StableAccessIcon />
          </span>
          <div>
            <p className="text-body-small font-medium text-heading">Stable Access</p>
            <p className="mt-1 text-body-small font-light leading-body text-muted-foreground">
              Quarterly visits to the training facility and trackside privileges.
            </p>
          </div>
        </li>
        <li className="flex items-start gap-3">
          <span className="mt-1">
            <RealtimeUpdatesIcon />
          </span>
          <div>
            <p className="text-body-small font-medium text-heading">Real-time Updates</p>
            <p className="mt-1 text-body-small font-light leading-body text-muted-foreground">
              Audio and video reports from the stable through the campaign.
            </p>
          </div>
        </li>
      </ul>

      {buyFlow ? (
        <div className="mt-7">{buyFlow}</div>
      ) : (
        <Link
          href={offer.ctaHref}
          className="label-action mt-7 flex min-h-11 w-full items-center justify-center gap-2 rounded-pill bg-heading px-6 py-3 text-on-light transition-colors duration-hover hover:bg-hover focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-edge"
        >
          {offer.ctaLabel}
          <span aria-hidden="true">→</span>
        </Link>
      )}

      <p className="mt-5 text-center text-micro leading-body text-muted-foreground">
        * For full investment details, see the Product Disclosure Statement and Syndicate Agreement.
      </p>
    </aside>
  )
}

export function HorseMobileBar({ offer }: { offer: HorseOfferSummary }) {
  useEffect(() => {
    document.body.classList.add('has-horse-conversion-bar')
    return () => document.body.classList.remove('has-horse-conversion-bar')
  }, [])

  return (
    <aside
      aria-label="Ownership action"
      className="fixed inset-x-0 bottom-0 z-sticky border-t border-border bg-canvas/95 px-4 pt-3 backdrop-blur-md lg:hidden"
      style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
    >
      <div className="mx-auto flex max-w-6xl items-center gap-4">
        <div className="min-w-0 flex-1">
          <p className="font-mono text-body font-medium text-heading">{offer.price}</p>
          <p className="label-spec truncate text-muted-foreground">{offer.priceUnit}</p>
        </div>
        <Link
          href={offer.ctaHref}
          className="label-action flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-pill bg-heading px-5 py-3 text-on-light transition-colors duration-hover hover:bg-hover focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-edge"
        >
          {offer.ctaLabel}
          <span aria-hidden="true">→</span>
        </Link>
      </div>
    </aside>
  )
}
