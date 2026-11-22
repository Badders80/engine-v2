/**
 * The legal preview. This is the compiler's production call site: it resolves
 * one draft DSL through the same legal compiler and ReportLab renderer used by
 * the executed Investor Pack.
 *
 * The response is a real, page-navigable PDF preview. It writes no sale row and
 * stores no document.
 */

import Link from 'next/link'
import { notFound } from 'next/navigation'

import { compileDraftPreview } from '@/lib/legal/draftPreview'

import { loadDslView } from '../../data'
import { LegalPdfPreview } from './LegalPdfPreview'

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ stake?: string; buyer?: string; date?: string }>
}) {
  const { id } = await params
  const query = await searchParams
  const view = await loadDslView(id)

  if (!view.ok) {
    return (
      <main className="grid gap-6">
        <h1>Legal preview</h1>
        <p role="alert">{view.reason}</p>
        <p>
          <Link href="/dsl/new">New DSL</Link>
        </p>
      </main>
    )
  }

  if (!view.found) notFound()

  const preview = compileDraftPreview({
    dsl: view.dsl,
    horse: view.horse,
    trainer: view.trainer,
    owner: view.owner,
    stakeRaw: query.stake,
    buyer: query.buyer,
    executedDate: query.date,
  })

  const previewParams = new URLSearchParams({
    stake: preview.stakeRaw,
    buyer: preview.buyer,
    date: preview.executedDate,
  })
  const pdfEndpoint = `/api/dsl/${id}/legal-preview?${previewParams.toString()}`

  return (
    <main className="grid gap-6">
      <p
        role="note"
        className="rounded-sm border border-line-strong bg-panel px-4 py-3 text-body"
      >
        <strong>DRAFT — not executed.</strong> This PDF is compiled from the deal as it stands now.
        No sale row is written and no document is stored.
      </p>

      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-line pb-5">
        <div className="grid gap-1">
          <h1>Legal preview</h1>
          <p className="text-body text-muted">
            {view.horse.legalName} · Expiry {view.dsl.endDate ?? '—'} · Draft start{' '}
            {preview.previewDsl.termStart ?? '—'}
          </p>
        </div>
        <Link
          href={`/dsl/${id}`}
          className="inline-flex min-h-11 items-center rounded-sm border border-line bg-panel px-3 py-2 text-caption uppercase tracking-caption text-body hover:border-accent"
        >
          Back to the DSL
        </Link>
      </header>

      {preview.blocking.length > 0 ? (
        <section className="rounded-sm border border-line-strong bg-panel p-4">
          <h2 className="mb-2 text-heading-sm uppercase tracking-caption text-muted">Still needed</h2>
          <ul className="grid list-disc gap-1 pl-5 text-body">
            {preview.blocking.map((field) => (
              <li key={field}>{field}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {preview.error !== null ? (
        <p role="alert" className="rounded-sm border border-line-strong bg-panel p-4 text-body">
          {preview.error}
        </p>
      ) : null}

      <section className="rounded-md border border-line bg-panel p-5">
        <h2 className="mb-4 text-heading-sm uppercase tracking-caption text-muted">
          Preview assumptions
        </h2>
        <form method="get" className="grid items-end gap-4 md:grid-cols-3">
          <label className="grid gap-2 text-body">
            <span className="text-caption uppercase tracking-caption text-muted">Stake %</span>
            <input name="stake" defaultValue={preview.stakeRaw} inputMode="decimal" />
          </label>
          <label className="grid gap-2 text-body">
            <span className="text-caption uppercase tracking-caption text-muted">Buyer name</span>
            <input name="buyer" defaultValue={preview.buyer} />
          </label>
          <label className="grid gap-2 text-body">
            <span className="text-caption uppercase tracking-caption text-muted">
              Execution date
            </span>
            <input type="date" name="date" defaultValue={preview.executedDate} />
          </label>
          <div className="md:col-span-3">
            <button type="submit">Compile PDF preview</button>
          </div>
        </form>
      </section>

      {preview.ok ? (
        <LegalPdfPreview endpoint={pdfEndpoint} horseName={view.horse.legalName} />
      ) : null}
    </main>
  )
}
