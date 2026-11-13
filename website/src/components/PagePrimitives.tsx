import type { ReactNode } from 'react'

export const PAGE_CONTAINER =
  'mx-auto w-full max-w-6xl px-12 md:px-16 lg:px-20'

export function PageShell({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return <main className={`bg-canvas text-ink ${className}`.trim()}>{children}</main>
}

export function PageContainer({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return <div className={`${PAGE_CONTAINER} ${className}`.trim()}>{children}</div>
}

export function PageIntro({
  eyebrow,
  title,
  description,
  actions,
  className = '',
}: {
  eyebrow?: ReactNode
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
  className?: string
}) {
  return (
    <section
      className={`${PAGE_CONTAINER} pt-32 pb-16 ${className}`.trim()}
      data-reveal
      data-reveal-mode="fade"
    >
      {actions ? (
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">{actions}</div>
      ) : null}
      {eyebrow ? <p className="label-eyebrow text-muted-foreground">{eyebrow}</p> : null}
      <h1 className="mt-6 max-w-3xl text-display leading-display tracking-display text-heading">
        {title}
      </h1>
      {description ? (
        <p className="mt-8 max-w-xl text-body-small leading-body text-muted-foreground">
          {description}
        </p>
      ) : null}
    </section>
  )
}

export function PageSection({
  children,
  className = '',
  id,
}: {
  children: ReactNode
  className?: string
  id?: string
}) {
  return (
    <section id={id} className={`${PAGE_CONTAINER} ${className}`.trim()}>
      {children}
    </section>
  )
}
