/**
 * Shared fixtures for the chunk-2 DSL contract.
 *
 * Records author horses and parties; the DSL only attaches their ids. These
 * helpers seed a store the way Records would, then hand back the ids so a test
 * can exercise `saveDsl` / `updateDsl` without re-writing a horse or a party
 * inside the action.
 */

import type { DslDraft, SaveDslInput } from '../../src/lib/dsl'
import type {
  DslStore,
  NewHorse,
  NewParty,
  PartyRow,
  HorseRow,
} from '../../src/lib/dslStore'

export function horseRow(overrides: Partial<NewHorse> = {}): NewHorse {
  return {
    slug: 'lady-ketchikan',
    legalName: 'Lady Ketchikan',
    barnName: null,
    foalingDate: '2021-09-14',
    sex: 'Filly',
    colour: 'Bay',
    breeder: 'Ketchikan Bloodstock Ltd',
    sireName: 'Wexford Lad',
    damName: 'Ketchikan Bay',
    microchip: '985113000123456',
    lifeNumber: 'NZ01234567',
    loveracingId: 'LR-88421',
    registered: true,
    aboutHorse: 'A paragraph about the horse.',
    racingOutlookAndPedigree: 'A paragraph about the racing outlook.',
    raceExpectation: 'A paragraph about what to expect.',
    imageCount: 3,
    raceRecord: {},
    ...overrides,
  }
}

export function trainerParty(overrides: Partial<NewParty> = {}): NewParty {
  return {
    displayName: 'T Trainer',
    company: 'Wexford Stables',
    contact: null,
    location: 'Cambridge',
    website: 'https://example.test',
    bio: 'One bio.',
    achievements: null,
    other: null,
    xUrl: null,
    facebookUrl: null,
    instagramUrl: null,
    links: [],
    ...overrides,
  }
}

export function ownerParty(overrides: Partial<NewParty> = {}): NewParty {
  return {
    displayName: 'Ketchikan Bloodstock Ltd',
    company: null,
    contact: 'C Contact',
    location: 'Auckland',
    website: null,
    bio: 'One profile paragraph.',
    achievements: null,
    other: null,
    xUrl: null,
    facebookUrl: null,
    instagramUrl: null,
    links: [],
    ...overrides,
  }
}

/** All four PDS soft slots approved, plus the record of when and of what. */
export const APPROVED_NARRATIVE = {
  narrativeSignoff: {
    'horse.about_horse': true,
    'horse.racing_outlook_and_pedigree': true,
    'horse.race_expectation': true,
    'trainer.bio': true,
  },
  narrativeApprovedAt: '2026-11-01T00:00:00.000Z',
  narrativeApprovedHash: 'a'.repeat(64),
} as const

export function draft(overrides: Partial<DslDraft> = {}): DslDraft {
  return {
    endDate: '2029-05-31',
    termStart: '2026-11-01',
    paymentModel: 'subscription_float',
    closeStyle: 'fourteen_day',
    status: 'coming_soon',
    published: false,
    wholesaleMonthlyPerPercent: 65,
    investorSplit: 75,
    listedStake: 5,
    minStake: 1,
    step: 1,
    distributionSchedule: 'Monthly on the 1st.',
    ...overrides,
  }
}

/** A draft that passes the full Available gate, narrative included. */
export function approvedDraft(overrides: Partial<DslDraft> = {}): DslDraft {
  return draft({
    status: 'available',
    published: true,
    narrativeSignoff: { ...APPROVED_NARRATIVE.narrativeSignoff },
    narrativeApprovedAt: APPROVED_NARRATIVE.narrativeApprovedAt,
    narrativeApprovedHash: APPROVED_NARRATIVE.narrativeApprovedHash,
    ...overrides,
  })
}

export type SeededStore = {
  horse: HorseRow
  trainer: PartyRow
  owner: PartyRow
}

/** Insert the three Records rows the DSL is allowed to point at. */
export async function seedStore(
  store: DslStore,
  overrides: { horse?: Partial<NewHorse>; trainer?: Partial<NewParty>; owner?: Partial<NewParty> } = {},
): Promise<SeededStore> {
  const horse = await store.insertHorse(horseRow(overrides.horse))
  const trainer = await store.insertParty(trainerParty(overrides.trainer), ['trainer'])
  const owner = await store.insertParty(ownerParty(overrides.owner), ['owner'])
  return { horse, trainer, owner }
}

/** Seed the store and build the matching `SaveDslInput`. */
export async function saveInput(
  store: DslStore,
  overrides: Partial<DslDraft> = {},
  seedOverrides: { horse?: Partial<NewHorse>; trainer?: Partial<NewParty>; owner?: Partial<NewParty> } = {},
): Promise<SaveDslInput> {
  const { horse, trainer, owner } = await seedStore(store, seedOverrides)
  return {
    horseId: horse.id,
    trainerId: trainer.id,
    ownerId: owner.id,
    dsl: draft(overrides),
  }
}
