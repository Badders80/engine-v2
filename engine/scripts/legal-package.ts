import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'

import { isListableDsl, type ListableDsl } from '../src/lib/dslStore'
import { createSupabasePurchaseStore } from '../src/lib/purchaseStoreSupabase'
import {
  buildLegalPackage,
  createContractId,
  renderLegalPdfWithReportLab,
  type LegalPackageResult,
} from '../src/lib/legal/package'
import type { LegalPackInput } from '../src/lib/legal/tokens'
import { validateStake } from '../src/lib/pricing'
import { saleTimeTerms } from '../src/lib/purchase'

type Fixture = {
  input: LegalPackInput
  contractId: string
  saleId: string
  dslId: string
  horseId: string
  accountId: string
}

const cliArgs = process.argv.slice(2).filter((value) => value !== '--')

const { values } = parseArgs({
  args: cliArgs,
  options: {
    fixture: { type: 'string' },
    'dsl-id': { type: 'string' },
    'sale-id': { type: 'string' },
    'contract-id': { type: 'string' },
    'contract-sequence': { type: 'string' },
    'account-id': { type: 'string' },
    'buyer-name': { type: 'string' },
    stake: { type: 'string' },
    'executed-date': { type: 'string' },
    'created-at': { type: 'string' },
    'out-dir': { type: 'string' },
  },
  strict: true,
  allowPositionals: false,
})

function arg(name: string): string | undefined {
  const value = values[name as keyof typeof values]
  return typeof value === 'string' && value.trim() !== '' ? value : undefined
}

function required(name: string): string {
  const value = arg(name)
  if (value === undefined) throw new Error(`missing --${name}`)
  return value
}

function numberArg(name: string): number | undefined {
  const raw = arg(name)
  if (raw === undefined) return undefined
  const parsed = Number(raw)
  if (!Number.isFinite(parsed)) throw new Error(`--${name} must be a number`)
  return parsed
}

function defaultOutDir(): string {
  return resolve(
    fileURLToPath(new URL('../../../../../sandbox/mvp/out/legal', import.meta.url)),
  )
}

function assertLiveStake(dsl: ListableDsl, stake: number): void {
  if (!Number.isFinite(stake) || stake <= 0) throw new Error('stake must be positive')
  if (stake < dsl.minStake) throw new Error(`stake ${stake} is below minimum ${dsl.minStake}`)
  if (stake > dsl.stakeRemaining) {
    throw new Error(`stake ${stake} exceeds remaining ${dsl.stakeRemaining}`)
  }
  validateStake(stake, dsl.step)
}

async function loadSavedRecords(dslId: string): Promise<{
  input: LegalPackInput
  dsl: ListableDsl
  accountId: string
}> {
  const store = createSupabasePurchaseStore()
  const dsl = await store.findDslById(dslId)
  if (dsl === null) throw new Error(`DSL ${dslId} does not exist`)
  if (!isListableDsl(dsl)) throw new Error('the DSL commercial terms are incomplete')

  const horse = await store.findHorseById(dsl.horseId)
  if (horse === null) throw new Error(`horse ${dsl.horseId} does not exist`)
  if (dsl.trainerId === null) throw new Error('the DSL has no trainer')
  if (dsl.ownerId === null) throw new Error('the DSL has no owner')

  const trainer = await store.findPartyById(dsl.trainerId)
  if (trainer === null) throw new Error(`trainer ${dsl.trainerId} does not exist`)
  const owner = await store.findPartyById(dsl.ownerId)
  if (owner === null) throw new Error(`owner ${dsl.ownerId} does not exist`)

  const executedDate = arg('executed-date') ?? new Date().toISOString().slice(0, 10)
  const stake = numberArg('stake') ?? dsl.minStake
  assertLiveStake(dsl, stake)

  const terms = saleTimeTerms(dsl, executedDate)
  if (!terms.ok) throw new Error(terms.reason)

  return {
    dsl,
    accountId: arg('account-id') ?? randomUUID(),
    input: {
      account: { fullName: arg('buyer-name') ?? 'Session DoD Buyer' },
      dsl: {
        ...dsl,
        termStart: terms.value.termStart,
        paymentModel: terms.value.paymentModel,
      },
      horse,
      trainer,
      owner,
      sale: { stake, executedDate },
    },
  }
}

async function buildFromFixture(): Promise<LegalPackageResult> {
  const path = required('fixture')
  const fixture = JSON.parse(await readFile(path, 'utf8')) as Fixture
  return buildLegalPackage({
    ...fixture,
    outDir: arg('out-dir') ?? defaultOutDir(),
    createdAt: arg('created-at') ?? new Date().toISOString(),
    pdfRenderer: renderLegalPdfWithReportLab,
  })
}

async function buildFromSavedRecords(): Promise<LegalPackageResult> {
  const loaded = await loadSavedRecords(required('dsl-id'))
  const executedDate = arg('executed-date') ?? new Date().toISOString().slice(0, 10)
  const year = Number(executedDate.slice(0, 4))
  const contractId =
    arg('contract-id') ??
    createContractId(year, Number(required('contract-sequence')))

  return buildLegalPackage({
    input: loaded.input,
    contractId,
    saleId: arg('sale-id') ?? randomUUID(),
    dslId: loaded.dsl.id,
    horseId: loaded.dsl.horseId,
    accountId: loaded.accountId,
    outDir: arg('out-dir') ?? defaultOutDir(),
    createdAt: arg('created-at') ?? new Date().toISOString(),
    pdfRenderer: renderLegalPdfWithReportLab,
  })
}

async function main(): Promise<void> {
  const result =
    arg('fixture') !== undefined ? await buildFromFixture() : await buildFromSavedRecords()

  console.log(
    JSON.stringify(
      {
        directory: result.directory,
        contract_pdf: result.contractPdfPath,
        contract_id: result.manifest.contract_id,
        pdf_sha256: result.manifest.pdf_sha256,
        pds_sha256: result.provenance.pds_sha256,
        sa_sha256: result.provenance.sa_sha256,
        legal_pack_version: result.provenance.legal_pack_version,
        template_hashes: result.provenance.template_hashes,
      },
      null,
      2,
    ),
  )
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
