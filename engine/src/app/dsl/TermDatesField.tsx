'use client'

/**
 * The two term dates. PLAN.md step 7, ruling of 2026-10-20.
 *
 * A legal term runs from the 1st of a month to the last day of a month, and it
 * ends after it starts. The templates say the term is counted in full calendar
 * months, so a mid-month date is not a term.
 *
 * This is a warning, not the gate. The save refuses the same combinations in
 * `checkCommercialTerms`, and migration `00011` refuses them at the database,
 * so submitting without JavaScript still cannot write a mid-month term.
 */

import { useEffect, useRef, useState } from 'react'

import { isMonthEnd, isMonthStart, termMonthsBetween } from '@/lib/term'

type Props = {
  defaultTermStart?: string
  defaultEndDate?: string
}

function problem(start: string, end: string): string | null {
  if (start === '' || end === '') return null
  if (!isMonthStart(start)) return 'The term start must be the 1st of a month.'
  if (!isMonthEnd(end)) return 'The end date must be the last day of its month.'
  if (termMonthsBetween(start, end) === null) return 'The end date must follow the start date.'
  return null
}

export function TermDatesField({ defaultTermStart = '', defaultEndDate = '' }: Props) {
  const startRef = useRef<HTMLInputElement>(null)
  const endRef = useRef<HTMLInputElement>(null)

  const [message, setMessage] = useState<string | null>(
    problem(defaultTermStart, defaultEndDate),
  )

  useEffect(() => {
    const start = startRef.current
    const end = endRef.current
    if (start === null || end === null) return

    const sync = () => setMessage(problem(start.value, end.value))

    sync()
    for (const input of [start, end]) {
      input.addEventListener('input', sync)
      input.addEventListener('change', sync)
    }

    return () => {
      for (const input of [start, end]) {
        input.removeEventListener('input', sync)
        input.removeEventListener('change', sync)
      }
    }
  }, [])

  return (
    <>
      <label>
        Term start
        <input
          ref={startRef}
          type="date"
          name="termStart"
          defaultValue={defaultTermStart}
          required
        />
      </label>

      <label>
        End date
        <input ref={endRef} type="date" name="endDate" defaultValue={defaultEndDate} required />
      </label>

      {message === null ? null : <p role="alert">{message}</p>}
    </>
  )
}
