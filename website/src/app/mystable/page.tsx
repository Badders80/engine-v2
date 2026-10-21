import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import Link from 'next/link'

import { AUTH_TOKEN_COOKIE } from '../../lib/auth'
import { readMyStable, type SaleRecord } from '../../lib/mystable'

/**
 * Screen 5 — Return / MyStable (`/mystable`). PLAN.md step 8 (`PLAN.md:238`, `:316`).
 *
 * Server-rendered (`force-dynamic`) under the signed-in investor's session.
 * Reads `accounts` and `sales` through `website/src/lib/mystable.ts`.
 *
 * If returning from Stripe Checkout (`?session_id=...`) before the webhook has
 * written the matching `sales` row, renders the pending state and never claims
 * the stake is owned (`PLAN.md:222`, `:238`). Once the `sales` row exists,
 * renders the stake, the amount paid, and both frozen documents (`pds_markdown`,
 * `sa_markdown`) with their SHA-256 hashes (`pds_hash`, `sa_hash`).
 */

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'MyStable — Evolution Stables',
  robots: { index: false },
}

function FrozenSaleCard({ sale }: { sale: SaleRecord }) {
  return (
    <article className="mt-12 rounded-lg border border-border bg-surface p-8 shadow-panel">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-6">
        <div>
          <p className="label-eyebrow text-gold">Recorded Leasehold Sale</p>
          <h2 className="mt-2 text-card-heading font-medium text-heading">{sale.printedName}</h2>
        </div>
        <span className="label-spec text-muted-foreground">Session {sale.stripeSessionId}</span>
      </div>

      <dl className="mt-6 grid gap-8 sm:grid-cols-3">
        <div>
          <dt className="label-spec text-muted-foreground">Stake</dt>
          <dd className="mt-2 font-mono text-card-heading font-medium text-heading">
            {String(sale.stake)}%
          </dd>
        </div>
        <div>
          <dt className="label-spec text-muted-foreground">Initial amount paid (NZD)</dt>
          <dd className="mt-2 font-mono text-card-heading font-medium text-heading">
            ${sale.amount.toFixed(2)}
          </dd>
        </div>
        <div>
          <dt className="label-spec text-muted-foreground">Recorded at</dt>
          <dd className="mt-2 font-mono text-body-small text-ink">{sale.createdAt}</dd>
        </div>
      </dl>

      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        <div className="legal-doc rounded-md border border-legal-border bg-legal-surface p-6 text-legal-ink">
          <div className="border-b border-legal-border pb-3">
            <p className="label-spec text-legal-ink">Product Disclosure Statement (Frozen)</p>
            <p className="mt-1 font-mono text-micro break-all text-legal-ink">
              SHA-256: {sale.pdsHash}
            </p>
          </div>
          <pre className="mt-4 max-h-80 overflow-y-auto font-mono text-micro whitespace-pre-wrap text-legal-ink">
            {sale.pdsMarkdown}
          </pre>
        </div>

        <div className="legal-doc rounded-md border border-legal-border bg-legal-surface p-6 text-legal-ink">
          <div className="border-b border-legal-border pb-3">
            <p className="label-spec text-legal-ink">Syndicate Agreement (Frozen)</p>
            <p className="mt-1 font-mono text-micro break-all text-legal-ink">
              SHA-256: {sale.saHash}
            </p>
          </div>
          <pre className="mt-4 max-h-80 overflow-y-auto font-mono text-micro whitespace-pre-wrap text-legal-ink">
            {sale.saMarkdown}
          </pre>
        </div>
      </div>
    </article>
  )
}

export default async function MyStablePage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>
}) {
  const params = await searchParams
  const cookieStore = await cookies()
  const accessToken = cookieStore.get(AUTH_TOKEN_COOKIE)?.value ?? null

  const view = await readMyStable({
    accessToken,
    checkoutSessionId: params.session_id ?? null,
  })

  return (
    <main className="min-h-screen bg-canvas text-ink">
      <section className="mx-auto w-full max-w-6xl px-12 pt-32 pb-32 md:px-16 lg:px-20">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Link href="/marketplace" className="label-action text-muted-foreground hover:text-heading">
            Marketplace
          </Link>
          {!view.account ? (
            <Link
              href="/login?next=%2Fmystable"
              className="label-action min-h-11 inline-flex items-center rounded-pill border border-border bg-surface px-5 py-2 text-heading"
            >
              Sign in
            </Link>
          ) : (
            <span className="label-spec text-muted-foreground">
              {view.account.fullName} · KYC: {view.account.kycStatus}
            </span>
          )}
        </div>

        <h1 className="mt-8 text-display leading-display tracking-display text-heading">
          MyStable
        </h1>

        {view.pendingNotice ? (
          <div
            role="status"
            className="mt-10 rounded-lg border border-gold bg-raised p-6 text-heading"
          >
            <p className="label-eyebrow text-gold">Checkout Return — Pending Confirmation</p>
            <p className="mt-3 text-body text-heading">{view.pendingNotice}</p>
            <p className="mt-2 font-mono text-micro text-muted-foreground">
              Stripe Session: {view.pendingSessionId}
            </p>
          </div>
        ) : null}

        {view.sales.length === 0 && !view.pendingNotice ? (
          <div className="mt-12 rounded-lg border border-border bg-surface p-8">
            <p className="text-body text-ink">
              No recorded syndicate stakes yet. Visit the{' '}
              <Link href="/marketplace" className="text-gold underline">
                Marketplace
              </Link>{' '}
              to view offerings.
            </p>
          </div>
        ) : null}

        {view.sales.map((sale) => (
          <FrozenSaleCard key={sale.id} sale={sale} />
        ))}
      </section>
    </main>
  )
}
