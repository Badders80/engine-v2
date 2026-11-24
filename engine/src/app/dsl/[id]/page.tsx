/**
 * One DSL — the term sheet. PLAN.md step 4; founder ruling 2026-11-07.
 *
 * This is the page the operator comes back to. Create lands here, the listing
 * is published from here, and every Sales row points here. It renders the five
 * sections of the one-page term sheet from the DSL row alone, with a blank
 * marker for anything not filled in — never a default.
 *
 * It is not a second write surface. Publish, take-down, and the image controls
 * all go through `actions.ts`; nothing here decides anything.
 *
 * The compiled documents are not rendered here. `/dsl/[id]/legal` is the
 * pre-execution preview, and the real compile happens per buyer at Checkout.
 */

import Link from 'next/link'
import { notFound } from 'next/navigation'

import { missingNarrativeSlots, resolveNarrative } from '@/lib/narrative'
import { staleOverrideSlots } from '@/lib/narrativeHash'
import { checkDslReadiness, readinessReason } from '@/lib/readiness'
import { effectiveImageOrder } from '@/lib/imageOrder'
import { imageKey, publicImageUrl } from '@/lib/storage'
import { buildTermSheet } from '@/lib/termSheet'
import { dslLifecycle, dslLifecycleLabel } from '@/lib/dslLifecycle'

import {
  approveNarrativeAction,
  dismissNarrativeWarningAction,
  publishDslAction,
  unpublishDslAction,
} from '../actions'
import { loadDslView } from '../data'

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ error?: string }>
}) {
  const { id } = await params
  const { error } = await searchParams
  const view = await loadDslView(id)

  if (!view.ok) {
    return (
      <main>
        <h1>DSL</h1>
        <p role="alert">{view.reason}</p>
        <p>
          <Link href="/dsl/new">New DSL</Link>
        </p>
      </main>
    )
  }

  if (!view.found) notFound()

  const { dsl, horse, trainer, owner, hasExecutedSale } = view
  const resolved = resolveNarrative(horse, dsl, trainer)
  const lifecycle = dslLifecycle({ published: dsl.published, hasExecutedSale })
  const sections = buildTermSheet({
    dsl,
    horse,
    trainer,
    owner,
    narrative: resolved,
    hasExecutedSale,
  })
  const staleSlots = staleOverrideSlots(horse, dsl)
  const emptySlots = missingNarrativeSlots(resolved)
  const readiness = checkDslReadiness({
    dsl,
    horse,
    trainer,
    narrative: {
      signoff: dsl.narrativeSignoff,
      approvedAt: dsl.narrativeApprovedAt,
      approvedHash: dsl.narrativeApprovedHash,
    },
  })

  // The count is the source of truth for what to show; the keys are derived
  // from it, so this page never calls the bucket. `image_count` is written from
  // the bucket by the upload, delete, and recount actions.
  const publicUrlBase = process.env.R2_PUBLIC_URL ?? ''
  const images = publicUrlBase.startsWith('https://')
    ? effectiveImageOrder(horse.imageOrder, horse.imageCount).map((imageNumber) => {
        const key = imageKey(horse.slug, imageNumber)
        return {
          key,
          imageNumber,
          url: publicImageUrl(key, publicUrlBase),
        }
      })
    : []

  return (
    <main className="grid gap-8">
      <header className="flex flex-wrap items-start justify-between gap-5 border-b border-line pb-6">
        <div className="grid gap-1">
          <h1>{horse.legalName}</h1>
          <p className="text-body text-muted">
            {dslLifecycleLabel(lifecycle)} · Term sheet
          </p>
        </div>
        <nav aria-label="DSL actions" className="flex flex-wrap gap-2">
          <Link
            href={`/dsl/${dsl.id}/edit`}
            className="inline-flex min-h-11 items-center rounded-sm border border-line bg-panel px-3 py-2 text-caption uppercase tracking-caption text-body hover:border-accent"
          >
            Edit
          </Link>
          <Link
            href={`/dsl/${dsl.id}/legal`}
            className="inline-flex min-h-11 items-center rounded-sm border border-line bg-panel px-3 py-2 text-caption uppercase tracking-caption text-body hover:border-accent"
          >
            PDS / SA preview
          </Link>
          <Link
            href="/dsl"
            className="inline-flex min-h-11 items-center rounded-sm border border-line bg-panel px-3 py-2 text-caption uppercase tracking-caption text-body hover:border-accent"
          >
            All DSLs
          </Link>
        </nav>
      </header>

      {staleSlots.length > 0 ? (
        <div
          role="status"
          className="rounded-sm border border-line-strong bg-panel px-4 py-3 text-body"
        >
          <p>
            Records changed since this deal overrode:{' '}
            {staleSlots.map((slot) => slot.replaceAll('_', ' ')).join('; ')}. The deal keeps its
            own text; this is informational.
          </p>
          <form action={dismissNarrativeWarningAction} className="mt-3">
            <input type="hidden" name="dslId" value={dsl.id} />
            <button type="submit">Dismiss</button>
          </form>
        </div>
      ) : null}

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <section className="rounded-md border border-line bg-panel p-5">
          <h2 className="mb-4 text-heading-sm uppercase tracking-caption text-muted">Narrative</h2>
          {dsl.narrativeApprovedHash === null ? (
            <p className="text-body text-low">Not approved.</p>
          ) : (
            <p className="break-words text-body text-low">
              Approved {dsl.narrativeApprovedAt ?? ''} · SHA-256 {dsl.narrativeApprovedHash}
            </p>
          )}
          <ul className="my-4 grid gap-2 text-caption text-muted sm:grid-cols-2">
            {(Object.keys(resolved) as (keyof typeof resolved)[]).map((slot) => (
              <li key={slot} className="rounded-sm bg-row px-3 py-2">
                <span className="block text-caption uppercase tracking-caption text-low">
                  {slot.replaceAll('_', ' ')}
                </span>
                <span className="mt-1 block text-body text-ink">
                  {resolved[slot].text === null
                    ? 'Empty'
                    : resolved[slot].overridden
                      ? 'Deal-local override'
                      : 'From Records'}
                </span>
              </li>
            ))}
          </ul>
          <form action={approveNarrativeAction}>
            <input type="hidden" name="dslId" value={dsl.id} />
            <button type="submit" disabled={emptySlots.length > 0}>
              Approve narrative
            </button>
          </form>
          {emptySlots.length > 0 ? (
            <p className="mt-3 text-caption text-low">
              Approval is refused while a slot is empty: {emptySlots.join(', ')}.
            </p>
          ) : null}
        </section>

        <section className="rounded-md border border-line bg-panel p-5">
          <h2 className="mb-4 text-heading-sm uppercase tracking-caption text-muted">Publication</h2>
          {error !== undefined && (
            <p role="alert" className="mb-4 text-body text-ink">
              {error}
            </p>
          )}

          {dsl.published && dsl.status === 'available' ? (
            <>
              <p className="text-body">
                Live. Listed at <Link href={`/marketplace/${horse.slug}`}>{horse.slug}</Link>,{' '}
                {dsl.stakeRemaining ?? 0}% of {dsl.listedStake ?? 0}% remaining.
              </p>
              <form action={unpublishDslAction} className="mt-4">
                <input type="hidden" name="dslId" value={dsl.id} />
                <button type="submit">Take down</button>
              </form>
            </>
          ) : (
            <>
              <p className="text-body text-muted">
                {readiness.ok ? 'Ready to publish.' : readinessReason(readiness)}
              </p>
              <form action={publishDslAction} className="mt-4">
                <input type="hidden" name="dslId" value={dsl.id} />
                <button type="submit" disabled={!readiness.ok}>
                  Publish
                </button>
              </form>
              {dsl.published && (
                <p className="mt-3 text-body text-low">
                  This is a Published DSL with inventory status {dsl.status}. Only an{' '}
                  <code>available</code> listing is buyable; take it down and publish again once
                  the terms are fixed.
                </p>
              )}
            </>
          )}
        </section>
      </div>

      {sections.map((section) => (
        <section key={section.title} className="rounded-md border border-line bg-panel p-5">
          <h2 className="mb-4 text-heading-sm uppercase tracking-caption text-muted">
            {section.title}
          </h2>
          <dl className="grid">
            {section.rows.map((row) => (
              <div
                key={row.label}
                className="grid gap-1 border-b border-line py-3 last:border-b-0 sm:grid-cols-[11rem_minmax(0,1fr)] sm:gap-4"
              >
                <dt className="text-caption uppercase tracking-caption text-muted">{row.label}</dt>
                <dd
                  className={`min-w-0 whitespace-pre-wrap break-words text-body ${
                    row.value.length > 120
                      ? 'max-w-[72ch] leading-relaxed text-muted'
                      : 'font-figure'
                  }`}
                >
                  {row.value}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      ))}

      <section className="rounded-md border border-line bg-panel p-5">
        <h2 className="mb-4 text-heading-sm uppercase tracking-caption text-muted">Images</h2>
        <p className="max-w-[70ch] text-body text-muted">
          {horse.imageCount} in the bucket. Images are authored on the horse&apos;s Records page and
          flow through here; they never block a listing. KYC and proof of address never come through
          here.{' '}
          <Link href={`/horses/${horse.id}`}>Manage images on the horse profile</Link>.
        </p>
        {images.length > 0 && (
          <ol className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
            {images.map((image) => (
              <li key={image.key} className="overflow-hidden rounded-sm border border-line bg-row">
                {/* The bucket serves the object; Next's image optimiser has no
                    origin configured for it, so a plain img is correct here. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={image.url}
                  alt={`${horse.legalName} image ${String(image.imageNumber)}`}
                  width={320}
                  height={220}
                  className="h-28 w-full object-cover"
                />
              </li>
            ))}
          </ol>
        )}
      </section>
    </main>
  )
}
