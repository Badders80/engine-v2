import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, readFile, rename, rm, unlink, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { compileLegalPack } from './compile'
import type { LegalPackInput } from './tokens'

export const CONTRACT_ID_PATTERN = /^ES-DSL-\d{4}-\d{6}$/
const ENGINE_ROOT = fileURLToPath(new URL('../../../', import.meta.url))

export type PdfRenderer = (input: {
  outputPath: string
  contractId: string
  legalPackVersion: string
  pdsMarkdown: string
  saMarkdown: string
}) => Promise<void>

export type LegalPackageInput = {
  input: LegalPackInput
  contractId: string
  saleId: string
  dslId: string
  horseId: string
  accountId: string
  outDir: string
  createdAt: string
  pdfRenderer: PdfRenderer
}

export type LegalPackageResult = {
  directory: string
  contractPdfPath: string
  manifest: ArchiveManifest
  provenance: LegalPackageProvenance
}

export type ArchiveManifest = {
  contract_id: string
  sale_id: string
  pdf_sha256: string
  object_key: string
  template_versions: {
    legal_pack: string
    files: Record<string, string>
  }
  created_at: string
}

export type LegalPackageProvenance = {
  contract_id: string
  sale_id: string
  dsl_id: string
  horse_id: string
  account_id: string
  pds_sha256: string
  sa_sha256: string
  template_hashes: Record<string, string>
  legal_pack_version: string
}

export function createContractId(year: number, sequence: number): string {
  return `ES-DSL-${year}-${String(sequence).padStart(6, '0')}`
}

export async function renderLegalPdfWithReportLab(input: {
  outputPath: string
  contractId: string
  legalPackVersion: string
  pdsMarkdown: string
  saMarkdown: string
}): Promise<void> {
  const inputPath = join(dirname(input.outputPath), 'reportlab-input.json')
  await writeFile(
    inputPath,
    JSON.stringify({
      output_path: input.outputPath,
      contract_id: input.contractId,
      legal_pack_version: input.legalPackVersion,
      pds_markdown: input.pdsMarkdown,
      sa_markdown: input.saMarkdown,
    }),
  )

  try {
    await new Promise<void>((resolve, reject) => {
      const child = spawn('python3', [join(ENGINE_ROOT, 'scripts/render-legal-pdf.py'), inputPath], {
        cwd: ENGINE_ROOT,
        stdio: ['ignore', 'ignore', 'pipe'],
      })
      let stderr = ''
      child.stderr.on('data', (chunk: Buffer) => {
        stderr += chunk.toString('utf8')
      })
      child.on('error', reject)
      child.on('exit', (code, signal) => {
        if (code === 0) {
          resolve()
          return
        }
        reject(
          new Error(
            `ReportLab PDF render failed (${signal ?? `exit ${String(code)}`}): ${stderr.trim()}`,
          ),
        )
      })
    })

    if (!existsSync(input.outputPath)) {
      throw new Error(`ReportLab exited without writing ${input.outputPath}`)
    }
  } finally {
    await unlink(inputPath).catch(() => undefined)
  }
}

function hashBytes(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex')
}

export async function buildLegalPackage(
  input: LegalPackageInput,
): Promise<LegalPackageResult> {
  if (!CONTRACT_ID_PATTERN.test(input.contractId)) {
    throw new Error(`invalid contract_id: ${input.contractId}`)
  }

  const pack = compileLegalPack({
    ...input.input,
    contract: { id: input.contractId },
  })
  await mkdir(input.outDir, { recursive: true })
  const tempDirectory = await mkdtemp(join(input.outDir, '.legal-package-'))
  const finalDirectory = join(input.outDir, input.contractId)

  try {
    await writeFile(join(tempDirectory, 'pds.md'), pack.pds.markdown)
    await writeFile(join(tempDirectory, 'sa.md'), pack.sa.markdown)

    const tempPdfPath = join(tempDirectory, 'contract.pdf')
    await input.pdfRenderer({
      outputPath: tempPdfPath,
      contractId: input.contractId,
      legalPackVersion: pack.version,
      pdsMarkdown: pack.pds.markdown,
      saMarkdown: pack.sa.markdown,
    })
    const pdfBytes = await readFile(tempPdfPath)
    const pdfHash = hashBytes(pdfBytes)

    const templateVersions = {
      legal_pack: pack.version,
      files: pack.templateHashes,
    }
    const manifest: ArchiveManifest = {
      contract_id: input.contractId,
      sale_id: input.saleId,
      pdf_sha256: pdfHash,
      object_key: `out/legal/${input.contractId}/contract.pdf`,
      template_versions: templateVersions,
      created_at: input.createdAt,
    }
    const provenance: LegalPackageProvenance = {
      contract_id: input.contractId,
      sale_id: input.saleId,
      dsl_id: input.dslId,
      horse_id: input.horseId,
      account_id: input.accountId,
      pds_sha256: pack.pds.hash,
      sa_sha256: pack.sa.hash,
      template_hashes: pack.templateHashes,
      legal_pack_version: pack.version,
    }

    await writeFile(join(tempDirectory, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)
    await writeFile(
      join(tempDirectory, 'provenance.json'),
      `${JSON.stringify(provenance, null, 2)}\n`,
    )
    await writeFile(join(tempDirectory, 'SHA256SUMS'), `${pdfHash}  contract.pdf\n`)
    await rename(tempDirectory, finalDirectory)

    return {
      directory: finalDirectory,
      contractPdfPath: join(finalDirectory, 'contract.pdf'),
      manifest,
      provenance,
    }
  } catch (error) {
    await rm(tempDirectory, { recursive: true, force: true })
    throw error
  }
}
