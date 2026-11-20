import { describe, expect, it } from 'vitest'

import {
  effectiveImageOrder,
  imageOrderError,
  remapImageOrderAfterDelete,
} from '../src/lib/imageOrder'

describe('the horse image order', () => {
  it('uses natural order when no order has been saved', () => {
    expect(effectiveImageOrder([], 5)).toEqual([1, 2, 3, 4, 5])
    expect(effectiveImageOrder(undefined, 3)).toEqual([1, 2, 3])
  })

  it('keeps a complete saved order, whose first image is the cover', () => {
    expect(effectiveImageOrder([3, 1, 5, 2, 4], 5)).toEqual([3, 1, 5, 2, 4])
  })

  it('keeps valid entries and appends newly uploaded images', () => {
    expect(effectiveImageOrder([3, 1], 5)).toEqual([3, 1, 2, 4, 5])
    expect(effectiveImageOrder([99, 2, 2, 0], 3)).toEqual([2, 1, 3])
  })

  it('accepts exactly one of every available image', () => {
    expect(imageOrderError([3, 1, 2], 3)).toBeNull()
    expect(imageOrderError([], 0)).toBeNull()
  })

  it('rejects missing, repeated, out-of-range and non-integer images', () => {
    expect(imageOrderError([1, 2], 3)).toMatch(/every image/)
    expect(imageOrderError([1, 1, 3], 3)).toMatch(/repeated/)
    expect(imageOrderError([1, 2, 4], 3)).toMatch(/outside/)
    expect(imageOrderError([1, 2, 2.5], 3)).toMatch(/whole numbers/)
  })

  it('remaps the saved order when deleting an image closes the bucket gap', () => {
    expect(remapImageOrderAfterDelete([3, 1, 5, 2, 4], 5, 2)).toEqual([2, 1, 4, 3])
    expect(remapImageOrderAfterDelete([1, 2, 3], 3, 1)).toEqual([1, 2])
  })
})
