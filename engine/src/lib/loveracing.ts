/**
 * The loveracing.nz loader. PLAN.md step 4, OUTCOME.md § How a horse gets in.
 *
 * A registered horse starts from a loveracing.nz link: the page is loaded, the
 * operator confirms or edits the fields, saves, then fills the three soft slots
 * by hand. This module does the loading half and nothing else.
 *
 * Two deliberate limits:
 *
 * - It is pure and synchronous, taking page source as a string. It never makes
 *   an outbound request, so tests run against local fixtures and CI needs no
 *   network.
 * - It reads the source as text, with no DOM. The test environment is Node, and
 *   a parser that needed `document` would need a browser to test.
 *
 * It returns hard facts and the race record only. The soft slots
 * (`about_horse`, `racing_outlook_and_pedigree`, `race_expectation`) are the
 * operator's to write afterwards, so they are not filled here. The race record
 * comes back as one object, to be stored as a single jsonb blob.
 */

import type { NewHorse } from './dslStore'

/** The hard facts this loader can fill. The soft slots are absent by design. */
export type LoveracingHorse = Pick<
  NewHorse,
  | 'legalName'
  | 'foalingDate'
  | 'sex'
  | 'colour'
  | 'breeder'
  | 'sireName'
  | 'damName'
  | 'microchip'
  | 'lifeNumber'
  | 'loveracingId'
  | 'registered'
>

export type RaceResultLine = {
  date: string | null
  venue: string | null
  race: string | null
  distance: number | null
  result: number | null
}

export type RaceRecord = {
  starts: number
  wins: number
  places: number
  resultLines: RaceResultLine[]
}

export type LoveracingParseResult =
  | { ok: true; value: { horse: LoveracingHorse; raceRecord: RaceRecord } }
  | { ok: false; reason: string }

const FACT_LABELS = {
  registration: 'registered',
  'foaling date': 'foalingDate',
  sex: 'sex',
  colour: 'colour',
  color: 'colour',
  breeder: 'breeder',
  sire: 'sireName',
  dam: 'damName',
  microchip: 'microchip',
  'life number': 'lifeNumber',
  'horse id': 'loveracingId',
} as const

type FactKey = (typeof FACT_LABELS)[keyof typeof FACT_LABELS]

function stripTags(fragment: string): string {
  return fragment
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim()
}

/**
 * Read the `dt`/`dd` pairs, not the whole page. A page that lists a horse's
 * facts in another shape is refused rather than guessed at.
 */
function readFacts(source: string): Map<FactKey, string> {
  const facts = new Map<FactKey, string>()
  const pair = /<dt[^>]*>([\s\S]*?)<\/dt>\s*<dd[^>]*>([\s\S]*?)<\/dd>/gi

  for (const match of source.matchAll(pair)) {
    const label = stripTags(match[1]).toLowerCase()
    const key = (FACT_LABELS as Record<string, FactKey>)[label]
    if (key === undefined) continue
    facts.set(key, stripTags(match[2]))
  }

  return facts
}

/** `14/09/2021` becomes `2021-09-14`, the form the date column takes. */
function toIsoDate(value: string | undefined): string | null {
  if (value === undefined) return null

  const dayFirst = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value)
  if (dayFirst) {
    const [, day, month, year] = dayFirst
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
  }

  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (iso) return value

  return null
}

function readRaceRecord(source: string): RaceRecord {
  const table = /<table[^>]*class="[^"]*race-record[^"]*"[^>]*>([\s\S]*?)<\/table>/i.exec(source)
  if (!table) return { starts: 0, wins: 0, places: 0, resultLines: [] }

  const resultLines: RaceResultLine[] = []

  for (const row of table[1].matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
    if (/<th[\s>]/i.test(row[1])) continue

    const cells = [...row[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((cell) =>
      stripTags(cell[1]),
    )
    if (cells.length < 5) continue

    const [date, venue, race, distance, result] = cells
    resultLines.push({
      date: toIsoDate(date),
      venue: venue === '' ? null : venue,
      race: race === '' ? null : race,
      distance: distance === '' ? null : Number(distance),
      result: result === '' ? null : Number(result),
    })
  }

  const results = resultLines.map((line) => line.result)

  return {
    starts: resultLines.length,
    wins: results.filter((result) => result === 1).length,
    places: results.filter((result) => result === 2 || result === 3).length,
    resultLines,
  }
}

export function parseLoveracingPage(source: string): LoveracingParseResult {
  const named = /<h1[^>]*class="[^"]*horse-name[^"]*"[^>]*>([\s\S]*?)<\/h1>/i.exec(source)

  if (!named) {
    const heading = /<h1[^>]*>([\s\S]*?)<\/h1>/i.exec(source)
    const said = heading ? stripTags(heading[1]) : ''
    return {
      ok: false,
      reason: said === '' ? 'No horse found on that page.' : said,
    }
  }

  const legalName = stripTags(named[1])
  const facts = readFacts(source)

  const missing = (['foalingDate', 'sireName', 'damName'] as FactKey[]).filter(
    (key) => facts.get(key) === undefined,
  )
  if (missing.length > 0) {
    return {
      ok: false,
      reason: `the page names ${legalName} but is missing ${missing.join(', ')}`,
    }
  }

  const foalingDate = toIsoDate(facts.get('foalingDate'))
  if (foalingDate === null) {
    return { ok: false, reason: `the foaling date for ${legalName} is not a date` }
  }

  const registration = facts.get('registered') ?? ''
  if (/unregistered/i.test(registration)) {
    return {
      ok: false,
      reason: `${legalName} is not registered; an unregistered horse is typed by hand instead`,
    }
  }

  return {
    ok: true,
    value: {
      horse: {
        legalName,
        foalingDate,
        sex: facts.get('sex') ?? '',
        colour: facts.get('colour') ?? '',
        breeder: facts.get('breeder') ?? null,
        sireName: facts.get('sireName') ?? '',
        damName: facts.get('damName') ?? '',
        microchip: facts.get('microchip') ?? null,
        lifeNumber: facts.get('lifeNumber') ?? null,
        loveracingId: facts.get('loveracingId') ?? null,
        registered: /registered/i.test(registration),
      },
      raceRecord: readRaceRecord(source),
    },
  }
}
