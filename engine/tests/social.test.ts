import { describe, expect, it } from 'vitest'

import { socialHandle } from '../src/lib/social'

describe('socialHandle', () => {
  it('reduces an X profile to its handle', () => {
    expect(socialHandle('https://x.com/copperbelt_stc')).toBe('@copperbelt_stc')
    expect(socialHandle('https://twitter.com/stephengrayracing')).toBe('@stephengrayracing')
  })

  it('reduces Instagram and Facebook profiles the same way', () => {
    expect(socialHandle('https://www.instagram.com/copperbelt_stc/')).toBe('@copperbelt_stc')
    expect(socialHandle('https://facebook.com/stephengrayracing')).toBe('@stephengrayracing')
  })

  it('drops query strings and keeps a bare handle as typed', () => {
    expect(socialHandle('https://x.com/copperbelt_stc?lang=en')).toBe('@copperbelt_stc')
    expect(socialHandle('@copperbelt_stc')).toBe('@copperbelt_stc')
  })
})
