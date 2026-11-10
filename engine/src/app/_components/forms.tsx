import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react'

/**
 * The shared form system. DSL side quest U13, PLAN.md §3.
 *
 * One set of primitives used by Records and, later, the DSL wizard: step
 * shell, field group, label and help text, error slot, stepper, summary row.
 * Styled from the theme tokens only; 44px targets; works at 390px.
 */

function classes(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ')
}

export function FormShell({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return <div className={classes('grid max-w-2xl gap-8', className)}>{children}</div>
}

export function FieldGroup({
  legend,
  description,
  children,
}: {
  legend: string
  description?: string
  children: ReactNode
}) {
  return (
    <fieldset className="grid gap-4">
      <legend className="mb-1 text-caption uppercase tracking-caption text-muted">
        {legend}
      </legend>
      {description !== undefined ? <p className="text-caption text-low">{description}</p> : null}
      {children}
    </fieldset>
  )
}

export function Field({
  label,
  htmlFor,
  help,
  error,
  children,
}: {
  label: string
  htmlFor?: string
  help?: string
  error?: string | null
  children: ReactNode
}) {
  return (
    <div className="grid gap-1">
      <label
        htmlFor={htmlFor}
        className="text-caption uppercase tracking-caption text-muted"
      >
        {label}
      </label>
      {children}
      {help !== undefined ? <p className="text-caption text-low">{help}</p> : null}
      {error !== null && error !== undefined ? (
        <p className="text-caption text-ink">{error}</p>
      ) : null}
    </div>
  )
}

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} />
}

export function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} />
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} />
}

export function Button({
  variant = 'secondary',
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' }) {
  return (
    <button
      {...props}
      className={classes(
        'justify-self-start',
        variant === 'primary'
          ? 'border-accent bg-accent text-on-accent hover:border-accent-deep'
          : undefined,
        className,
      )}
    />
  )
}

export function ErrorSlot({ message }: { message: string | null }) {
  if (message === null) return null

  return (
    <p
      role="alert"
      className="rounded-sm border border-line-strong bg-panel px-4 py-3 text-body text-ink"
    >
      {message}
    </p>
  )
}

export function Stepper({
  steps,
  current,
  onSelect,
}: {
  steps: readonly string[]
  current: number
  onSelect?: (step: number) => void
}) {
  return (
    <ol aria-label="Progress" className="flex flex-wrap items-center gap-3">
      {steps.map((step, index) => {
        const state = index < current - 1 ? 'done' : index === current - 1 ? 'current' : 'next'
        const number = index + 1
        const content = (
          <>
            <span
              aria-hidden="true"
              className={classes(
                'flex h-7 w-7 items-center justify-center rounded-full border text-caption',
                state === 'current'
                  ? 'border-accent bg-accent text-on-accent'
                  : 'border-line text-low',
              )}
            >
              {number}
            </span>
            <span
              className={classes(
                'text-caption uppercase tracking-caption',
                state === 'current' ? 'text-ink' : 'text-low',
              )}
            >
              {step}
            </span>
          </>
        )

        return (
          <li key={step} className="flex items-center gap-2">
            {onSelect === undefined ? (
              <span className="flex items-center gap-2">{content}</span>
            ) : (
              <button
                type="button"
                onClick={() => onSelect(number)}
                aria-current={state === 'current' ? 'step' : undefined}
                className="flex min-h-0 cursor-pointer items-center gap-2 rounded-sm border-0 bg-transparent p-0 text-left hover:text-ink"
              >
                {content}
              </button>
            )}
            {index < steps.length - 1 ? (
              <span aria-hidden="true" className="text-low">
                ·
              </span>
            ) : null}
          </li>
        )
      })}
    </ol>
  )
}

export function SummaryRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="grid grid-cols-[10rem_1fr] gap-3 border-b border-line py-2">
      <dt className="text-caption uppercase tracking-caption text-muted">{label}</dt>
      <dd className="font-figure text-body">{value}</dd>
    </div>
  )
}
