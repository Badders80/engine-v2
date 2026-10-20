/**
 * The legal corpus: two templates, four block files, one loader.
 * PLAN.md step 7.
 *
 * The loader reads the six files from disk, hashes each one, and refuses a
 * corpus that breaks the token contract. It selects a block by branch and
 * throws on an unknown branch: there is no silent default.
 *
 * Every legal sentence lives in these files. Nothing in TypeScript generates,
 * paraphrases, or improves prose.
 */

import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { SOFT_TOKEN_KEYS, TOKEN_KEYS } from './tokens'

import type { CloseStyle, PaymentModel } from '../dslStore'

/** Resolved from the engine app root, where `next dev`, `next build`, and the tests run. */
export const LEGAL_DIR = join(process.cwd(), 'src/templates')

export const TEMPLATE_FILES = {
  pds: 'PDS.template.md',
  sa: 'SA.template.md',
} as const

export const BLOCK_FILES = {
  'pds.costs_summary_block': {
    subscription_float: 'blocks/pds-costs-summary.float.md',
    upfront: 'blocks/pds-costs-summary.upfront.md',
  },
  'pds.close_style_block': {
    fourteen_day: 'blocks/pds-close-style.fourteen-day.md',
    three_x_remaining: 'blocks/pds-close-style.three-x-remaining.md',
  },
} as const

/** The six legal-prose files, relative to `engine/src/templates/`. */
export const CORPUS_FILES = [
  TEMPLATE_FILES.pds,
  TEMPLATE_FILES.sa,
  BLOCK_FILES['pds.costs_summary_block'].subscription_float,
  BLOCK_FILES['pds.costs_summary_block'].upfront,
  BLOCK_FILES['pds.close_style_block'].fourteen_day,
  BLOCK_FILES['pds.close_style_block'].three_x_remaining,
] as const

export type LegalCorpus = {
  pds: string
  sa: string
  /** Raw block text, keyed by its path under `src/templates/`. */
  blocks: Record<string, string>
  /** SHA-256 per file, keyed by its path under `src/templates/`. */
  hashes: Record<string, string>
}

export function sha256(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex')
}

/** Every `{{token}}` in a piece of text, in the order it appears. */
export function tokensIn(text: string): string[] {
  return [...text.matchAll(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g)].map((match) => match[1])
}

function readCorpusFile(dir: string, relative: string): string {
  try {
    return readFileSync(join(dir, relative), 'utf8')
  } catch {
    throw new Error(`missing legal prose file: ${relative}`)
  }
}

/**
 * Read the corpus and hold it to the token contract.
 *
 * The four soft slots are the PDS's own: the SA must carry none of them, and
 * the PDS must carry all four, so an operator cannot publish an agreement with
 * an empty about-the-horse paragraph.
 */
export function loadLegalCorpus(dir: string = LEGAL_DIR): LegalCorpus {
  const sa = readCorpusFile(dir, TEMPLATE_FILES.sa)
  const pds = readCorpusFile(dir, TEMPLATE_FILES.pds)

  const blocks: Record<string, string> = {}
  const hashes: Record<string, string> = {}
  for (const relative of CORPUS_FILES) {
    const text = readCorpusFile(dir, relative)
    blocks[relative] = text
    hashes[relative] = sha256(text)
  }

  const saTokens = tokensIn(sa)
  const pdsTokens = tokensIn(pds)
  const corpusText = [`${pds}\n${sa}`, ...Object.values(blocks)].join('\n')
  const corpusTokens = tokensIn(corpusText)

  for (const soft of SOFT_TOKEN_KEYS) {
    if (saTokens.includes(soft)) {
      throw new Error(`the SA must carry no soft slot, but it carries {{${soft}}}`)
    }
    if (!pdsTokens.includes(soft)) {
      throw new Error(`the PDS must carry the soft slot {{${soft}}}`)
    }
  }

  const known = new Set<string>(TOKEN_KEYS)
  for (const token of corpusTokens) {
    if (!known.has(token)) {
      throw new Error(`the legal corpus carries an unknown token: {{${token}}}`)
    }
  }

  for (const key of TOKEN_KEYS) {
    if (!corpusTokens.includes(key)) {
      throw new Error(`the token {{${key}}} has no call site in the legal corpus`)
    }
  }

  for (const [name, text] of [
    ['PDS', pds],
    ['SA', sa],
    ...Object.entries(blocks),
  ] as const) {
    if (count(text, '{{') !== count(text, '}}')) {
      throw new Error(`${name} has unbalanced {{ }} braces`)
    }
  }

  return { pds, sa, blocks, hashes }
}

function count(text: string, needle: string): number {
  return text.split(needle).length - 1
}

/** The costs block for the payment model. An unknown branch is a defect. */
export function selectCostsFile(paymentModel: PaymentModel): string {
  const branch = BLOCK_FILES['pds.costs_summary_block']
  if (paymentModel === 'subscription_float') return branch.subscription_float
  if (paymentModel === 'upfront') return branch.upfront
  throw new Error(`unknown payment model: ${String(paymentModel)}`)
}

/** The exit-paragraph block for the close style. An unknown branch is a defect. */
export function selectCloseFile(closeStyle: CloseStyle): string {
  const branch = BLOCK_FILES['pds.close_style_block']
  if (closeStyle === 'fourteen_day') return branch.fourteen_day
  if (closeStyle === 'three_x_remaining') return branch.three_x_remaining
  throw new Error(`unknown close style: ${String(closeStyle)}`)
}
