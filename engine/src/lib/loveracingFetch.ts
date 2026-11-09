/**
 * Loading a loveracing.nz page. PLAN.md step 4, OUTCOME.md § How a horse gets
 * in.
 *
 * The parse itself is pure, in `loveracing.ts`. This module is the only part
 * that goes to the network, so it is the only part that can be pointed
 * somewhere else. Three rules hold here:
 *
 * - The host is an exact match against a short allowlist. A link that merely
 *   ends with the allowed name, or that carries credentials, is refused. This
 *   is the operator's own page, not a general fetch, and it must not become a
 *   way to read other machines on the network.
 * - Redirects are refused rather than followed, so an allowed link cannot
 *   bounce the request somewhere else.
 * - The request does **not** use plain `fetch`. loveracing.nz is behind a
 *   Cloudflare JS challenge: `fetch`, curl and requests all get `403 Just a
 *   moment…` whatever User-Agent they send. The working path is TLS
 *   impersonation via `curl_cffi`, which is Python, so the page is fetched by
 *   `scripts/loveracing-fetch.py` and read back over stdout. Verified against
 *   both `/Breeding/…` and `/stud-book/…` on 2026-11-09.
 *
 * `fetch` is injected, so the tests prove the guard and the parse without a
 * network or a Python install.
 */

import { execFile } from 'node:child_process'
import { join } from 'node:path'

import { parseLoveracingPage, type LoveracingParseResult } from './loveracing'

/** Exactly these two hosts, over https, with nothing before the host. */
export const LOVERACING_HOSTS = ['loveracing.nz', 'www.loveracing.nz'] as const

export const LOVERACING_TIMEOUT_MS = 8000

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>

/** Where the TLS-impersonating fetcher lives. Overridable for a packaged build. */
export function loveracingFetcherScript(): string {
  return process.env.LOVERACING_FETCH_SCRIPT ?? join(process.cwd(), 'scripts', 'loveracing-fetch.py')
}

/**
 * Fetch through `curl_cffi` by running the helper script. Returns a `Response`
 * so the caller has one shape whether it injects `fetch` or not.
 */
export function curlCffiFetch(input: string, init?: RequestInit): Promise<Response> {
  const script = loveracingFetcherScript()

  return new Promise<Response>((resolve, reject) => {
    execFile(
      process.env.PYTHON ?? 'python3',
      [script, input],
      {
        timeout: LOVERACING_TIMEOUT_MS + 12000,
        maxBuffer: 8 * 1024 * 1024,
        signal: init?.signal as AbortSignal | undefined,
      },
      (error, stdout, stderr) => {
        if (error) {
          const said = stderr.trim()
          reject(new Error(said !== '' ? said : error.message))
          return
        }

        resolve(new Response(stdout, { status: 200, headers: { 'content-type': 'text/html' } }))
      },
    )
  })
}

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

/** `/Breeding/460867/Slug.aspx` and `/stud-book/460867/Slug.aspx` both count. */
export function loveracingIdFromUrl(url: URL): string | null {
  const match = /\/(?:breeding|stud-book)\/(\d+)\//i.exec(url.pathname)
  return match === null ? null : match[1]
}

export async function loadLoveracingPage(
  raw: string,
  fetchImpl: FetchLike = curlCffiFetch,
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

    return parseLoveracingPage(await response.text(), loveracingIdFromUrl(url))
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : 'the load failed' }
  }
}
