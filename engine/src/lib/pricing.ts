/**
 * Engine V2 pricing rules. PLAN.md step 3.
 *
 * Pure functions only: no network, no Supabase client, no Stripe, no side
 * effects. Every shared number lives here, not on a DSL row. A DSL row holds one
 * owner's terms and never restates these.
 *
 * Sole user-editable input is `wholesaleMonthlyPerPercent`, the wholesale cost
 * per 1% of ownership per month. Everything else is derived from it.
 */

/** Evolution Stables margin, as a percent of wholesale. */
export const EVOLUTION_MARGIN_PCT = 5

/** Platform fee, as a percent of wholesale. */
export const PLATFORM_FEE_PCT = 3

/** Checkout float: 3 months deposit reserve plus 2 months prepaid, 5 total. */
export const FLOAT_DEPOSIT_MONTHS = 3
export const FLOAT_PREPAID_MONTHS = 2
export const FLOAT_TOTAL_MONTHS = FLOAT_DEPOSIT_MONTHS + FLOAT_PREPAID_MONTHS

/** Months an investor must be paid up before a race to share in it. */
export const QUALIFICATION_PAID_UP_MONTHS = 2

/** The two close styles a DSL may use. */
export const CLOSE_STYLES = ['fourteen_day', 'three_x_remaining'] as const
export type CloseStyle = (typeof CLOSE_STYLES)[number]

/** Investor split range, inclusive, as a percent of stakes won. */
export const INVESTOR_RETURN_PCT_MIN = 50
export const INVESTOR_RETURN_PCT_MAX = 85

/**
 * The refund sentence. OUTCOME.md section Refund, verbatim. The buy screen, the
 * PDS, and the SA print this sentence and no day count.
 */
export const REFUND_SENTENCE =
  'If the horse is retired or the lease ends early, the leaseholder receives a pro-rata refund of the unused lease fee for the full months remaining.'

const MARGIN_MULTIPLIER = 1 + EVOLUTION_MARGIN_PCT / 100
const FEE_MULTIPLIER = 1 + PLATFORM_FEE_PCT / 100

/**
 * Listed price per 1%, in whole dollars.
 *
 * Ceiling keeps every derived share a whole-dollar amount. This must stay equal
 * to the `retail_monthly_per_percent` generated column on `dsls`, which is
 * `ceil(wholesale_monthly_per_percent * 1.05 * 1.03)` over exact numeric.
 */
export function retailPerPercentFromWholesale(wholesaleMonthlyPerPercent: number): number {
  return Math.ceil(wholesaleMonthlyPerPercent * MARGIN_MULTIPLIER * FEE_MULTIPLIER)
}

/** Monthly amount for a stake: the per-1% rate times the stake percent. */
export function totalForStake(retailPerPercent: number, stake: number): number {
  return retailPerPercent * stake
}

/**
 * Initial payment collected at checkout on the float model: strictly 5 months
 * (3 deposit reserve + 2 prepaid) times the stake amount.
 */
export function floatTotal(retailPerPercent: number, stake: number): number {
  return FLOAT_TOTAL_MONTHS * totalForStake(retailPerPercent, stake)
}

/**
 * Initial payment on the upfront model, for a lease term of 5 months or less:
 * the whole lease term collected at checkout, with zero charges after.
 */
export function upfrontTotal(termMonths: number, retailPerPercent: number, stake: number): number {
  return termMonths * totalForStake(retailPerPercent, stake)
}

/** True when the split sits in the 50 to 85 range, inclusive. */
export function isInvestorReturnPctInRange(pct: number): boolean {
  return pct >= INVESTOR_RETURN_PCT_MIN && pct <= INVESTOR_RETURN_PCT_MAX
}

/**
 * The DSL's own investor split, or null when it is unassigned.
 *
 * An unassigned split is null and stays null. It is never defaulted to 75: that
 * is the value an empty form shows, and it is not a horse's split.
 */
export function investorReturnPctFrom(split?: number | null): number | null {
  if (split === null || split === undefined) return null
  return split
}

/**
 * Throws unless the stake is a whole multiple of the DSL's step size.
 *
 * `step` is required and has no default: a guessed step silently mis-prices a
 * stake. The `undefined` guard is here for untyped callers, since TypeScript
 * already refuses an omitted argument.
 *
 * The comparison runs in integer basis points, not raw floats. IEEE-754 makes
 * `0.3 % 0.1` come out as `0.09999999999999998`, so a raw modulo rejects stakes
 * the database accepts; Postgres `numeric(5,2)` computes `mod(0.30, 0.10) = 0`.
 * Rounding to hundredths is exact for every stake and step the schema stores.
 */
export function validateStake(stake: number, step: number): void {
  if (typeof step !== 'number' || !Number.isFinite(step) || step <= 0) {
    throw new Error(`step must be a positive number (received ${String(step)})`)
  }
  if (Math.round(stake * 100) % Math.round(step * 100) !== 0) {
    throw new Error(`stake ${stake} is not a multiple of step ${step}`)
  }
}

/**
 * The orphan remainder rule: the smallest amount that may still be bought.
 *
 * When the unallocated remainder of a DSL is smaller than the stated minimum,
 * the remainder itself becomes buyable, so the last slice does not strand. This
 * is the whole rule: it is a minimum, not a floor, a default, or a discount.
 */
export function effectiveMinStake(minStake: number, stakeRemaining: number): number {
  return Math.min(minStake, stakeRemaining)
}
