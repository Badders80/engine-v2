/**
 * Horse slugs, per `engine/SSOT/doc/HORSE-IDENTITY-NAMING-LAW.md` §2 (locked
 * 2026-09-16): the slug is the official NZTR name kebab-cased, the country
 * suffix is dropped, one word stays one word, and an unnamed horse is keyed
 * `sire-x-dam-yr` with the year required.
 */

import { describe, expect, it } from 'vitest'

import { slugFromLegalName, slugFromUnnamed } from '../src/lib/dsl'

describe('a named horse', () => {
  it('drops the parenthetical country suffix', () => {
    expect(slugFromLegalName('Mulan The Brave (NZ)')).toBe('mulan-the-brave')
    expect(slugFromLegalName('Lady Ketchikan (NZ)')).toBe('lady-ketchikan')
  })

  it('keeps one word as one word', () => {
    expect(slugFromLegalName('Hottathanafantasy')).toBe('hottathanafantasy')
  })

  it('kebab-cases the spaces', () => {
    expect(slugFromLegalName('I Stole A Manolo')).toBe('i-stole-a-manolo')
  })
})

describe('an unnamed horse', () => {
  it('is keyed sire-x-dam-yr, never an abbreviation', () => {
    expect(slugFromUnnamed('Turn Me Loose (NZ)', 'Yearn (NZ)', '2023')).toBe(
      'turn-me-loose-x-yearn-2023',
    )
  })

  it('refuses without a year', () => {
    expect(slugFromUnnamed('Turn Me Loose', 'Yearn', '')).toBe('')
    expect(slugFromUnnamed('Turn Me Loose', 'Yearn', 'soon')).toBe('')
  })

  it('refuses without a sire or a dam', () => {
    expect(slugFromUnnamed('', 'Yearn', '2023')).toBe('')
    expect(slugFromUnnamed('Turn Me Loose', '', '2023')).toBe('')
  })
})
