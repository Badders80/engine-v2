/**
 * The legal compiler. PLAN.md step 7.
 *
 * A deterministic interpolator. It loads the two locked templates and the four
 * block files, substitutes database values for `{{tokens}}`, and returns the
 * rendered Markdown and its SHA-256. It generates no prose of its own: every
 * sentence comes from a file under `engine/src/templates/`.
 *
 * The order is the contract: validate, load, render blocks, insert, render the
 * documents, assert no braces remain, scan the rendered prose, hash.
 */

import {
  assertPaymentModelEligible,
  LEGAL_PACK_VERSION,
  resolveScalars,
  type LegalPackInput,
} from './tokens'
import {
  loadLegalCorpus,
  selectCloseFile,
  selectCostsFile,
  sha256,
  type LegalCorpus,
} from './templates'

export type LegalPack = {
  pds: { markdown: string; hash: string }
  sa: { markdown: string; hash: string }
  templateHashes: Record<string, string>
  version: string
}

/** The banned disclosures, case-insensitive, word-bounded where the term is a word. */
const BANNED_PROSE: { label: string; pattern: RegExp }[] = [
  { label: 'Tokinvest', pattern: /Tokinvest/i },
  { label: 'VARA', pattern: /\bVARA\b/i },
  { label: 'digital token', pattern: /digital\s+token/i },
  { label: 'tokenised', pattern: /\btokenis(?:ed|ing)\b/i },
  { label: 'tokens', pattern: /\btokens?\b/i },
  { label: 'Fair Value', pattern: /fair\s+value/i },
  { label: '14 business days', pattern: /\b14\s+business\s+days\b/i },
  { label: 'absorb', pattern: /\babsorb(?:ed|ing|s)?\b/i },
]

const TOKEN_PATTERN = /\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g

/**
 * Substitute one pass of `{{tokens}}`. An unknown key throws with its name; it
 * never renders an empty string into a legal document.
 */
export function render(text: string, values: Record<string, string>): string {
  return text.replace(TOKEN_PATTERN, (_match, key: string) => {
    const value = values[key]
    if (value === undefined) throw new Error(`unknown legal token: {{${key}}}`)
    return value
  })
}

function validateInput(input: LegalPackInput): number {
  const months = assertPaymentModelEligible(input)

  if (input.dsl.investorSplit === null) {
    throw new Error('missing required value for dsl.investor_split')
  }

  if (
    input.dsl.distributionSchedule === null ||
    input.dsl.distributionSchedule.trim() === ''
  ) {
    throw new Error('missing required value for dsl.distribution_schedule')
  }

  const soft: [string, string | null][] = [
    ['horse.about_horse', input.horse.aboutHorse],
    ['horse.racing_outlook_and_pedigree', input.horse.racingOutlookAndPedigree],
    ['horse.race_expectation', input.horse.raceExpectation],
    ['trainer.bio', input.trainer.bio],
  ]
  for (const [name, value] of soft) {
    if (value === null || value.trim() === '') {
      throw new Error(`missing required value for ${name}`)
    }
  }

  // Everything else the documents read is checked here, before a block renders.
  resolveScalars(input)

  return months
}

function assertNoBraces(document: string, name: string): void {
  if (document.includes('{{') || document.includes('}}')) {
    throw new Error(`${name} still carries a dangling {{ }} token`)
  }
}

function assertNoBannedProse(document: string, name: string): void {
  for (const { label, pattern } of BANNED_PROSE) {
    if (pattern.test(document)) {
      throw new Error(`${name} carries the banned term '${label}'`)
    }
  }
}

/**
 * Compile one legal pack.
 *
 * The payment-model rule is re-checked here independently of the save gate and
 * the database trigger, because a document is the last place an illegal
 * combination may surface.
 */
export function compileLegalPack(input: LegalPackInput, corpus?: LegalCorpus): LegalPack {
  validateInput(input)

  const loaded = corpus ?? loadLegalCorpus()

  const scalars = resolveScalars(input)

  const costsBlock = render(loaded.blocks[selectCostsFile(input.dsl.paymentModel)], scalars)
  const closeBlock = render(loaded.blocks[selectCloseFile(input.dsl.closeStyle)], scalars)

  const values: Record<string, string> = {
    ...scalars,
    'pds.costs_summary_block': costsBlock,
    'pds.close_style_block': closeBlock,
  }

  const pds = render(loaded.pds, values)
  const sa = render(loaded.sa, values)

  assertNoBraces(pds, 'the PDS')
  assertNoBraces(sa, 'the SA')
  assertNoBannedProse(pds, 'the PDS')
  assertNoBannedProse(sa, 'the SA')

  return {
    pds: { markdown: pds, hash: sha256(pds) },
    sa: { markdown: sa, hash: sha256(sa) },
    templateHashes: { ...loaded.hashes },
    version: LEGAL_PACK_VERSION,
  }
}
