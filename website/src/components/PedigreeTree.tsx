import type { PedigreeNode, PedigreeSnapshot } from '../lib/listings'
import { formatHorseName } from '../lib/marketplace'

type PedigreeTreeProps = {
  legalName: string
  sireName: string | null
  damName: string | null
  sex: string | null
  colour: string | null
  age: string | null
  foaled: string | null
  pedigree: PedigreeSnapshot | null
}

type NodeRole = 'horse' | 'sire' | 'dam'

const GEN2_PATHS = ['sire.sire', 'sire.dam', 'dam.sire', 'dam.dam'] as const
const GEN3_PATHS = [
  'sire.sire.sire',
  'sire.sire.dam',
  'sire.dam.sire',
  'sire.dam.dam',
  'dam.sire.sire',
  'dam.sire.dam',
  'dam.dam.sire',
  'dam.dam.dam',
] as const

function PedigreeNodeCard({
  role,
  rawName,
  compact = false,
}: {
  role: NodeRole
  rawName: string | null | undefined
  compact?: boolean
}) {
  const parsed = formatHorseName(rawName)
  const roleLabel = role === 'horse' ? 'Horse' : role === 'sire' ? 'Sire' : 'Dam'

  const pillClass =
    role === 'dam'
      ? 'border-gold/35 bg-gold/10 text-gold'
      : 'border-spot-mint/35 bg-spot-mint/10 text-spot-mint'

  const frameClass =
    role === 'horse'
      ? 'border-spot-mint/40 bg-raised shadow-bevel'
      : 'border-border bg-canvas/70'

  return (
    <div
      className={`min-w-0 rounded-sm border ${frameClass} ${compact ? 'px-2 py-1.5' : 'px-2.5 py-2'}`}
    >
      <div className="flex items-center justify-between gap-1">
        <span
          className={`inline-flex shrink-0 items-center rounded-sm border px-1 py-0.5 font-mono text-micro uppercase tracking-tag leading-none ${pillClass}`}
        >
          {roleLabel}
        </span>
        {parsed.country ? (
          <span className="shrink-0 font-mono text-micro leading-none text-muted-foreground">
            [{parsed.country}]
          </span>
        ) : null}
      </div>
      <p
        className={`mt-1 truncate font-light text-heading ${
          compact ? 'text-xs leading-snug' : 'text-body-small leading-snug'
        }`}
        title={parsed.display}
      >
        {parsed.name}
      </p>
    </div>
  )
}

export function PedigreeTree({
  legalName,
  sireName,
  damName,
  sex,
  colour,
  age,
  foaled,
  pedigree,
}: PedigreeTreeProps) {
  const byPath = new Map<string, PedigreeNode>(
    (pedigree?.nodes ?? []).map((node) => [node.path, node]),
  )

  const subjectName = byPath.get('horse')?.name ?? legalName
  const sireNodeName = byPath.get('sire')?.name ?? sireName
  const damNodeName = byPath.get('dam')?.name ?? damName
  const broodmareSireName = byPath.get('dam.sire')?.name ?? null
  const broodmareSireDisplay = broodmareSireName ? formatHorseName(broodmareSireName).display : '—'

  const breedingRecordUrl =
    pedigree?.sourceUrl && pedigree.sourceUrl.startsWith('https://') ? pedigree.sourceUrl : null

  return (
    <div className="space-y-5">
      <div className="inline-flex flex-wrap items-center gap-3 rounded-pill border border-border bg-surface px-3.5 py-2">
        <span className="rounded-pill border border-spot-mint/40 bg-spot-mint/10 px-2.5 py-0.5 font-mono text-micro uppercase tracking-tag text-spot-mint">
          Broodmare sire
        </span>
        <span className="text-body-small font-light text-heading">{broodmareSireDisplay}</span>
      </div>

      <div className="rounded-lg border border-border bg-surface p-4 md:p-5">
        <div className="overflow-x-auto pb-2">
          <div className="min-w-[540px] lg:min-w-0">
            <div className="grid grid-cols-4 gap-2.5 pb-4 text-center">
              <p className="label-spec truncate text-muted-foreground">Subject</p>
              <p className="label-spec truncate text-muted-foreground">Parents</p>
              <p className="label-spec truncate text-muted-foreground">Grandparents</p>
              <p className="label-spec truncate text-muted-foreground">Great-grandparents</p>
            </div>

            <div className="grid grid-cols-4 items-stretch gap-2.5">
              {/* Generation 0: Subject */}
              <div className="flex min-w-0 flex-col justify-center">
                <PedigreeNodeCard role="horse" rawName={subjectName} />
              </div>

              {/* Generation 1: Sire & Dam */}
              <div className="relative flex min-w-0 flex-col justify-around gap-3 pl-2.5 before:absolute before:bottom-1/4 before:left-0 before:top-1/4 before:w-px before:bg-border">
                <div className="relative min-w-0 before:absolute before:-left-2.5 before:top-1/2 before:h-px before:w-2.5 before:bg-border">
                  <PedigreeNodeCard role="sire" rawName={sireNodeName} />
                </div>
                <div className="relative min-w-0 before:absolute before:-left-2.5 before:top-1/2 before:h-px before:w-2.5 before:bg-border">
                  <PedigreeNodeCard role="dam" rawName={damNodeName} />
                </div>
              </div>

              {/* Generation 2: Grandparents */}
              <div className="flex min-w-0 flex-col justify-around gap-2.5">
                {[0, 2].map((pairStart) => (
                  <div
                    key={pairStart}
                    className="relative flex min-w-0 flex-1 flex-col justify-around gap-2 pl-2.5 before:absolute before:bottom-1/4 before:left-0 before:top-1/4 before:w-px before:bg-border"
                  >
                    {GEN2_PATHS.slice(pairStart, pairStart + 2).map((path) => (
                      <div
                        key={path}
                        className="relative min-w-0 before:absolute before:-left-2.5 before:top-1/2 before:h-px before:w-2.5 before:bg-border"
                      >
                        <PedigreeNodeCard
                          role={path.endsWith('.sire') ? 'sire' : 'dam'}
                          rawName={byPath.get(path)?.name ?? null}
                          compact
                        />
                      </div>
                    ))}
                  </div>
                ))}
              </div>

              {/* Generation 3: Great-grandparents */}
              <div className="flex min-w-0 flex-col justify-between gap-2">
                {[0, 2, 4, 6].map((pairStart) => (
                  <div
                    key={pairStart}
                    className="relative flex min-w-0 flex-col gap-1.5 pl-2.5 before:absolute before:bottom-1/4 before:left-0 before:top-1/4 before:w-px before:bg-border"
                  >
                    {GEN3_PATHS.slice(pairStart, pairStart + 2).map((path) => (
                      <div
                        key={path}
                        className="relative min-w-0 before:absolute before:-left-2.5 before:top-1/2 before:h-px before:w-2.5 before:bg-border"
                      >
                        <PedigreeNodeCard
                          role={path.endsWith('.sire') ? 'sire' : 'dam'}
                          rawName={byPath.get(path)?.name ?? null}
                          compact
                        />
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-border pt-4">
          <dl className="flex flex-wrap gap-x-6 gap-y-2 text-body-small font-light">
            {sex ? (
              <div className="flex items-baseline gap-1.5">
                <dt className="text-muted-foreground">Sex:</dt>
                <dd className="text-heading">{sex}</dd>
              </div>
            ) : null}
            {colour ? (
              <div className="flex items-baseline gap-1.5">
                <dt className="text-muted-foreground">Colour:</dt>
                <dd className="text-heading">{colour}</dd>
              </div>
            ) : null}
            {age ? (
              <div className="flex items-baseline gap-1.5">
                <dt className="text-muted-foreground">Age:</dt>
                <dd className="text-heading">{age}</dd>
              </div>
            ) : null}
            {foaled ? (
              <div className="flex items-baseline gap-1.5">
                <dt className="text-muted-foreground">Foaled:</dt>
                <dd className="text-heading">{foaled}</dd>
              </div>
            ) : null}
          </dl>

          {breedingRecordUrl ? (
            <a
              href={breedingRecordUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="label-action inline-flex min-h-11 items-center gap-1.5 text-spot-mint transition-colors duration-hover hover:text-heading focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-edge"
            >
              Full breeding record <span aria-hidden="true">↗</span>
            </a>
          ) : null}
        </div>
      </div>
    </div>
  )
}
