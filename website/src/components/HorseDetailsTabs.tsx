'use client'

import { useId, useRef, useState, type KeyboardEvent } from 'react'

import type { HorseDetails } from '../lib/horsePageFixture'

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'pedigree', label: 'Pedigree' },
  { id: 'trainer', label: 'Trainer' },
  { id: 'race-record', label: 'Race record' },
  { id: 'documents', label: 'Documents' },
] as const

type TabId = (typeof TABS)[number]['id']

export function HorseDetailsTabs({ details }: { details: HorseDetails }) {
  const [active, setActive] = useState<TabId>('overview')
  const baseId = useId()
  const buttonRefs = useRef<Array<HTMLButtonElement | null>>([])

  const selectTab = (index: number) => {
    const tab = TABS[index]
    if (!tab) return
    setActive(tab.id)
    buttonRefs.current[index]?.focus()
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (event.key === 'ArrowRight') {
      event.preventDefault()
      selectTab((index + 1) % TABS.length)
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault()
      selectTab((index - 1 + TABS.length) % TABS.length)
    } else if (event.key === 'Home') {
      event.preventDefault()
      selectTab(0)
    } else if (event.key === 'End') {
      event.preventDefault()
      selectTab(TABS.length - 1)
    }
  }

  return (
    <div>
      <div
        role="tablist"
        aria-label="Horse details"
        className="flex overflow-x-auto border-b border-border"
      >
        {TABS.map((tab, index) => {
          const selected = tab.id === active
          return (
            <button
              key={tab.id}
              ref={(element) => {
                buttonRefs.current[index] = element
              }}
              id={`${baseId}-${tab.id}-tab`}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={`${baseId}-${tab.id}-panel`}
              tabIndex={selected ? 0 : -1}
              onKeyDown={(event) => handleKeyDown(event, index)}
              onClick={() => setActive(tab.id)}
              className={`label-eyebrow relative min-h-11 whitespace-nowrap border-b-2 px-5 py-4 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-edge ${
                selected
                  ? '-mb-px border-gold text-heading'
                  : '-mb-px border-transparent text-muted-foreground'
              }`}
            >
              {tab.label}
            </button>
          )
        })}
      </div>

      <div
        id={`${baseId}-${active}-panel`}
        role="tabpanel"
        aria-labelledby={`${baseId}-${active}-tab`}
        tabIndex={0}
        className="min-h-56 pt-8 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-edge"
      >
        {active === 'overview' ? (
          <div className="max-w-2xl">
            <h3 className="text-card-heading leading-heading text-heading">{details.overview.title}</h3>
            <div className="mt-5 space-y-4 text-body-small leading-body text-ink">
              {details.overview.paragraphs.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
          </div>
        ) : null}

        {active === 'pedigree' ? (
          <div>
            <h3 className="text-card-heading leading-heading text-heading">Pedigree</h3>
            <dl className="mt-6 divide-y divide-border border-y border-border">
              {details.pedigree.rows.map((row) => (
                <div key={row.label} className="grid grid-cols-[7rem_1fr] gap-4 py-4">
                  <dt className="label-spec text-muted-foreground">{row.label}</dt>
                  <dd className="text-body-small leading-body text-heading">{row.value}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-5 max-w-2xl text-body-small leading-body text-muted-foreground">
              {details.pedigree.note}
            </p>
          </div>
        ) : null}

        {active === 'trainer' ? (
          <div className="max-w-2xl">
            <h3 className="text-card-heading leading-heading text-heading">{details.trainer.name}</h3>
            <p className="label-spec mt-3 text-muted-foreground">{details.trainer.location}</p>
            <div className="mt-5 space-y-4 text-body-small leading-body text-ink">
              {details.trainer.paragraphs.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
            <a
              href={details.trainer.website}
              target="_blank"
              rel="noopener noreferrer"
              className="label-action mt-7 inline-flex min-h-11 items-center text-gold focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-edge"
            >
              Official website <span aria-hidden="true">↗</span>
            </a>
          </div>
        ) : null}

        {active === 'race-record' ? (
          <div className="max-w-2xl">
            <h3 className="text-card-heading leading-heading text-heading">Race timeline and starts</h3>
            <p className="mt-5 text-body text-heading">{details.raceRecord.summary}</p>
            <p className="mt-4 text-body-small leading-body text-ink">{details.raceRecord.note}</p>
          </div>
        ) : null}

        {active === 'documents' ? (
          <div className="max-w-2xl">
            <h3 className="text-card-heading leading-heading text-heading">{details.documents.title}</h3>
            <p className="mt-5 text-body-small leading-body text-ink">{details.documents.body}</p>
            <div className="mt-7 rounded-md border border-border bg-surface p-6">
              <div className="flex items-start gap-4">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-pill border border-border text-muted-foreground">
                  <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
                    <rect x="5" y="10" width="14" height="10" rx="2" />
                    <path strokeLinecap="round" d="M8 10V7a4 4 0 018 0v3" />
                  </svg>
                </span>
                <div>
                  <p className="text-body-small text-heading">{details.documents.restrictedTitle}</p>
                  <p className="mt-2 text-body-small leading-body text-muted-foreground">
                    {details.documents.restrictedBody}
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
