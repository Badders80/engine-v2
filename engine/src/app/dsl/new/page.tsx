/**
 * Create a DSL through the four-step wizard. Chunk 3.
 *
 * The horse, trainer and owner are Records. This page links them by id and
 * writes one `dsls` row at Confirm. The wizard authors none of them.
 */

import Link from 'next/link'

import { recordStore } from '../../records/store'
import { DslWizard, type WizardHorse } from '../DslWizard'
import { createDslAction } from '../actions'

export const dynamic = 'force-dynamic'

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const params = await searchParams
  const store = recordStore()
  const [horses, dsls, trainers, owners] = await Promise.all([
    store.listHorses(),
    store.listDsls(),
    store.listPartiesByRole('trainer'),
    store.listPartiesByRole('owner'),
  ])

  const termsByHorse = new Map<string, WizardHorse['terms']>()
  for (const dsl of dsls) {
    const terms = termsByHorse.get(dsl.horseId) ?? []
    terms.push({ id: dsl.id, endDate: dsl.endDate, listedStake: dsl.listedStake })
    termsByHorse.set(dsl.horseId, terms)
  }

  const wizardHorses: WizardHorse[] = horses.map((horse) => ({
    id: horse.id,
    legalName: horse.legalName,
    slug: horse.slug,
    facts: {
      foalingDate: horse.foalingDate,
      sex: horse.sex,
      colour: horse.colour,
      breeder: horse.breeder,
      sireName: horse.sireName,
      damName: horse.damName,
      microchip: horse.microchip,
      lifeNumber: horse.lifeNumber,
      registered: horse.registered,
      imageCount: horse.imageCount,
    },
    aboutHorse: horse.aboutHorse,
    racingOutlookAndPedigree: horse.racingOutlookAndPedigree,
    raceExpectation: horse.raceExpectation,
    terms: termsByHorse.get(horse.id) ?? [],
  }))

  return (
    <main className="grid gap-6">
      <header>
        <p className="text-caption uppercase tracking-caption text-low">
          <Link href="/dsl">DSLs</Link> / New
        </p>
        <h1 className="mt-1">New DSL</h1>
      </header>

      <p className="max-w-2xl text-body text-low">
        A DSL links records that already exist. Add the horse on{' '}
        <Link href="/horses/new">/horses/new</Link> first; add the trainer and the owner on
        their Records pages. Nothing here authors one.
      </p>

      <DslWizard
        action={createDslAction}
        mode="create"
        error={params.error ?? null}
        horses={wizardHorses}
        trainers={trainers.map((trainer) => ({
          id: trainer.id,
          displayName: trainer.displayName,
          company: trainer.company,
          bio: trainer.bio,
        }))}
        owners={owners.map((owner) => ({ id: owner.id, displayName: owner.displayName }))}
        defaults={{
          narrative: {
            aboutHorse: '',
            racingOutlook: '',
            raceExpectation: '',
            trainerBio: '',
          },
          overridden: {
            aboutHorse: false,
            racingOutlook: false,
            raceExpectation: false,
          },
        }}
      />
    </main>
  )
}
