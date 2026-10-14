/**
 * Loading a DSL for the view and edit pages. PLAN.md step 4.
 *
 * The store throws when the environment has no credentials, and this returns the
 * reason instead, so the page can say what is missing rather than showing a
 * stack trace. `notFound()` is called by the page, outside this function, so
 * nothing here swallows a control-flow error.
 */

import type { DslRow, HorseRow, OwnerRow, TrainerRow } from '@/lib/dslStore'
import { createSupabaseDslStore, supabaseClientFromEnv } from '@/lib/dslStoreSupabase'

export type DslView =
  | {
      ok: true
      found: true
      dsl: DslRow
      horse: HorseRow
      trainer: TrainerRow | null
      owner: OwnerRow | null
    }
  | { ok: true; found: false }
  | { ok: false; reason: string }

export async function loadDslView(id: string): Promise<DslView> {
  try {
    const store = createSupabaseDslStore(supabaseClientFromEnv())

    const dsl = await store.findDslById(id)
    if (dsl === null) return { ok: true, found: false }

    const horse = await store.findHorseById(dsl.horseId)
    if (horse === null) {
      return { ok: false, reason: `the horse ${dsl.horseId} for this DSL does not exist` }
    }

    const trainer = await store.findTrainerById(horse.trainerId)
    const owner = await store.findOwnerById(horse.ownerId)

    return { ok: true, found: true, dsl, horse, trainer, owner }
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? error.message : 'the load failed',
    }
  }
}
