'use client'

import { useId, useRef, useState, type KeyboardEvent } from 'react'

import type { PedigreeSnapshot, RaceRecord } from '../lib/listings'
import { formatFullDate } from '../lib/marketplace'
import { PedigreeTree } from './PedigreeTree'

export type HorseDetailsData = {
  legalName: string
  sireName: string | null
  damName: string | null
  sex: string | null
  colour: string | null
  age: string | null
  foaled: string | null
  breeder: string | null
  pedigree: PedigreeSnapshot | null
  overviewParagraphs: readonly string[]
  raceRecord: RaceRecord | null
  raceExpectationParagraphs: readonly string[]
}

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'pedigree', label: 'Pedigree' },
  { id: 'trainer', label: 'Trainer' },
  { id: 'race-record', label: 'Race record' },
  { id: 'documents', label: 'Documents' },
] as const

type TabId = (typeof TABS)[number]['id']

function formatOrdinalFinish(result: number | string | null | undefined): string {
  if (result === null || result === undefined || result === '') return '—'
  const num = Number(result)
  if (!Number.isInteger(num) || num < 1) return String(result)
  const mod100 = num % 100
  if (mod100 >= 11 && mod100 <= 13) return `${String(num)}th`
  const mod10 = num % 10
  if (mod10 === 1) return `${String(num)}st`
  if (mod10 === 2) return `${String(num)}nd`
  if (mod10 === 3) return `${String(num)}rd`
  return `${String(num)}th`
}

function formatStakesNzd(stakes: number): string {
  return `NZ$${Math.round(stakes).toLocaleString('en-NZ')}`
}

export function HorseDetailsTabs({ details }: { details: HorseDetailsData }) {
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

  const summary = details.raceRecord?.summary ?? null
  const resultLines = details.raceRecord?.resultLines ?? []

  return (
    <div>
      <div
        role="tablist"
        aria-label="Horse details"
        className="flex flex-wrap items-center gap-x-6 gap-y-1 border-b border-border sm:gap-x-8"
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
              className={`label-eyebrow relative min-h-11 whitespace-nowrap border-b-2 py-3 transition-colors duration-hover focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-edge ${
                selected
                  ? 'border-gold text-gold'
                  : 'border-transparent text-muted-foreground hover:text-heading'
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
            <h3 className="text-card-heading font-light leading-heading text-heading">
              Racing outlook and pedigree
            </h3>
            {details.overviewParagraphs.length > 0 ? (
              <div className="mt-5 space-y-4 text-body-small font-light leading-body text-ink">
                {details.overviewParagraphs.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
            ) : (
              <p className="mt-5 text-body-small font-light leading-body text-muted-foreground">
                Campaign outlook notes are published once approved for this offering.
              </p>
            )}
          </div>
        ) : null}

        {active === 'pedigree' ? (
          <PedigreeTree
            legalName={details.legalName}
            sireName={details.sireName}
            damName={details.damName}
            sex={details.sex}
            colour={details.colour}
            age={details.age}
            foaled={details.foaled}
            pedigree={details.pedigree}
          />
        ) : null}

        {active === 'trainer' ? (
          <div className="max-w-2xl">
            <h3 className="text-card-heading font-light leading-heading text-heading">
              Stable &amp; trainer profile
            </h3>
            <div className="mt-5 rounded-md border border-border bg-surface p-6">
              <p className="label-spec text-muted-foreground">Licensed preparation</p>
              <p className="mt-3 text-body-small font-light leading-body text-ink">
                Verified trainer credentials, stable base, career record and official links connect
                automatically from the v2 party directory once public profile reads are enabled.
              </p>
              {details.breeder ? (
                <p className="label-spec mt-5 border-t border-border pt-4 text-muted-foreground">
                  Breeder: <span className="text-heading">{details.breeder}</span>
                </p>
              ) : null}
            </div>
          </div>
        ) : null}

        {active === 'race-record' ? (
          <div className="max-w-2xl space-y-6">
            <h3 className="text-card-heading font-light leading-heading text-heading">
              Race timeline and starts
            </h3>

            {summary ? (
              <dl className="grid grid-cols-2 gap-4 rounded-md border border-border bg-surface p-5 sm:grid-cols-5">
                <div>
                  <dt className="label-spec text-muted-foreground">Starts</dt>
                  <dd className="mt-1 font-mono text-card-heading font-light text-heading">
                    {String(summary.starts)}
                  </dd>
                </div>
                <div>
                  <dt className="label-spec text-muted-foreground">Wins</dt>
                  <dd className="mt-1 font-mono text-card-heading font-light text-heading">
                    {String(summary.wins)}
                  </dd>
                </div>
                <div>
                  <dt className="label-spec text-muted-foreground">Seconds</dt>
                  <dd className="mt-1 font-mono text-card-heading font-light text-heading">
                    {String(summary.seconds)}
                  </dd>
                </div>
                <div>
                  <dt className="label-spec text-muted-foreground">Thirds</dt>
                  <dd className="mt-1 font-mono text-card-heading font-light text-heading">
                    {String(summary.thirds)}
                  </dd>
                </div>
                <div>
                  <dt className="label-spec text-muted-foreground">Stakes</dt>
                  <dd className="mt-1 font-mono text-card-heading font-light text-heading">
                    {formatStakesNzd(summary.stakesNzd)}
                  </dd>
                </div>
              </dl>
            ) : (
              <p className="text-body-small font-light text-heading">0 starts · Unraced</p>
            )}

            {resultLines.length > 0 ? (
              <div className="overflow-x-auto rounded-md border border-border bg-surface">
                <table className="w-full text-left text-body-small font-light">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground">
                      <th className="label-spec px-4 py-3 font-normal">Date</th>
                      <th className="label-spec px-4 py-3 font-normal">Race</th>
                      <th className="label-spec px-4 py-3 font-normal">Venue</th>
                      <th className="label-spec px-4 py-3 font-normal">Dist.</th>
                      <th className="label-spec px-4 py-3 text-right font-normal">Finish</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {resultLines.map((line, index) => (
                      <tr key={`${line.date ?? 'row'}-${String(index)}`}>
                        <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-muted-foreground">
                          {formatFullDate(line.date) ?? '—'}
                        </td>
                        <td className="px-4 py-3 text-heading">{line.race ?? '—'}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-ink">
                          {line.venue ?? '—'}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-ink">
                          {line.distance ? `${String(line.distance)}m` : '—'}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right font-mono text-xs text-heading">
                          {formatOrdinalFinish(line.result)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}

            {details.raceExpectationParagraphs.length > 0 ? (
              <div className="space-y-4 text-body-small font-light leading-body text-ink">
                {details.raceExpectationParagraphs.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

        {active === 'documents' ? (
          <div className="max-w-2xl">
            <h3 className="text-card-heading font-light leading-heading text-heading">
              Legal disclosures and Investor Pack
            </h3>
            <p className="mt-5 text-body-small font-light leading-body text-ink">
              Ownership is governed by the Product Disclosure Statement and Syndicate Agreement. The
              combined Investor Pack becomes available inside the ownership flow and MyStable once
              verified.
            </p>
            <div className="mt-7 rounded-md border border-border bg-surface p-6">
              <div className="flex items-start gap-4">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-pill border border-border text-muted-foreground">
                  <svg
                    viewBox="0 0 24 24"
                    className="size-5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.5}
                    aria-hidden="true"
                  >
                    <rect x="5" y="10" width="14" height="10" rx="2" />
                    <path strokeLinecap="round" d="M8 10V7a4 4 0 018 0v3" />
                  </svg>
                </span>
                <div>
                  <p className="text-body-small text-heading">Verified investors only</p>
                  <p className="mt-2 text-body-small font-light leading-body text-muted-foreground">
                    Sign in to review the compiled Investor Pack, accept mandatory declarations and
                    access your frozen document record.
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
