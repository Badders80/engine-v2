/**
 * Term arithmetic and the payment-model rule. PLAN.md step 7, `PLAN.md:72`.
 *
 * The count is inclusive of both the start month and the end month. The rule
 * is the reason, not a convenience: at 5 months or less the five-month initial
 * payment already covers the term, so a float would over-collect.
 */

import { describe, expect, it } from 'vitest'

import { paymentModelAllowed, termMonthsBetween } from '../src/lib/term'

describe('inclusive full-calendar months', () => {
  it('counts 1 January to 31 May as five months', () => {
    expect(termMonthsBetween('2026-01-01', '2026-05-31')).toBe(5)
  })

  it('counts 1 January to 1 June as six months', () => {
    expect(termMonthsBetween('2026-01-01', '2026-06-01')).toBe(6)
  })

  it('counts by calendar months, not by days', () => {
    expect(termMonthsBetween('2026-01-15', '2026-06-30')).toBe(6)
  })

  it('counts an 18-month term', () => {
    expect(termMonthsBetween('2026-01-01', '2027-06-30')).toBe(18)
  })

  it('counts a term inside one calendar month as one month', () => {
    expect(termMonthsBetween('2026-03-01', '2026-03-31')).toBe(1)
  })

  it('counts across a year boundary', () => {
    expect(termMonthsBetween('2026-11-01', '2027-01-31')).toBe(3)
  })

  it('returns zero when the end precedes the start', () => {
    expect(termMonthsBetween('2026-06-01', '2026-05-31')).toBe(0)
  })

  it('returns null for a malformed or impossible date', () => {
    for (const [start, end] of [
      ['not-a-date', '2026-05-31'],
      ['2026-01-01', 'not-a-date'],
      ['2026-13-01', '2026-05-31'],
      ['2026-01-01', '2026-02-30'],
      ['2026-1-1', '2026-05-31'],
      ['', ''],
    ]) {
      expect(termMonthsBetween(start, end)).toBeNull()
    }
  })
})

describe('the payment-model rule', () => {
  it('always permits upfront, at every term', () => {
    for (const months of [1, 3, 5, 6, 18]) {
      expect(paymentModelAllowed('upfront', months)).toBe(true)
    }
  })

  it('refuses subscription_float at five months or less', () => {
    for (const months of [1, 3, 4, 5]) {
      expect(paymentModelAllowed('subscription_float', months)).toBe(false)
    }
  })

  it('permits subscription_float at six months or more', () => {
    for (const months of [6, 12, 18]) {
      expect(paymentModelAllowed('subscription_float', months)).toBe(true)
    }
  })
})
