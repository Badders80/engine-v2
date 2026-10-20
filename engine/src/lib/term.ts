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
 * This is the single source of the count: the save gate, the migration, the
 * compiler, and the preview all use it or mirror its formula.
 */
export function termMonthsBetween(startIso: string, endIso: string): number | null {
  const start = parseIsoDate(startIso)
  const end = parseIsoDate(endIso)
  if (start === null || end === null) return null

  return (end.year - start.year) * 12 + (end.month - start.month) + 1
}

/** True when the requested model is legal for the term. */
export function paymentModelAllowed(paymentModel: PaymentModel, termMonths: number): boolean {
  return paymentModel === 'upfront' || termMonths >= FLOAT_MIN_TERM_MONTHS
}
