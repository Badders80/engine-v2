/**
 * The legal token contract. PLAN.md step 7.
 *
 * Every `{{token}}` in the two locked templates and the four block files
 * resolves from one declared key list. `TOKEN_KEYS` is the union; `RESOLVERS`
 * is a `Record` over it, so TypeScript fails if a scalar key loses its
 * resolver, and the loader fails if a key appears in neither the templates nor
 * the blocks.
 *
 * Nothing here invents prose. Every string is a column value, a derived number,
 * or a fixed label the law already states.
 */

import { floatTotal, upfrontTotal } from '../pricing'
import { paymentModelAllowed, termMonthsBetween } from '../term'

import type { CloseStyle, PaymentModel } from '../dslStore'

/** The pack version printed on every document. One constant, bumped by hand. */
export const LEGAL_PACK_VERSION = '1.0.0'

export type LegalPackInput = {
  account: { fullName: string }
  dsl: {
    termStart: string
    endDate: string
    paymentModel: PaymentModel
    closeStyle: CloseStyle
    distributionSchedule: string | null
    investorSplit: number | null
    listedStake: number
    minStake: number
    step: number
    retailMonthlyPerPercent: number
  }
  horse: {
    slug: string
    legalName: string
    foalingDate: string
    sex: string
    colour: string
    breeder: string | null
    sireName: string
    damName: string
    microchip: string | null
    aboutHorse: string | null
    racingOutlookAndPedigree: string | null
    raceExpectation: string | null
  }
  trainer: { name: string; location: string; bio: string | null }
  owner: { entity: string }
  sale: { stake: number; executedDate: string }
}

/** The two tokens whose value is a selected block, not a scalar. */
export const BLOCK_KEYS = ['pds.costs_summary_block', 'pds.close_style_block'] as const
export type BlockKey = (typeof BLOCK_KEYS)[number]

export const SCALAR_KEYS = [
  'account.full_name',
  'dsl.campaign_slug',
  'dsl.distribution_schedule',
  'dsl.end_date',
  'dsl.investor_split',
  'dsl.listed_stake',
  'dsl.min_stake',
  'dsl.owner_retention_split',
  'dsl.payment_model_label',
  'dsl.step',
  'dsl.term_months',
  'dsl.term_start',
  'horse.about_horse',
  'horse.breeder',
  'horse.colour',
  'horse.dam_name',
  'horse.foaling_label',
  'horse.legal_name',
  'horse.microchip',
  'horse.race_expectation',
  'horse.racing_outlook_and_pedigree',
  'horse.sex',
  'horse.sire_name',
  'owner.entity_name',
  'pricing.float_per_percent_nzd',
  'pricing.monthly_lease_payment_unit_nzd',
  'pricing.upfront_per_percent_nzd',
  'sale.executed_date',
  'sale.initial_payment_nzd',
  'sale.monthly_payment_nzd',
  'sale.stake_pct',
  'syndicate.name',
  'syndicate.version',
  'trainer.bio',
  'trainer.location',
  'trainer.name',
] as const
export type ScalarKey = (typeof SCALAR_KEYS)[number]

export const TOKEN_KEYS = [...SCALAR_KEYS, ...BLOCK_KEYS] as const
export type TokenKey = (typeof TOKEN_KEYS)[number]

/** The four soft slots. The SA carries none of them; the PDS carries all four. */
export const SOFT_TOKEN_KEYS = [
  'horse.about_horse',
  'horse.racing_outlook_and_pedigree',
  'horse.race_expectation',
  'trainer.bio',
] as const

const MONTH_LABELS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const

/** `$71.00`, `$1,775.00`. One formatter, one locale, no browser dependency. */
export function money(amount: number): string {
  return new Intl.NumberFormat('en-NZ', { style: 'currency', currency: 'NZD' }).format(amount)
}

/** `2.5`, `2`, `0.1`: two decimals maximum, trailing zeros trimmed. */
export function pct(value: number): string {
  return Number(value.toFixed(2)).toString()
}

/** `2026-05-31` unchanged. The format is the contract, so a bad value throws. */
export function isoDate(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`a legal date must be YYYY-MM-DD (received '${value}')`)
  }
  return value
}

/** `30 Aug 2023`: the date only, never an age, so the hash stays stable. */
export function foalingLabel(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (match === null) {
    throw new Error(`foaling_date must be YYYY-MM-DD (received '${iso}')`)
  }

  const month = Number(match[2])
  if (month < 1 || month > 12) {
    throw new Error(`foaling_date has no month ${match[2]} (received '${iso}')`)
  }

  return `${Number(match[3])} ${MONTH_LABELS[month - 1]} ${match[1]}`
}

function required(value: string | null | undefined, name: string): string {
  const trimmed = typeof value === 'string' ? value.trim() : ''
  if (trimmed === '') throw new Error(`missing required value for ${name}`)
  return trimmed
}

/** The only two blanks a document may carry. */
function notRecorded(value: string | null | undefined): string {
  const trimmed = typeof value === 'string' ? value.trim() : ''
  return trimmed === '' ? 'Not recorded' : trimmed
}

function termMonths(input: LegalPackInput): number {
  const months = termMonthsBetween(input.dsl.termStart, input.dsl.endDate)
  if (months === null || months < 1) throw new Error('term dates are invalid')
  return months
}

function investorSplit(input: LegalPackInput): number {
  if (input.dsl.investorSplit === null) {
    throw new Error('missing required value for dsl.investor_split')
  }
  return input.dsl.investorSplit
}

export const RESOLVERS: Record<ScalarKey, (input: LegalPackInput) => string> = {
  'account.full_name': (input) => required(input.account.fullName, 'account.full_name'),

  'dsl.campaign_slug': (input) => required(input.horse.slug, 'horse.slug'),
  'dsl.distribution_schedule': (input) =>
    required(input.dsl.distributionSchedule, 'dsl.distribution_schedule'),
  'dsl.end_date': (input) => isoDate(input.dsl.endDate),
  'dsl.investor_split': (input) => pct(investorSplit(input)),
  'dsl.listed_stake': (input) => pct(input.dsl.listedStake),
  'dsl.min_stake': (input) => pct(input.dsl.minStake),
  'dsl.owner_retention_split': (input) => pct(100 - investorSplit(input)),
  'dsl.payment_model_label': (input) =>
    input.dsl.paymentModel === 'upfront' ? 'Upfront' : 'Monthly (subscription float)',
  'dsl.step': (input) => pct(input.dsl.step),
  'dsl.term_months': (input) => String(termMonths(input)),
  'dsl.term_start': (input) => isoDate(input.dsl.termStart),

  'horse.about_horse': (input) => required(input.horse.aboutHorse, 'horse.about_horse'),
  'horse.breeder': (input) => notRecorded(input.horse.breeder),
  'horse.colour': (input) => required(input.horse.colour, 'horse.colour'),
  'horse.dam_name': (input) => required(input.horse.damName, 'horse.dam_name'),
  'horse.foaling_label': (input) => foalingLabel(input.horse.foalingDate),
  'horse.legal_name': (input) => required(input.horse.legalName, 'horse.legal_name'),
  'horse.microchip': (input) => notRecorded(input.horse.microchip),
  'horse.race_expectation': (input) =>
    required(input.horse.raceExpectation, 'horse.race_expectation'),
  'horse.racing_outlook_and_pedigree': (input) =>
    required(input.horse.racingOutlookAndPedigree, 'horse.racing_outlook_and_pedigree'),
  'horse.sex': (input) => required(input.horse.sex, 'horse.sex'),
  'horse.sire_name': (input) => required(input.horse.sireName, 'horse.sire_name'),

  'owner.entity_name': (input) => required(input.owner.entity, 'owner.entity_name'),

  'pricing.float_per_percent_nzd': (input) =>
    money(floatTotal(input.dsl.retailMonthlyPerPercent, 1)),
  'pricing.monthly_lease_payment_unit_nzd': (input) =>
    money(input.dsl.retailMonthlyPerPercent),
  'pricing.upfront_per_percent_nzd': (input) =>
    money(upfrontTotal(termMonths(input), input.dsl.retailMonthlyPerPercent, 1)),

  'sale.executed_date': (input) => isoDate(input.sale.executedDate),
  'sale.initial_payment_nzd': (input) =>
    money(
      input.dsl.paymentModel === 'upfront'
        ? upfrontTotal(termMonths(input), input.dsl.retailMonthlyPerPercent, input.sale.stake)
        : floatTotal(input.dsl.retailMonthlyPerPercent, input.sale.stake),
    ),
  'sale.monthly_payment_nzd': (input) =>
    money(input.dsl.retailMonthlyPerPercent * input.sale.stake),
  'sale.stake_pct': (input) => pct(input.sale.stake),

  'syndicate.name': (input) =>
    `${required(input.horse.legalName, 'horse.legal_name')} Syndicate`,
  'syndicate.version': () => LEGAL_PACK_VERSION,

  'trainer.bio': (input) => required(input.trainer.bio, 'trainer.bio'),
  'trainer.location': (input) => required(input.trainer.location, 'trainer.location'),
  'trainer.name': (input) => required(input.trainer.name, 'trainer.name'),
}

/**
 * Every scalar token the input could not resolve. Used by the compiler's
 * validation pass so it fails before a block is rendered.
 */
export function resolveScalars(input: LegalPackInput): Record<ScalarKey, string> {
  const values = {} as Record<ScalarKey, string>
  for (const key of SCALAR_KEYS) {
    values[key] = RESOLVERS[key](input)
  }
  return values
}

/** The float rule, stated once more where the compiler can reach it. */
export function assertPaymentModelEligible(input: LegalPackInput): number {
  const months = termMonths(input)
  if (!paymentModelAllowed(input.dsl.paymentModel, months)) {
    throw new Error(
      `a ${months}-month term must use upfront; subscription_float requires 6 months or more`,
    )
  }
  return months
}
