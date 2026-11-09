/**
 * The loveracing.nz loader. PLAN.md step 4, OUTCOME.md § How a horse gets in.
 *
 * The parse is pure and synchronous: it takes page source as a string and
 * returns the hard facts. CI never makes an outbound request, so the page under
 * `tests/fixtures/` is the real Stud Book page for Mulan The Brave, saved on
 * 2026-11-09 — the same bytes served by `/Breeding/{id}/…` and
 * `/stud-book/{id}/…`.
 */

import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

import { parseLoveracingPage } from '../src/lib/loveracing'

function fixture(name: string): string {
  return readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8')
}

const MULAN = fixture('loveracing-mulan.html')

describe('the loader reads the page as text and calls nothing', () => {
  it('is synchronous, so no outbound request can be pending', () => {
    expect(parseLoveracingPage(MULAN)).not.toBeInstanceOf(Promise)
  })

  it('parses without a DOM', () => {
    expect(typeof globalThis.document).toBe('undefined')
  })
})

describe('the real Stud Book page loads its hard facts', () => {
  const result = parseLoveracingPage(MULAN, '460867')
  if (!result.ok) throw new Error(`fixture should parse: ${result.reason}`)

  it('reads the official name without the trailing foaling year', () => {
    // The heading is "Mulan The Brave (NZ) 2023"; the name is not.
    expect(result.value.horse.legalName).toBe('Mulan The Brave (NZ)')
  })

  it('reads the foaling date as an ISO date', () => {
    expect(result.value.horse.foalingDate).toBe('2023-08-17')
  })

  it('splits the unlabelled "Bay Filly" line into colour and sex', () => {
    expect(result.value.horse.colour).toBe('Bay')
    expect(result.value.horse.sex).toBe('Filly')
  })

  it('reads the sire and the dam as printed', () => {
    expect(result.value.horse.sireName).toBe('TURN ME LOOSE (NZ) 2011')
    expect(result.value.horse.damName).toBe('YEARN (NZ) 2013')
  })

  it('reads the breeder, microchip and life number', () => {
    expect(result.value.horse.breeder).toBe('C W Kwok')
    expect(result.value.horse.microchip).toBe('985125000128426')
    expect(result.value.horse.lifeNumber).toBe('NZ00460867')
  })

  it('takes the loveracing id from the URL, not the page', () => {
    expect(result.value.horse.loveracingId).toBe('460867')
    const withoutUrl = parseLoveracingPage(MULAN)
    if (!withoutUrl.ok) throw new Error(withoutUrl.reason)
    expect(withoutUrl.value.horse.loveracingId).toBeNull()
  })

  it('marks a horse with a life number as registered', () => {
    expect(result.value.horse.registered).toBe(true)
  })

  it('returns an empty race record rather than guessing one', () => {
    // The identity page carries no race table; the Performance Profile does.
    expect(result.value.raceRecord).toEqual({
      starts: 0,
      wins: 0,
      places: 0,
      resultLines: [],
    })
  })

  it('does not fill the soft slots, which the operator writes afterwards', () => {
    const keys = Object.keys(result.value.horse)
    expect(keys).not.toContain('aboutHorse')
    expect(keys).not.toContain('racingOutlookAndPedigree')
    expect(keys).not.toContain('raceExpectation')
  })
})

describe('it refuses a page it cannot trust', () => {
  it('refuses a page with no horse-name heading', () => {
    const result = parseLoveracingPage('<html><body><h1>No horse found</h1></body></html>')

    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('expected a refusal')
    expect(result.reason).toMatch(/No horse found on that page|does not look like a Stud Book page/)
  })

  it('refuses a page missing the sire', () => {
    const source = MULAN.replace(/<strong>Sire:<\/strong>[\s\S]{0,300}?<\/li>/, '</li>')
    const result = parseLoveracingPage(source)

    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('expected a refusal')
    expect(result.reason).toMatch(/missing sire/)
  })

  it('refuses an unparseable foaling date', () => {
    const source = MULAN.replace(
      /<strong>Foaling date:<\/strong>[^<]*/,
      '<strong>Foaling date:</strong> unknown',
    )
    const result = parseLoveracingPage(source)

    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('expected a refusal')
    expect(result.reason).toMatch(/foaling date/)
  })
})
