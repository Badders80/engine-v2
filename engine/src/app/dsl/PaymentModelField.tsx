'use client'

/**
 * The payment-style select. PLAN.md step 7, `PLAN.md:72`.
 *
 * The only client component in the DSL form. It watches the two date inputs in
 * the same form and, while the term is 5 months or less, forces `upfront` and
 * locks the select. Above 5 months both models are offered, and the value the
 * operator had stays selected.
 *
 * JavaScript is not the gate. The server refuses an illegal combination in
 * `checkCommercialTerms`, so submitting without this component still cannot
 * write a 5-month float. This component only prevents the operator from
 * choosing a term the save would reject.
 *
 * A disabled select is not submitted by the browser, so while it is locked the
 * value travels in a hidden input with the same name.
 */

import { useEffect, useRef, useState } from 'react'

import { termMonthsBetween, UPFRONT_MAX_TERM_MONTHS } from '@/lib/term'
import type { PaymentModel } from '@/lib/dslStore'

type Props = {
  defaultValue: PaymentModel
  defaultTermStart?: string
  defaultEndDate?: string
}

function lockedFor(termStart: string, endDate: string): boolean {
  const months = termMonthsBetween(termStart, endDate)
  return months !== null && months >= 1 && months <= UPFRONT_MAX_TERM_MONTHS
}

export function PaymentModelField({
  defaultValue,
  defaultTermStart = '',
  defaultEndDate = '',
}: Props) {
  const selectRef = useRef<HTMLSelectElement>(null)
  const initiallyLocked = lockedFor(defaultTermStart, defaultEndDate)

  const [model, setModel] = useState<PaymentModel>(initiallyLocked ? 'upfront' : defaultValue)
  const [locked, setLocked] = useState(initiallyLocked)

  useEffect(() => {
    const select = selectRef.current
    if (select === null) return
    const form = select.form
    if (form === null) return

    const start = form.elements.namedItem('termStart')
    const end = form.elements.namedItem('endDate')
    if (!(start instanceof HTMLInputElement) || !(end instanceof HTMLInputElement)) return

    const sync = () => {
      const isLocked = lockedFor(start.value, end.value)
      setLocked(isLocked)
      if (isLocked) setModel('upfront')
    }

    sync()
    start.addEventListener('input', sync)
    start.addEventListener('change', sync)
    end.addEventListener('input', sync)
    end.addEventListener('change', sync)

    return () => {
      start.removeEventListener('input', sync)
      start.removeEventListener('change', sync)
      end.removeEventListener('input', sync)
      end.removeEventListener('change', sync)
    }
  }, [])

  return (
    <label>
      Payment style
      {locked ? <input type="hidden" name="paymentModel" value={model} /> : null}
      <select
        ref={selectRef}
        name={locked ? undefined : 'paymentModel'}
        value={model}
        disabled={locked}
        onChange={(event) => setModel(event.target.value as PaymentModel)}
      >
        <option value="subscription_float">subscription_float</option>
        <option value="upfront">upfront</option>
      </select>
      {locked ? <span> A term of 5 months or less must use upfront.</span> : null}
    </label>
  )
}
