import { execFile, spawn } from 'node:child_process'
import { createHash, randomUUID } from 'node:crypto'
import { mkdtemp, readFile, rm, unlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'

import type { LegalPack } from './compile'

const execFileAsync = promisify(execFile)

async function renderPdf(input: {
  outputPath: string
  pack: LegalPack
  horseName: string
  investorName: string
  executedDate: string
}): Promise<void> {
  const inputPath = join(tmpdir(), `evolution-dsl-preview-${randomUUID()}.json`)
  const engineRoot = process.env.ENGINE_ROOT ?? process.cwd()

  await writeFile(
    inputPath,
    JSON.stringify({
      output_path: input.outputPath,
      contract_id: 'DRAFT-NOT-ASSIGNED',
      legal_pack_version: input.pack.version,
      investor_name: input.investorName,
      horse_name: input.horseName,
      executed_date: input.executedDate,
      created_at: new Date().toISOString(),
      pds_markdown: input.pack.pds.markdown,
      sa_markdown: input.pack.sa.markdown,
    }),
  )

  try {
    await new Promise<void>((resolve, reject) => {
      const child = spawn('python3', [join(engineRoot, 'scripts/render-legal-pdf.py'), inputPath], {
        cwd: engineRoot,
        stdio: ['ignore', 'ignore', 'pipe'],
      })
      let stderr = ''
      child.stderr.on('data', (chunk: Buffer) => {
        stderr += chunk.toString('utf8')
      })
      child.on('error', reject)
      child.on('exit', (code, signal) => {
        if (code === 0) return resolve()
        reject(
          new Error(
            `ReportLab PDF render failed (${signal ?? `exit ${String(code)}`}): ${stderr.trim()}`,
          ),
        )
      })
    })
  } finally {
    await unlink(inputPath).catch(() => undefined)
  }
}

export type DraftPdf = {
  bytes: Buffer
  sha256: string
  pageCount: number
}

export async function renderDraftLegalPdf(input: {
  pack: LegalPack
  horseName: string
  investorName: string
  executedDate: string
}): Promise<DraftPdf> {
  const directory = await mkdtemp(join(tmpdir(), 'evolution-dsl-preview-'))
  const outputPath = join(directory, 'contract.pdf')

  try {
    await renderPdf({
      outputPath,
      pack: input.pack,
      investorName: input.investorName,
      horseName: input.horseName,
      executedDate: input.executedDate,
    })

    const bytes = await readFile(outputPath)
    const sha256 = createHash('sha256').update(bytes).digest('hex')
    const { stdout } = await execFileAsync('pdfinfo', [outputPath])
    const pages = /^Pages:\s+(\d+)$/m.exec(stdout)
    if (pages === null) throw new Error('the PDF page count could not be read')

    return { bytes, sha256, pageCount: Number(pages[1]) }
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
}
