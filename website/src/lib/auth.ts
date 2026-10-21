/**
 * Website authentication helpers. PLAN.md step 8 (`PLAN.md:24`, `:226`, `:316`).
 *
 * Signup and login use Supabase Auth (email/password or Google OAuth).
 * Full legal name is required at signup and stored in `raw_user_meta_data.full_name`,
 * which migration `00012_accounts_signup.sql` copies into `public.accounts`.
 * Checkout reads that one account row and never creates a second profile.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

import { SUPABASE_ANON_KEY_ENV, SUPABASE_URL_ENV } from './supabaseRead'

export const AUTH_TOKEN_COOKIE = 'evo_access_token'

export type SignupInput = {
  fullName: string
  email: string
  password: string
}

export type LoginInput = {
  email: string
  password: string
}

export type ValidationResult<T> = { ok: true; value: T } | { ok: false; reason: string }

/**
 * Ensures the post-login redirect path is a safe internal relative path on
 * this site (`/marketplace/[slug]` or `/mystable`), preventing open redirects.
 */
export function sanitizeReturnPath(nextParam: string | null | undefined): string {
  if (typeof nextParam !== 'string') return '/mystable'
  const trimmed = nextParam.trim()
  if (!trimmed.startsWith('/') || trimmed.startsWith('//') || trimmed.includes('\\')) {
    return '/mystable'
  }
  return trimmed
}

/**
 * Validates signup inputs before calling Supabase Auth so `full_name` is always
 * non-empty when `00012_accounts_signup.sql` runs.
 */
export function validateSignupInput(input: SignupInput): ValidationResult<SignupInput> {
  const fullName = input.fullName.trim()
  const email = input.email.trim().toLowerCase()
  const password = input.password

  if (fullName.length < 2) {
    return { ok: false, reason: 'Enter your full legal name as it appears on your ID.' }
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, reason: 'Enter a valid email address.' }
  }
  if (password.length < 8) {
    return { ok: false, reason: 'Password must be at least 8 characters.' }
  }

  return {
    ok: true,
    value: { fullName, email, password },
  }
}

export function validateLoginInput(input: LoginInput): ValidationResult<LoginInput> {
  const email = input.email.trim().toLowerCase()
  const password = input.password

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, reason: 'Enter a valid email address.' }
  }
  if (password.length === 0) {
    return { ok: false, reason: 'Enter your password.' }
  }

  return { ok: true, value: { email, password } }
}

/**
 * Creates a server-side Supabase client scoped to the signed-in buyer's JWT
 * (or anon if no token is present). Row-level security in migration `00009`
 * restricts `accounts` and `sales` to `auth.uid() = id` / `auth.uid() = user_id`.
 */
export function createUserClient(accessToken?: string | null): SupabaseClient {
  const url = process.env[SUPABASE_URL_ENV]
  const anonKey = process.env[SUPABASE_ANON_KEY_ENV]

  if (!url || !anonKey) {
    throw new Error(
      `${SUPABASE_URL_ENV} and ${SUPABASE_ANON_KEY_ENV} must both be set. See website/.env.example.`,
    )
  }

  const headers: Record<string, string> = {}
  if (accessToken && accessToken.trim() !== '') {
    headers.Authorization = `Bearer ${accessToken.trim()}`
  }

  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers },
  })
}

export async function signUpWithFullName(
  input: SignupInput,
  client: SupabaseClient = createUserClient(),
): Promise<ValidationResult<{ userId: string; email: string }>> {
  const checked = validateSignupInput(input)
  if (!checked.ok) return checked

  const { data, error } = await client.auth.signUp({
    email: checked.value.email,
    password: checked.value.password,
    options: {
      data: {
        full_name: checked.value.fullName,
      },
    },
  })

  if (error || !data.user) {
    return { ok: false, reason: error?.message ?? 'Unable to create account.' }
  }

  return {
    ok: true,
    value: {
      userId: data.user.id,
      email: data.user.email ?? checked.value.email,
    },
  }
}

export async function signInWithEmail(
  input: LoginInput,
  client: SupabaseClient = createUserClient(),
): Promise<ValidationResult<{ userId: string; accessToken: string }>> {
  const checked = validateLoginInput(input)
  if (!checked.ok) return checked

  const { data, error } = await client.auth.signInWithPassword({
    email: checked.value.email,
    password: checked.value.password,
  })

  if (error || !data.user || !data.session) {
    return { ok: false, reason: error?.message ?? 'Invalid email or password.' }
  }

  return {
    ok: true,
    value: {
      userId: data.user.id,
      accessToken: data.session.access_token,
    },
  }
}
