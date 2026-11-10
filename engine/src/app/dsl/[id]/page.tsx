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
import { imageKeys, publicImageUrl } from '@/lib/storage'
import { buildTermSheet } from '@/lib/termSheet'

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

  const { dsl, horse, trainer, owner } = view
  const resolved = resolveNarrative(horse, dsl, trainer)
  const sections = buildTermSheet({ dsl, horse, trainer, owner, narrative: resolved })
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
    ? imageKeys(horse.slug, horse.imageCount).map((key, index) => ({
        key,
        imageNumber: index + 1,
        url: publicImageUrl(key, publicUrlBase),
      }))
    : []

  return (
    <main>
      <h1>{horse.legalName}</h1>
      <p>
        Term sheet · <Link href={`/dsl/${dsl.id}/edit`}>Edit</Link> ·{' '}
        <Link href={`/dsl/${dsl.id}/legal`}>PDS / SA preview</Link> ·{' '}
        <Link href="/dsl">All listings</Link>
      </p>

      {staleSlots.length > 0 ? (
        <div
          role="status"
          className="mt-4 rounded-sm border border-line-strong bg-panel px-4 py-3 text-body"
        >
          <p>
            Records changed since this deal overrode:{' '}
            {staleSlots.map((slot) => slot.replaceAll('_', ' ')).join('; ')}. The deal keeps its
            own text; this is informational.
          </p>
          <form action={dismissNarrativeWarningAction}>
            <input type="hidden" name="dslId" value={dsl.id} />
            <button type="submit">Dismiss</button>
          </form>
        </div>
      ) : null}

      <h2>Narrative</h2>
      {dsl.narrativeApprovedHash === null ? (
        <p className="text-body text-low">Not approved.</p>
      ) : (
        <p className="text-body text-low">
          Approved {dsl.narrativeApprovedAt ?? ''} · SHA-256 {dsl.narrativeApprovedHash}
        </p>
      )}
      <ul className="my-2 grid gap-1 text-caption text-low">
        {(Object.keys(resolved) as (keyof typeof resolved)[]).map((slot) => (
          <li key={slot}>
            {slot.replaceAll('_', ' ')}:{' '}
            {resolved[slot].text === null
              ? 'empty'
              : resolved[slot].overridden
                ? 'deal-local override'
                : 'from Records'}
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
        <p className="mt-1 text-caption text-low">
          Approval is refused while a slot is empty: {emptySlots.join(', ')}.
        </p>
      ) : null}

      <h2>Publication</h2>
      {error !== undefined && <p role="alert">{error}</p>}

      {dsl.published && dsl.status === 'available' ? (
        <>
          <p>
            Live. Listed at <Link href={`/marketplace/${horse.slug}`}>{horse.slug}</Link>,{' '}
            {dsl.stakeRemaining ?? 0}% of {dsl.listedStake ?? 0}% remaining.
          </p>
          <form action={unpublishDslAction}>
            <input type="hidden" name="dslId" value={dsl.id} />
            <button type="submit">Take down</button>
          </form>
        </>
      ) : (
        <>
          <p>{readiness.ok ? 'Ready to publish.' : readinessReason(readiness)}</p>
          <form action={publishDslAction}>
            <input type="hidden" name="dslId" value={dsl.id} />
            <button type="submit" disabled={!readiness.ok}>
              Publish
            </button>
          </form>
          {dsl.published && (
            <p>
              Published with status {dsl.status}. Only an <code>available</code> listing is
              buyable; take it down and publish again once the terms are fixed.
            </p>
          )}
        </>
      )}

      {sections.map((section) => (
        <section key={section.title}>
          <h2>{section.title}</h2>
          <dl>
            {section.rows.map((row) => (
              <div key={row.label}>
                <dt>{row.label}</dt>
                <dd>{row.value}</dd>
              </div>
            ))}
          </dl>
        </section>
      ))}

      <h2>Images</h2>
      <p>
        {horse.imageCount} in the bucket. Images are authored on the horse&apos;s Records page and
        flow through here; they never block a listing. KYC and proof of address never come through
        here. <Link href={`/horses/${horse.id}`}>Manage images on the horse profile</Link>.
      </p>
      {images.length > 0 && (
        <ol>
          {images.map((image) => (
            <li key={image.key}>
              {/* The bucket serves the object; Next's image optimiser has no
                  origin configured for it, so a plain img is correct here. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={image.url}
                alt={`${horse.legalName} image ${String(image.imageNumber)}`}
                width={160}
              />
            </li>
          ))}
        </ol>
      )}
    </main>
  )
}
