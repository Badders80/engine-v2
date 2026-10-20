/**
 * The compiler's contract. PLAN.md step 7.
 *
 * One fixture, one matrix. The documents are deterministic: the same input
 * produces byte-identical Markdown and hashes. The payment-model rule is
 * enforced here independently of the save gate and the database trigger.
 */

import { describe, expect, it } from 'vitest'

import { compileLegalPack, render } from '../src/lib/legal/compile'
import { loadLegalCorpus, sha256 } from '../src/lib/legal/templates'
import type { LegalPackInput } from '../src/lib/legal/tokens'

type Overrides = {
  account?: Partial<LegalPackInput['account']>
  dsl?: Partial<LegalPackInput['dsl']>
  horse?: Partial<LegalPackInput['horse']>
  trainer?: Partial<LegalPackInput['trainer']>
  owner?: Partial<LegalPackInput['owner']>
  sale?: Partial<LegalPackInput['sale']>
}

/** A 21-month float pack, the campaign shape. */
function input(overrides: Overrides = {}): LegalPackInput {
  return {
    account: { fullName: 'Test Buyer', ...overrides.account },
    dsl: {
      termStart: '2026-01-01',
      endDate: '2027-09-30',
      paymentModel: 'subscription_float',
      closeStyle: 'fourteen_day',
      distributionSchedule: 'Monthly on the 1st.',
      investorSplit: 75,
      listedStake: 5,
      minStake: 1,
      step: 1,
      retailMonthlyPerPercent: 71,
      ...overrides.dsl,
    },
    horse: {
      slug: 'lady-ketchikan',
      legalName: 'Lady Ketchikan',
      foalingDate: '2021-09-14',
      sex: 'Filly',
      colour: 'Bay',
      breeder: 'Ketchikan Bloodstock Ltd',
      sireName: 'Wexford Lad',
      damName: 'Ketchikan Bay',
      microchip: '985113000123456',
      aboutHorse: 'About the horse.',
      racingOutlookAndPedigree: 'Outlook and pedigree.',
      raceExpectation: 'Race expectation.',
      ...overrides.horse,
    },
    trainer: { name: 'T Trainer', location: 'Cambridge', bio: 'One bio.', ...overrides.trainer },
    owner: { entity: 'Ketchikan Bloodstock Ltd', ...overrides.owner },
    sale: { stake: 1, executedDate: '2026-10-20', ...overrides.sale },
  }
}

const FLOAT_TERMS = { termStart: '2026-01-01', endDate: '2026-05-31' } // 5 months
const SIX_MONTHS = { termStart: '2026-01-01', endDate: '2026-06-30' } // 6 months
const THREE_MONTHS = { termStart: '2026-01-01', endDate: '2026-03-31' } // 3 months
const EIGHTEEN_MONTHS = { termStart: '2026-01-01', endDate: '2027-06-30' } // 18 months

describe('a 21-month float pack renders', () => {
  const pack = compileLegalPack(input())

  it('carries the four soft texts in the PDS', () => {
    expect(pack.pds.markdown).toContain('About the horse.')
    expect(pack.pds.markdown).toContain('Outlook and pedigree.')
    expect(pack.pds.markdown).toContain('Race expectation.')
    expect(pack.pds.markdown).toContain('One bio.')
  })

  it('carries none of them in the SA', () => {
    expect(pack.sa.markdown).not.toContain('About the horse.')
    expect(pack.sa.markdown).not.toContain('Outlook and pedigree.')
    expect(pack.sa.markdown).not.toContain('Race expectation.')
    expect(pack.sa.markdown).not.toContain('One bio.')
  })

  it('leaves no dangling token in either document', () => {
    expect(pack.pds.markdown).not.toContain('{{')
    expect(pack.sa.markdown).not.toContain('{{')
    expect(pack.pds.markdown).not.toContain('}}')
    expect(pack.sa.markdown).not.toContain('}}')
  })

  it('selects the float costs block', () => {
    expect(pack.pds.markdown).toContain(
      'A one-time upfront payment of $355.00 per 1% stake covers the deposit and initial payment.',
    )
    expect(pack.pds.markdown).toContain('$71.00 per month per 1% stake')
  })

  it('selects the fourteen-day close paragraph', () => {
    expect(pack.pds.markdown).toContain('Lessor 14-Day Break')
    expect(pack.pds.markdown).not.toContain('Early Sale / Buyout')
  })
})

describe('the payment-model rule is enforced in the compiler', () => {
  it('refuses a 5-month float', () => {
    expect(() =>
      compileLegalPack(input({ dsl: { ...FLOAT_TERMS, paymentModel: 'subscription_float' } })),
    ).toThrow(/must use upfront/)
  })

  it('refuses a 3-month float', () => {
    expect(() =>
      compileLegalPack(input({ dsl: { ...THREE_MONTHS, paymentModel: 'subscription_float' } })),
    ).toThrow(/must use upfront/)
  })

  it('renders a 5-month upfront pack', () => {
    const pack = compileLegalPack(
      input({ dsl: { ...FLOAT_TERMS, paymentModel: 'upfront' } }),
    )
    expect(pack.pds.markdown).toContain('**Lease fee:**')
  })

  it('renders either model at 6 months', () => {
    for (const paymentModel of ['subscription_float', 'upfront'] as const) {
      const pack = compileLegalPack(input({ dsl: { ...SIX_MONTHS, paymentModel } }))
      expect(pack.pds.markdown.length).toBeGreaterThan(1000)
    }
  })

  it('renders a 3-month upfront pack', () => {
    const pack = compileLegalPack(
      input({ dsl: { ...THREE_MONTHS, paymentModel: 'upfront' } }),
    )
    expect(pack.pds.markdown).toContain('**Lease fee:**')
  })

  it('prices an 18-month upfront pack at 18 times the rate', () => {
    const pack = compileLegalPack(
      input({ dsl: { ...EIGHTEEN_MONTHS, paymentModel: 'upfront' } }),
    )
    // 18 months x $71.00 per 1% = $1,278.00.
    expect(pack.pds.markdown).toContain('**Lease fee:** $1,278.00 per 1% stake')
  })
})

describe('the close-style branches do not leak into each other', () => {
  it('prints the three-times-remaining text and not the fourteen-day text', () => {
    const pack = compileLegalPack(input({ dsl: { closeStyle: 'three_x_remaining' } }))
    expect(pack.pds.markdown).toContain('Early Sale / Buyout')
    expect(pack.pds.markdown).not.toContain('Lessor 14-Day Break')
  })
})

describe('required values fail loudly', () => {
  it('throws naming a missing soft slot', () => {
    expect(() => compileLegalPack(input({ horse: { aboutHorse: null } }))).toThrow(
      /horse\.about_horse/,
    )
  })

  it('throws naming a missing trainer bio', () => {
    expect(() => compileLegalPack(input({ trainer: { bio: null } }))).toThrow(/trainer\.bio/)
  })

  it('throws on a banned term in soft prose, naming the term', () => {
    expect(() =>
      compileLegalPack(input({ horse: { aboutHorse: 'This is a digital token.' } })),
    ).toThrow(/digital token/)
  })

  it('throws on the word absorb in a soft slot', () => {
    expect(() =>
      compileLegalPack(input({ horse: { raceExpectation: 'Costs absorb the fee.' } })),
    ).toThrow(/absorb/)
  })

  it('throws on a dangling brace the renderer cannot substitute', () => {
    const corpus = loadLegalCorpus()
    const broken = { ...corpus, pds: `${corpus.pds}\n{{ broken` }
    expect(() => compileLegalPack(input(), broken)).toThrow(/dangling/)
  })

  it('throws on a null investor split', () => {
    expect(() => compileLegalPack(input({ dsl: { investorSplit: null } }))).toThrow(
      /dsl\.investor_split/,
    )
  })

  it('throws on a null distribution schedule', () => {
    expect(() => compileLegalPack(input({ dsl: { distributionSchedule: null } }))).toThrow(
      /dsl\.distribution_schedule/,
    )
  })

  it('throws on an unknown token, naming it', () => {
    expect(() => render('Hello {{nope}}', {})).toThrow(/unknown legal token: \{\{nope\}\}/)
  })

  it('renders Not recorded for a null breeder and microchip', () => {
    const pack = compileLegalPack(input({ horse: { breeder: null, microchip: null } }))
    expect(pack.pds.markdown.match(/Not recorded/g)?.length).toBe(2)
  })
})

describe('the output is deterministic', () => {
  const first = compileLegalPack(input())

  it('renders a whole percent without decimals', () => {
    expect(first.sa.markdown).toContain('- **Investor Return:** 75%')
  })

  it('produces identical Markdown and hashes on a second compile', () => {
    const second = compileLegalPack(input())
    expect(second.pds.markdown).toBe(first.pds.markdown)
    expect(second.sa.markdown).toBe(first.sa.markdown)
    expect(second.pds.hash).toBe(first.pds.hash)
    expect(second.sa.hash).toBe(first.sa.hash)
  })

  it('hashes the exact Markdown it returns', () => {
    expect(first.pds.hash).toBe(sha256(first.pds.markdown))
    expect(first.sa.hash).toBe(sha256(first.sa.markdown))
  })

  it('returns a hash for each of the six prose files', () => {
    expect(Object.keys(first.templateHashes)).toHaveLength(6)
  })
})
