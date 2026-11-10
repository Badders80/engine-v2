/**
 * Term arithmetic and the payment-model rule. PLAN.md step 7, `PLAN.md:72`.
 *
 * One helper, used by the save gate, the compiler, and the preview. The rule,
 * locked 2026-10-20:
 *
 * - `upfront` is available for any term.
 * - A term of 5 months or less must use `upfront`, because the five-month
 *   initial payment already covers the whole term.
 * - A term of 6 months or more may use either, defaulting to
 *   `subscription_float`.
 *
 * The month count is inclusive of both the start month and the end month, the
 * same formula the old term sheet used (`term_sheet.ts:55-61`). A term that
 * starts and ends inside one calendar month is one month. The boundary is the
 * float size, not a claim that a float is impossible.
 */

import type { PaymentModel } from './dslStore'

/** The shortest term on which the float model is lawful. */
export const FLOAT_MIN_TERM_MONTHS = 6

/** The longest term that must use the upfront model. */
export const UPFRONT_MAX_TERM_MONTHS = FLOAT_MIN_TERM_MONTHS - 1

type CivilDate = { year: number; month: number; day: number }

/**
 * A strict `YYYY-MM-DD` parse. `31 Feb` and `2026-13-01` are not dates, so they
 * come back null rather than rolling over into March or the next year.
 */
function parseIsoDate(iso: string): CivilDate | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (match === null) return null

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])

  const date = new Date(Date.UTC(year, month - 1, day))
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null
  }

  return { year, month, day }
}

/**
 * Inclusive full-calendar months between two ISO dates. null on bad input.
 *
 * A legal term runs from the 1st of a month to the last day of a month, and
 * ends after it starts. Ruling of 2026-10-20: the templates say the term is
 * "counted in full calendar months", so a mid-month date is not a term. The
 * old month-input model assumed the same boundaries.
 *
 * This is the single source of the count: the save gate, the migration, the
 * compiler, and the preview all use it or mirror its formula.
 */
export function termMonthsBetween(startIso: string, endIso: string): number | null {
  const start = parseIsoDate(startIso)
  const end = parseIsoDate(endIso)
  if (start === null || end === null) return null

  if (start.day !== 1) return null
  if (end.day !== lastDayOfMonth(end.year, end.month)) return null

  const months = (end.year - start.year) * 12 + (end.month - start.month) + 1
  return months >= 1 ? months : null
}

/** True when the date is the first of its month. */
export function isMonthStart(iso: string): boolean {
  const date = parseIsoDate(iso)
  return date !== null && date.day === 1
}

/** True when the date is the last day of its month. */
export function isMonthEnd(iso: string): boolean {
  const date = parseIsoDate(iso)
  return date !== null && date.day === lastDayOfMonth(date.year, date.month)
}

function lastDayOfMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

/** True when the requested model is legal for the term. */
export function paymentModelAllowed(paymentModel: PaymentModel, termMonths: number): boolean {
  return paymentModel === 'upfront' || termMonths >= FLOAT_MIN_TERM_MONTHS
}

/** `2027-09` for the `type="month"` input. */
export function monthKey(iso: string): string | null {
  const date = parseIsoDate(iso)
  if (date === null) return null
  return `${String(date.year).padStart(4, '0')}-${String(date.month).padStart(2, '0')}`
}

/** The month key of a civil date, defaulting to today in UTC. */
export function currentMonthKey(now: Date = new Date()): string {
  return `${String(now.getUTCFullYear()).padStart(4, '0')}-${String(
    now.getUTCMonth() + 1,
  ).padStart(2, '0')}`
}

/** The first day of a `YYYY-MM` month, as `YYYY-MM-DD`; null on bad input. */
export function firstDayOfMonthKey(key: string): string | null {
  const match = /^(\d{4})-(\d{2})$/.exec(key)
  if (match === null) return null
  const year = Number(match[1])
  const month = Number(match[2])
  if (year < 1900 || year > 2200 || month < 1 || month > 12) return null
  return `${match[1]}-${match[2]}-01`
}

/**
 * The last day of a `YYYY-MM` month, as `YYYY-MM-DD`; null on bad input.
 * Creation asks only for the expiry month and stores this date.
 */
export function lastDayOfMonthKey(key: string): string | null {
  const match = /^(\d{4})-(\d{2})$/.exec(key)
  if (match === null) return null
  const year = Number(match[1])
  const month = Number(match[2])
  if (year < 1900 || year > 2200 || month < 1 || month > 12) return null
  const day = lastDayOfMonth(year, month)
  return `${match[1]}-${match[2]}-${String(day).padStart(2, '0')}`
}

/**
 * Inclusive full-calendar months from the current month to an expiry date.
 *
 * Chunk 3 stores no start: the duration shown is "current month → expiry",
 * recomputed on every view and never written down. The sale stamps the
 * buyer's start (chunk 4) and prices the remaining months.
 */
export function durationFromCurrentMonth(
  endIso: string | null,
  now: Date = new Date(),
): number | null {
  if (endIso === null) return null
  const end = parseIsoDate(endIso)
  if (end === null) return null
  if (end.day !== lastDayOfMonth(end.year, end.month)) return null

  const nowKey = currentMonthKey(now)
  const nowYear = Number(nowKey.slice(0, 4))
  const nowMonth = Number(nowKey.slice(5, 7))

  const months = (end.year - nowYear) * 12 + (end.month - nowMonth) + 1
  return months >= 1 ? months : null
}
