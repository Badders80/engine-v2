/**
 * The registration gate on the DSL status. PLAN.md step 4, OUTCOME.md § How a
 * horse gets in.
 *
 * An unregistered horse is typed by hand and saved at Coming Soon. It is
 * refused every transition past it. A registered horse keeps the full
 * lifecycle. The gate is scoped strictly to `registered`: the published flag is
 * not part of it, so a Coming Soon horse is reachable published or not.
 *
 * The database trigger (supabase/migrations/00008) only guards status
 * `available`, so `fully_allocated` and `completed` are the action layer's job.
 */

import { describe, expect, it } from 'vitest'

import { DSL_STATUSES, checkStatusTransition, type DslStatus } from '../src/lib/dsl'

const LIFECYCLE: DslStatus[] = ['coming_soon', 'available', 'fully_allocated', 'completed']

describe('the four statuses are the four the schema declares', () => {
  it('matches supabase/migrations/00001_enums.sql exactly', () => {
    expect([...DSL_STATUSES]).toEqual(LIFECYCLE)
  })
})

describe('unregistered horse cannot pass Coming Soon', () => {
  it('permits coming_soon as the initial status', () => {
    expect(checkStatusTransition({ registered: false, from: null, to: 'coming_soon' })).toEqual({
      ok: true,
    })
  })

  it('permits re-saving at coming_soon', () => {
    expect(checkStatusTransition({ registered: false, from: 'coming_soon', to: 'coming_soon' }).ok).toBe(
      true,
    )
  })

  it('refuses available', () => {
    const result = checkStatusTransition({ registered: false, from: 'coming_soon', to: 'available' })
    expect(result.ok).toBe(false)
  })

  it('refuses fully_allocated', () => {
    const result = checkStatusTransition({
      registered: false,
      from: 'coming_soon',
      to: 'fully_allocated',
    })
    expect(result.ok).toBe(false)
  })

  it('refuses completed', () => {
    const result = checkStatusTransition({ registered: false, from: 'coming_soon', to: 'completed' })
    expect(result.ok).toBe(false)
  })

  it('refuses a jump straight into the lifecycle with no prior status', () => {
    for (const to of ['available', 'fully_allocated', 'completed'] as DslStatus[]) {
      expect(checkStatusTransition({ registered: false, from: null, to }).ok).toBe(false)
    }
  })

  it('names the horse as unregistered in the refusal', () => {
    const result = checkStatusTransition({ registered: false, from: 'coming_soon', to: 'available' })
    if (result.ok) throw new Error('expected the unregistered horse to be refused')
    expect(result.reason).toMatch(/unregistered/i)
  })
})

describe('registered horse keeps the full lifecycle', () => {
  it('permits coming_soon as the initial status', () => {
    expect(checkStatusTransition({ registered: true, from: null, to: 'coming_soon' }).ok).toBe(true)
  })

  it('permits every step forward, in order', () => {
    for (let i = 0; i < LIFECYCLE.length; i += 1) {
      const from = i === 0 ? null : LIFECYCLE[i - 1]
      expect(checkStatusTransition({ registered: true, from, to: LIFECYCLE[i] }).ok).toBe(true)
    }
  })

  it('permits a re-save at the same status', () => {
    for (const status of LIFECYCLE) {
      expect(checkStatusTransition({ registered: true, from: status, to: status }).ok).toBe(true)
    }
  })
})

describe('the gate is scoped to registration only', () => {
  it('ignores a published flag, so Coming Soon is reachable published or not', () => {
    // The published flag is the DSL's own boolean, not a gate input. A widened
    // gate would refuse this, so the widening shows up here rather than in
    // production.
    const widened = { registered: false, from: 'coming_soon', to: 'coming_soon', published: true }
    const asGateInput = widened as unknown as Parameters<typeof checkStatusTransition>[0]
    expect(checkStatusTransition(asGateInput).ok).toBe(true)
  })
})
