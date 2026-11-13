import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { getHorsePageFixture } from '../src/lib/horsePageFixture'

const APP_ROOT = fileURLToPath(new URL('..', import.meta.url))
const read = (path: string) => readFileSync(resolve(APP_ROOT, path), 'utf8')

describe('the horse-page visual fixture', () => {
  it('provides the Mulan campaign and all three gallery images', () => {
    const horse = getHorsePageFixture('mulan-the-brave')

    expect(horse?.legalName).toBe('Mulan The Brave (NZ)')
    expect(horse?.status).toBe('available')
    expect(horse?.gallery).toHaveLength(3)
    expect(horse?.facts.map((fact) => fact.label)).toEqual(['Age', 'Sex', 'Colour', 'Sire', 'Dam'])
  })

  it('keeps the public offer to commercial terms, not order-book internals', () => {
    const horse = getHorsePageFixture('mulan-the-brave')
    const offer = horse?.offer
    const publicOffer = JSON.stringify(offer)

    expect(offer?.price).toBe('$65')
    expect(offer?.investorReturn).toBe('75%')
    expect(offer?.expiry).toBe('Jun 2028')
    expect(publicOffer).not.toMatch(/minimum|step|close style|payment model|remaining/i)
  })

  it('renders one horse heading and keeps the fixture behind the explicit switch', () => {
    const page = read('src/components/HorseFixturePage.tsx')
    const route = read('src/app/marketplace/[slug]/page.tsx')

    expect(page.match(/<h1\b/g)).toHaveLength(1)
    expect(route).toContain("process.env.WEBSITE_MARKETPLACE_FIXTURE === 'true'")
    expect(route).toContain('HorseFixturePage')
  })
})
