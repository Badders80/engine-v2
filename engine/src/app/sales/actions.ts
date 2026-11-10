'use server'

/**
 * The ledger's one write: the manual close (U19).
 *
 * Everything that decides anything lives in `@/lib/ledger` and the database's
 * `close_dsl`; this file reads the form and hands the refusal back to the page.
 * `redirect()` sits outside a `try`, because Next implements it by throwing.
 */

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { closeListing } from '@/lib/ledger'
import { createSupabasePurchaseStore } from '@/lib/purchaseStoreSupabase'

function value(form: FormData, key: string): string {
  const raw = form.get(key)
  return typeof raw === 'string' ? raw.trim() : ''
}

export async function closeListingAction(formData: FormData): Promise<void> {
  const dslId = value(formData, 'dslId')
  const reason = value(formData, 'reason')
  const closedBy = value(formData, 'closedBy')

  const result = await closeListing(
    { dslId, reason, closedBy },
    createSupabasePurchaseStore(),
  )

  revalidatePath('/sales')

  if (!result.ok) {
    redirect(
      `/sales?close_error=${encodeURIComponent(result.reason)}&dsl=${encodeURIComponent(dslId)}`,
    )
  }

  redirect(`/sales?closed=${encodeURIComponent(dslId)}`)
}
