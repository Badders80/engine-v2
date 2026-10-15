import { describe, expect, it } from 'vitest'

import {
  CLOSE_STYLES,
  FLOAT_DEPOSIT_MONTHS,
  FLOAT_PREPAID_MONTHS,
  FLOAT_TOTAL_MONTHS,
  QUALIFICATION_PAID_UP_MONTHS,
  REFUND_SENTENCE,
  effectiveMinStake,
  floatTotal,
  investorReturnPctFrom,
  isInvestorReturnPctInRange,
  retailPerPercentFromWholesale,
  totalForStake,
  upfrontTotal,
  validateStake,
} from '../src/lib/pricing'

// PLAN.md step 3. These are drift contracts: the numbers are pinned here so a
// changed formula fails CI rather than silently re-pricing the marketplace.

describe('retailPerPercentFromWholesale', () => {
  it('ceils wholesale cost per 1% by the 5% margin and 3% fee', () => {
    expect(retailPerPercentFromWholesale(65)).toBe(71)
    expect(retailPerPercentFromWholesale(70)).toBe(76)
  })

  it('always returns a whole dollar amount', () => {
    for (const wholesale of [1, 7, 33, 65, 70, 99, 143, 250]) {
      expect(Number.isInteger(retailPerPercentFromWholesale(wholesale))).toBe(true)
    }
  })
})

describe('totalForStake', () => {
  it('is the per-1% rate times the stake', () => {
    expect(totalForStake(71, 5)).toBe(355)
    expect(totalForStake(76, 5)).toBe(380)
  })
})

describe('floatTotal', () => {
  it('is strictly 5 months: 3 deposit reserve plus 2 prepaid', () => {
    expect(FLOAT_DEPOSIT_MONTHS).toBe(3)
    expect(FLOAT_PREPAID_MONTHS).toBe(2)
    expect(FLOAT_TOTAL_MONTHS).toBe(5)
  })

  it('is 5 months times the per-1% rate for a 1% stake', () => {
    expect(floatTotal(71, 1)).toBe(355)
    expect(floatTotal(76, 1)).toBe(380)
  })

  it('is 5 months times the stake amount', () => {
    expect(floatTotal(71, 5)).toBe(1775)
    expect(floatTotal(76, 5)).toBe(1900)
  })
})

describe('upfrontTotal', () => {
  it('collects the whole lease term with no monthly charges after', () => {
    expect(upfrontTotal(3, 71, 5)).toBe(1065)
  })

  it('matches the float at the 5 month boundary', () => {
    expect(upfrontTotal(5, 71, 5)).toBe(floatTotal(71, 5))
  })
})

describe('isInvestorReturnPctInRange', () => {
  it('accepts the 50 to 85 range inclusive', () => {
    expect(isInvestorReturnPctInRange(50)).toBe(true)
    expect(isInvestorReturnPctInRange(85)).toBe(true)
    expect(isInvestorReturnPctInRange(76)).toBe(true)
  })

  it('rejects below 50 and above 85', () => {
    expect(isInvestorReturnPctInRange(49)).toBe(false)
    expect(isInvestorReturnPctInRange(86)).toBe(false)
  })
})

describe('investorReturnPctFrom', () => {
  it('returns the assigned split unchanged', () => {
    expect(investorReturnPctFrom(76)).toBe(76)
  })

  it('returns null when unassigned, never a default 75', () => {
    expect(investorReturnPctFrom(null)).toBeNull()
    expect(investorReturnPctFrom(undefined)).toBeNull()
    expect(investorReturnPctFrom()).toBeNull()
    expect(investorReturnPctFrom(null)).not.toBe(75)
    expect(investorReturnPctFrom(null)).not.toBe('75')
    expect(investorReturnPctFrom(null)).not.toBe('75%')
  })
})

describe('validateStake', () => {
  it('accepts a stake that is a whole multiple of the step', () => {
    expect(() => validateStake(5, 5)).not.toThrow()
    expect(() => validateStake(6, 2)).not.toThrow()
    expect(() => validateStake(2.5, 0.5)).not.toThrow()
  })

  it('throws when the stake is not a multiple of the step', () => {
    expect(() => validateStake(5, 2)).toThrow()
  })

  it('throws when the step is omitted', () => {
    expect(() => validateStake(5, undefined as unknown as number)).toThrow()
  })

  it('throws when the step is zero', () => {
    expect(() => validateStake(5, 0)).toThrow()
  })

  it('accepts fractional stakes that are whole multiples of a fractional step', () => {
    // IEEE-754 trap: 0.3 % 0.1 is 0.09999999999999998, so a raw float modulo
    // rejects stakes the database accepts. numeric(5,2): mod(0.30, 0.10) = 0.
    expect(() => validateStake(0.3, 0.1)).not.toThrow()
    expect(() => validateStake(0.6, 0.1)).not.toThrow()
    expect(() => validateStake(0.7, 0.1)).not.toThrow()
    expect(() => validateStake(1.2, 0.1)).not.toThrow()
  })

  it('still throws on a fractional stake that is a real non-multiple', () => {
    expect(() => validateStake(0.35, 0.1)).toThrow()
    expect(() => validateStake(0.25, 0.1)).toThrow()
  })
})

describe('effectiveMinStake', () => {
  it('drops to the remaining stake when the remainder is smaller', () => {
    expect(effectiveMinStake(5, 2)).toBe(2)
    expect(effectiveMinStake(0.5, 0.2)).toBe(0.2)
  })

  it('keeps the declared minimum when the remainder is larger', () => {
    expect(effectiveMinStake(5, 12)).toBe(5)
  })

  it('is the orphan remainder rule: min of the two, and nothing else', () => {
    expect(effectiveMinStake(5, 5)).toBe(5)
    expect(effectiveMinStake(1, 0)).toBe(0)
  })
})

describe('declared constants', () => {
  it('locks the two close styles', () => {
    expect(CLOSE_STYLES).toEqual(['fourteen_day', 'three_x_remaining'])
  })

  it('locks the two paid-up months before a race', () => {
    expect(QUALIFICATION_PAID_UP_MONTHS).toBe(2)
  })
})

describe('refund text contract', () => {
  it('is the exact sentence from OUTCOME.md', () => {
    expect(REFUND_SENTENCE).toBe(
      'If the horse is retired or the lease ends early, the leaseholder receives a pro-rata refund of the unused lease fee for the full months remaining.'
    )
  })

  it('never prints a day count', () => {
    expect(REFUND_SENTENCE).not.toMatch(/\d+\s+days?/i)
  })
})
