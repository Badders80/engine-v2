/**
 * Edit one DSL through the same wizard. Chunk 3.
 *
 * The horse is fixed: an edit changes the deal, not which horse it is about.
 * The expiry is fixed too (creation set it). The wizard writes one `dsls` row.
 */

import Link from 'next/link'
import { notFound } from 'next/navigation'

import { resolveNarrative } from '@/lib/narrative'

import { recordStore } from '../../../records/store'
import { DslWizard, type WizardHorse } from '../../DslWizard'
import { updateDslAction } from '../../actions'
import { loadDslView } from '../../data'

export const dynamic = 'force-dynamic'

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ error?: string }>
}) {
  const { id } = await params
  const { error } = await searchParams

  const view = await loadDslView(id)

  if (!view.ok) {
    return (
      <main>
        <h1>Edit DSL</h1>
        <p role="alert">{view.reason}</p>
        <p>
          <Link href="/dsl/new">New DSL</Link>
        </p>
      </main>
    )
  }

  if (!view.found) notFound()

  const { dsl, horse, trainer } = view

  const store = recordStore()
  const [horses, dsls, trainers, owners] = await Promise.all([
    store.listHorses(),
    store.listDsls(),
    store.listPartiesByRole('trainer'),
    store.listPartiesByRole('owner'),
  ])

  const termsByHorse = new Map<string, WizardHorse['terms']>()
  for (const term of dsls) {
    if (term.id === dsl.id) continue
    const terms = termsByHorse.get(term.horseId) ?? []
    terms.push({ id: term.id, endDate: term.endDate, listedStake: term.listedStake })
    termsByHorse.set(term.horseId, terms)
  }

  const wizardHorses: WizardHorse[] = horses.map((entry) => ({
    id: entry.id,
    legalName: entry.legalName,
    slug: entry.slug,
    facts: {
      foalingDate: entry.foalingDate,
      sex: entry.sex,
      colour: entry.colour,
      breeder: entry.breeder,
      sireName: entry.sireName,
      damName: entry.damName,
      microchip: entry.microchip,
      lifeNumber: entry.lifeNumber,
      registered: entry.registered,
      imageCount: entry.imageCount,
    },
    aboutHorse: entry.aboutHorse,
    racingOutlookAndPedigree: entry.racingOutlookAndPedigree,
    raceExpectation: entry.raceExpectation,
    terms: termsByHorse.get(entry.id) ?? [],
  }))

  const resolved = resolveNarrative(horse, dsl, trainer)

  return (
    <main className="grid gap-6">
      <header>
        <p className="text-caption uppercase tracking-caption text-low">
          <Link href="/dsl">DSLs</Link> / <Link href={`/dsl/${dsl.id}`}>{horse.legalName}</Link>{' '}
          / Edit
        </p>
        <h1 className="mt-1">Edit {horse.legalName}</h1>
      </header>

      <p className="max-w-2xl text-body text-low">
        The horse and the parties are edited in Records; this page only links them. The stake
        remaining is left where the sales put it.
      </p>

      <DslWizard
        action={updateDslAction}
        mode="edit"
        error={error ?? null}
        horses={wizardHorses}
        trainers={trainers.map((entry) => ({
          id: entry.id,
          displayName: entry.displayName,
          company: entry.company,
          bio: entry.bio,
        }))}
        owners={owners.map((entry) => ({ id: entry.id, displayName: entry.displayName }))}
        defaults={{
          dslId: dsl.id,
          horseId: horse.id,
          trainerId: dsl.trainerId,
          ownerId: dsl.ownerId,
          wholesale: dsl.wholesaleMonthlyPerPercent,
          retail: dsl.retailMonthlyPerPercent,
          investorSplit: dsl.investorSplit,
          listedStake: dsl.listedStake,
          minStake: dsl.minStake,
          step: dsl.step,
          endDate: dsl.endDate,
          paymentModel: dsl.paymentModel,
          closeStyle: dsl.closeStyle,
          distributionSchedule: dsl.distributionSchedule,
          narrative: {
            aboutHorse: resolved['horse.about_horse'].text ?? '',
            racingOutlook: resolved['horse.racing_outlook_and_pedigree'].text ?? '',
            raceExpectation: resolved['horse.race_expectation'].text ?? '',
            trainerBio: resolved['trainer.bio'].text ?? '',
          },
          overridden: {
            aboutHorse: resolved['horse.about_horse'].overridden,
            racingOutlook: resolved['horse.racing_outlook_and_pedigree'].overridden,
            raceExpectation: resolved['horse.race_expectation'].overridden,
          },
        }}
      />
    </main>
  )
}
