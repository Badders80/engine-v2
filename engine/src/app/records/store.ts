/**
 * The store handle for the records screens.
 *
 * One factory, so a page never reaches for the Supabase client itself. The
 * records screens are read-and-edit surfaces over rows the DSL page also
 * writes; they never price, compile, or touch a sale.
 */

import { createSupabaseDslStore, supabaseClientFromEnv } from '@/lib/dslStoreSupabase'

export function recordStore() {
  return createSupabaseDslStore(supabaseClientFromEnv())
}
