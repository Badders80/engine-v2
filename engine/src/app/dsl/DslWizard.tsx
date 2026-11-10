'use client'

/**
 * The four-step DSL wizard. Chunk 3, U4/U7/U14.
 *
 * One `<form>`; the steps are shown and hidden client-side; the only submit is
 * Confirm inside the Review popup. The server action re-validates everything
 * and is authoritative, so a browser with JavaScript disabled can still not
 * write an illegal deal (it cannot drive the wizard at all, which is the safe
 * failure).
 *
 * The wizard authors nothing. Every party and horse is an existing Records id;
 * the three soft-content textareas are prefilled and only become deal-local
 * overrides when the operator changes them.
 */

import { useMemo, useRef, useState } from 'react'

import type { CloseStyle, DslRow, HorseRow, PartyRow, PaymentModel } from '@/lib/dslStore'
import { resolveNarrative } from '@/lib/narrative'
import {
  floatTotal,
  retailPerPercentFromWholesale,
  upfrontTotal,
  wholesaleFromRetail,
} from '@/lib/pricing'
import { buildTermSheet } from '@/lib/termSheet'
import {
  durationFromCurrentMonth,
  lastDayOfMonthKey,
  monthKey,
  paymentModelAllowed,
} from '@/lib/term'

import { Button, ErrorSlot, Field, FieldGroup, Stepper } from '../_components/forms'

export type WizardHorse = {
  id: string
  legalName: string
  slug: string
  facts: {
    foalingDate: string
    sex: string
    colour: string
    breeder: string | null
    sireName: string
    damName: string
    microchip: string | null
    lifeNumber: string | null
    registered: boolean
    imageCount: number
  }
  aboutHorse: string | null
  racingOutlookAndPedigree: string | null
  raceExpectation: string | null
  terms: { id: string; endDate: string | null; listedStake: number | null }[]
}

export type WizardTrainer = {
  id: string
  displayName: string
  company: string | null
  bio: string | null
}

export type WizardOwner = { id: string; displayName: string }

export type WizardDefaults = {
  dslId?: string
  horseId?: string | null
  trainerId?: string | null
  ownerId?: string | null
  wholesale?: number | null
  retail?: number | null
  investorSplit?: number | null
  listedStake?: number | null
  minStake?: number | null
  step?: number | null
  endDate?: string | null
  paymentModel?: PaymentModel | null
  closeStyle?: CloseStyle | null
  distributionSchedule?: string | null
  narrative: {
    aboutHorse: string
    racingOutlook: string
    raceExpectation: string
    trainerBio: string
  }
  overridden: {
    aboutHorse: boolean
    racingOutlook: boolean
    raceExpectation: boolean
  }
}

type Props = {
  action: (formData: FormData) => Promise<void>
  mode: 'create' | 'edit'
  defaults: WizardDefaults
  horses: readonly WizardHorse[]
  trainers: readonly WizardTrainer[]
  owners: readonly WizardOwner[]
  error?: string | null
}

const STEPS = ['Parties', 'Commercials', 'Terms', 'Narrative'] as const

function text(value: string | null | undefined): string {
  return value ?? ''
}

function numberText(value: number | null | undefined): string {
  return value === null || value === undefined ? '' : String(value)
}

function money(amount: number): string {
  return `$${amount.toFixed(2)}`
}

/**
 * What the server will store for a slot: empty when the textarea still carries
 * the Records text (untouched), otherwise the deal-local override.
 */
function overrideValue(typed: string, base: string): string {
  return typed.trim() === base.trim() ? '' : typed
}

export function DslWizard({
  action,
  mode,
  defaults,
  horses,
  trainers,
  owners,
  error = null,
}: Props) {
  const formRef = useRef<HTMLFormElement>(null)

  const [step, setStep] = useState(1)
  const [reviewOpen, setReviewOpen] = useState(false)

  const [horseId, setHorseId] = useState(defaults.horseId ?? '')
  const [trainerId, setTrainerId] = useState(defaults.trainerId ?? '')
  const [ownerId, setOwnerId] = useState(defaults.ownerId ?? '')

  const [wholesale, setWholesale] = useState(numberText(defaults.wholesale))
  const [retail, setRetail] = useState(
    numberText(
      defaults.retail ??
        (defaults.wholesale === null || defaults.wholesale === undefined
          ? null
          : retailPerPercentFromWholesale(defaults.wholesale)),
    ),
  )
  const [priceError, setPriceError] = useState<string | null>(null)

  const [investorSplit, setInvestorSplit] = useState(numberText(defaults.investorSplit))
  const [listedStake, setListedStake] = useState(numberText(defaults.listedStake))
  const [minStake, setMinStake] = useState(numberText(defaults.minStake))
  const [stepSize, setStepSize] = useState(numberText(defaults.step))

  const [expiryMonth, setExpiryMonth] = useState(
    defaults.endDate === null || defaults.endDate === undefined
      ? ''
      : (monthKey(defaults.endDate) ?? ''),
  )
  const [paymentModel, setPaymentModel] = useState<PaymentModel | ''>(
    defaults.paymentModel ?? '',
  )
  const [closeStyle, setCloseStyle] = useState<CloseStyle | ''>(defaults.closeStyle ?? '')
  const [distributionSchedule, setDistributionSchedule] = useState(
    text(defaults.distributionSchedule),
  )

  const [aboutText, setAboutText] = useState(defaults.narrative.aboutHorse)
  const [outlookText, setOutlookText] = useState(defaults.narrative.racingOutlook)
  const [expectationText, setExpectationText] = useState(defaults.narrative.raceExpectation)

  const horse = horses.find((entry) => entry.id === horseId) ?? null
  const trainer = trainers.find((entry) => entry.id === trainerId) ?? null
  const owner = owners.find((entry) => entry.id === ownerId) ?? null

  // The editor uses the same resolver as readiness, the compiler and the term
  // sheet. With no overrides it is the Records baseline; the trainer bio always
  // resolves from the selected party and is never a named form field.
  const recordsResolved = resolveNarrative(horse, null, trainer)
  const trainerBio = recordsResolved['trainer.bio'].text ?? ''
  const baseAbout = recordsResolved['horse.about_horse'].text ?? ''
  const baseOutlook = recordsResolved['horse.racing_outlook_and_pedigree'].text ?? ''
  const baseExpectation = recordsResolved['horse.race_expectation'].text ?? ''

  /** A new horse brings its own Records text; the wizard prefills all three. */
  function changeHorse(nextId: string) {
    setHorseId(nextId)
    const next = horses.find((entry) => entry.id === nextId) ?? null
    const nextResolved = resolveNarrative(next, null, null)
    setAboutText(nextResolved['horse.about_horse'].text ?? '')
    setOutlookText(nextResolved['horse.racing_outlook_and_pedigree'].text ?? '')
    setExpectationText(nextResolved['horse.race_expectation'].text ?? '')
  }

  const endDate = expiryMonth === '' ? null : lastDayOfMonthKey(expiryMonth)
  const duration = durationFromCurrentMonth(endDate)

  // A 5-month-or-shorter term must use upfront. Changing the expiry re-filters
  // the options. The effective model is derived, never set during render: an
  // illegal stored choice is shown and submitted as upfront until the operator
  // picks again on a longer term.
  const effectiveModel: PaymentModel | '' =
    paymentModel === ''
      ? ''
      : duration !== null && !paymentModelAllowed(paymentModel, duration)
        ? 'upfront'
        : paymentModel

  const retailNumber = Number(retail)
  const wholesaleNumber = Number(wholesale)

  const initialPerPercent = useMemo(() => {
    if (!Number.isFinite(retailNumber) || retailNumber <= 0) return null
    if (duration === null || effectiveModel === '') return null
    return effectiveModel === 'upfront'
      ? upfrontTotal(duration, retailNumber, 1)
      : floatTotal(retailNumber, 1)
  }, [duration, effectiveModel, retailNumber])

  const termsTotal = useMemo(() => {
    if (horse === null) return { count: 0, total: 0 }
    return {
      count: horse.terms.length,
      total: horse.terms.reduce((sum, term) => sum + (term.listedStake ?? 0), 0),
    }
  }, [horse])

  function changeWholesale(raw: string) {
    setWholesale(raw)
    const parsed = Number(raw)
    if (raw === '' || !Number.isFinite(parsed) || parsed <= 0) {
      setRetail('')
      setPriceError(raw === '' ? null : 'The wholesale rate must be above zero.')
      return
    }
    setRetail(String(retailPerPercentFromWholesale(parsed)))
    setPriceError(null)
  }

  function changeRetail(raw: string) {
    setRetail(raw)
    const parsed = Number(raw)
    if (raw === '' || !Number.isFinite(parsed) || parsed <= 0) {
      setWholesale('')
      setPriceError(raw === '' ? null : 'The retail rate must be above zero.')
      return
    }
    const derived = wholesaleFromRetail(parsed)
    if (derived === null) {
      setWholesale('')
      setPriceError(
        `No whole-dollar wholesale rate reproduces ${money(parsed)}. Pick another retail rate.`,
      )
      return
    }
    setWholesale(String(derived))
    setPriceError(null)
  }

  const gaps = reviewGaps({
    horse,
    trainer,
    owner,
    endDate,
    closeStyle,
    wholesale,
    investorSplit,
    listedStake,
    minStake,
    stepSize,
    distributionSchedule,
    aboutText,
    outlookText,
    expectationText,
    trainerBio,
  })

  const ownerStep =
    horse === null || trainer === null || owner === null
      ? 1
      : wholesale.trim() === '' ||
          investorSplit.trim() === '' ||
          listedStake.trim() === '' ||
          minStake.trim() === '' ||
          stepSize.trim() === ''
        ? 2
        : endDate === null
          ? 2
          : paymentModel === '' ||
              closeStyle === '' ||
              distributionSchedule.trim() === ''
            ? 3
            : 4

  function saveAndReview() {
    // Leaving step 4 opens the popup; nothing is written until Confirm.
    setReviewOpen(true)
  }

  function confirm() {
    formRef.current?.requestSubmit()
  }

  // The Review is the real one-pager: `buildTermSheet` is the same function the
  // /dsl/[id] page renders, fed the values currently in the wizard. It is not a
  // second layout that can drift.
  const reviewHorse: HorseRow | null =
    horse === null
      ? null
      : {
          id: horse.id,
          slug: horse.slug,
          legalName: horse.legalName,
          barnName: null,
          foalingDate: horse.facts.foalingDate,
          sex: horse.facts.sex,
          colour: horse.facts.colour,
          breeder: horse.facts.breeder,
          sireName: horse.facts.sireName,
          damName: horse.facts.damName,
          microchip: horse.facts.microchip,
          lifeNumber: horse.facts.lifeNumber,
          loveracingId: null,
          registered: horse.facts.registered,
          aboutHorse: horse.aboutHorse,
          racingOutlookAndPedigree: horse.racingOutlookAndPedigree,
          raceExpectation: horse.raceExpectation,
          imageCount: horse.facts.imageCount,
          raceRecord: {},
        }

  const reviewTrainer: PartyRow | null =
    trainer === null
      ? null
      : {
          id: trainer.id,
          displayName: trainer.displayName,
          company: trainer.company,
          contact: null,
          location: null,
          website: null,
          bio: trainer.bio,
          achievements: null,
          other: null,
          xUrl: null,
          facebookUrl: null,
          instagramUrl: null,
          links: [],
          roles: ['trainer'],
        }

  const reviewOwner: PartyRow | null =
    owner === null
      ? null
      : {
          id: owner.id,
          displayName: owner.displayName,
          company: null,
          contact: null,
          location: null,
          website: null,
          bio: null,
          achievements: null,
          other: null,
          xUrl: null,
          facebookUrl: null,
          instagramUrl: null,
          links: [],
          roles: ['owner'],
        }

  const overrideAbout = overrideValue(aboutText, baseAbout)
  const overrideOutlook = overrideValue(outlookText, baseOutlook)
  const overrideExpectation = overrideValue(expectationText, baseExpectation)

  const reviewDsl: DslRow = {
    id: defaults.dslId ?? 'draft',
    horseId,
    trainerId: trainerId === '' ? null : trainerId,
    ownerId: ownerId === '' ? null : ownerId,
    endDate,
    termStart: null,
    paymentModel: effectiveModel === '' ? null : effectiveModel,
    closeStyle: closeStyle === '' ? null : closeStyle,
    status: 'coming_soon',
    published: false,
    wholesaleMonthlyPerPercent: wholesale === '' ? null : wholesaleNumber,
    retailMonthlyPerPercent: retail === '' ? null : retailNumber,
    investorSplit: investorSplit === '' ? null : Number(investorSplit),
    listedStake: listedStake === '' ? null : Number(listedStake),
    minStake: minStake === '' ? null : Number(minStake),
    step: stepSize === '' ? null : Number(stepSize),
    stakeRemaining: listedStake === '' ? null : Number(listedStake),
    distributionSchedule: distributionSchedule === '' ? null : distributionSchedule,
    narrativeSignoff: null,
    narrativeApprovedAt: null,
    narrativeApprovedHash: null,
    narrativeAboutHorse: overrideAbout === '' ? null : overrideAbout,
    narrativeRacingOutlook: overrideOutlook === '' ? null : overrideOutlook,
    narrativeRaceExpectation: overrideExpectation === '' ? null : overrideExpectation,
  }

  const reviewResolved = resolveNarrative(
    horse,
    {
      narrativeAboutHorse: reviewDsl.narrativeAboutHorse,
      narrativeRacingOutlook: reviewDsl.narrativeRacingOutlook,
      narrativeRaceExpectation: reviewDsl.narrativeRaceExpectation,
    },
    trainer,
  )

  const reviewSections =
    reviewHorse === null
      ? []
      : buildTermSheet({
          dsl: reviewDsl,
          horse: reviewHorse,
          trainer: reviewTrainer,
          owner: reviewOwner,
          narrative: reviewResolved,
        })

  return (
    <form ref={formRef} action={action} className="grid max-w-3xl gap-6">
      <ErrorSlot message={error} />
      {defaults.dslId === undefined ? null : (
        <input type="hidden" name="dslId" value={defaults.dslId} />
      )}

      <Stepper steps={STEPS} current={step} onSelect={setStep} />

      {/* Step 1 — Parties */}
      <div hidden={step !== 1}>
        <FieldGroup legend="Parties" description="A DSL links Records that already exist. Nothing here authors one.">
          <Field label="Horse" htmlFor="horseId">
            <select
              id="horseId"
              name={mode === 'edit' ? undefined : 'horseId'}
              value={horseId}
              onChange={(event) => changeHorse(event.target.value)}
              disabled={mode === 'edit'}
              required
            >
              <option value="">— choose a horse —</option>
              {horses.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.legalName} — {entry.slug}
                </option>
              ))}
            </select>
            {mode === 'edit' ? <input type="hidden" name="horseId" value={horseId} /> : null}
          </Field>

          <Field label="Trainer" htmlFor="trainerId">
            <select
              id="trainerId"
              name="trainerId"
              value={trainerId}
              onChange={(event) => setTrainerId(event.target.value)}
            >
              <option value="">— choose a trainer —</option>
              {trainers.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.displayName}
                  {entry.company === null ? '' : ` — ${entry.company}`}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Owner" htmlFor="ownerId">
            <select
              id="ownerId"
              name="ownerId"
              value={ownerId}
              onChange={(event) => setOwnerId(event.target.value)}
            >
              <option value="">— choose an owner —</option>
              {owners.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.displayName}
                </option>
              ))}
            </select>
          </Field>
        </FieldGroup>

        {horse === null ? (
          <p className="mt-4 text-body text-low">Choose a horse to see its facts and existing terms.</p>
        ) : (
          <section className="mt-6 rounded-md border border-line bg-panel p-5">
            <h3 className="mb-3">{horse.legalName}</h3>
            <dl className="grid gap-1 text-body">
              <ReadOnlyRow label="Foaling date" value={horse.facts.foalingDate} />
              <ReadOnlyRow label="Sex" value={horse.facts.sex} />
              <ReadOnlyRow label="Colour" value={horse.facts.colour} />
              <ReadOnlyRow label="Breeder" value={horse.facts.breeder ?? '—'} />
              <ReadOnlyRow label="Sire" value={horse.facts.sireName} />
              <ReadOnlyRow label="Dam" value={horse.facts.damName} />
              <ReadOnlyRow label="Microchip" value={horse.facts.microchip ?? '—'} />
              <ReadOnlyRow label="Life number" value={horse.facts.lifeNumber ?? '—'} />
              <ReadOnlyRow label="Registered" value={horse.facts.registered ? 'Yes' : 'No'} />
              <ReadOnlyRow label="Images" value={String(horse.facts.imageCount)} />
            </dl>

            <p className="mt-4 text-body">
              {termsTotal.count === 0
                ? 'No terms yet for this horse.'
                : `${termsTotal.total}% listed across ${termsTotal.count} term${termsTotal.count === 1 ? '' : 's'}.`}
            </p>
            {horse.terms.length === 0 ? null : (
              <ul className="mt-2 grid gap-1 text-caption text-low">
                {horse.terms.map((term) => (
                  <li key={term.id}>
                    {term.endDate ?? 'no expiry'} ·{' '}
                    {term.listedStake === null ? 'stake not set' : `${term.listedStake}%`}
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-2 text-caption text-low">
              The 100% cap is the operator&apos;s manual check. The wizard surfaces the number; it
              does not block.
            </p>
          </section>
        )}

        <StepButtons step={step} setStep={setStep} />
      </div>

      {/* Step 2 — Commercials */}
      <div hidden={step !== 2}>
        <FieldGroup legend="Commercials" description="One price, two ways. Retail stays a whole dollar, rounded up.">
          <div className="grid items-start gap-3 sm:grid-cols-3">
            <Field label="Wholesale cost per 1%, per month" htmlFor="wholesale" error={priceError}>
              <input
                id="wholesale"
                name="wholesaleMonthlyPerPercent"
                type="number"
                step="1"
                min="1"
                value={wholesale}
                onChange={(event) => changeWholesale(event.target.value)}
                required
              />
            </Field>

            <Field
              label="Retail price per 1%, per month"
              htmlFor="retail"
              help="Whole dollars. Typing a retail rate derives the wholesale rate that produces it."
              error={priceError}
            >
              <input
                id="retail"
                type="number"
                step="1"
                min="1"
                value={retail}
                onChange={(event) => changeRetail(event.target.value)}
              />
            </Field>

            {defaults.endDate !== null && defaults.endDate !== undefined && mode === 'edit' ? (
              <Field label="Expiry" htmlFor="expiryFixed">
                <input id="expiryFixed" type="text" value={defaults.endDate} readOnly />
                <input type="hidden" name="expiryMonth" value={expiryMonth} />
              </Field>
            ) : (
              <Field label="Expiry month" htmlFor="expiryMonth">
                <input
                  id="expiryMonth"
                  name="expiryMonth"
                  type="month"
                  value={expiryMonth}
                  onChange={(event) => setExpiryMonth(event.target.value)}
                  required
                />
              </Field>
            )}
          </div>

          <dl className="grid gap-1 rounded-sm border border-line bg-panel p-4 text-body">
            <ReadOnlyRow
              label="Retail"
              value={retail === '' ? '—' : `${money(retailNumber)} / month per 1%`}
            />
            <ReadOnlyRow
              label="Initial payment"
              value={initialPerPercent === null ? '—' : `${money(initialPerPercent)} per 1% stake`}
            />
          </dl>

          <div className="grid items-start gap-3 sm:grid-cols-2">
            <Field label="Investor return, 50 to 85" htmlFor="investorSplit">
              <input
                id="investorSplit"
                name="investorSplit"
                type="number"
                step="0.01"
                min="50"
                max="85"
                value={investorSplit}
                onChange={(event) => setInvestorSplit(event.target.value)}
              />
            </Field>

            <Field label="Listed stake %" htmlFor="listedStake">
              <input
                id="listedStake"
                name="listedStake"
                type="number"
                step="0.01"
                min="0.01"
                value={listedStake}
                onChange={(event) => setListedStake(event.target.value)}
                required
              />
            </Field>

            <Field label="Minimum stake %" htmlFor="minStake">
              <input
                id="minStake"
                name="minStake"
                type="number"
                step="0.01"
                min="0.01"
                value={minStake}
                onChange={(event) => setMinStake(event.target.value)}
                required
              />
            </Field>

            <Field label="Step %" htmlFor="stepSize">
              <input
                id="stepSize"
                name="step"
                type="number"
                step="0.01"
                min="0.01"
                value={stepSize}
                onChange={(event) => setStepSize(event.target.value)}
                required
              />
            </Field>
          </div>
        </FieldGroup>

        <StepButtons step={step} setStep={setStep} />
      </div>

      {/* Step 3 — Terms */}
      <div hidden={step !== 3}>
        <FieldGroup legend="Terms" description="The expiry is set on Commercials. The start is stamped by the sale.">
          <p className="text-body">
            Duration: {duration === null ? '—' : `${duration} months`}
            <span className="text-caption text-low"> (current month to expiry, never stored)</span>
          </p>

          <Field
            label="Payment model"
            htmlFor="paymentModel"
            help={
              duration !== null && duration < 6
                ? 'A term of 5 months or less must use upfront.'
                : 'Both models are available for 6 months or more.'
            }
          >
            <select
              id="paymentModel"
              name="paymentModel"
              value={effectiveModel}
              onChange={(event) => setPaymentModel(event.target.value as PaymentModel | '')}
              required
            >
              <option value="">— choose a payment model —</option>
              {duration !== null && duration < 6 ? null : (
                <option value="subscription_float">subscription_float</option>
              )}
              <option value="upfront">upfront</option>
            </select>
          </Field>

          <Field label="Close style" htmlFor="closeStyle">
            <select
              id="closeStyle"
              name="closeStyle"
              value={closeStyle}
              onChange={(event) => setCloseStyle(event.target.value as CloseStyle | '')}
              required
            >
              <option value="">— choose a close style —</option>
              <option value="fourteen_day">fourteen_day</option>
              <option value="three_x_remaining">three_x_remaining</option>
            </select>
          </Field>

          <Field label="Distribution schedule" htmlFor="distributionSchedule">
            <select
              id="distributionSchedule"
              name="distributionSchedule"
              value={distributionSchedule}
              onChange={(event) => setDistributionSchedule(event.target.value)}
              required
            >
              <option value="">— choose a distribution schedule —</option>
              {distributionSchedule !== '' && distributionSchedule !== 'quarterly' ? (
                <option value={distributionSchedule}>{distributionSchedule}</option>
              ) : null}
              <option value="quarterly">quarterly</option>
            </select>
          </Field>
        </FieldGroup>

        <StepButtons step={step} setStep={setStep} />
      </div>

      {/* Step 4 — Narrative */}
      <div hidden={step !== 4}>
        <FieldGroup
          legend="Narrative"
          description="Prefilled from Records. Edit a horse paragraph to make it deal-local; clear it to read through again."
        >
          <NarrativeSlot
            label="About the horse"
            name="narrativeAboutHorse"
            value={aboutText}
            base={baseAbout}
            overridden={defaults.overridden.aboutHorse}
            onChange={setAboutText}
          />
          <NarrativeSlot
            label="Racing outlook and pedigree"
            name="narrativeRacingOutlook"
            value={outlookText}
            base={baseOutlook}
            overridden={defaults.overridden.racingOutlook}
            onChange={setOutlookText}
          />
          <NarrativeSlot
            label="Race expectation"
            name="narrativeRaceExpectation"
            value={expectationText}
            base={baseExpectation}
            overridden={defaults.overridden.raceExpectation}
            onChange={setExpectationText}
          />

          <Field
            label="Trainer bio"
            htmlFor="trainerBio"
            help="Always resolves from the party. Read-only here; edit it on the trainer page."
          >
            <textarea id="trainerBio" rows={5} value={trainerBio} readOnly />
          </Field>
        </FieldGroup>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Button type="button" onClick={() => setStep(3)}>
            Back
          </Button>
          <Button type="button" variant="primary" onClick={saveAndReview}>
            Review term sheet
          </Button>
        </div>
      </div>

      {/* No other submit control exists. Confirm in the popup is the one write. */}
      <button type="submit" className="hidden" aria-hidden="true" tabIndex={-1}>
        Confirm
      </button>

      {reviewOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Review the term sheet"
          className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4"
        >
          <div className="max-h-[90vh] w-full max-w-2xl overflow-auto rounded-md border border-line bg-panel p-6">
            <h2 className="mb-4">Review term sheet</h2>

            {horse === null ? null : (
              <section className="mt-4">
                <h3 className="mb-2">Horse facts</h3>
                <dl className="grid gap-1">
                  <ReadOnlyRow label="Foaling date" value={horse.facts.foalingDate} />
                  <ReadOnlyRow label="Sex" value={horse.facts.sex} />
                  <ReadOnlyRow label="Colour" value={horse.facts.colour} />
                  <ReadOnlyRow label="Breeder" value={horse.facts.breeder ?? '—'} />
                  <ReadOnlyRow label="Sire" value={horse.facts.sireName} />
                  <ReadOnlyRow label="Dam" value={horse.facts.damName} />
                  <ReadOnlyRow label="Registered" value={horse.facts.registered ? 'Yes' : 'No'} />
                  <ReadOnlyRow label="Images" value={String(horse.facts.imageCount)} />
                </dl>
              </section>
            )}

            {reviewSections.map((section) => (
              <section key={section.title} className="mt-4">
                <h3 className="mb-2">{section.title}</h3>
                <dl className="grid gap-1">
                  {section.rows.map((row) => (
                    <ReadOnlyRow key={row.label} label={row.label} value={row.value} />
                  ))}
                </dl>
              </section>
            ))}

            <section className="mt-4">
              <h3 className="mb-2">Readiness gaps</h3>
              {gaps.length === 0 ? (
                <p className="text-body text-muted-foreground">
                  No field gaps. Publish is available once the narrative is approved.
                </p>
              ) : (
                <ul className="grid list-disc gap-1 pl-5 text-body">
                  {gaps.map((gap) => (
                    <li key={gap}>{gap}</li>
                  ))}
                </ul>
              )}
            </section>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Button type="button" variant="primary" onClick={confirm}>
                Confirm
              </Button>
              <Button
                type="button"
                onClick={() => {
                  setReviewOpen(false)
                  setStep(ownerStep)
                }}
              >
                Edit
              </Button>
              <Button type="button" onClick={() => setReviewOpen(false)}>
                Close
              </Button>
            </div>
            <p className="mt-2 text-caption text-low">
              Edit returns to the step that owns the field. Close writes nothing.
            </p>
          </div>
        </div>
      ) : null}
    </form>
  )
}

function StepButtons({ step, setStep }: { step: number; setStep: (next: number) => void }) {
  return (
    <div className="mt-6 flex items-center gap-3">
      {step > 1 ? (
        <Button type="button" onClick={() => setStep(step - 1)}>
          Back
        </Button>
      ) : null}
      <Button type="button" variant="primary" onClick={() => setStep(step + 1)}>
        Next
      </Button>
    </div>
  )
}

function ReadOnlyRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[10rem_1fr] gap-3">
      <dt className="text-caption uppercase tracking-caption text-muted">{label}</dt>
      <dd className="font-figure text-body">{value}</dd>
    </div>
  )
}

function NarrativeSlot({
  label,
  name,
  value,
  base,
  overridden,
  onChange,
}: {
  label: string
  name: string
  value: string
  base: string
  overridden: boolean
  onChange: (next: string) => void
}) {
  const isOverride = overrideValue(value, base) !== ''

  return (
    <Field label={label} htmlFor={name}>
      <textarea
        id={name}
        rows={5}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      <input type="hidden" name={name} value={overrideValue(value, base)} />
      <p className="text-caption text-low">
        {isOverride
          ? 'Deal-local override. Clear it to read through from Records again.'
          : overridden
            ? 'This slot has a stored override that is not shown. Type to replace it.'
            : 'Reading through from Records live.'}
      </p>
    </Field>
  )
}

function reviewGaps(input: {
  horse: WizardHorse | null
  trainer: WizardTrainer | null
  owner: WizardOwner | null
  endDate: string | null
  closeStyle: CloseStyle | ''
  wholesale: string
  investorSplit: string
  listedStake: string
  minStake: string
  stepSize: string
  distributionSchedule: string
  aboutText: string
  outlookText: string
  expectationText: string
  trainerBio: string
}): string[] {
  const gaps: string[] = []
  const present = (value: string) => value.trim() !== ''
  const positive = (value: string) => {
    const parsed = Number(value)
    return value.trim() !== '' && Number.isFinite(parsed) && parsed > 0
  }

  if (input.owner === null) gaps.push('the owner on the term sheet')
  if (input.trainer === null) gaps.push('the trainer on the term sheet')
  if (input.endDate === null) gaps.push('the expiry')
  if (!present(input.distributionSchedule)) gaps.push('the distribution schedule')
  if (!positive(input.wholesale)) gaps.push('the wholesale cost per 1%')
  if (!positive(input.investorSplit)) gaps.push("the investor's split")
  if (!positive(input.listedStake)) gaps.push('the listed stake')
  if (!positive(input.minStake)) gaps.push('the minimum stake')
  if (!positive(input.stepSize)) gaps.push('the stake step')

  if (input.horse === null) {
    gaps.push('the horse')
    return gaps
  }

  if (!input.horse.facts.registered) gaps.push('a registered horse')
  if (input.horse.facts.imageCount < 3) gaps.push('at least 3 horse images')
  if (!present(input.aboutText)) gaps.push('the about-the-horse paragraph')
  if (!present(input.outlookText)) gaps.push('the racing outlook and pedigree paragraph')
  if (!present(input.expectationText)) gaps.push('the race expectation paragraph')
  if (!present(input.trainerBio)) gaps.push("the trainer's bio")

  return gaps
}
