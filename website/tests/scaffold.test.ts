import { describe, expect, it } from 'vitest'

import nextConfig from '../next.config'

describe('website scaffold', () => {
  it('exposes a Next.js config object', () => {
    expect(typeof nextConfig).toBe('object')
    expect(nextConfig.reactStrictMode).toBe(true)
  })
})
