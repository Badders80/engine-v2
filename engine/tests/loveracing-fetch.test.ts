/**
 * The guard on the loveracing.nz link, and the load behind it.
 *
 * `fetch` is injected throughout, so these tests prove the guard and the parse
 * without a network call. The fixture is the same page the pure parser test
 * reads.
 */

import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'

import {
  LOVERACING_HOSTS,
  LOVERACING_RACE_SUMMARY_URL,
  loadLoveracingPage,
  loveracingUrlOrNull,
  type FetchLike,
} from '../src/lib/loveracingFetch'

function fixture(name: string): string {
  return readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8')
}

const REGISTERED = fixture('loveracing-mulan.html')

function stub(status: number, body: string): ReturnType<typeof vi.fn<FetchLike>> {
  return vi.fn<FetchLike>(async () => new Response(body, { status }))
}

describe('the guard accepts exactly two hosts over https', () => {
  it('names the two hosts', () => {
    expect([...LOVERACING_HOSTS]).toEqual(['loveracing.nz', 'www.loveracing.nz'])
  })

  it('accepts the bare host and the www host', () => {
    expect(loveracingUrlOrNull('https://loveracing.nz/horse/123')?.hostname).toBe('loveracing.nz')
    expect(loveracingUrlOrNull('https://www.loveracing.nz/horse/123')?.hostname).toBe(
      'www.loveracing.nz',
    )
  })

  it('accepts a link with surrounding whitespace', () => {
    expect(loveracingUrlOrNull('  https://loveracing.nz/horse/123  ')?.hostname).toBe(
      'loveracing.nz',
    )
  })

  it('refuses a plain http link', () => {
    expect(loveracingUrlOrNull('http://loveracing.nz/horse/123')).toBeNull()
  })

  it('refuses a host that merely ends with the allowed name', () => {
    expect(loveracingUrlOrNull('https://loveracing.nz.evil.test/x')).toBeNull()
    expect(loveracingUrlOrNull('https://notloveracing.nz/x')).toBeNull()
  })

  it('refuses a subdomain that is not the www host', () => {
    expect(loveracingUrlOrNull('https://api.loveracing.nz/x')).toBeNull()
  })

  it('refuses credentials in the link', () => {
    expect(loveracingUrlOrNull('https://someone:secret@loveracing.nz/x')).toBeNull()
  })

  it('refuses every other scheme', () => {
    for (const raw of [
      'file:///etc/passwd',
      'ftp://loveracing.nz/x',
      'javascript:alert(1)',
      'data:text/html,hello',
    ]) {
      expect(loveracingUrlOrNull(raw)).toBeNull()
    }
  })

  it('refuses an empty or unparseable link rather than guessing', () => {
    expect(loveracingUrlOrNull('')).toBeNull()
    expect(loveracingUrlOrNull('   ')).toBeNull()
    expect(loveracingUrlOrNull('not a url')).toBeNull()
    expect(loveracingUrlOrNull('/horse/123')).toBeNull()
  })
})

describe('the load reads the guarded seed and follows its ancestry', () => {
  it('returns the parsed page', async () => {
    const fetchImpl = pedigreeFetch()
    const result = await loadLoveracingPage(
      'https://loveracing.nz/stud-book/460867/Mulan-The-Brave-NZ-2023.aspx',
      fetchImpl,
    )

    expect(fetchImpl).toHaveBeenCalledTimes(8)
    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error(result.reason)
    expect(result.value.horse.legalName).toBe('Mulan The Brave (NZ)')
    expect(result.value.raceRecord).toEqual({
      summary: {
        source: 'loveracing_nz',
        sourceHorseId: '460867',
        retrievedAt: expect.any(String),
        starts: 1,
        wins: 0,
        seconds: 0,
        thirds: 0,
        stakesNzd: 370,
      },
      resultLines: [],
    })
    expect(result.value.pedigree.nodes).toHaveLength(15)
  })

  it('reads the loveracing id out of either URL shape', async () => {
    for (const raw of [
      'https://loveracing.nz/Breeding/460867/Mulan-The-Brave-NZ-2023.aspx',
      'https://loveracing.nz/stud-book/460867/Mulan-The-Brave-NZ-2023.aspx',
    ]) {
      const result = await loadLoveracingPage(raw, pedigreeFetch())
      if (!result.ok) throw new Error(result.reason)
      expect(result.value.horse.loveracingId).toBe('460867')
    }
  })

  it('requests the guarded url itself, and refuses to follow a redirect', async () => {
    const fetchImpl = pedigreeFetch()
    await loadLoveracingPage(
      'https://loveracing.nz/stud-book/460867/Mulan-The-Brave-NZ-2023.aspx',
      fetchImpl,
    )

    const [calledUrl, init] = fetchImpl.mock.calls[0]
    expect(calledUrl).toBe(
      'https://loveracing.nz/stud-book/460867/Mulan-The-Brave-NZ-2023.aspx',
    )
    expect(init?.redirect).toBe('error')
  })

  it('refuses a Loveracing page without a Stud Book HorseID before calling out', async () => {
    const fetchImpl = vi.fn<FetchLike>(async () => new Response(REGISTERED, { status: 200 }))
    const result = await loadLoveracingPage('https://loveracing.nz/horse/123', fetchImpl)

    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('expected a missing HorseID to be refused')
    expect(result.reason).toMatch(/HorseID/)
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('never calls out at all for a link the guard refuses', async () => {
    const fetchImpl = stub(200, REGISTERED)
    const result = await loadLoveracingPage('https://loveracing.nz.evil.test/x', fetchImpl)

    expect(result.ok).toBe(false)
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('refuses a non-200 answer', async () => {
    const result = await loadLoveracingPage(
      'https://loveracing.nz/stud-book/460867/Mulan-The-Brave-NZ-2023.aspx',
      stub(404, 'gone'),
    )

    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('expected a refusal')
    expect(result.reason).toMatch(/404/)
  })

  it('refuses rather than throwing when the request itself fails', async () => {
    const fetchImpl = vi.fn<FetchLike>(async () => {
      throw new Error('network down')
    })
    const result = await loadLoveracingPage(
      'https://loveracing.nz/stud-book/460867/Mulan-The-Brave-NZ-2023.aspx',
      fetchImpl,
    )

    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('expected a refusal')
    expect(result.reason).toMatch(/network down/)
  })

  it('refuses a page that is not a horse page', async () => {
    const result = await loadLoveracingPage(
      'https://loveracing.nz/horse/0',
      stub(200, '<html><body><h1>No horse found</h1></body></html>'),
    )

    expect(result.ok).toBe(false)
  })

  it('captures exactly four generations in a 1/2/4/8 matrix', async () => {
    const result = await loadLoveracingPage(
      'https://loveracing.nz/stud-book/460867/Mulan-The-Brave-NZ-2023.aspx',
      pedigreeFetch(),
    )
    if (!result.ok) throw new Error(result.reason)

    const generations = result.value.pedigree.nodes.reduce<Record<number, number>>(
      (counts, node) => {
        counts[node.generation] = (counts[node.generation] ?? 0) + 1
        return counts
      },
      {},
    )

    expect(generations).toEqual({ 0: 1, 1: 2, 2: 4, 3: 8 })
    expect(result.value.pedigree.nodes[0]).toMatchObject({
      path: 'horse',
      name: 'Mulan The Brave (NZ)',
      horseId: '460867',
    })
    expect(result.value.pedigree.nodes.at(-1)?.generation).toBe(3)
  })

  it('refuses an incomplete pedigree rather than saving a partial tree', async () => {
    const complete = pedigreeFetch()
    const fetchImpl = vi.fn<FetchLike>(async (input, init) => {
      const url = new URL(input)
      if (url.searchParams.get('HorseID') === '250539') {
        throw new Error('grandparent page unavailable')
      }
      return complete(input, init)
    })

    const result = await loadLoveracingPage(
      'https://loveracing.nz/stud-book/460867/Mulan-The-Brave-NZ-2023.aspx',
      fetchImpl,
    )

    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('expected an incomplete pedigree to be refused')
    expect(result.reason).toMatch(/pedigree/i)
    expect(result.reason).toMatch(/grandparent page unavailable/)
  })

  it('requests and captures the NZTR race summary', async () => {
    const fetchImpl = pedigreeFetch()
    const result = await loadLoveracingPage(
      'https://loveracing.nz/stud-book/460867/Mulan-The-Brave-NZ-2023.aspx',
      fetchImpl,
    )
    if (!result.ok) throw new Error(result.reason)

    const summaryCall = fetchImpl.mock.calls.find(
      ([input]) => input === LOVERACING_RACE_SUMMARY_URL,
    )
    expect(summaryCall).toBeDefined()
    expect(summaryCall?.[1]?.method).toBe('POST')
    expect(JSON.parse(String(summaryCall?.[1]?.body))).toEqual({
      horseID: '460867',
      recordCount: '',
    })
    expect(result.value.raceRecord.summary?.stakesNzd).toBe(370)
  })

  it('refuses the import when the race summary is unavailable', async () => {
    const complete = pedigreeFetch()
    const fetchImpl = vi.fn<FetchLike>(async (input, init) => {
      if (input === LOVERACING_RACE_SUMMARY_URL) {
        return new Response('summary unavailable', { status: 503 })
      }
      return complete(input, init)
    })

    const result = await loadLoveracingPage(
      'https://loveracing.nz/stud-book/460867/Mulan-The-Brave-NZ-2023.aspx',
      fetchImpl,
    )

    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('expected a missing summary to be refused')
    expect(result.reason).toMatch(/race summary/i)
    expect(result.reason).toMatch(/503/)
  })
})

const ANCESTOR_PAGES: Record<string, string> = {
  '290223': ancestorPage([
    ['Sire', '255989', 'IFFRAAJ (GB) 2001'],
    ['Dam', '234436', 'INDOMITABLE (NZ) 2003'],
  ]),
  '317105': ancestorPage([
    ['Sire', '238456', 'SAVABEEL (AUS) 2001'],
    ['Dam', '250539', 'PRINCESS UNO (AUS) 2003'],
  ]),
  '255989': ancestorPage([
    ['Sire', '213094', 'ZAFONIC (USA) 1990'],
    ['Dam', '255990', 'PASTORALE (GB) 1988'],
  ]),
  '234436': ancestorPage([
    ['Sire', '300001', 'INDOMITABLE SIRE (NZ) 1990'],
    ['Dam', '300002', 'INDOMITABLE DAM (NZ) 1995'],
  ]),
  '238456': ancestorPage([
    ['Sire', '300003', 'ZABEEL (NZ) 1986'],
    ['Dam', '300004', 'SAVANNAH SUCCESS (NZ) 1993'],
  ]),
  '250539': ancestorPage([
    ['Sire', '151645', 'DANE HILL (USA) 1986'],
    ['Dam', '250540', 'NUMERO PRIVEE (USA) 1990'],
  ]),
}

function ancestorPage(
  parents: ReadonlyArray<readonly ['Sire' | 'Dam', string, string]>,
): string {
  const rows = parents.map(
    ([label, id, name]) =>
      `<li><strong>${label}:</strong> <a href="/Common/SystemTemplates/Modal/EntryDetail.aspx?HorseID=${id}&DisplayContext=Modal">${name}</a></li>`,
  )
  return `<html><body><ul>${rows.join('')}</ul></body></html>`
}

function pedigreeFetch() {
  return vi.fn<FetchLike>(async (input, init) => {
    if (input === LOVERACING_RACE_SUMMARY_URL) {
      expect(init?.method).toBe('POST')
      return new Response(
        JSON.stringify({
          d: JSON.stringify({
            rows: [
              {
                HorseID: 460867,
                Level: 0,
                Starts: 1,
                Wins: 0,
                Seconds: 0,
                Thirds: 0,
                Stakes: 370,
              },
            ],
          }),
        }),
        { status: 200 },
      )
    }

    const url = new URL(input)
    if (url.pathname.includes('460867')) return new Response(REGISTERED, { status: 200 })

    const horseId = url.searchParams.get('HorseID')
    const page = horseId === null ? null : ANCESTOR_PAGES[horseId]
    return page === undefined || page === null
      ? new Response('not found', { status: 404 })
      : new Response(page, { status: 200 })
  })
}
