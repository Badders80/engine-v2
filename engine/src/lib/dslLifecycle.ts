/**
 * The operator-facing lifecycle for one DSL.
 *
 * This is derived from two facts that remain independent in storage:
 * whether the offer is published, and whether at least one sale exists.
 * It does not replace `DslStatus`, which still controls inventory and
 * checkout availability.
 */

export const DSL_LIFECYCLE_VALUES = ['dsl', 'published_dsl', 'executed_dsl'] as const

export type DslLifecycle = (typeof DSL_LIFECYCLE_VALUES)[number]

export type DslLifecycleFacts = {
  published: boolean
  hasExecutedSale: boolean
}

export function dslLifecycle({
  published,
  hasExecutedSale,
}: DslLifecycleFacts): DslLifecycle {
  if (hasExecutedSale) return 'executed_dsl'
  if (published) return 'published_dsl'
  return 'dsl'
}

const LABELS: Record<DslLifecycle, string> = {
  dsl: 'DSL',
  published_dsl: 'Published DSL',
  executed_dsl: 'Executed DSL',
}

export function dslLifecycleLabel(lifecycle: DslLifecycle): string {
  return LABELS[lifecycle]
}
