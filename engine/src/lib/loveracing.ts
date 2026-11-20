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
 * The markup it reads was checked against the live Stud Book page on 2026-11-09
 * (`/Breeding/{id}/{slug}.aspx` and `/stud-book/{id}/{slug}.aspx` return the
 * same bytes):
 *
 *   <h2 class="horse-name">Mulan The Brave (NZ) 2023</h2>
 *   <ul class="no-bullets horse-attr">
 *     <li><strong>Born:</strong> 17/08/2023</li>
 *     <li>Bay Filly</li>
 *     <li><strong>Sire:</strong> <a …>TURN ME LOOSE (NZ) 2011</a></li>
 *   </ul>
 *   <div class="col-xs-3"><strong>Foaling date:</strong> 17/08/2023</div>
 *   <div class="col-xs-3"><strong>Microchip:</strong> 985125000128426</div>
 *   <div class="col-xs-3"><strong>Life no:</strong> NZ00460867</div>
 *   <div class="col-xs-3"><strong>Breeder:</strong> C W Kwok</div>
 *
 * It returns hard facts only. The identity page has no race table. The network
 * loader captures NZTR's aggregate race summary separately and leaves the
 * runner-by-runner Performance Profile lines empty until that source is parsed.
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

export type LoveracingParent = {
  name: string
  horseId: string
  href: string
}

export type LoveracingParents = {
  sire: LoveracingParent | null
  dam: LoveracingParent | null
}

export type RaceResultLine = {
  date: string | null
  venue: string | null
  race: string | null
  distance: number | null
  result: number | null
}

export type RaceSummary = {
  source: 'loveracing_nz'
  sourceHorseId: string
  retrievedAt: string
  starts: number
  wins: number
  seconds: number
  thirds: number
  stakesNzd: number
}

export type RaceRecord = {
  summary: RaceSummary | null
  resultLines: RaceResultLine[]
}

export type RaceSummaryParseResult =
  | { ok: true; value: RaceSummary }
  | { ok: false; reason: string }

export type LoveracingParseResult =
  | {
      ok: true
      value: { horse: LoveracingHorse; raceRecord: RaceRecord; parents: LoveracingParents }
    }
  | { ok: false; reason: string }

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
 * The value that follows `<strong>Label:</strong>`, up to the next label or the
 * end of its container. The page writes every fact this way, and the label text
 * is the only stable hook in it.
 */
function fact(source: string, label: string): string | null {
  const pattern = new RegExp(
    `<strong>\\s*${label}\\s*:\\s*</strong>([\\s\\S]{0,300}?)(?=<strong>|<\\/div>|<\\/li>|$)`,
    'i',
  )
  const match = pattern.exec(source)
  if (match === null) return null

  const value = stripTags(match[1])
  return value === '' || value === '-' ? null : value
}

/** A labelled ancestor link, including the stable HorseID in its href. */
function linkedHorseFact(source: string, label: string): LoveracingParent | null {
  const pattern = new RegExp(
    `<strong>\\s*${label}\\s*:\\s*</strong>[\\s\\S]{0,200}?<a\\b[^>]*href=(?:"([^"]*)"|'([^']*)')[^>]*>([\\s\\S]*?)<\\/a>`,
    'i',
  )
  const match = pattern.exec(source)
  if (match === null) return null

  const href = (match[1] ?? match[2] ?? '').replace(/&amp;/g, '&').trim()
  const name = stripTags(match[3])
  const id = /(?:[?&]HorseID=|\/(?:breeding|stud-book)\/)(\d+)/i.exec(href)?.[1]
  if (href === '' || name === '' || id === undefined) return null

  return { name, horseId: id, href }
}

export function parseLoveracingParents(source: string): LoveracingParents {
  return {
    sire: linkedHorseFact(source, 'Sire'),
    dam: linkedHorseFact(source, 'Dam'),
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function summaryCount(row: Record<string, unknown>, key: string): number | null {
  const value = row[key]
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : null
}

/** Parse the aggregate race summary embedded in NZTR's pedigree payload. */
export function parseLoveracingRaceSummary(
  source: string,
  sourceHorseId: string,
  retrievedAt: string,
): RaceSummaryParseResult {
  let envelope: unknown
  try {
    envelope = JSON.parse(source)
  } catch {
    return { ok: false, reason: 'the race summary response is not valid json' }
  }

  if (!isRecord(envelope) || typeof envelope.d !== 'string') {
    return { ok: false, reason: 'the race summary response has no encoded payload' }
  }

  let payload: unknown
  try {
    payload = JSON.parse(envelope.d)
  } catch {
    return { ok: false, reason: 'the race summary payload is not valid json' }
  }

  if (!isRecord(payload) || !Array.isArray(payload.rows)) {
    return { ok: false, reason: 'the race summary payload has no rows' }
  }

  const root = payload.rows.find(
    (row) =>
      isRecord(row) &&
      row.Level === 0 &&
      String(row.HorseID) === sourceHorseId,
  )
  if (!isRecord(root)) {
    return {
      ok: false,
      reason: `the race summary has no root horse row for Loveracing HorseID ${sourceHorseId}`,
    }
  }

  const starts = summaryCount(root, 'Starts')
  const wins = summaryCount(root, 'Wins')
  const seconds = summaryCount(root, 'Seconds')
  const thirds = summaryCount(root, 'Thirds')
  const stakesNzd = root.Stakes

  for (const [label, value] of [
    ['Starts', starts],
    ['Wins', wins],
    ['Seconds', seconds],
    ['Thirds', thirds],
  ] as const) {
    if (value === null) {
      return { ok: false, reason: `the race summary ${label} is not a non-negative integer` }
    }
  }

  if (starts === null || wins === null || seconds === null || thirds === null) {
    return { ok: false, reason: 'the race summary counts are invalid' }
  }

  if (typeof stakesNzd !== 'number' || !Number.isFinite(stakesNzd) || stakesNzd < 0) {
    return { ok: false, reason: 'the race summary Stakes is not a non-negative number' }
  }

  return {
    ok: true,
    value: {
      source: 'loveracing_nz',
      sourceHorseId,
      retrievedAt,
      starts,
      wins,
      seconds,
      thirds,
      stakesNzd,
    },
  }
}

/** `<li>Bay Filly</li>` — the only unlabelled line in the identity list. */
function readColourAndSex(source: string): { colour: string; sex: string } {
  const list = /<ul[^>]*class="[^"]*horse-attr[^"]*"[^>]*>([\s\S]*?)<\/ul>/i.exec(source)
  if (list === null) return { colour: '', sex: '' }

  for (const item of list[1].matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)) {
    if (/<strong>/i.test(item[1])) continue

    const said = stripTags(item[1])
    if (said === '') continue

    const words = said.split(/\s+/)
    const tail = words[words.length - 1].toLowerCase()
    const sexes = ['filly', 'colt', 'gelding', 'mare', 'stallion', 'rig']
    if (sexes.includes(tail)) {
      return {
        colour: words.slice(0, -1).join(' '),
        sex: words[words.length - 1],
      }
    }

    return { colour: said, sex: '' }
  }

  return { colour: '', sex: '' }
}

/** `14/09/2021` becomes `2021-09-14`, the form the date column takes. */
function toIsoDate(value: string | null): string | null {
  if (value === null) return null

  const dayFirst = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value)
  if (dayFirst) {
    const [, day, month, year] = dayFirst
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
  }

  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (iso) return value

  return null
}

/** The heading carries the foaling year after the name; the name does not. */
function nameWithoutYear(said: string): string {
  return said.replace(/\s+(19|20)\d{2}\s*$/, '').trim()
}

export function parseLoveracingPage(
  source: string,
  loveracingId: string | null = null,
): LoveracingParseResult {
  const named = /<h2[^>]*class="[^"]*horse-name[^"]*"[^>]*>([\s\S]*?)<\/h2>/i.exec(source)

  if (named === null) {
    const heading = /<h2[^>]*>([\s\S]*?)<\/h2>/i.exec(source)
    const said = heading ? stripTags(heading[1]) : ''
    return {
      ok: false,
      reason:
        said === ''
          ? 'No horse found on that page.'
          : `That page does not look like a Stud Book page (first heading: ${said}).`,
    }
  }

  const legalName = nameWithoutYear(stripTags(named[1]))
  if (legalName === '') {
    return { ok: false, reason: 'the page has a horse-name heading but it is empty' }
  }

  const foalingDate = toIsoDate(fact(source, 'Foaling date') ?? fact(source, 'Born'))
  if (foalingDate === null) {
    return { ok: false, reason: `the foaling date for ${legalName} is missing or not a date` }
  }

  const { colour, sex } = readColourAndSex(source)
  const sireName = fact(source, 'Sire')
  const damName = fact(source, 'Dam')
  const parents = parseLoveracingParents(source)

  const missing: string[] = []
  if (sireName === null) missing.push('sire')
  if (damName === null) missing.push('dam')
  if (missing.length > 0) {
    return {
      ok: false,
      reason: `the page names ${legalName} but is missing ${missing.join(' and ')}`,
    }
  }

  const lifeNumber = fact(source, 'Life no') ?? fact(source, 'Life number')

  return {
    ok: true,
    value: {
      horse: {
        legalName,
        foalingDate,
        sex,
        colour,
        breeder: fact(source, 'Breeder'),
        sireName: sireName ?? '',
        damName: damName ?? '',
        microchip: fact(source, 'Microchip'),
        lifeNumber,
        loveracingId,
        // A horse with a Stud Book page and a life number is registered; the
        // operator can still untick the box before saving.
        registered: lifeNumber !== null,
      },
      raceRecord: { summary: null, resultLines: [] },
      parents,
    },
  }
}
