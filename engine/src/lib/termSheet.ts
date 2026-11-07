/**
 * The one-page term sheet, from the DSL row alone.
 *
 * Founder's litmus rule, carried from the old engine (`term_sheet.ts`): render
 * ONLY what is in the data. A missing field renders as a blank marker, never a
 * default. The term sheet is the byproduct of the process, not the process.
 *
 * It is built from the DSL, not from the compiled pack: the pack holds the
 * buyer's name, stake and date, and none of those exist before Checkout. So the
 * page shows per-1% rates, and the buyer-specific figures appear on the sale.
 *
 * No timeline appears anywhere in this document. "14 business days" is a banned
 * phrase in V2, and the refund promise is deliberately silent on timing.
 */

import { termMonthsBetween } from './term'
import {
  EVOLUTION_MARGIN_PCT,
  PLATFORM_FEE_PCT,
  floatTotal,
  totalForStake,
  upfrontTotal,
} from './pricing'

import type { DslRow, HorseRow, OwnerRow, TrainerRow } from './dslStore'

/** The blank marker. Never a default value. */
export const BLANK = '[not filled in yet]'

export type TermSheetRow = { label: string; value: string }
export type TermSheetSection = { title: string; rows: TermSheetRow[] }

function text(value: string | null | undefined): string {
  return value === null || value === undefined || value.trim() === '' ? BLANK : value
}

function pct(value: number | null): string {
  return value === null ? BLANK : `${value}%`
}

function money(value: number | null): string {
  return value === null ? BLANK : `$${value.toFixed(2)}`
}

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

export function termDateLabel(iso: string | null): string {
  if (iso === null) return BLANK
  const date = new Date(`${iso}T00:00:00Z`)
  if (Number.isNaN(date.getTime())) return iso
  return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`
}

function termLine(dsl: DslRow): string {
  const months =
    dsl.termStart !== null && dsl.endDate !== null
      ? termMonthsBetween(dsl.termStart, dsl.endDate)
      : null

  if (months === null && (dsl.termStart === null || dsl.endDate === null)) return BLANK
  const start = termDateLabel(dsl.termStart)
  const end = termDateLabel(dsl.endDate)
  if (months === null) return `${start} → ${end}`
  return `${months} months (${start} → ${end})`
}

function paymentRows(dsl: DslRow): TermSheetRow[] {
  const retail = dsl.retailMonthlyPerPercent
  const months =
    dsl.termStart !== null && dsl.endDate !== null
      ? termMonthsBetween(dsl.termStart, dsl.endDate)
      : null

  const model =
    dsl.paymentModel === 'upfront'
      ? 'Upfront — the whole term paid at Checkout'
      : dsl.paymentModel === 'subscription_float'
        ? 'Subscription Float — 5 months up front, then monthly'
        : BLANK

  const initial =
    retail === null
      ? null
      : dsl.paymentModel === 'upfront' && months !== null
        ? upfrontTotal(months, retail, 1)
        : dsl.paymentModel === 'subscription_float'
          ? floatTotal(retail, 1)
          : null

  const monthly =
    retail === null
      ? null
      : dsl.paymentModel === 'upfront'
        ? 0
        : dsl.paymentModel === 'subscription_float'
          ? totalForStake(retail, 1)
          : null

  return [
    { label: 'Payment model', value: model },
    { label: 'Initial payment, per 1% stake', value: money(initial) },
    {
      label: 'Monthly thereafter, per 1% stake',
      value: monthly === null ? BLANK : money(monthly),
    },
    { label: 'GST', value: 'Included in every amount above, at 15%' },
  ]
}

function closeStyleLabel(dsl: DslRow): string {
  if (dsl.closeStyle === 'fourteen_day') return '14-day notice'
  if (dsl.closeStyle === 'three_x_remaining') return '3× remaining buyout'
  return BLANK
}

export type TermSheetInput = {
  dsl: DslRow
  horse: HorseRow
  trainer: TrainerRow | null
  owner: OwnerRow | null
}

export function buildTermSheet(input: TermSheetInput): TermSheetSection[] {
  const { dsl, horse, trainer, owner } = input

  return [
    {
      title: '1. Thoroughbred & Parties',
      rows: [
        { label: 'Horse', value: text(horse.legalName) },
        { label: 'Microchip / ID', value: text(horse.microchip) },
        { label: 'Life number', value: text(horse.lifeNumber) },
        { label: 'Owner', value: text(owner?.entity ?? null) },
        {
          label: 'Trainer',
          value:
            trainer === null
              ? BLANK
              : trainer.location === null || trainer.location === ''
                ? text(trainer.name)
                : `${trainer.name} (${trainer.location})`,
        },
      ],
    },
    {
      title: '2. Syndicate Stake & Commercials',
      rows: [
        { label: 'Syndicated stake in the horse', value: pct(dsl.listedStake) },
        { label: 'Remaining', value: pct(dsl.stakeRemaining) },
        {
          label: 'Minimum investment',
          value:
            dsl.minStake === null || dsl.step === null
              ? BLANK
              : `${dsl.minStake}%, then increments of ${dsl.step}%`,
        },
        {
          label: 'Wholesale monthly rate (M)',
          value: dsl.wholesaleMonthlyPerPercent === null ? BLANK : `${money(dsl.wholesaleMonthlyPerPercent)} / month per 1%`,
        },
        {
          label: 'Evolution margin',
          value: `${EVOLUTION_MARGIN_PCT.toFixed(1)}%  |  Platform fee ${PLATFORM_FEE_PCT.toFixed(1)}%`,
        },
        {
          label: 'Retail monthly rate',
          value:
            dsl.retailMonthlyPerPercent === null
              ? BLANK
              : `${money(dsl.retailMonthlyPerPercent)} / month per 1%`,
        },
        { label: 'Lease term', value: termLine(dsl) },
      ],
    },
    {
      title: '3. Payment Structure & Float',
      rows: paymentRows(dsl),
    },
    {
      title: '4. Prize Money & Exit Terms',
      rows: [
        {
          label: 'Investor return',
          value: dsl.investorSplit === null ? BLANK : `${dsl.investorSplit}% of gross official NZTR stakes`,
        },
        { label: 'Distribution schedule', value: text(dsl.distributionSchedule) },
        { label: 'Exit / close style', value: closeStyleLabel(dsl) },
      ],
    },
    {
      title: '5. Execution & Approvals',
      rows: [
        { label: 'Status', value: `${dsl.status}, ${dsl.published ? 'published' : 'not published'}` },
        {
          label: 'Execution',
          value:
            'Executed online by the buyer at Checkout. The PDS and SA are compiled per buyer and hashed onto the sale.',
        },
      ],
    },
  ]
}
