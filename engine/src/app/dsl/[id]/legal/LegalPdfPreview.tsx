'use client'

import { useEffect, useState } from 'react'

type PreviewState =
  | { status: 'loading' }
  | { status: 'ready'; url: string; sha256: string; pageCount: number }
  | { status: 'error'; message: string }

export function LegalPdfPreview({
  endpoint,
  horseName,
}: {
  endpoint: string
  horseName: string
}) {
  const [state, setState] = useState<PreviewState>({ status: 'loading' })

  useEffect(() => {
    const controller = new AbortController()
    let objectUrl: string | null = null

    async function load() {
      try {
        const response = await fetch(endpoint, { signal: controller.signal })
        if (!response.ok) {
          const body = await response.json().catch(() => null) as { error?: string } | null
          throw new Error(body?.error ?? `PDF preview failed with status ${response.status}`)
        }

        const sha256 = response.headers.get('X-PDF-SHA256')
        const pageCount = Number(response.headers.get('X-PDF-Page-Count'))
        if (sha256 === null || !Number.isInteger(pageCount) || pageCount <= 0) {
          throw new Error('the PDF preview response is missing its integrity metadata')
        }

        const blob = await response.blob()
        objectUrl = URL.createObjectURL(blob)
        setState({ status: 'ready', url: objectUrl, sha256, pageCount })
      } catch (error) {
        if (controller.signal.aborted) return
        setState({
          status: 'error',
          message: error instanceof Error ? error.message : 'the PDF preview failed',
        })
      }
    }

    void load()
    return () => {
      controller.abort()
      if (objectUrl !== null) URL.revokeObjectURL(objectUrl)
    }
  }, [endpoint])

  if (state.status === 'loading') {
    return (
      <div className="grid min-h-96 place-items-center rounded-md border border-line bg-panel p-6">
        <p className="text-body text-muted">Rendering the draft Investor Pack PDF…</p>
      </div>
    )
  }

  if (state.status === 'error') {
    return (
      <div role="alert" className="rounded-md border border-line-strong bg-panel p-5">
        <p className="text-body text-ink">{state.message}</p>
      </div>
    )
  }

  const filename = `${horseName.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '')}-investor-pack-draft.pdf`

  return (
    <section className="grid gap-4 rounded-md border border-line bg-panel p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid gap-1">
          <p className="text-caption uppercase tracking-caption text-muted">
            Draft PDF · {state.pageCount} pages
          </p>
          <p className="break-all font-figure text-caption text-low">SHA-256 {state.sha256}</p>
        </div>
        <a
          href={state.url}
          download={filename}
          className="inline-flex min-h-11 items-center rounded-sm border border-line-strong px-3 py-2 text-caption uppercase tracking-caption text-body hover:border-accent"
        >
          Download draft PDF
        </a>
      </div>
      <iframe
        title={`${horseName} draft Investor Pack PDF`}
        src={`${state.url}#page=1&view=FitH`}
        className="h-[70vh] min-h-[36rem] w-full rounded-sm border border-line bg-white"
      />
      <p className="text-caption text-low">
        Use the PDF viewer controls to move page by page. This draft is not executed and is not stored.
      </p>
    </section>
  )
}
