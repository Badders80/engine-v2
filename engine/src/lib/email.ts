/**
 * The four transactional emails sent by the engine, and no others.
 * PLAN.md step 9 (`OUTCOME.md:74`, `PLAN.md:234-238`, `:317`, `:343`,
 * `engine/OPERATIONS.md:195-204`).
 *
 * Strictly closed over `EMAIL_KINDS`:
 *   1. `buyer_sale_written`        — to the buyer (`sale.email`), with stake, amount, and MyStable link
 *   2. `buyer_kyc_failed`          — to the buyer (`account.email`) when Stripe Identity fails/cancels
 *   3. `founder_sale_succeeded`    — to the founder (`sender.founderEmail`) when a new sale is written
 *   4. `founder_our_fault_failure` — to the founder (`sender.founderEmail`) when checkout or webhook
 *                                    fails for a reason that is ours (never on card decline,
 *                                    expired checkout, or buyer validation rejection)
 *
 * Uses HTTP API transport configured via `ENGINE_EMAIL_*` / `ENGINE_FOUNDER_EMAIL` in production
 * and an in-memory recorder in hermetic tests. Zero Gmail SMTP is used anywhere.
 */

import type { AccountRow, SaleRow } from './purchaseStore'

export const EMAIL_KINDS = [
  'buyer_sale_written',
  'buyer_kyc_failed',
  'founder_sale_succeeded',
  'founder_our_fault_failure',
] as const

export type EmailKind = (typeof EMAIL_KINDS)[number]

export const MYSTABLE_URL = 'https://www.evolutionstables.nz/mystable'

export const ENGINE_EMAIL_API_URL_ENV = 'ENGINE_EMAIL_API_URL'
export const ENGINE_EMAIL_API_KEY_ENV = 'ENGINE_EMAIL_API_KEY'
export const ENGINE_EMAIL_FROM_ENV = 'ENGINE_EMAIL_FROM'
export const ENGINE_FOUNDER_EMAIL_ENV = 'ENGINE_FOUNDER_EMAIL'

export type EmailMessage = {
  kind: EmailKind
  to: string
  subject: string
  text: string
}

export interface EmailSender {
  readonly founderEmail: string
  send(message: EmailMessage): Promise<void>
}

export type InMemoryEmailSender = EmailSender & {
  readonly sent: EmailMessage[]
}

export type EmailDispatchInput =
  | {
      kind: 'buyer_sale_written'
      sale: SaleRow
      horseLegalName: string
    }
  | {
      kind: 'buyer_kyc_failed'
      account: AccountRow
    }
  | {
      kind: 'founder_sale_succeeded'
      sale: SaleRow
      horseLegalName: string
    }
  | {
      kind: 'founder_our_fault_failure'
      stage: 'checkout' | 'webhook'
      reason: string
    }

function requireEmailAddress(value: string, label: string): string {
  const trimmed = value.trim()
  if (trimmed === '' || !trimmed.includes('@')) {
    throw new Error(`${label} must be a non-empty email address`)
  }
  return trimmed
}

export function buildBuyerSaleWrittenEmail(input: {
  sale: SaleRow
  horseLegalName: string
}): EmailMessage {
  const to = requireEmailAddress(input.sale.email, 'sale.email')
  return {
    kind: 'buyer_sale_written',
    to,
    subject: `Evolution Stables — Your ${input.sale.stake}% stake in ${input.horseLegalName}`,
    text: [
      `Kia ora ${input.sale.printedName},`,
      '',
      `Your purchase in ${input.horseLegalName} has been recorded.`,
      `Stake: ${input.sale.stake}%`,
      `Amount paid: $${input.sale.amount} NZD`,
      '',
      `View your stake and signed documents in MyStable: ${MYSTABLE_URL}`,
    ].join('\n'),
  }
}

export function buildBuyerKycFailedEmail(input: { account: AccountRow }): EmailMessage {
  const to = requireEmailAddress(input.account.email, 'account.email')
  return {
    kind: 'buyer_kyc_failed',
    to,
    subject: 'Evolution Stables — Identity verification could not be completed',
    text: [
      `Kia ora ${input.account.fullName},`,
      '',
      'We could not complete your identity verification with your New Zealand driver licence or passport.',
      'Your purchase has not proceeded to payment and no charge has been made.',
    ].join('\n'),
  }
}

export function buildFounderSaleSucceededEmail(
  input: { sale: SaleRow; horseLegalName: string },
  sender: EmailSender,
): EmailMessage {
  const to = requireEmailAddress(sender.founderEmail, 'sender.founderEmail')
  return {
    kind: 'founder_sale_succeeded',
    to,
    subject: `Sale succeeded — ${input.horseLegalName} (${input.sale.stake}%)`,
    text: [
      `Horse: ${input.horseLegalName}`,
      `Buyer: ${input.sale.printedName} <${input.sale.email}>`,
      `Stake: ${input.sale.stake}%`,
      `Amount: $${input.sale.amount} NZD`,
      `Stripe Session ID: ${input.sale.stripeSessionId}`,
    ].join('\n'),
  }
}

export function buildFounderOurFaultFailureEmail(
  input: { stage: 'checkout' | 'webhook'; reason: string },
  sender: EmailSender,
): EmailMessage {
  const to = requireEmailAddress(sender.founderEmail, 'sender.founderEmail')
  return {
    kind: 'founder_our_fault_failure',
    to,
    subject: `Engine ${input.stage} failure — action required`,
    text: [
      `Stage: ${input.stage}`,
      `Reason: ${input.reason}`,
      'No sale row was left standing.',
    ].join('\n'),
  }
}

export async function sendEngineEmail(
  input: EmailDispatchInput,
  sender: EmailSender,
): Promise<EmailMessage> {
  const rawKind = (input as { kind: string }).kind
  if (!(EMAIL_KINDS as readonly string[]).includes(rawKind)) {
    throw new Error(
      `Refusing to send unrecognised email kind '${rawKind}'; only the four EMAIL_KINDS are permitted`,
    )
  }

  let message: EmailMessage
  switch (input.kind) {
    case 'buyer_sale_written':
      message = buildBuyerSaleWrittenEmail({
        sale: input.sale,
        horseLegalName: input.horseLegalName,
      })
      break
    case 'buyer_kyc_failed':
      message = buildBuyerKycFailedEmail({ account: input.account })
      break
    case 'founder_sale_succeeded':
      message = buildFounderSaleSucceededEmail(
        { sale: input.sale, horseLegalName: input.horseLegalName },
        sender,
      )
      break
    case 'founder_our_fault_failure':
      message = buildFounderOurFaultFailureEmail(
        { stage: input.stage, reason: input.reason },
        sender,
      )
      break
  }

  await sender.send(message)
  return message
}

export function createInMemoryEmailSender(
  founderEmail: string = 'founder@evolutionstables.nz',
): InMemoryEmailSender {
  const validatedFounderEmail = requireEmailAddress(founderEmail, 'founderEmail')
  const sent: EmailMessage[] = []
  return {
    founderEmail: validatedFounderEmail,
    sent,
    async send(message: EmailMessage) {
      if (!(EMAIL_KINDS as readonly string[]).includes(message.kind)) {
        throw new Error(`Invalid email kind '${String(message.kind)}'`)
      }
      sent.push({ ...message })
    },
  }
}

export function createEmailSenderFromEnv(
  env: Record<string, string | undefined> = process.env,
): EmailSender {
  const apiUrl = (env[ENGINE_EMAIL_API_URL_ENV] ?? '').trim()
  const apiKey = (env[ENGINE_EMAIL_API_KEY_ENV] ?? '').trim()
  const fromAddress = (env[ENGINE_EMAIL_FROM_ENV] ?? '').trim()
  const founderEmail = (env[ENGINE_FOUNDER_EMAIL_ENV] ?? '').trim()

  const missing: string[] = []
  if (apiUrl === '') missing.push(ENGINE_EMAIL_API_URL_ENV)
  if (apiKey === '') missing.push(ENGINE_EMAIL_API_KEY_ENV)
  if (fromAddress === '') missing.push(ENGINE_EMAIL_FROM_ENV)
  if (founderEmail === '') missing.push(ENGINE_FOUNDER_EMAIL_ENV)

  if (missing.length > 0) {
    throw new Error(`Missing required email environment variables: ${missing.join(', ')}`)
  }

  const validatedFrom = requireEmailAddress(fromAddress, ENGINE_EMAIL_FROM_ENV)
  const validatedFounder = requireEmailAddress(founderEmail, ENGINE_FOUNDER_EMAIL_ENV)

  return {
    founderEmail: validatedFounder,
    async send(message: EmailMessage) {
      if (!(EMAIL_KINDS as readonly string[]).includes(message.kind)) {
        throw new Error(`Invalid email kind '${String(message.kind)}'`)
      }
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: validatedFrom,
          to: message.to,
          subject: message.subject,
          text: message.text,
          kind: message.kind,
        }),
      })

      if (!response.ok) {
        const detail = await response.text().catch(() => '')
        throw new Error(
          `Email dispatch (${message.kind}) failed with HTTP ${response.status}${detail ? `: ${detail}` : ''}`,
        )
      }
    },
  }
}
