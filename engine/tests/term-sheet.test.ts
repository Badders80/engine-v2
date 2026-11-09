/**
 * The one-page term sheet. Founder ruling 2026-11-07.
 *
 * The old engine's litmus rule carries over: render only what is in the data,
 * a blank marker otherwise. These tests pin that, plus the two things V2 must
 * not lose — GST is inclusive and never added, and no timeline is promised.
 */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

import type { DslRow, HorseRow, PartyRow } from '../src/lib/dslStore'
import { BLANK, buildTermSheet, termDateLabel } from '../src/lib/termSheet'

const DSL: DslRow = {
  id: 'dsl-1',
  horseId: 'horse-1',
  trainerId: 'trainer-1',
  ownerId: 'owner-1',
  endDate: '2027-09-30',
  termStart: '2026-01-01',
  paymentModel: 'subscription_float',
  closeStyle: 'fourteen_day',
  status: 'coming_soon',
  published: false,
  wholesaleMonthlyPerPercent: 65,
  retailMonthlyPerPercent: 71,
  investorSplit: 75,
  listedStake: 10,
  minStake: 2.5,
  step: 2.5,
  stakeRemaining: 10,
  distributionSchedule: 'Monthly on the 1st.',
  narrativeSignoff: null,
  narrativeApprovedAt: null,
  narrativeApprovedHash: null,
}

const HORSE = {
  id: 'horse-1',
  slug: 'lady-ketchikan',
  legalName: 'Lady Ketchikan',
  foalingDate: '2021-09-14',
  sex: 'Filly',
  colour: 'Bay',
  breeder: 'Ketchikan Bloodstock Ltd',
  sireName: 'Wexford Lad',
  damName: 'Ketchikan Bay',
  microchip: '985113000123456',
  lifeNumber: null,
  loveracingId: null,
  registered: true,
  aboutHorse: 'About.',
  racingOutlookAndPedigree: 'Outlook.',
  raceExpectation: 'Expectation.',
  imageCount: 3,
  raceRecord: {},
} as HorseRow

const TRAINER = {
  id: 'trainer-1',
  displayName: 'T Trainer',
  company: 'Stable',
  contact: null,
  location: 'Cambridge',
  website: null,
  bio: 'Bio.',
  achievements: null,
  other: null,
  xUrl: null,
  facebookUrl: null,
  instagramUrl: null,
  links: [],
  roles: ['trainer'],
} as PartyRow

const OWNER = {
  id: 'owner-1',
  displayName: 'Ketchikan Bloodstock Ltd',
  company: null,
  contact: 'Contact',
  location: null,
  website: null,
  bio: null,
  achievements: null,
  other: null,
  xUrl: null,
  facebookUrl: null,
  instagramUrl: null,
  links: [],
  roles: ['owner'],
} as PartyRow

function section(sheets: ReturnType<typeof buildTermSheet>, title: string) {
  const found = sheets.find((entry) => entry.title.startsWith(title))
  if (found === undefined) throw new Error(`no section ${title}`)
  return found
}

function row(sheets: ReturnType<typeof buildTermSheet>, title: string, label: string) {
  const found = section(sheets, title).rows.find((entry) => entry.label === label)
  if (found === undefined) throw new Error(`no row ${label}`)
  return found.value
}

describe('the term sheet has the five sections, in order', () => {
  const sheets = buildTermSheet({ dsl: DSL, horse: HORSE, trainer: TRAINER, owner: OWNER })

  it('declares exactly the old one-pager shape', () => {
    expect(sheets.map((entry) => entry.title)).toEqual([
      '1. Thoroughbred & Parties',
      '2. Syndicate Stake & Commercials',
      '3. Payment Structure & Float',
      '4. Prize Money & Exit Terms',
      '5. Execution & Approvals',
    ])
  })

  it('carries the parties', () => {
    expect(row(sheets, '1.', 'Horse')).toBe('Lady Ketchikan')
    expect(row(sheets, '1.', 'Owner')).toBe('Ketchikan Bloodstock Ltd')
    expect(row(sheets, '1.', 'Trainer')).toBe('T Trainer (Cambridge)')
  })

  it('carries the commercials and the derived retail rate', () => {
    expect(row(sheets, '2.', 'Syndicated stake in the horse')).toBe('10%')
    expect(row(sheets, '2.', 'Remaining')).toBe('10%')
    expect(row(sheets, '2.', 'Retail monthly rate')).toBe('$71.00 / month per 1%')
    expect(row(sheets, '2.', 'Lease term')).toBe('21 months (1 January 2026 → 30 September 2027)')
  })

  it('quotes the float in per-1% terms and never the buyer figures', () => {
    expect(row(sheets, '3.', 'Initial payment, per 1% stake')).toBe('$355.00')
    expect(row(sheets, '3.', 'Monthly thereafter, per 1% stake')).toBe('$71.00')
  })

  it('says GST is included, and promises no timeline', () => {
    expect(row(sheets, '3.', 'GST')).toContain('Included')
    const all = JSON.stringify(sheets)
    expect(all).not.toMatch(/business day/i)
    expect(all).not.toMatch(/within \d+ days/i)
  })
})

describe('the blank marker, never a default', () => {
  it('blanks an absent owner, trainer and distribution schedule', () => {
    const sheets = buildTermSheet({
      dsl: { ...DSL, ownerId: null, distributionSchedule: null, investorSplit: null },
      horse: { ...HORSE, microchip: null },
      trainer: null,
      owner: null,
    })
    expect(row(sheets, '1.', 'Owner')).toBe(BLANK)
    expect(row(sheets, '1.', 'Trainer')).toBe(BLANK)
    expect(row(sheets, '1.', 'Microchip / ID')).toBe(BLANK)
    expect(row(sheets, '4.', 'Distribution schedule')).toBe(BLANK)
    expect(row(sheets, '4.', 'Investor return')).toBe(BLANK)
  })

  it('blanks a payment model that is not set rather than assuming one', () => {
    const sheets = buildTermSheet({
      dsl: { ...DSL, paymentModel: null, closeStyle: null },
      horse: HORSE,
      trainer: TRAINER,
      owner: OWNER,
    })
    expect(row(sheets, '3.', 'Payment model')).toBe(BLANK)
    expect(row(sheets, '3.', 'Initial payment, per 1% stake')).toBe(BLANK)
    expect(row(sheets, '4.', 'Exit / close style')).toBe(BLANK)
  })
})

describe('dates', () => {
  it('formats a legal date and leaves a blank alone', () => {
    expect(termDateLabel('2026-11-01')).toBe('1 November 2026')
    expect(termDateLabel(null)).toBe(BLANK)
  })
})

describe('Publish is the only way a listing goes live', () => {
  const source = readFileSync(
    fileURLToPath(new URL('../src/app/dsl/actions.ts', import.meta.url)),
    'utf8',
  )

  it('recomputes readiness rather than trusting a stale tick', () => {
    expect(source).toMatch(/export async function publishDslAction/)
    expect(source).toMatch(/checkDslReadiness\(/)
    expect(source).toMatch(/published: true, status: 'available'/)
  })

  it('creates a draft, never a live listing', () => {
    expect(source).toMatch(/toInput\(form, \{ status: 'coming_soon', published: false \}\)/)
  })
})
