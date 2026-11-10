/**
 * The TS half of `just check:db`. Chunk 3 (U14).
 *
 * Both this test and `scripts/check-db-narrative.sql` read the same fixture
 * file and compare against the same hand-written expected JSON. Neither
 * implementation is the oracle: if either drifts, its half fails.
 *
 * This test runs in `pnpm verify` too. It needs no database, so CI stays plain.
 */

import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { resolveNarrative } from '../src/lib/narrative'

type FixtureCase = {
  name: string
  horse_id: string
  dsl_id: string | null
  party_id: string | null
  expected: Record<string, { text: string | null; overridden: boolean }>
}

type Fixtures = {
  horses: {
    id: string
    about_horse: string | null
    racing_outlook_and_pedigree: string | null
    race_expectation: string | null
  }[]
  parties: { id: string; bio: string | null }[]
  dsls: {
    id: string
    narrative_about_horse: string | null
    narrative_racing_outlook: string | null
    narrative_race_expectation: string | null
  }[]
  cases: FixtureCase[]
}

const fixtures: Fixtures = JSON.parse(
  readFileSync(
    new URL('./fixtures/narrative-cases.json', import.meta.url),
    'utf8',
  ),
) as Fixtures

const horseById = new Map(fixtures.horses.map((horse) => [horse.id, horse]))
const partyById = new Map(fixtures.parties.map((party) => [party.id, party]))
const dslById = new Map(fixtures.dsls.map((dsl) => [dsl.id, dsl]))

function horseOf(id: string) {
  const horse = horseById.get(id)
  if (horse === undefined) throw new Error(`fixture horse ${id} is missing`)
  return {
    aboutHorse: horse.about_horse,
    racingOutlookAndPedigree: horse.racing_outlook_and_pedigree,
    raceExpectation: horse.race_expectation,
  }
}

describe('the TS resolver agrees with the fixture set', () => {
  it('has at least the six cases the SQL script loads', () => {
    expect(fixtures.cases.length).toBeGreaterThanOrEqual(6)
  })

  for (const testCase of fixtures.cases) {
    it(`resolves ${testCase.name}`, () => {
      const dsl = testCase.dsl_id === null ? null : (dslById.get(testCase.dsl_id) ?? null)
      const party = testCase.party_id === null ? null : (partyById.get(testCase.party_id) ?? null)

      const resolved = resolveNarrative(
        horseOf(testCase.horse_id),
        dsl === null
          ? null
          : {
              narrativeAboutHorse: dsl.narrative_about_horse,
              narrativeRacingOutlook: dsl.narrative_racing_outlook,
              narrativeRaceExpectation: dsl.narrative_race_expectation,
            },
        party,
      )

      expect(resolved).toEqual(testCase.expected)
    })
  }
})
