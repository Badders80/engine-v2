import { describe, expect, it } from 'vitest'

import { gallerySlots, PLACEHOLDER_IMAGE } from '../src/lib/gallery'

const real = (number: number) => ({
  key: `horse/${String(number)}`,
  number,
  url: `https://img.example/horse/${String(number)}.jpg`,
})

describe('gallerySlots — the display target fills with placeholders', () => {
  it('returns three placeholder slots when the horse has no images', () => {
    const slots = gallerySlots([])
    expect(slots).toHaveLength(3)
    expect(slots.every((slot) => slot.placeholder)).toBe(true)
    expect(slots.every((slot) => slot.url === PLACEHOLDER_IMAGE)).toBe(true)
    expect(slots.map((slot) => slot.number)).toEqual([1, 2, 3])
  })

  it('keeps real images in order and fills the rest', () => {
    const slots = gallerySlots([real(1)])
    expect(slots[0]).toMatchObject({ number: 1, placeholder: false })
    expect(slots[1]).toMatchObject({ number: 2, placeholder: true })
    expect(slots[2]).toMatchObject({ number: 3, placeholder: true })
  })

  it('shows no placeholder when the horse holds the full target', () => {
    const slots = gallerySlots([real(1), real(2), real(3)])
    expect(slots.every((slot) => !slot.placeholder)).toBe(true)
  })
})
