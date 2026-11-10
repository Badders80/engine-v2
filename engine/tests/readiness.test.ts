/**
 * The readiness gate. DSL engine decision 2026-11-07.
 *
 * This list is the TypeScript half of `assert_dsl_available()` in
 * `supabase/migrations/00015_owner_moves_to_dsl.sql`. If the two drift, a DSL
 * can pass one and fail the other — which is exactly the defect this module
 * exists to remove, so the cases below are named after the SQL failure they
 * mirror.
 */

import { describe, expect, it } from 'vitest'

import {
  checkDslReadiness,
  readinessReason,
  type ReadinessInput,
  type ReadinessResult,
} from '../src/lib/readiness'

function ready(): ReadinessInput {
  return {
    dsl: {
      ownerId: 'owner-1',
      endDate: '2028-06-30',
      termStart: '2026-11-01',
      paymentModel: 'subscription_float',
      closeStyle: 'fourteen_day',
      wholesaleMonthlyPerPercent: 65,
      investorSplit: 75,
      listedStake: 10,
      minStake: 1,
      step: 1,
      stakeRemaining: 10,
      distributionSchedule: 'Prizemoney is distributed in proportion to stake.',
    },
    horse: {
      registered: true,
      imageCount: 3,
      aboutHorse: 'A paragraph about the horse.',
      racingOutlookAndPedigree: 'A paragraph about the racing outlook.',
      raceExpectation: 'A paragraph about what to expect.',
    },
    trainer: { bio: 'A paragraph about the trainer.' },
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

function missingOf(result: ReadinessResult): readonly string[] {
  return result.ok ? [] : result.missing
}

describe('a complete DSL is ready', () => {
  it('returns ok', () => {
    expect(checkDslReadiness(ready())).toEqual({ ok: true })
  })

  it('says nothing when ready', () => {
    expect(readinessReason(checkDslReadiness(ready()))).toBeNull()
  })
})

describe('a DSL before its deal is not ready', () => {
  it('names the owner when the term sheet has none', () => {
    const input = ready()
    input.dsl.ownerId = null
    expect(missingOf(checkDslReadiness(input))).toContain('the owner on the term sheet')
  })

  it('names the expiry', () => {
    const input = ready()
    input.dsl.endDate = null
    expect(missingOf(checkDslReadiness(input))).toContain('the expiry')
  })

  it('does not require a term start: the sale stamps it (chunk 3)', () => {
    const input = ready()
    input.dsl.termStart = null
    expect(checkDslReadiness(input)).toEqual({ ok: true })
  })

  it('names the payment model and close style', () => {
    const input = ready()
    input.dsl.paymentModel = null
    input.dsl.closeStyle = null
    expect(missingOf(checkDslReadiness(input))).toEqual(
      expect.arrayContaining(['the payment model', 'the close style']),
    )
  })

  it('names every commercial number', () => {
    const input = ready()
    Object.assign(input.dsl, {
      wholesaleMonthlyPerPercent: null,
      investorSplit: null,
      listedStake: null,
      minStake: null,
      step: null,
      stakeRemaining: null,
    })
    expect(missingOf(checkDslReadiness(input))).toEqual(
      expect.arrayContaining([
        'the wholesale cost per 1%',
        "the investor's split",
        'the listed stake',
        'the minimum stake',
        'the stake step',
        'the stake remaining',
      ]),
    )
  })
})

describe('the content the legal pack needs', () => {
  it('refuses an empty distribution schedule', () => {
    const input = ready()
    input.dsl.distributionSchedule = '   '
    expect(missingOf(checkDslReadiness(input))).toContain('the distribution schedule')
  })

  it('refuses an unregistered horse', () => {
    const input = ready()
    input.horse!.registered = false
    expect(missingOf(checkDslReadiness(input))).toContain('a registered horse')
  })

  it('does not block on images', () => {
    const input = ready()
    input.horse!.imageCount = 0
    expect(checkDslReadiness(input)).toEqual({ ok: true })
  })

  it('refuses each empty soft paragraph', () => {
    const input = ready()
    input.horse!.aboutHorse = null
    input.horse!.racingOutlookAndPedigree = ''
    input.horse!.raceExpectation = '   '
    expect(missingOf(checkDslReadiness(input))).toEqual(
      expect.arrayContaining([
        'the about-the-horse paragraph',
        'the racing outlook and pedigree paragraph',
        'the race expectation paragraph',
      ]),
    )
  })

  it('refuses a trainer with no bio', () => {
    const input = ready()
    input.trainer = { bio: null }
    expect(missingOf(checkDslReadiness(input))).toContain("the trainer's bio")
  })

  it('refuses a missing trainer row', () => {
    const input = ready()
    input.trainer = null
    expect(missingOf(checkDslReadiness(input))).toContain("the trainer's bio")
  })

  it('stops at the horse when the horse is gone', () => {
    const input = ready()
    input.horse = null
    expect(missingOf(checkDslReadiness(input))).toContain('the horse')
  })
})

describe('the four soft slots must be approved', () => {
  it('refuses when one slot is not approved', () => {
    const input = ready()
    input.narrative.signoff = { 'horse.about_horse': true }
    expect(missingOf(checkDslReadiness(input))).toContain(
      'the narrative sign-off (all four PDS soft slots approved)',
    )
  })

  it('refuses when the approval timestamp is missing', () => {
    const input = ready()
    input.narrative.approvedAt = null
    expect(missingOf(checkDslReadiness(input))).toContain(
      'the narrative sign-off (all four PDS soft slots approved)',
    )
  })

  it('refuses when the approval hash is missing', () => {
    const input = ready()
    input.narrative.approvedHash = ''
    expect(missingOf(checkDslReadiness(input))).toContain(
      'the narrative sign-off (all four PDS soft slots approved)',
    )
  })
})

describe('the refusal message names what is missing', () => {
  it('lists every missing field in one sentence', () => {
    const input = ready()
    input.dsl.ownerId = null
    input.trainer = null
    const reason = readinessReason(checkDslReadiness(input))
    expect(reason).toContain('the owner on the term sheet')
    expect(reason).toContain("the trainer's bio")
  })
})
