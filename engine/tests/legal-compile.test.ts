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
    contract: { id: 'ES-DSL-2026-900001' },
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
    trainer: { displayName: 'T Trainer', location: 'Cambridge', bio: 'One bio.', ...overrides.trainer },
    owner: { displayName: 'Ketchikan Bloodstock Ltd', ...overrides.owner },
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

  it('prints the contract identifier in both documents', () => {
    expect(pack.pds.markdown).toContain('**Contract ID:** ES-DSL-2026-900001')
    expect(pack.sa.markdown).toContain('**Contract ID:** ES-DSL-2026-900001')
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
    expect(pack.pds.markdown).toContain('9.1 14-Day Notice')
    expect(pack.pds.markdown).toContain(
      'Evolution Stables reserves the right to terminate the DSL',
    )
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
    expect(pack.pds.markdown).toContain('9.1 Early Sale / Buyout')
    expect(pack.pds.markdown).not.toContain('9.1 14-Day Notice')
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

describe('the SA states the termination clause', () => {
  it('prints the 14-day branch as a pass-through right', () => {
    const pack = compileLegalPack(input({ dsl: { closeStyle: 'fourteen_day' } }))
    expect(pack.sa.markdown).toContain('15.1 14-Day Notice')
    expect(pack.sa.markdown).toContain(
      'Evolution Stables reserves the right to terminate this Agreement',
    )
    expect(pack.sa.markdown).not.toContain('Early Sale / Buyout')
  })

  it('prints the 3× branch with the buyout', () => {
    const pack = compileLegalPack(input({ dsl: { closeStyle: 'three_x_remaining' } }))
    expect(pack.sa.markdown).toContain('15.1 Early Sale / Buyout')
    expect(pack.sa.markdown).toContain('three times the remaining lease value')
    expect(pack.sa.markdown).not.toContain('15.1 14-Day Notice')
  })

  it('prints both payment-model settlements in each branch', () => {
    for (const closeStyle of ['fourteen_day', 'three_x_remaining'] as const) {
      const pack = compileLegalPack(input({ dsl: { closeStyle } }))
      expect(pack.sa.markdown).toContain('**Upfront Leases:**')
      expect(pack.sa.markdown).toContain('**Monthly Leases:**')
    }
  })

  it('keeps the PDS and SA aligned on the selected style', () => {
    const fourteen = compileLegalPack(input({ dsl: { closeStyle: 'fourteen_day' } }))
    expect(fourteen.pds.markdown).toContain('9.1 14-Day Notice')
    expect(fourteen.sa.markdown).toContain('15.1 14-Day Notice')
    const buyout = compileLegalPack(input({ dsl: { closeStyle: 'three_x_remaining' } }))
    expect(buyout.pds.markdown).toContain('9.1 Early Sale / Buyout')
    expect(buyout.sa.markdown).toContain('15.1 Early Sale / Buyout')
  })
})

describe('exit, default and wind-up rights', () => {
  const pack = compileLegalPack(input())

  it('states the five-month voluntary exit runway', () => {
    for (const document of [pack.pds.markdown, pack.sa.markdown]) {
      expect(document).toContain('Voluntary Exit (Subscription Float only)')
      expect(document).toContain('at least five full calendar months remaining')
      expect(document).toContain('next scheduled payment remains due')
      expect(document).toContain('one-month advance plus three-month reserve')
    }
  })

  it('restores default notice and pays accrued winnings before forfeiture', () => {
    for (const document of [pack.pds.markdown, pack.sa.markdown]) {
      expect(document).toContain('written notice')
      expect(document).toContain('by the end of that month')
      expect(document).toContain('already earned but unpaid winnings')
      expect(document).toContain('forfeited to the Owner')
    }
  })

  it('states automatic wind-up and first refusal at expiry', () => {
    for (const document of [pack.pds.markdown, pack.sa.markdown]) {
      expect(document).toContain('winds up automatically')
      expect(document).toContain('right of first refusal')
      expect(document).toContain('new agreement and Investor opt-in')
    }
  })

  it('keeps the agreed plain-language structure', () => {
    expect(pack.pds.markdown).toContain('## 6. Individual Exit, Default & Forfeiture')
    expect(pack.pds.markdown).toContain('## 9. Early Termination, Refunds & Expiry')
    expect(pack.sa.markdown).toContain('## 8. Individual Exit, Default & Forfeiture')
    expect(pack.sa.markdown).toContain('## 15. Syndicate Early Termination & Refunds')
    expect(pack.pds.markdown).toContain('**5.1 Calculation:**')
    expect(pack.pds.markdown).not.toContain('- **5.1 Calculation:**')
    expect(pack.pds.markdown).toContain('**13.1 Performance:**')
    expect(pack.sa.markdown).toContain('**7.1** Make all day-to-day decisions')
    expect(pack.sa.markdown).toContain('**10.1 Entitlement:**')
    expect(pack.pds.markdown).toContain('**5.3 Schedule:** Monthly on the 1st.')
    expect(pack.sa.markdown).toContain('| Attribute | Detail |')
    expect(pack.sa.markdown).toContain('| Signatory | Capacity | Date |')
    expect(pack.pds.markdown).toContain('6. Are 18 years of age or older')

    for (const document of [pack.pds.markdown, pack.sa.markdown]) {
      expect(document).not.toMatch(/Head Lease|head lease|There is no buyout|strictly|Shareholder|Lessor|Prize Freeze/i)
      expect(document.match(/whole calendar months only/g)).toHaveLength(1)
    }
  })
})

describe('the output is deterministic', () => {
  const first = compileLegalPack(input())

  it('renders a whole percent without decimals', () => {
    expect(first.sa.markdown).toContain('| Investor Return | 75% |')
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

  it('returns a hash for each of the eight prose files', () => {
    expect(Object.keys(first.templateHashes)).toHaveLength(8)
  })
})
