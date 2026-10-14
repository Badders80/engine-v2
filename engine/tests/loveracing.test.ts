/**
 * The loveracing.nz loader. PLAN.md step 4, OUTCOME.md § How a horse gets in.
 *
 * A registered horse starts from a loveracing.nz link, which is loaded, then
 * confirmed or edited by the operator, then saved. The parse is pure and
 * synchronous: it takes page source as a string and returns horse fields plus
 * the race record. CI never makes an outbound request, so the pages under
 * `tests/fixtures/` stand in for the live ones.
 *
 * The environment is Node, with no DOM. The parse reads the source as text.
 */

import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

import { parseLoveracingPage } from '../src/lib/loveracing'

function fixture(name: string): string {
  return readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8')
}

const REGISTERED = fixture('loveracing-registered.html')
const UNKNOWN = fixture('loveracing-unknown.html')

describe('the loader reads the page as text and calls nothing', () => {
  it('is synchronous, so no outbound request can be pending', () => {
    const result = parseLoveracingPage(REGISTERED)
    expect(result).not.toBeInstanceOf(Promise)
  })

  it('parses without a DOM', () => {
    // `document` does not exist in the Node environment this runs in.
    expect(typeof globalThis.document).toBe('undefined')
  })
})

describe('a registered horse loads its hard facts', () => {
  const result = parseLoveracingPage(REGISTERED)
  if (!result.ok) throw new Error(`fixture should parse: ${result.reason}`)

  it('reads the legal name', () => {
    expect(result.value.horse.legalName).toBe('LADY KETCHIKAN')
  })

  it('reads the foaling date as an ISO date', () => {
    expect(result.value.horse.foalingDate).toBe('2021-09-14')
  })

  it('reads sex, colour, and breeder', () => {
    expect(result.value.horse.sex).toBe('Filly')
    expect(result.value.horse.colour).toBe('Bay')
    expect(result.value.horse.breeder).toBe('Ketchikan Bloodstock Ltd')
  })

  it('reads the sire and the dam as names entered manually', () => {
    expect(result.value.horse.sireName).toBe('Wexford Lad')
    expect(result.value.horse.damName).toBe('Ketchikan Bay')
  })

  it('reads the microchip, the life number, and the loveracing id', () => {
    expect(result.value.horse.microchip).toBe('985113000123456')
    expect(result.value.horse.lifeNumber).toBe('NZ01234567')
    expect(result.value.horse.loveracingId).toBe('LR-88421')
  })

  it('marks the horse as registered', () => {
    expect(result.value.horse.registered).toBe(true)
  })

  it('does not fill the soft slots, which the operator writes afterwards', () => {
    // The loader returns hard facts only. The three soft slots belong to the
    // operator, so their keys are absent rather than empty.
    const keys = Object.keys(result.value.horse)
    expect(keys).not.toContain('aboutHorse')
    expect(keys).not.toContain('racingOutlookAndPedigree')
    expect(keys).not.toContain('raceExpectation')
  })

  it('returns the hard facts and nothing besides them', () => {
    expect(Object.keys(result.value.horse).sort()).toEqual([
      'breeder',
      'colour',
      'damName',
      'foalingDate',
      'legalName',
      'lifeNumber',
      'loveracingId',
      'microchip',
      'registered',
      'sex',
      'sireName',
    ])
  })
})

describe('the race record comes back as one blob', () => {
  const result = parseLoveracingPage(REGISTERED)
  if (!result.ok) throw new Error(`fixture should parse: ${result.reason}`)

  it('is a single object, not a table of columns', () => {
    expect(typeof result.value.raceRecord).toBe('object')
    expect(Array.isArray(result.value.raceRecord)).toBe(false)
  })

  it('counts the starts', () => {
    expect(result.value.raceRecord.resultLines).toHaveLength(2)
  })

  it('keeps each run whole', () => {
    expect(result.value.raceRecord.resultLines?.[0]).toMatchObject({
      date: '2024-03-02',
      venue: 'Te Rapa',
      race: 'Maiden',
      distance: 1200,
      result: 1,
    })
  })
})

describe('a page with no horse returns a refusal, never a half-built horse', () => {
  it('refuses', () => {
    expect(parseLoveracingPage(UNKNOWN).ok).toBe(false)
  })

  it('says why', () => {
    const result = parseLoveracingPage(UNKNOWN)
    if (result.ok) throw new Error('expected a refusal')
    expect(result.reason).toMatch(/no horse found/i)
  })

  it('carries no horse fields at all', () => {
    expect(Object.keys(parseLoveracingPage(UNKNOWN))).not.toContain('value')
  })
})

describe('a page that is not a horse page is refused', () => {
  it('refuses empty source', () => {
    expect(parseLoveracingPage('').ok).toBe(false)
  })

  it('refuses a page with a name but no facts', () => {
    const result = parseLoveracingPage('<html><body><h1>Something</h1></body></html>')
    expect(result.ok).toBe(false)
  })
})
