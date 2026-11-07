'use server'

/**
 * Create and edit for the three static records. DSL engine decision 2026-11-07.
 *
 * These are the only places a trainer or an owner is authored now. The DSL
 * form attaches an existing row by id; it no longer invents one, which is what
 * made the old natural-key lookup drop edits and orphan rows when a stable or
 * entity was renamed.
 *
 * A horse is still authored through the DSL page, because a horse without a
 * DSL has no listing to attach and no page of its own in this section yet.
 */

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { recordStore } from './store'

function value(form: FormData, key: string): string {
  const raw = form.get(key)
  return typeof raw === 'string' ? raw.trim() : ''
}

function optional(form: FormData, key: string): string | null {
  const raw = value(form, key)
  return raw === '' ? null : raw
}

export async function createTrainerAction(form: FormData): Promise<void> {
  const created = await recordStore().insertTrainer({
    name: value(form, 'name'),
    stable: value(form, 'stable'),
    location: value(form, 'location'),
    website: optional(form, 'website'),
    bio: optional(form, 'bio'),
  })

  revalidatePath('/trainers')
  redirect(`/trainers/${created.id}`)
}

export async function updateTrainerAction(form: FormData): Promise<void> {
  const id = value(form, 'id')

  await recordStore().updateTrainer(id, {
    name: value(form, 'name'),
    stable: value(form, 'stable'),
    location: value(form, 'location'),
    website: optional(form, 'website'),
    bio: optional(form, 'bio'),
  })

  revalidatePath('/trainers')
  revalidatePath(`/trainers/${id}`)
  redirect(`/trainers/${id}`)
}

export async function createOwnerAction(form: FormData): Promise<void> {
  const created = await recordStore().insertOwner({
    entity: value(form, 'entity'),
    contact: value(form, 'contact'),
    website: optional(form, 'website'),
    profile: optional(form, 'profile'),
  })

  revalidatePath('/owners')
  redirect(`/owners/${created.id}`)
}

export async function updateOwnerAction(form: FormData): Promise<void> {
  const id = value(form, 'id')

  await recordStore().updateOwner(id, {
    entity: value(form, 'entity'),
    contact: value(form, 'contact'),
    website: optional(form, 'website'),
    profile: optional(form, 'profile'),
  })

  revalidatePath('/owners')
  revalidatePath(`/owners/${id}`)
  redirect(`/owners/${id}`)
}
