/**
 * The image path is wired to the operator surface. PLAN.md step 5, and the
 * 00008 trigger.
 *
 * Step 5 shipped `storage.ts` as a tested island: nothing in `app/dsl/` imported
 * it, so no operator could add an image, so `image_count` could never reach the
 * three that `00008_dsl_availability_trigger.sql:54` demands, so no listing could
 * ever be published at `available`.
 *
 * The app layer has no unit tests in this repo — it is the thin wrapper and the
 * pure decisions live in `lib/`. What can be pinned is the wiring itself, in the
 * same way `structure.test.ts` pins the shape of the tree. These assertions fail
 * if the island is cut loose again.
 */

import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

import { MIN_IMAGES_FOR_AVAILABLE } from '../src/lib/storage'

const ACTIONS = new URL('../src/app/dsl/actions.ts', import.meta.url)
const DETAIL = new URL('../src/app/dsl/[id]/page.tsx', import.meta.url)

const actions = readFileSync(ACTIONS, 'utf8')
const detail = readFileSync(DETAIL, 'utf8')

describe('the upload action exists and goes through the storage module', () => {
  it('exports the action the detail page posts to', () => {
    expect(actions).toMatch(/export async function uploadHorseImageAction\(/)
  })

  it('imports the R2 upload rather than re-implementing it', () => {
    expect(actions).toMatch(/from '@\/lib\/storage'/)
    expect(actions).toMatch(/uploadPublicImage\(/)
  })

  it('hands the upload a slug and a number, never a caller-supplied key', () => {
    // storage.ts builds the key itself. A `key` argument here would mean the
    // page could name a path, which is what keeps KYC material off the bucket.
    const call = actions.slice(actions.indexOf('await uploadPublicImage({'))
    const args = call.slice(0, call.indexOf('})'))
    expect(args).toMatch(/slug: horse\.slug/)
    expect(args).toMatch(/imageNumber/)
    expect(args).not.toMatch(/\bkey:/)
  })

  it('persists the advanced count on the horse', () => {
    expect(actions).toMatch(/updateHorse\(horse\.id, \{ imageCount: imageNumber \}\)/)
  })
})

describe('the detail page carries the control', () => {
  it('posts the form to the upload action', () => {
    expect(detail).toMatch(/import \{ uploadHorseImageAction \} from '\.\.\/actions'/)
    expect(detail).toMatch(/<form action=\{uploadHorseImageAction\}>/)
  })

  it('sends the dsl id and accepts only images', () => {
    expect(detail).toMatch(/name="dslId"/)
    expect(detail).toMatch(/type="file" accept="image\/\*"/)
  })

  it('states the three-image requirement the trigger enforces', () => {
    expect(MIN_IMAGES_FOR_AVAILABLE).toBe(3)
    expect(detail).toMatch(/MIN_IMAGES_FOR_AVAILABLE/)
  })
})
