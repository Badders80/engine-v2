export const PEDIGREE_VERSION = 1 as const

export type PedigreeGeneration = 0 | 1 | 2 | 3

export type PedigreeNode = {
  /** Stable position in the tree, e.g. `sire.dam.sire`. */
  path: string
  generation: PedigreeGeneration
  name: string
  horseId: string
  sourceUrl: string
}

export type PedigreeSnapshot = {
  version: typeof PEDIGREE_VERSION
  source: 'loveracing_nz'
  rootHorseId: string
  sourceUrl: string
  retrievedAt: string
  nodes: PedigreeNode[]
}

export const PEDIGREE_GENERATION_COUNTS = [1, 2, 4, 8] as const

function generationPaths(): string[] {
  const generations = [['horse']]
  let current = ['horse']
  for (let generation = 1; generation <= 3; generation += 1) {
    current = current.flatMap((path) =>
      path === 'horse' ? ['sire', 'dam'] : [`${path}.sire`, `${path}.dam`],
    )
    generations.push(current)
  }
  return generations.flat()
}

export const PEDIGREE_PATHS = generationPaths()

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function nodeProblem(value: unknown): string | null {
  if (!isRecord(value)) return 'node is not an object'
  if (typeof value.path !== 'string' || value.path === '') return 'node path is missing'
  if (
    !Number.isInteger(value.generation) ||
    Number(value.generation) < 0 ||
    Number(value.generation) > 3
  ) {
    return `${value.path} has an invalid generation`
  }
  if (typeof value.name !== 'string' || value.name.trim() === '') {
    return `${value.path} has no name`
  }
  if (typeof value.horseId !== 'string' || !/^\d+$/.test(value.horseId)) {
    return `${value.path} has no Loveracing HorseID`
  }
  if (typeof value.sourceUrl !== 'string' || !value.sourceUrl.startsWith('https://loveracing.nz/')) {
    return `${value.path} has no Loveracing source URL`
  }
  return null
}

export function pedigreeSnapshotProblem(value: unknown): string | null {
  if (!isRecord(value)) return 'snapshot is not an object'
  if (value.version !== PEDIGREE_VERSION) return 'snapshot version is not 1'
  if (value.source !== 'loveracing_nz') return 'snapshot source is not loveracing_nz'
  if (typeof value.rootHorseId !== 'string' || !/^\d+$/.test(value.rootHorseId)) {
    return 'snapshot has no root Loveracing HorseID'
  }
  if (typeof value.sourceUrl !== 'string' || !value.sourceUrl.startsWith('https://loveracing.nz/')) {
    return 'snapshot has no Loveracing source URL'
  }
  if (typeof value.retrievedAt !== 'string' || value.retrievedAt === '') {
    return 'snapshot has no retrieval time'
  }
  if (!Array.isArray(value.nodes)) return 'snapshot has no nodes'
  if (value.nodes.length !== 15) return `snapshot has ${value.nodes.length} nodes, expected 15`

  for (const node of value.nodes) {
    const problem = nodeProblem(node)
    if (problem !== null) return problem
  }

  const byPath = new Map(
    value.nodes.map((node) => [(node as PedigreeNode).path, node as PedigreeNode]),
  )
  if (byPath.size !== value.nodes.length) {
    const seen = new Set<string>()
    const duplicates = new Set<string>()
    for (const node of value.nodes) {
      if (seen.has(node.path)) duplicates.add(node.path)
      seen.add(node.path)
    }
    return `snapshot has duplicate paths: ${[...duplicates].join(', ')}`
  }
  if (byPath.size !== PEDIGREE_PATHS.length) {
    return `snapshot has missing paths: ${PEDIGREE_PATHS.filter((path) => !byPath.has(path)).join(', ')}`
  }

  for (const [index, path] of PEDIGREE_PATHS.entries()) {
    const node = byPath.get(path)
    if (node === undefined) return `snapshot is missing ${path}`
    const expectedGeneration = index === 0 ? 0 : index < 3 ? 1 : index < 7 ? 2 : 3
    if (node.generation !== expectedGeneration) {
      return `${path} is generation ${node.generation}, expected ${expectedGeneration}`
    }
  }

  return null
}

export function isCompletePedigreeSnapshot(value: unknown): value is PedigreeSnapshot {
  return pedigreeSnapshotProblem(value) === null
}
