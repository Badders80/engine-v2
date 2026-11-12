import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import { buildLegalPackage, createContractId } from '../src/lib/legal/package'
import { sha256 } from '../src/lib/legal/templates'
import type { LegalPackInput } from '../src/lib/legal/tokens'

const roots: string[] = []

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})

function input(): LegalPackInput {
  return {
    account: { fullName: 'Session DoD Buyer' },
    dsl: {
      termStart: '2026-11-01',
      endDate: '2028-06-30',
      paymentModel: 'subscription_float',
      closeStyle: 'fourteen_day',
      distributionSchedule: 'Quarterly',
      investorSplit: 75,
      listedStake: 5,
      minStake: 1,
      step: 0.5,
      retailMonthlyPerPercent: 65,
    },
    horse: {
      slug: 'mulan-the-brave',
      legalName: 'Mulan The Brave (NZ)',
      foalingDate: '2023-08-17',
      sex: 'Filly',
      colour: 'Bay',
      breeder: 'C W Kwok',
      sireName: 'TURN ME LOOSE (NZ) 2011',
      damName: 'YEARN (NZ) 2013',
      microchip: '985125000128426',
      aboutHorse: 'About the horse.',
      racingOutlookAndPedigree: 'Outlook and pedigree.',
      raceExpectation: 'Race expectation.',
    },
    trainer: {
      displayName: 'Stephen Gray & Bridget Gray',
      location: 'Copper Belt, Palmerston North, NZ',
      bio: 'Trainer bio.',
    },
    owner: { displayName: 'Stephen Gray & Bridget Gray' },
    sale: { stake: 1, executedDate: '2026-11-12' },
  }
}

describe('the contract identifier', () => {
  it('formats the locked ES-DSL identifier', () => {
    expect(createContractId(2026, 900001)).toBe('ES-DSL-2026-900001')
  })
})

describe('the complete legal package', () => {
  it('writes the combined document, manifest, provenance and exact hashes', async () => {
    const outDir = await mkdtemp(join(tmpdir(), 'legal-package-'))
    roots.push(outDir)

    const result = await buildLegalPackage({
      input: input(),
      contractId: 'ES-DSL-2026-900001',
      saleId: '00000000-0000-4000-8000-000000000001',
      dslId: '00000000-0000-4000-8000-000000000002',
      horseId: '00000000-0000-4000-8000-000000000003',
      accountId: '00000000-0000-4000-8000-000000000004',
      outDir,
      createdAt: '2026-11-12T00:00:00.000Z',
      pdfRenderer: async ({ contractId, outputPath, pdsMarkdown, saMarkdown }) => {
        expect(contractId).toBe('ES-DSL-2026-900001')
        expect(pdsMarkdown).toContain('Product Disclosure Statement')
        expect(saMarkdown).toContain('Syndicate Agreement')
        await writeFile(outputPath, '%PDF-1.4\nmock legal package\n')
      },
    })

    const pdf = await readFile(result.contractPdfPath)
    const pds = await readFile(join(result.directory, 'pds.md'), 'utf8')
    const sa = await readFile(join(result.directory, 'sa.md'), 'utf8')
    const manifest = JSON.parse(await readFile(join(result.directory, 'manifest.json'), 'utf8'))
    const provenance = JSON.parse(
      await readFile(join(result.directory, 'provenance.json'), 'utf8'),
    )

    expect(Object.keys(manifest).sort()).toEqual([
      'contract_id',
      'created_at',
      'object_key',
      'pdf_sha256',
      'sale_id',
      'template_versions',
    ])
    expect(manifest.pdf_sha256).toBe(sha256(pdf.toString('utf8')))
    expect(provenance.pds_sha256).toBe(sha256(pds))
    expect(provenance.sa_sha256).toBe(sha256(sa))
    expect(Object.keys(provenance.template_hashes)).toHaveLength(8)
    expect(manifest.sale_id).toBe('00000000-0000-4000-8000-000000000001')
  })

  it('refuses to overwrite an existing contract package', async () => {
    const outDir = await mkdtemp(join(tmpdir(), 'legal-package-'))
    roots.push(outDir)

    const args = {
      input: input(),
      contractId: 'ES-DSL-2026-900002',
      saleId: '00000000-0000-4000-8000-000000000001',
      dslId: '00000000-0000-4000-8000-000000000002',
      horseId: '00000000-0000-4000-8000-000000000003',
      accountId: '00000000-0000-4000-8000-000000000004',
      outDir,
      createdAt: '2026-11-12T00:00:00.000Z',
      pdfRenderer: async ({ outputPath }: { outputPath: string }) => {
        await writeFile(outputPath, '%PDF-1.4\nmock legal package\n')
      },
    }

    await buildLegalPackage(args)
    await expect(buildLegalPackage(args)).rejects.toThrow(/EEXIST|ENOTEMPTY/)
  })
})
