import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

import {
  softContentProblems,
  softContentWarnings,
  type SoftContentDraft,
} from '../src/lib/softContent'

function words(count: number, prefix: string): string {
  return Array.from({ length: count }, (_, index) => `${prefix}${index + 1}`).join(' ')
}

function draft(overrides: Partial<SoftContentDraft> = {}): SoftContentDraft {
  return {
    aboutHorse: words(120, 'about'),
    racingOutlookAndPedigree: words(140, 'outlook'),
    raceExpectation: words(70, 'expectation'),
    ...overrides,
  }
}

describe('soft-content preflight', () => {
  it('accepts three plain-text blocks inside their target ranges', () => {
    expect(softContentProblems(draft())).toEqual([])
    expect(softContentWarnings(draft())).toEqual([])
  })

  it('blocks an empty horse paragraph', () => {
    expect(softContentProblems(draft({ raceExpectation: '' }))).toContain(
      'Race expectation is required.',
    )
  })

  it('blocks markdown instead of saving literal formatting characters', () => {
    expect(softContentProblems(draft({ aboutHorse: '**Mulan** is a filly.' }))).toContain(
      'About the horse must be plain text; Markdown emphasis is not allowed.',
    )
  })

  it('blocks the legal compiler banned terms', () => {
    expect(softContentProblems(draft({ aboutHorse: 'This digital token is ready.' }))).toContain(
      "About the horse uses the banned term 'digital token'.",
    )
  })

  it('warns instead of blocking when a block misses its target length', () => {
    expect(softContentProblems(draft({ aboutHorse: 'A short true paragraph.' }))).toEqual([])
    expect(softContentWarnings(draft({ aboutHorse: 'A short true paragraph.' }))).toContain(
      'About the horse is 4 words; target 100–150.',
    )
  })
})

describe('the external authoring brief', () => {
  it('ships inside the engine and names the reusable chat prompt', () => {
    const guide = readFileSync(
      new URL('../public/soft-content-guide.md', import.meta.url),
      'utf8',
    )

    expect(guide).toContain('Use this guide to help me write the soft content for')
    expect(guide).toContain('About the horse')
    expect(guide).toContain('Racing outlook and pedigree')
    expect(guide).toContain('Race expectation')
    expect(guide).toContain('Facts used')
  })
})
