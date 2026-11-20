export type BannedProseRule = {
  label: string
  pattern: RegExp
}

/** The banned disclosures shared by legal compilation and soft-content preflight. */
export const BANNED_PROSE: readonly BannedProseRule[] = [
  { label: 'Tokinvest', pattern: /Tokinvest/i },
  { label: 'VARA', pattern: /\bVARA\b/i },
  { label: 'digital token', pattern: /digital\s+token/i },
  { label: 'tokenised', pattern: /\btokenis(?:ed|ing)\b/i },
  { label: 'tokens', pattern: /\btokens?\b/i },
  { label: 'Fair Value', pattern: /fair\s+value/i },
  { label: '14 business days', pattern: /\b14\s+business\s+days\b/i },
  { label: 'absorb', pattern: /\babsorb(?:ed|ing|s)?\b/i },
]

export function bannedProseTerm(text: string): string | null {
  return BANNED_PROSE.find((rule) => rule.pattern.test(text))?.label ?? null
}
