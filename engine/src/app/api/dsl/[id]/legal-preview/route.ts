import { loadDslView } from '@/app/dsl/data'
import { compileDraftPreview } from '@/lib/legal/draftPreview'
import { renderDraftLegalPdf } from '@/lib/legal/renderDraftPdf'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const view = await loadDslView(id)
  if (!view.ok) return Response.json({ error: view.reason }, { status: 500 })
  if (!view.found) return Response.json({ error: 'the DSL does not exist' }, { status: 404 })

  const url = new URL(request.url)
  const preview = compileDraftPreview({
    dsl: view.dsl,
    horse: view.horse,
    trainer: view.trainer,
    owner: view.owner,
    stakeRaw: url.searchParams.get('stake') ?? undefined,
    buyer: url.searchParams.get('buyer') ?? undefined,
    executedDate: url.searchParams.get('date') ?? undefined,
  })

  if (!preview.ok) {
    return Response.json(
      { error: preview.error, blocking: preview.blocking },
      { status: 422 },
    )
  }

  const pdf = await renderDraftLegalPdf({
    pack: preview.pack,
    horseName: view.horse.legalName,
    investorName: preview.buyer,
    executedDate: preview.executedDate,
  })
  const safeHorse = view.horse.slug.replace(/[^a-z0-9-]/gi, '-')

  return new Response(new Uint8Array(pdf.bytes), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${safeHorse}-investor-pack-draft.pdf"`,
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'X-PDF-SHA256': pdf.sha256,
      'X-PDF-Page-Count': String(pdf.pageCount),
    },
  })
}
