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

import {
  parseLoveracingRaceSummary,
  parseLoveracingPage,
  parseLoveracingParents,
  type LoveracingHorse,
  type LoveracingParent,
  type LoveracingParents,
  type RaceRecord,
  type RaceSummary,
} from './loveracing'
import {
  PEDIGREE_PATHS,
  PEDIGREE_VERSION,
  isCompletePedigreeSnapshot,
  pedigreeSnapshotProblem,
  type PedigreeGeneration,
  type PedigreeNode,
  type PedigreeSnapshot,
} from './pedigree'

/** Exactly these two hosts, over https, with nothing before the host. */
export const LOVERACING_HOSTS = ['loveracing.nz', 'www.loveracing.nz'] as const

export const LOVERACING_TIMEOUT_MS = 8000

export const LOVERACING_RACE_SUMMARY_URL =
  'https://loveracing.nz/Common/ServerScript/Breeding.aspx/GetHorsePedigree'

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>

export type LoveracingLoadResult =
  | {
      ok: true
      value: {
        horse: LoveracingHorse
        raceRecord: RaceRecord
        parents: LoveracingParents
        pedigree: PedigreeSnapshot
      }
    }
  | { ok: false; reason: string }

type HtmlResult = { ok: true; value: { url: URL; html: string } } | { ok: false; reason: string }

type PendingNode = { node: PedigreeNode; parents: LoveracingParents }

type ChildNode = { node: PedigreeNode; href: string }

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
  const args = [script, input]
  const method = init?.method?.toUpperCase() ?? 'GET'

  if (method === 'POST') {
    if (typeof init?.body !== 'string') {
      return Promise.reject(new Error('the Loveracing POST body must be a JSON string'))
    }
    args.push('--json', init.body)
  } else if (method !== 'GET') {
    return Promise.reject(new Error(`unsupported Loveracing method ${method}`))
  }

  return new Promise<Response>((resolve, reject) => {
    execFile(
      process.env.PYTHON ?? 'python3',
      args,
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

async function loadRaceSummary(
  horseId: string,
  fetchImpl: FetchLike,
): Promise<{ ok: true; value: RaceSummary } | { ok: false; reason: string }> {
  try {
    const response = await fetchImpl(LOVERACING_RACE_SUMMARY_URL, {
      method: 'POST',
      redirect: 'error',
      signal: AbortSignal.timeout(LOVERACING_TIMEOUT_MS),
      headers: {
        accept: 'application/json',
        'content-type': 'application/json; charset=utf-8',
      },
      body: JSON.stringify({ horseID: horseId, recordCount: '' }),
    })

    if (!response.ok) {
      return { ok: false, reason: `the race summary request answered ${response.status}` }
    }

    return parseLoveracingRaceSummary(
      await response.text(),
      horseId,
      new Date().toISOString(),
    )
  } catch (error) {
    return {
      ok: false,
      reason: `the race summary request failed: ${error instanceof Error ? error.message : 'unknown error'}`,
    }
  }
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

function withoutHash(url: URL): URL {
  const clean = new URL(url)
  clean.hash = ''
  return clean
}

async function fetchLoveracingHtml(raw: URL, fetchImpl: FetchLike): Promise<HtmlResult> {
  const guarded = loveracingUrlOrNull(raw.toString())
  if (guarded === null) return { ok: false, reason: 'ancestor link is not an https://loveracing.nz link' }

  try {
    const response = await fetchImpl(guarded.toString(), {
      redirect: 'error',
      signal: AbortSignal.timeout(LOVERACING_TIMEOUT_MS),
      headers: { accept: 'text/html' },
    })

    if (!response.ok) {
      return { ok: false, reason: `loveracing.nz answered ${response.status}` }
    }

    return { ok: true, value: { url: withoutHash(guarded), html: await response.text() } }
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : 'the load failed' }
  }
}

function resolvedParent(
  pageUrl: URL,
  parent: LoveracingParent | null,
  side: 'sire' | 'dam',
): { ok: true; value: { parent: LoveracingParent; url: URL } } | { ok: false; reason: string } {
  if (parent === null) {
    return { ok: false, reason: `the page is missing a linked ${side} HorseID` }
  }

  let url: URL
  try {
    url = withoutHash(new URL(parent.href, pageUrl))
  } catch {
    return { ok: false, reason: `the linked ${side} HorseID is not a valid URL` }
  }

  if (loveracingUrlOrNull(url.toString()) === null) {
    return { ok: false, reason: `the linked ${side} HorseID is not hosted by loveracing.nz` }
  }

  return { ok: true, value: { parent, url } }
}

async function loadPedigree(
  root: { name: string; horseId: string; url: URL },
  rootParents: LoveracingParents,
  fetchImpl: FetchLike,
): Promise<{ ok: true; value: PedigreeSnapshot } | { ok: false; reason: string }> {
  const rootNode: PedigreeNode = {
    path: 'horse',
    generation: 0,
    name: root.name,
    horseId: root.horseId,
    sourceUrl: withoutHash(root.url).toString(),
  }

  const nodes: PedigreeNode[] = [rootNode]
  let pending: PendingNode[] = [{ node: rootNode, parents: rootParents }]

  for (let generation = 1; generation <= 3; generation += 1) {
    const children: ChildNode[] = []

    for (const branch of pending) {
      for (const side of ['sire', 'dam'] as const) {
        const resolved = resolvedParent(
          new URL(branch.node.sourceUrl),
          branch.parents[side],
          side,
        )
        if (!resolved.ok) {
          return {
            ok: false,
            reason: `pedigree generation ${generation}: ${branch.node.name}: ${resolved.reason}`,
          }
        }

        const childPath = branch.node.path === 'horse' ? side : `${branch.node.path}.${side}`
        const node: PedigreeNode = {
          path: childPath,
          generation: generation as PedigreeGeneration,
          name: resolved.value.parent.name,
          horseId: resolved.value.parent.horseId,
          sourceUrl: resolved.value.url.toString(),
        }
        nodes.push(node)
        children.push({ node, href: resolved.value.url.toString() })
      }
    }

    if (generation === 3) break

    const loaded = await Promise.all(
      children.map(async (child): Promise<{ ok: true; value: PendingNode } | { ok: false; reason: string }> => {
        const page = await fetchLoveracingHtml(new URL(child.href), fetchImpl)
        if (!page.ok) {
          return {
            ok: false,
            reason: `pedigree generation ${generation + 1}: ${child.node.name}: ${page.reason}`,
          }
        }
        return {
          ok: true,
          value: { node: child.node, parents: parseLoveracingParents(page.value.html) },
        }
      }),
    )

    const failed = loaded.find((entry) => !entry.ok)
    if (failed !== undefined && !failed.ok) return failed
    pending = loaded.flatMap((entry) => (entry.ok ? [entry.value] : []))
  }

  const snapshot: PedigreeSnapshot = {
    version: PEDIGREE_VERSION,
    source: 'loveracing_nz',
    rootHorseId: root.horseId,
    sourceUrl: withoutHash(root.url).toString(),
    retrievedAt: new Date().toISOString(),
    nodes,
  }

  if (!isCompletePedigreeSnapshot(snapshot)) {
    const present = new Set(nodes.map((node) => node.path))
    const missing = PEDIGREE_PATHS.filter((path) => !present.has(path))
    return {
      ok: false,
      reason: `pedigree is incomplete or malformed; ${pedigreeSnapshotProblem(snapshot) ?? `missing ${missing.join(', ')}`}`,
    }
  }

  return { ok: true, value: snapshot }
}

export async function loadLoveracingPage(
  raw: string,
  fetchImpl: FetchLike = curlCffiFetch,
): Promise<LoveracingLoadResult> {
  const url = loveracingUrlOrNull(raw)
  if (url === null) {
    return { ok: false, reason: 'that is not an https://loveracing.nz link' }
  }

  const horseId = loveracingIdFromUrl(url)
  if (horseId === null) {
    return { ok: false, reason: 'use a Loveracing Stud Book URL containing the horse HorseID' }
  }

  const page = await fetchLoveracingHtml(url, fetchImpl)
  if (!page.ok) return page

  const parsed = parseLoveracingPage(page.value.html, horseId)
  if (!parsed.ok) return parsed

  const [pedigree, summary] = await Promise.all([
    loadPedigree(
      {
        name: parsed.value.horse.legalName,
        horseId,
        url: page.value.url,
      },
      parsed.value.parents,
      fetchImpl,
    ),
    loadRaceSummary(horseId, fetchImpl),
  ])
  if (!pedigree.ok) return pedigree
  if (!summary.ok) return summary

  return {
    ok: true,
    value: {
      ...parsed.value,
      raceRecord: { summary: summary.value, resultLines: [] },
      pedigree: pedigree.value,
    },
  }
}
