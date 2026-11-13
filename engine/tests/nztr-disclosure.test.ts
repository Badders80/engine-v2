/**
 * B9 — the NZTR disclosure self-audit.
 *
 * `PLAN.md:317`: "The self-audit checks both rendered documents against the
 * disclosure checklist in `reference/nztr-pro-forma/README.md`."
 *
 * The reference set is not in this repo — it is a public build and those
 * documents are NZTR's, not ours. The checklist below is the twelve mandatory
 * elements from that README, restated in our own words, and the audit runs on
 * **rendered** Markdown, not on template source: a section a conditional block
 * drops at compile time is missing from the document a buyer receives, however
 * present it looks in the template.
 *
 * What we check is presence, not legal sufficiency. A lawyer still reads it.
 */

import { describe, expect, it } from 'vitest'

import { compileLegalPack } from '../src/lib/legal/compile'
import type { LegalPackInput } from '../src/lib/legal/tokens'

function input(overrides: Partial<LegalPackInput['dsl']> = {}): LegalPackInput {
  return {
    account: { fullName: 'Audit Buyer' },
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
      ...overrides,
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
    },
    trainer: { displayName: 'T Trainer', location: 'Cambridge', bio: 'One bio.' },
    owner: { displayName: 'Ketchikan Bloodstock Ltd' },
    sale: { stake: 1, executedDate: '2026-10-20' },
  }
}

/**
 * Both payment models render different cost blocks and a different section 4.
 * The checklist must hold for each: a disclosure clause that lives inside the
 * conditional half would pass on one model and ship broken on the other.
 */
const PACKS = {
  subscription_float: compileLegalPack(input({ paymentModel: 'subscription_float' })),
  upfront: compileLegalPack(input({ paymentModel: 'upfront' })),
} as const

const pack = PACKS.subscription_float
const sa = pack.sa.markdown

/**
 * The twelve mandatory elements, in the order the NZTR checklist states them.
 * Each entry must match in the rendered PDS.
 */
const CHECKLIST: ReadonlyArray<{ item: string; patterns: RegExp[] }> = [
  {
    item: '1. about the syndicate — the horse, the trainer, the share structure, and the plan after racing',
    patterns: [/## 1\. Title & Structure/, /## 2\. Asset Specifics/, /## 14\. Responsible Investment & Welfare/, /post-racing|rehoming/i],
  },
  {
    item: '2. upfront costs — the purchase price including GST, and any other initial cost',
    patterns: [/## 18\. Investment Details/, /Initial Float Payment/, /GST/i],
  },
  {
    item: '3. number of shares and the cost per share',
    patterns: [/Stake Percentage/, /per 1% stake/],
  },
  {
    item: '4. estimated ongoing costs, GST inclusive',
    patterns: [/## 3\. Commercial Model/, /## 4\. Deposit, Float & Billing/, /GST/i],
  },
  {
    item: '5. insurance — what is covered, for how long, to what value',
    patterns: [/## 8\. Insurance/],
  },
  {
    item: '6. valuation — the report, or the reason one is not required',
    patterns: [/## 10\. Valuation/],
  },
  {
    item: '7. veterinary report — examined and certified sound for racing',
    patterns: [/## 11\. Veterinary Report/, /sound for racing/i],
  },
  {
    item: '8. material interests and commissions',
    patterns: [/## 12\. Material Interests/, /5\.0%/, /3\.0%/],
  },
  {
    item: '9. standard industry risks',
    patterns: [/## 13\. Risk Disclosure/, /not guaranteed/i],
  },
  {
    item: '10. governing documents — the Syndicate Agreement the buyer is bound by',
    patterns: [/Syndicate Agreement/],
  },
  {
    item: '11. promoter declaration — Authorised Syndicator under the NZTR Code of Practice, and that NZTR does not endorse or guarantee the offer',
    patterns: [/## 20\. Promoter Declaration/, /Authorised Syndicator/i, /does not endorse|not guaranteed by NZTR/i],
  },
  {
    item: '12. applicant acknowledgement — 18 or over, not prohibited from owning a racehorse, the stake, the price, and their identity',
    patterns: [/## 19\. Investor Declaration/, /18 (years|or over)|eighteen/i, /not prohibited/i, /\| Signatory \| Capacity \| Date \|/],
  },
]

describe('B9 — the NZTR disclosure checklist, against the rendered PDS', () => {
  for (const [model, rendered] of Object.entries(PACKS)) {
    for (const entry of CHECKLIST) {
      it(`${entry.item} [${model}]`, () => {
        const missing = entry.patterns
          .filter((pattern) => !pattern.test(rendered.pds.markdown))
          .map(String)
        expect(missing, `missing from the rendered PDS: ${missing.join(', ')}`).toEqual([])
      })
    }

    it(`leaves no token, block or dangling brace in the rendered document [${model}]`, () => {
      expect(rendered.pds.markdown).not.toContain('{{')
      expect(rendered.pds.markdown).not.toContain('}}')
    })
  }
})

describe('B9 — the Syndicate Agreement the buyer executes', () => {
  it('binds the parties to the NZTR Rules of Racing', () => {
    expect(sa).toMatch(/NZTR Rules of Racing/)
  })

  it('bills a fixed monthly amount on the 1st, not invoiced costs', () => {
    expect(sa).toMatch(/billed on the 1st of each calendar month/i)
    expect(sa).not.toMatch(/invoiced costs/i)
  })

  it('carries no soft prose — the horse story belongs to the PDS alone', () => {
    expect(sa).not.toContain('About the horse.')
    expect(sa).not.toContain('Race expectation.')
    expect(sa).not.toContain('One bio.')
  })
})
