import type { Metadata } from 'next'
import Link from 'next/link'

import { sanitizeReturnPath } from '../../lib/auth'

/**
 * Investor sign-in and account creation (`/login`). PLAN.md step 8 (`PLAN.md:24`, `:226`).
 *
 * Collects full legal name at signup (`raw_user_meta_data.full_name`), supports
 * email and Google OAuth, and preserves the return path (`?next=/marketplace/[slug]`)
 * so an investor who clicks Buy Now while logged out returns directly to the horse page.
 */

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Sign in — Evolution Stables',
  robots: { index: false },
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; mode?: string }>
}) {
  const params = await searchParams
  const returnPath = sanitizeReturnPath(params.next)
  const isSignup = params.mode === 'signup'

  return (
    <main className="min-h-screen bg-canvas text-ink">
      <div className="mx-auto w-full max-w-6xl px-12 pt-32 pb-32 md:px-16 lg:px-20">
        <Link href={returnPath} className="label-action text-muted-foreground hover:text-heading">
          Return
        </Link>

        <div className="mt-12 max-w-lg rounded-lg border border-border bg-surface p-8 shadow-panel">
          <p className="label-eyebrow text-gold">Investor Account</p>
          <h1 className="mt-4 text-section-heading leading-heading text-heading">
            {isSignup ? 'Create your account' : 'Sign in to Evolution Stables'}
          </h1>
          <p className="mt-4 text-body-small text-ink">
            {isSignup
              ? 'Your full legal name is recorded on your Product Disclosure Statement and Syndicate Agreement.'
              : 'Sign in with your email or Google account to continue.'}
          </p>

          <div className="mt-8 flex gap-4 border-b border-border pb-4">
            <Link
              href={`/login?next=${encodeURIComponent(returnPath)}`}
              className={`label-action min-h-11 inline-flex items-center px-4 rounded-pill ${
                !isSignup
                  ? 'bg-raised text-heading border border-border'
                  : 'text-muted-foreground hover:text-heading'
              }`}
            >
              Sign in
            </Link>
            <Link
              href={`/login?mode=signup&next=${encodeURIComponent(returnPath)}`}
              className={`label-action min-h-11 inline-flex items-center px-4 rounded-pill ${
                isSignup
                  ? 'bg-raised text-heading border border-border'
                  : 'text-muted-foreground hover:text-heading'
              }`}
            >
              Create account
            </Link>
          </div>

          <form method="post" action={returnPath} className="mt-8 space-y-6">
            <input type="hidden" name="next" value={returnPath} />
            <input type="hidden" name="mode" value={isSignup ? 'signup' : 'signin'} />

            {isSignup ? (
              <div>
                <label htmlFor="fullName" className="label-spec block text-muted-foreground">
                  Full legal name
                </label>
                <input
                  id="fullName"
                  name="fullName"
                  type="text"
                  required
                  autoComplete="name"
                  placeholder="As shown on your driver licence or passport"
                  className="mt-2 min-h-11 w-full rounded border border-border bg-raised px-4 py-3 text-body text-heading placeholder:text-muted-foreground focus:border-gold focus:outline-none"
                />
              </div>
            ) : null}

            <div>
              <label htmlFor="email" className="label-spec block text-muted-foreground">
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                className="mt-2 min-h-11 w-full rounded border border-border bg-raised px-4 py-3 text-body text-heading placeholder:text-muted-foreground focus:border-gold focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="password" className="label-spec block text-muted-foreground">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                minLength={8}
                autoComplete={isSignup ? 'new-password' : 'current-password'}
                className="mt-2 min-h-11 w-full rounded border border-border bg-raised px-4 py-3 text-body text-heading placeholder:text-muted-foreground focus:border-gold focus:outline-none"
              />
            </div>

            <button
              type="submit"
              className="label-action min-h-11 w-full rounded-pill bg-gold px-6 py-3 text-on-gold transition duration-hover hover:bg-gold-hover"
            >
              {isSignup ? 'Create Account & Continue' : 'Sign In & Continue'}
            </button>
          </form>

          <div className="mt-6 border-t border-border pt-6">
            <a
              href={`/login?provider=google&next=${encodeURIComponent(returnPath)}`}
              className="label-action min-h-11 inline-flex w-full items-center justify-center rounded-pill border border-border bg-raised px-6 py-3 text-heading transition duration-hover hover:border-edge"
            >
              Continue with Google
            </a>
          </div>
        </div>
      </div>
    </main>
  )
}
