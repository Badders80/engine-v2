import { bannedProseTerm } from './bannedProse'

export type SoftContentDraft = {
  aboutHorse: string
  racingOutlookAndPedigree: string
  raceExpectation: string
}

const SECTIONS = [
  {
    key: 'aboutHorse',
    label: 'About the horse',
    min: 100,
    max: 150,
  },
  {
    key: 'racingOutlookAndPedigree',
    label: 'Racing outlook and pedigree',
    min: 120,
    max: 170,
  },
  {
    key: 'raceExpectation',
    label: 'Race expectation',
    min: 50,
    max: 90,
  },
] as const

const MARKDOWN_RULES = [
  { label: 'a heading', pattern: /^\s{0,3}#{1,6}\s/m },
  { label: 'a bullet list', pattern: /^\s{0,3}[-*+]\s/m },
  { label: 'a numbered list', pattern: /^\s{0,3}\d+[.)]\s/m },
  { label: 'emphasis', pattern: /\*\*|__|`/ },
  { label: 'a link', pattern: /\[[^\]]+\]\([^)]+\)/ },
] as const

function markdownProblem(text: string): string | null {
  return MARKDOWN_RULES.find((rule) => rule.pattern.test(text))?.label ?? null
}

function wordCount(text: string): number {
  const trimmed = text.trim()
  return trimmed === '' ? 0 : trimmed.split(/\s+/).length
}

/** Hard failures that must stop a save before unapproved prose reaches the database. */
export function softContentProblems(input: SoftContentDraft): string[] {
  const problems: string[] = []

  for (const section of SECTIONS) {
    const text = input[section.key]
    if (text.trim() === '') {
      problems.push(`${section.label} is required.`)
      continue
    }

    const markdown = markdownProblem(text)
    if (markdown !== null) {
      problems.push(`${section.label} must be plain text; Markdown ${markdown} is not allowed.`)
    }

    const banned = bannedProseTerm(text)
    if (banned !== null) {
      problems.push(`${section.label} uses the banned term '${banned}'.`)
    }
  }

  return problems
}

/** Length is guidance, not a save gate. A short true paragraph can be correct. */
export function softContentWarnings(input: SoftContentDraft): string[] {
  const warnings: string[] = []

  for (const section of SECTIONS) {
    const count = wordCount(input[section.key])
    if (count > 0 && (count < section.min || count > section.max)) {
      warnings.push(`${section.label} is ${count} words; target ${section.min}–${section.max}.`)
    }
  }

  return warnings
}
