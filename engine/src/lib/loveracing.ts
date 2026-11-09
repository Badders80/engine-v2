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
 * It returns hard facts only. The race record lives on the Performance Profile
 * (`EntryDetail.aspx?HorseID=…`), which is a later item — the identity page has
 * no race table, so `raceRecord` comes back empty rather than guessed.
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
      raceRecord: { starts: 0, wins: 0, places: 0, resultLines: [] },
    },
  }
}
