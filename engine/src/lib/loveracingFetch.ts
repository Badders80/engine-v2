/**
 * Loading a loveracing.nz page. PLAN.md step 4, OUTCOME.md § How a horse gets
 * in.
 *
 * The parse itself is pure, in `loveracing.ts`. This module is the only part
 * that goes to the network, so it is the only part that can be pointed
 * somewhere else. Two rules hold here:
 *
 * - The host is an exact match against a short allowlist. A link that merely
 *   ends with the allowed name, or that carries credentials, is refused. This
 *   is the operator's own page, not a general fetch, and it must not become a
 *   way to read other machines on the network.
 * - Redirects are refused rather than followed, so an allowed link cannot
 *   bounce the request somewhere else.
 *
 * `fetch` is injected, so the tests below prove both the parse and the guard
 * without a network.
 */

import { parseLoveracingPage, type LoveracingParseResult } from './loveracing'

/** Exactly these two hosts, over https, with nothing before the host. */
export const LOVERACING_HOSTS = ['loveracing.nz', 'www.loveracing.nz'] as const

export const LOVERACING_TIMEOUT_MS = 8000

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>

/**
 * The url, or null when the link is not one this loader may fetch.
 *
 * Nothing is trimmed into a valid link: an empty or unparseable string is a
 * refusal, not a guess at what the operator meant.
 */
export function loveracingUrlOrNull(raw: string): URL | null {
  const trimmed = raw.trim()
  if (trimmed === '') return null

  let url: URL
  try {
    url = new URL(trimmed)
  } catch {
    return null
  }

  if (url.protocol !== 'https:') return null
  if (url.username !== '' || url.password !== '') return null
  if (!(LOVERACING_HOSTS as readonly string[]).includes(url.hostname.toLowerCase())) return null

  return url
}

export async function loadLoveracingPage(
  raw: string,
  fetchImpl: FetchLike = fetch,
): Promise<LoveracingParseResult> {
  const url = loveracingUrlOrNull(raw)
  if (url === null) {
    return { ok: false, reason: 'that is not an https://loveracing.nz link' }
  }

  try {
    const response = await fetchImpl(url.toString(), {
      redirect: 'error',
      signal: AbortSignal.timeout(LOVERACING_TIMEOUT_MS),
      headers: { accept: 'text/html' },
    })

    if (!response.ok) {
      return { ok: false, reason: `loveracing.nz answered ${response.status}` }
    }

    return parseLoveracingPage(await response.text())
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : 'the load failed' }
  }
}
