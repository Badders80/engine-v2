/**
 * The horse gallery's display slots. Chunk 4 follow-on: images never block a
 * listing (ruling 26), so a horse with fewer than three photos still renders a
 * full gallery. Missing slots use the branded placeholder; `image_count` stays
 * truthful, which is what tells the operator a photo is still missing.
 */

import { HORSE_IMAGE_SLOTS } from './storage'

export const PLACEHOLDER_IMAGE = '/brand/coming-soon.jpg'

export type GalleryImage = {
  key: string
  number: number
  url: string
}

export type GallerySlot = GalleryImage & {
  placeholder: boolean
}

export function gallerySlots(
  images: readonly GalleryImage[],
  slots: number = HORSE_IMAGE_SLOTS,
): GallerySlot[] {
  return Array.from({ length: slots }, (_, index) => {
    const number = index + 1
    const image = images[index]
    return image === undefined
      ? {
          key: `placeholder-${String(number)}`,
          number,
          url: PLACEHOLDER_IMAGE,
          placeholder: true,
        }
      : { ...image, placeholder: false }
  })
}
