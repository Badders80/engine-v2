import { describe, expect, it } from 'vitest'

import { dslLifecycle, dslLifecycleLabel } from '../src/lib/dslLifecycle'

describe('DSL lifecycle', () => {
  it('starts as a DSL while unpublished', () => {
    expect(dslLifecycle({ published: false, hasExecutedSale: false })).toBe('dsl')
  })

  it('becomes a Published DSL when it goes live', () => {
    expect(dslLifecycle({ published: true, hasExecutedSale: false })).toBe('published_dsl')
  })

  it('becomes an Executed DSL once one investment writes a sale', () => {
    expect(dslLifecycle({ published: true, hasExecutedSale: true })).toBe('executed_dsl')
  })

  it('keeps the Executed DSL label after a taken-down listing', () => {
    expect(dslLifecycle({ published: false, hasExecutedSale: true })).toBe('executed_dsl')
  })

  it.each([
    ['dsl', 'DSL'],
    ['published_dsl', 'Published DSL'],
    ['executed_dsl', 'Executed DSL'],
  ] as const)('labels %s as %s', (lifecycle, label) => {
    expect(dslLifecycleLabel(lifecycle)).toBe(label)
  })
})
