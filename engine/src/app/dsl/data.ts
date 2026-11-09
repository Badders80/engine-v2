/**
 * Loading a DSL for the view and edit pages. Chunk 2.
 *
 * The trainer and the owner hang off the DSL, not the horse (ruling 10). The
 * store throws when the environment has no credentials, and this returns the
 * reason instead, so the page can say what is missing rather than showing a
 * stack trace.
 */

import type { DslRow, HorseRow, PartyRow } from '@/lib/dslStore'
import { createSupabaseDslStore, supabaseClientFromEnv } from '@/lib/dslStoreSupabase'

export type DslView =
  | {
      ok: true
      found: true
      dsl: DslRow
      horse: HorseRow
      trainer: PartyRow | null
      owner: PartyRow | null
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

    const trainer = dsl.trainerId === null ? null : await store.findPartyById(dsl.trainerId)
    const owner = dsl.ownerId === null ? null : await store.findPartyById(dsl.ownerId)

    return { ok: true, found: true, dsl, horse, trainer, owner }
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? error.message : 'the load failed',
    }
  }
}
