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
  loadLoveracingPage,
  loveracingUrlOrNull,
  type FetchLike,
} from '../src/lib/loveracingFetch'

function fixture(name: string): string {
  return readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8')
}

const REGISTERED = fixture('loveracing-registered.html')

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

describe('the load makes one request to the guarded url', () => {
  it('returns the parsed page', async () => {
    const fetchImpl = stub(200, REGISTERED)
    const result = await loadLoveracingPage('https://loveracing.nz/horse/123', fetchImpl)

    expect(fetchImpl).toHaveBeenCalledTimes(1)
    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error(result.reason)
    expect(result.value.horse.legalName).toBe('LADY KETCHIKAN')
    expect(result.value.raceRecord.starts).toBe(2)
  })

  it('requests the guarded url itself, and refuses to follow a redirect', async () => {
    const fetchImpl = stub(200, REGISTERED)
    await loadLoveracingPage('https://loveracing.nz/horse/123', fetchImpl)

    const [calledUrl, init] = fetchImpl.mock.calls[0]
    expect(calledUrl).toBe('https://loveracing.nz/horse/123')
    expect(init?.redirect).toBe('error')
  })

  it('never calls out at all for a link the guard refuses', async () => {
    const fetchImpl = stub(200, REGISTERED)
    const result = await loadLoveracingPage('https://loveracing.nz.evil.test/x', fetchImpl)

    expect(result.ok).toBe(false)
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('refuses a non-200 answer', async () => {
    const result = await loadLoveracingPage('https://loveracing.nz/horse/1', stub(404, 'gone'))

    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('expected a refusal')
    expect(result.reason).toMatch(/404/)
  })

  it('refuses rather than throwing when the request itself fails', async () => {
    const fetchImpl = vi.fn<FetchLike>(async () => {
      throw new Error('network down')
    })
    const result = await loadLoveracingPage('https://loveracing.nz/horse/1', fetchImpl)

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
})
