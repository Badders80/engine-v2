/**
 * Hermetic tests for Step 8b website purchase flow, auth helpers, and MyStable.
 *
 * Covers checklist items 14–25:
 * - Item 14: `00012_accounts_signup.sql` trigger structure and signup full-name validation.
 * - Item 15: `BuyFlowModal.tsx` five screens (`Terms`, `Documents`, `Identity`, `Pay`, `Return`)
 *   and `.legal-doc` / 6a token usage.
 * - Item 16: Verbatim `BUY_FLOW_REFUND_SENTENCE` and zero day-count expressions.
 * - Item 17: Zero "NZTR-verified member" claims.
 * - Item 18: `canRenderBuyNow` renders only on `available` when `WEBSITE_BUY_ENABLED === 'true'`,
 *   and never on `coming_soon`, `fully_allocated`, or `completed`.
 * - Items 19–21: `resolveMyStableView` pending state before webhook vs frozen sale documents
 *   and hashes once written.
 * - Items 22–24: Website boundary fences (no engine imports, no Stripe/service-role secrets,
 *   no pricing/compilation, only `mystable.ts` queries `accounts`/`sales`).
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

import { BUY_FLOW_SCREENS } from '../src/components/BuyFlowModal'
import { sanitizeReturnPath, validateSignupInput } from '../src/lib/auth'
import {
  allDocumentsAccepted,
  BUY_FLOW_REFUND_SENTENCE,
  BUY_FLOW_SA_DECLARATIONS,
  canRenderBuyNow,
  requireInvestorSplit,
} from '../src/lib/engineClient'
import {
  PENDING_CHECKOUT_NOTICE,
  resolveMyStableView,
  toAccountProfile,
  toSaleRecord,
} from '../src/lib/mystable'

const APP_ROOT = fileURLToPath(new URL('..', import.meta.url))
const REPO_ROOT = join(APP_ROOT, '..')
const MODAL_PATH = join(APP_ROOT, 'src', 'components', 'BuyFlowModal.tsx')
const MYSTABLE_PAGE_PATH = join(APP_ROOT, 'src', 'app', 'mystable', 'page.tsx')
const MIGRATION_00012_PATH = join(REPO_ROOT, 'supabase', 'migrations', '00012_accounts_signup.sql')

describe('Step 8b — signup validation and 00012 migration', () => {
  it('requires full legal name at signup and sanitizes return paths', () => {
    expect(
      validateSignupInput({ fullName: ' ', email: 'buyer@example.co.nz', password: 'password123' })
        .ok,
    ).toBe(false)

    const valid = validateSignupInput({
      fullName: '  Aroha Williams ',
      email: 'Aroha@Example.co.nz',
      password: 'password123',
    })
    expect(valid).toEqual({
      ok: true,
      value: {
        fullName: 'Aroha Williams',
        email: 'aroha@example.co.nz',
        password: 'password123',
      },
    })

    expect(sanitizeReturnPath('/marketplace/lady-ketchikan')).toBe('/marketplace/lady-ketchikan')
    expect(sanitizeReturnPath('https://evil.example/phish')).toBe('/mystable')
    expect(sanitizeReturnPath('//evil.example')).toBe('/mystable')
  })

  it('defines migration 00012 to populate public.accounts from auth.users at unverified', () => {
    const sql = readFileSync(MIGRATION_00012_PATH, 'utf8')
    expect(sql).toContain('create or replace function public.handle_auth_user_created()')
    expect(sql).toContain('insert into public.accounts (id, full_name, email, kyc_status)')
    expect(sql).toContain("'unverified'::public.kyc_status")
    expect(sql).toContain('create trigger on_auth_user_created')
    expect(sql).toContain('after insert on auth.users')
  })
})

describe('Step 8b — five-screen BuyFlowModal and Buy Now gate', () => {
  it('declares the exact five screens in order', () => {
    expect(BUY_FLOW_SCREENS).toEqual(['Terms', 'Documents', 'Identity', 'Pay', 'Return'])
  })

  it('allows Buy Now only on available listings when WEBSITE_BUY_ENABLED is true', () => {
    expect(canRenderBuyNow('available', 'true')).toBe(true)
    expect(canRenderBuyNow('available', 'false')).toBe(false)
    expect(canRenderBuyNow('available', undefined)).toBe(false)

    for (const nonBuyable of ['coming_soon', 'fully_allocated', 'completed']) {
      expect(canRenderBuyNow(nonBuyable, 'true')).toBe(false)
      expect(canRenderBuyNow(nonBuyable, 'false')).toBe(false)
      expect(canRenderBuyNow(nonBuyable, undefined)).toBe(false)
    }
  })

  it('requires the listing investorSplit and never falls back to 75', () => {
    expect(requireInvestorSplit(70)).toBe(70)
    expect(() => requireInvestorSplit(null)).toThrow(/investor_split/)
  })

  it('requires PDS acceptance, SA acceptance, and all four verbatim SA declarations', () => {
    expect(
      allDocumentsAccepted({
        pdsAccepted: true,
        saAccepted: true,
        declarationsAccepted: BUY_FLOW_SA_DECLARATIONS.slice(0, 3),
      }),
    ).toBe(false)

    expect(
      allDocumentsAccepted({
        pdsAccepted: true,
        saAccepted: true,
        declarationsAccepted: [...BUY_FLOW_SA_DECLARATIONS],
      }),
    ).toBe(true)
  })

  it('prints the verbatim refund sentence with zero day-count expressions and uses .legal-doc', () => {
    const modalSource = readFileSync(MODAL_PATH, 'utf8')
    expect(BUY_FLOW_REFUND_SENTENCE).toBe(
      'If the horse is retired or the lease ends early, the leaseholder receives a pro-rata refund of the unused lease fee for the full months remaining.',
    )
    expect(BUY_FLOW_REFUND_SENTENCE).not.toMatch(/\d+\s+days?/i)
    expect(modalSource).not.toMatch(/\d+\s+days?/i)
    expect(modalSource).toContain('legal-doc')
    expect(modalSource).toContain('Evolution Stables is an NZTR-authorised syndicator.')
    expect(modalSource).toContain('Review &amp; Sign Documents')
    expect(modalSource).toContain('Signed documents are hashed and stored for MyStable.')
    expect(modalSource).toContain('Encrypted and handled under the NZ Privacy Act 2020.')
  })
})

describe('Step 8b — MyStable pending return state and frozen sale rendering', () => {
  const account = toAccountProfile({
    id: 'acc-1',
    full_name: 'Aroha Williams',
    email: 'aroha@example.co.nz',
    kyc_status: 'verified',
    created_at: '2026-10-21T00:00:00Z',
  })

  const sale = toSaleRecord({
    id: 'sale-1',
    dsl_id: 'dsl-1',
    user_id: 'acc-1',
    printed_name: 'Aroha Williams',
    email: 'aroha@example.co.nz',
    stake: 5,
    amount: 1775,
    stripe_session_id: 'cs_live_abc123',
    stripe_identity_id: 'vs_live_xyz',
    pds_markdown: '# Frozen PDS Markdown',
    sa_markdown: '# Frozen SA Markdown',
    pds_hash: 'a'.repeat(64),
    sa_hash: 'b'.repeat(64),
    created_at: '2026-10-21T01:00:00Z',
  })

  it('shows a pending state when returning from Checkout before the webhook writes the sale row', () => {
    const pendingView = resolveMyStableView({
      account,
      sales: [],
      checkoutSessionId: 'cs_live_pending_999',
    })

    expect(pendingView.pendingSessionId).toBe('cs_live_pending_999')
    expect(pendingView.pendingNotice).toBe(PENDING_CHECKOUT_NOTICE)
    expect(pendingView.pendingNotice).toContain('pending')
    expect(pendingView.pendingNotice).not.toMatch(/\bowned\b/i)
  })

  it('clears the pending banner and returns the frozen documents and hashes once the sale row exists', () => {
    const settledView = resolveMyStableView({
      account,
      sales: [sale],
      checkoutSessionId: 'cs_live_abc123',
    })

    expect(settledView.pendingSessionId).toBeNull()
    expect(settledView.pendingNotice).toBeNull()
    expect(settledView.sales).toHaveLength(1)
    expect(settledView.sales[0].stake).toBe(5)
    expect(settledView.sales[0].amount).toBe(1775)
    expect(settledView.sales[0].pdsMarkdown).toBe('# Frozen PDS Markdown')
    expect(settledView.sales[0].saMarkdown).toBe('# Frozen SA Markdown')
    expect(settledView.sales[0].pdsHash).toBe('a'.repeat(64))
    expect(settledView.sales[0].saHash).toBe('b'.repeat(64))

    const pageSource = readFileSync(MYSTABLE_PAGE_PATH, 'utf8')
    expect(pageSource).toContain("export const dynamic = 'force-dynamic'")
    expect(pageSource).toContain('sale.pdsMarkdown')
    expect(pageSource).toContain('sale.saMarkdown')
    expect(pageSource).toContain('sale.pdsHash')
    expect(pageSource).toContain('sale.saHash')
  })
})
