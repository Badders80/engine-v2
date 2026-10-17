import { viewForStatus } from '../lib/status'

/**
 * The status badge. PLAN.md step 6b-ii.
 *
 * `website/DESIGN.md:567` rules this as **one component with one map**, so it
 * lives here once rather than being written into each page. The map itself is
 * `website/src/lib/status.ts`; this file only decides how the result looks.
 *
 * Anatomy, per DESIGN.md: a dot, the label, and a glow on the active variant only.
 * The dot carries the semantic colour and the label stays neutral — a status
 * answers what something is, and colouring the word as well would make it read as
 * a call to action, which DESIGN.md forbids outright.
 *
 * Always a pill, and positioned by whoever renders it: no margin, no alignment,
 * nothing that assumes where it sits.
 */
export default function StatusBadge({ status }: { status: string }) {
  const view = viewForStatus(status)

  return (
    <span className="label-badge inline-flex items-center gap-2 rounded-pill border border-border bg-surface px-3 py-1 uppercase text-heading">
      <span
        aria-hidden
        className={[
          'block size-1.5 rounded-pill',
          view.className,
          view.glow ? 'shadow-glow-success' : '',
        ]
          .filter(Boolean)
          .join(' ')}
      />
      {view.label}
    </span>
  )
}
