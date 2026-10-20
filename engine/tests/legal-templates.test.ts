/**
 * The legal corpus and its token contract. PLAN.md step 7.
 *
 * The two templates are the document authority. The four block files hold the
 * branch text. Every legal sentence lives under `engine/src/templates/`, and
 * every `{{token}}` in that corpus resolves from one declared key list.
 */

import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import {
  BLOCK_FILES,
  CORPUS_FILES,
  loadLegalCorpus,
  selectCloseFile,
  selectCostsFile,
  sha256,
  tokensIn,
} from '../src/lib/legal/templates'
import { BLOCK_KEYS, SOFT_TOKEN_KEYS, TOKEN_KEYS } from '../src/lib/legal/tokens'

const REPO = new URL('../../', import.meta.url)
const PREVIEW = new URL('../src/app/dsl/[id]/legal/page.tsx', import.meta.url)

const corpus = loadLegalCorpus()

describe('the six legal prose files exist and load', () => {
  it('loads the two templates and the four block files', () => {
    expect(CORPUS_FILES).toHaveLength(6)
    expect(corpus.pds.length).toBeGreaterThan(1000)
    expect(corpus.sa.length).toBeGreaterThan(1000)
    expect(Object.keys(corpus.blocks)).toHaveLength(6)
  })

  it('selects every branch to a file that exists in the corpus', () => {
    expect(selectCostsFile('subscription_float')).toBe(
      BLOCK_FILES['pds.costs_summary_block'].subscription_float,
    )
    expect(selectCostsFile('upfront')).toBe(BLOCK_FILES['pds.costs_summary_block'].upfront)
    expect(selectCloseFile('fourteen_day')).toBe(
      BLOCK_FILES['pds.close_style_block'].fourteen_day,
    )
    expect(selectCloseFile('three_x_remaining')).toBe(
      BLOCK_FILES['pds.close_style_block'].three_x_remaining,
    )
    for (const file of [
      selectCostsFile('subscription_float'),
      selectCostsFile('upfront'),
      selectCloseFile('fourteen_day'),
      selectCloseFile('three_x_remaining'),
    ]) {
      expect(corpus.blocks[file]).toBeTypeOf('string')
    }
  })

  it('throws on an unknown branch rather than defaulting', () => {
    // The cast stands for a form value that reached the compiler unchecked.
    expect(() => selectCostsFile('monthly' as never)).toThrow(/unknown payment model/)
    expect(() => selectCloseFile('thirty_day' as never)).toThrow(/unknown close style/)
  })
})

describe('the pinned hashes match the prose on disk', () => {
  it('verifies every line of SHA256SUMS', () => {
    const manifest = readFileSync(
      new URL('engine/src/templates/SHA256SUMS', REPO),
      'utf8',
    )
      .split('\n')
      .filter((line) => line.trim() !== '')

    expect(manifest).toHaveLength(6)

    for (const line of manifest) {
      const match = /^([0-9a-f]{64})\s+(.+)$/.exec(line)
      expect(match).not.toBeNull()
      if (match === null) continue

      const [, pinned, path] = match
      const text = readFileSync(new URL(path, REPO), 'utf8')
      expect(sha256(text), path).toBe(pinned)
    }
  })
})

describe('the token contract holds over the whole corpus', () => {
  it('has no token outside the declared union', () => {
    const text = [corpus.pds, corpus.sa, ...Object.values(corpus.blocks)].join('\n')
    const unknown = tokensIn(text).filter(
      (token) => !(TOKEN_KEYS as readonly string[]).includes(token),
    )
    expect(unknown).toEqual([])
  })

  it('leaves no declared key without a call site', () => {
    const text = [corpus.pds, corpus.sa, ...Object.values(corpus.blocks)].join('\n')
    const present = new Set(tokensIn(text))
    const orphans = TOKEN_KEYS.filter((key) => !present.has(key))
    expect(orphans).toEqual([])
  })

  it('declares the two block tokens and no third', () => {
    expect([...BLOCK_KEYS]).toEqual(['pds.costs_summary_block', 'pds.close_style_block'])
  })

  it('balances the braces in every file', () => {
    for (const text of [corpus.pds, corpus.sa, ...Object.values(corpus.blocks)]) {
      expect(text.split('{{').length).toBe(text.split('}}').length)
    }
  })
})

describe('the soft slots belong to the PDS alone', () => {
  it('gives the SA none of the four', () => {
    const saTokens = new Set(tokensIn(corpus.sa))
    for (const soft of SOFT_TOKEN_KEYS) {
      expect(saTokens.has(soft), soft).toBe(false)
    }
  })

  it('gives the PDS all four', () => {
    const pdsTokens = new Set(tokensIn(corpus.pds))
    for (const soft of SOFT_TOKEN_KEYS) {
      expect(pdsTokens.has(soft), soft).toBe(true)
    }
  })

  it('refuses a corpus that breaks either side', () => {
    // The loader is the gate. These two lines are the assertions it makes.
    expect(() => loadLegalCorpus()).not.toThrow()
    expect(tokensIn(corpus.sa)).not.toContain('trainer.bio')
    expect(tokensIn(corpus.pds)).toContain('trainer.bio')
  })
})

describe('the raw corpus carries no banned term', () => {
  const banned = [
    /Tokinvest/i,
    /\bVARA\b/i,
    /digital\s+token/i,
    /\btokenis(?:ed|ing)\b/i,
    /\btokens?\b/i,
    /fair\s+value/i,
    /\b14\s+business\s+days\b/i,
    /\babsorb(?:ed|ing|s)?\b/i,
  ]

  it('passes on every file', () => {
    for (const [name, text] of [
      ['PDS', corpus.pds],
      ['SA', corpus.sa],
      ...Object.entries(corpus.blocks),
    ] as const) {
      for (const pattern of banned) {
        expect(pattern.test(text), `${name} matched ${pattern}`).toBe(false)
      }
    }
  })
})

describe('the preview page is the compiler call site', () => {
  it('imports compileLegalPack and calls it', () => {
    const page = readFileSync(PREVIEW, 'utf8')
    expect(page).toMatch(/from '@\/lib\/legal\/compile'/)
    expect(page).toMatch(/compileLegalPack\(/)
  })

  it('loads the DSL through the existing view loader', () => {
    const page = readFileSync(PREVIEW, 'utf8')
    expect(page).toMatch(/loadDslView\(/)
  })

  it('writes no sale row and creates no PDF', () => {
    // Comments document the fence; the assertion is about the code.
    const code = readFileSync(PREVIEW, 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*$/gm, '')
    expect(code).not.toMatch(/\binsertSale\b|\bsales\b.*\binsert\b/)
    expect(code).not.toMatch(/\bpdf\b/i)
  })
})
