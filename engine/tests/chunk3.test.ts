/**
 * Chunk 3 unit contracts: the two-way price, the expiry/duration arithmetic,
 * the resolver's override rule, the warning's one-time memory and the approval
 * hash. The SQL parity file covers agreement with Postgres; this file pins the
 * TypeScript behaviour the wizard and the pages rely on.
 */

import { describe, expect, it } from 'vitest'

import {
  carryDismissals,
  resolveNarrative,
  type NarrativeHorse,
} from '../src/lib/narrative'
import {
  narrativeHash,
  sourceHash,
  staleOverrideSlots,
} from '../src/lib/narrativeHash'
import { retailPerPercentFromWholesale, wholesaleFromRetail } from '../src/lib/pricing'
import { checkDslReadiness, type ReadinessInput } from '../src/lib/readiness'
import {
  durationFromCurrentMonth,
  lastDayOfMonthKey,
  monthKey,
} from '../src/lib/term'

const HORSE: NarrativeHorse = {
  aboutHorse: 'Records about.',
  racingOutlookAndPedigree: 'Records outlook.',
  raceExpectation: 'Records expectation.',
}

const PARTY = { bio: 'Trainer bio.' }

describe('the two-way price', () => {
  it('derives the whole-dollar wholesale that reproduces a retail rate', () => {
    expect(wholesaleFromRetail(71)).toBe(65)
    expect(retailPerPercentFromWholesale(65)).toBe(71)
  })

  it('refuses a retail rate no whole-dollar wholesale reproduces', () => {
    expect(wholesaleFromRetail(14)).toBeNull()
  })

  it('round-trips every reachable retail figure it returns', () => {
    for (let retail = 1; retail <= 400; retail += 1) {
      const wholesale = wholesaleFromRetail(retail)
      if (wholesale !== null) {
        expect(retailPerPercentFromWholesale(wholesale), `retail ${retail}`).toBe(retail)
      }
    }
  })
})

describe('expiry month and duration', () => {
  it('stores the last day of the chosen month', () => {
    expect(lastDayOfMonthKey('2027-02')).toBe('2027-02-28')
    expect(lastDayOfMonthKey('2028-02')).toBe('2028-02-29')
    expect(lastDayOfMonthKey('2027-09')).toBe('2027-09-30')
  })

  it('counts the duration from the current month to the expiry, inclusive', () => {
    expect(durationFromCurrentMonth('2027-09-30', new Date('2026-11-10'))).toBe(11)
    expect(durationFromCurrentMonth('2026-11-30', new Date('2026-11-10'))).toBe(1)
  })

  it('reads a month back out of the stored date', () => {
    expect(monthKey('2027-09-30')).toBe('2027-09')
  })
})

describe('the resolver', () => {
  it('reads through from Records when the deal has no override', () => {
    const resolved = resolveNarrative(HORSE, null, PARTY)
    expect(resolved['horse.about_horse']).toEqual({
      text: 'Records about.',
      overridden: false,
    })
  })

  it('lets a deal-local override win, per slot', () => {
    const resolved = resolveNarrative(
      HORSE,
      { narrativeAboutHorse: 'Deal about.' },
      PARTY,
    )
    expect(resolved['horse.about_horse']).toEqual({
      text: 'Deal about.',
      overridden: true,
    })
    expect(resolved['horse.racing_outlook_and_pedigree'].overridden).toBe(false)
  })

  it('never overrides the trainer bio', () => {
    const resolved = resolveNarrative(HORSE, { narrativeAboutHorse: 'Deal about.' }, PARTY)
    expect(resolved['trainer.bio']).toEqual({ text: 'Trainer bio.', overridden: false })
  })
})

describe('an override counts toward readiness', () => {
  function input(): ReadinessInput {
    return {
      dsl: {
        ownerId: 'owner-1',
        endDate: '2028-06-30',
        termStart: null,
        paymentModel: 'subscription_float',
        closeStyle: 'fourteen_day',
        wholesaleMonthlyPerPercent: 65,
        investorSplit: 75,
        listedStake: 10,
        minStake: 1,
        step: 1,
        stakeRemaining: 10,
        distributionSchedule: 'Monthly on the 1st.',
      },
      horse: {
        registered: true,
        imageCount: 3,
        aboutHorse: null,
        racingOutlookAndPedigree: 'Outlook.',
        raceExpectation: 'Expectation.',
      },
      trainer: { bio: 'Trainer bio.' },
      narrative: {
        signoff: {
          'horse.about_horse': true,
          'horse.racing_outlook_and_pedigree': true,
          'horse.race_expectation': true,
          'trainer.bio': true,
        },
        approvedAt: '2026-11-01T00:00:00.000Z',
        approvedHash: 'a'.repeat(64),
      },
    }
  }

  it('accepts a deal-local paragraph where Records is empty', () => {
    const draft = input()
    draft.dsl.narrativeAboutHorse = 'Deal about.'
    expect(checkDslReadiness(draft)).toEqual({ ok: true })
  })

  it('still refuses when no source fills the slot', () => {
    expect(checkDslReadiness(input())).toEqual({
      ok: false,
      missing: expect.arrayContaining(['the about-the-horse paragraph']),
    })
  })
})

describe('the override warning remembers one dismissal', () => {
  const dsl = {
    narrativeAboutHorse: 'Deal about.',
    narrativeOverrideMeta: {
      'horse.about_horse': { sourceHash: sourceHash('Old Records about.') },
    } as Record<string, { sourceHash?: string; dismissedHash?: string }>,
  }

  it('warns when Records moved since the override was written', () => {
    expect(
      staleOverrideSlots({ ...HORSE, aboutHorse: 'New Records about.' }, dsl),
    ).toEqual(['horse.about_horse'])
  })

  it('stays quiet once the new source hash is dismissed', () => {
    const dismissed = {
      ...dsl,
      narrativeOverrideMeta: {
        'horse.about_horse': {
          sourceHash: sourceHash('Old Records about.'),
          dismissedHash: sourceHash('New Records about.'),
        },
      },
    }
    expect(
      staleOverrideSlots({ ...HORSE, aboutHorse: 'New Records about.' }, dismissed),
    ).toEqual([])
  })
})

describe('a dismissal survives a save', () => {
  const current = {
    narrativeAboutHorse: 'Deal text.',
    narrativeOverrideMeta: {
      'horse.about_horse': { sourceHash: 'old', dismissedHash: 'dismissed' },
    },
  }

  it('keeps the dismissed hash when the override text is unchanged', () => {
    const next = { 'horse.about_horse': { sourceHash: 'new' } }
    expect(carryDismissals(next, current, { narrativeAboutHorse: 'Deal text.' })).toEqual({
      'horse.about_horse': { sourceHash: 'new', dismissedHash: 'dismissed' },
    })
  })

  it('drops the dismissal when the override text changes', () => {
    const next = { 'horse.about_horse': { sourceHash: 'new' } }
    expect(carryDismissals(next, current, { narrativeAboutHorse: 'Edited text.' })).toEqual({
      'horse.about_horse': { sourceHash: 'new' },
    })
  })
})

describe('the approval hash covers the resolved text', () => {
  it('does not move when Records changes under an override', () => {
    const override = { narrativeAboutHorse: 'Deal about.' }
    const before = narrativeHash(resolveNarrative(HORSE, override, PARTY))
    const after = narrativeHash(
      resolveNarrative({ ...HORSE, aboutHorse: 'A later Records edit.' }, override, PARTY),
    )
    expect(after).toBe(before)
  })

  it('moves when the resolved text moves', () => {
    const before = narrativeHash(resolveNarrative(HORSE, null, PARTY))
    const after = narrativeHash(
      resolveNarrative({ ...HORSE, aboutHorse: 'A different paragraph.' }, null, PARTY),
    )
    expect(after).not.toBe(before)
  })
})
