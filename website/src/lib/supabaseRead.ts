/**
 * The website's read client. PLAN.md step 6b-i.
 *
 * The website holds its own client and imports nothing from `engine/`. The
 * public site reads through the anon role, so migration 00009's policies are
 * the whole of what it can see, and nothing here can widen that.
 *
 * The env names carry no NEXT_PUBLIC_ prefix on purpose. Every read in this app
 * happens on the server, so the key never needs to reach a browser, and leaving
 * the prefix off makes it impossible for Next to inline the key into a client
 * bundle. A logged-out visitor still reads as `anon`, so row level security
 * applies exactly as the policies intend.
 *
 * A missing variable throws rather than yielding an undefined URL. A client
 * pointed at nothing returns [] and raises no error, which is indistinguishable
 * from a deny-by-default table — that is the failure mode this file exists to
 * make loud.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

export const SUPABASE_URL_ENV = 'WEBSITE_SUPABASE_URL'
export const SUPABASE_ANON_KEY_ENV = 'WEBSITE_SUPABASE_ANON_KEY'

export function createReadClient(): SupabaseClient {
  const url = process.env[SUPABASE_URL_ENV]
  const anonKey = process.env[SUPABASE_ANON_KEY_ENV]

  if (!url || !anonKey) {
    throw new Error(
      `${SUPABASE_URL_ENV} and ${SUPABASE_ANON_KEY_ENV} must both be set. See website/.env.example.`,
    )
  }

  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
