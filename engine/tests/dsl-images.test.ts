/**
 * The image path is wired to Records. Ruling 26 (2026-11-10): images never
 * block a listing, are authored on the horse profile, and flow through to the
 * DSL and the public card. The public card falls back to a placeholder.
 *
 * The app layer has no unit tests in this repo — it is the thin wrapper and the
 * pure decisions live in `lib/`. What can be pinned is the wiring itself, in the
 * same way `structure.test.ts` pins the shape of the tree.
 */

import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const ACTIONS = new URL('../src/app/dsl/actions.ts', import.meta.url)
const DETAIL = new URL('../src/app/dsl/[id]/page.tsx', import.meta.url)
const HORSE = new URL('../src/app/horses/[id]/page.tsx', import.meta.url)
const EDITOR = new URL('../src/app/horses/[id]/ImageOrderEditor.tsx', import.meta.url)

const actions = readFileSync(ACTIONS, 'utf8')
const detail = readFileSync(DETAIL, 'utf8')
const horse = readFileSync(HORSE, 'utf8')
const editor = readFileSync(EDITOR, 'utf8')

describe('the upload action exists and goes through the storage module', () => {
  it('exports the action Records posts to', () => {
    expect(actions).toMatch(/export async function uploadHorseImageAction\(/)
  })

  it('imports the R2 upload rather than re-implementing it', () => {
    expect(actions).toMatch(/from '@\/lib\/storage'/)
    expect(actions).toMatch(/uploadPublicImage\(/)
  })

  it('hands the upload a slug and a number, never a caller-supplied key', () => {
    const call = actions.slice(actions.indexOf('await uploadPublicImage({'))
    const args = call.slice(0, call.indexOf('})'))
    expect(args).toMatch(/slug: horse\.slug/)
    expect(args).toMatch(/imageNumber/)
    expect(args).not.toMatch(/\bkey:/)
  })

  it('persists the count and reconciled display order on the horse', () => {
    expect(actions).toMatch(/imageCount: images\.length/)
    expect(actions).toMatch(/imageOrder: effectiveImageOrder\(horse\.imageOrder, images\.length\)/)
  })
})

describe('the horse Records page carries the controls', () => {
  it('posts upload and recount, and mounts the image editor', () => {
    expect(horse).toMatch(/action=\{uploadHorseImageAction\}/)
    expect(horse).toMatch(/action=\{recountHorseImagesAction\}/)
    expect(horse).toMatch(/<ImageOrderEditor/)
  })

  it('sends the horse id and accepts only images', () => {
    expect(horse).toMatch(/name="horseId"/)
    expect(horse).toMatch(/type="file" accept="image\/\*"/)
  })

  it('edits image positions by drag and by accessible arrow controls', () => {
    expect(editor).toMatch(/Edit positions/)
    expect(editor).toMatch(/draggable=\{editing\}/)
    expect(editor).toMatch(/Move image \$\{image\.number\} earlier/)
    expect(editor).toMatch(/Move image \$\{image\.number\} later/)
  })

  it('saves the repeated order fields and still posts deletion', () => {
    expect(editor).toMatch(/action=\{saveHorseImageOrderAction\}/)
    expect(editor).toMatch(/name="order"/)
    expect(editor).toMatch(/action=\{deleteHorseImageAction\}/)
  })

  it('disables colour transitions when reduced motion is requested', () => {
    expect(editor).toMatch(/motion-reduce:transition-none/)
  })
})

describe('the DSL detail page is read-only for images', () => {
  it('does not post an upload form', () => {
    expect(detail).not.toMatch(/<form action=\{uploadHorseImageAction\}/)
  })

  it('links to the horse profile and says images never block', () => {
    expect(detail).toMatch(/Manage images on the horse profile/)
    expect(detail).toMatch(/never block a listing/)
  })
})
