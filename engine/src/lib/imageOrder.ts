/**
 * The operator-controlled display order for a horse's public images.
 *
 * R2 keys stay in their upload order (`01..NN`). This vector stores those image
 * numbers in display order, so changing the cover never renames or copies an
 * object. The first number is the cover image; the rest form the gallery.
 */

function assertImageCount(imageCount: number): void {
  if (!Number.isInteger(imageCount) || imageCount < 0) {
    throw new Error(`image count must be a whole number from 0 upward (received ${String(imageCount)})`)
  }
}

/** The natural display order used before an operator saves a custom order. */
export function naturalImageOrder(imageCount: number): number[] {
  assertImageCount(imageCount)
  return Array.from({ length: imageCount }, (_, index) => index + 1)
}

/**
 * The order to render, reconciled against the images the bucket currently has.
 *
 * A valid saved prefix is kept, invalid or repeated entries are discarded, and
 * any image missing from the vector is appended in natural order. This makes
 * uploads safe without a second write and keeps old rows working with the empty
 * default.
 */
export function effectiveImageOrder(
  order: readonly number[] | null | undefined,
  imageCount: number,
): number[] {
  assertImageCount(imageCount)

  const seen = new Set<number>()
  const result: number[] = []

  for (const imageNumber of order ?? []) {
    if (
      Number.isInteger(imageNumber) &&
      imageNumber >= 1 &&
      imageNumber <= imageCount &&
      !seen.has(imageNumber)
    ) {
      seen.add(imageNumber)
      result.push(imageNumber)
    }
  }

  for (const imageNumber of naturalImageOrder(imageCount)) {
    if (!seen.has(imageNumber)) result.push(imageNumber)
  }

  return result
}

/**
 * Validate an operator-submitted order. It must name every current image once.
 */
export function imageOrderError(order: readonly unknown[], imageCount: number): string | null {
  assertImageCount(imageCount)

  if (!order.every((value) => Number.isInteger(value))) {
    return 'image order must contain whole numbers'
  }
  if (order.some((value) => (value as number) < 1 || (value as number) > imageCount)) {
    return 'image order contains an image outside the current bucket run'
  }
  if (new Set(order).size !== order.length) {
    return 'image order cannot contain a repeated image'
  }
  if (order.length !== imageCount) {
    return 'image order must include every image exactly once'
  }

  return null
}

/**
 * Keep the operator's relative order after removal renumbers the bucket run.
 * Images after the deleted one move down by one; the deleted image is dropped.
 */
export function remapImageOrderAfterDelete(
  order: readonly number[] | null | undefined,
  imageCount: number,
  deletedImageNumber: number,
): number[] {
  if (!Number.isInteger(deletedImageNumber) || deletedImageNumber < 1) {
    throw new Error('deleted image number must be a whole number from 1 upward')
  }

  const current = effectiveImageOrder(order, imageCount)
  return current
    .filter((imageNumber) => imageNumber !== deletedImageNumber)
    .map((imageNumber) => (imageNumber > deletedImageNumber ? imageNumber - 1 : imageNumber))
}
