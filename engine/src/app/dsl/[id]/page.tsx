/**
 * View one DSL. PLAN.md step 4.
 *
 * Read only, apart from the image upload. The edit link goes to the same form
 * the create page uses.
 *
 * The upload lives here rather than on the edit form because it is one file at a
 * time and it writes as it goes: `00008_dsl_availability_trigger.sql` wants three
 * images on the horse before the listing may be available, and this is the only
 * control that can put them there.
 */

import Link from 'next/link'
import { notFound } from 'next/navigation'

import { MIN_IMAGES_FOR_AVAILABLE } from '@/lib/storage'

import { uploadHorseImageAction } from '../actions'
import { loadDslView } from '../data'

function Field({ label, value }: { label: string; value: string | number | null }) {
  return (
    <>
      <dt>{label}</dt>
      <dd>{value === null || value === '' ? '—' : value}</dd>
    </>
  )
}

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
        <h1>DSL</h1>
        <p role="alert">{view.reason}</p>
        <p>
          <Link href="/dsl/new">New DSL</Link>
        </p>
      </main>
    )
  }

  if (!view.found) notFound()

  const { dsl, horse, trainer, owner } = view

  return (
    <main>
      <h1>{horse.legalName}</h1>
      <p>
        {dsl.status}, {dsl.published ? 'published' : 'unpublished'} ·{' '}
        <Link href={`/dsl/${dsl.id}/edit`}>Edit</Link> · <Link href="/dsl/new">New DSL</Link>
      </p>

      {error !== undefined && <p role="alert">{error}</p>}

      <h2>Images</h2>
      <p>
        {horse.imageCount} in the bucket, numbered {horse.slug}/01 upward. Available needs{' '}
        {MIN_IMAGES_FOR_AVAILABLE}. Images are public: KYC and proof of address never come through
        here.
      </p>
      <form action={uploadHorseImageAction}>
        <input type="hidden" name="dslId" value={dsl.id} />
        <label htmlFor="image">Add image number {horse.imageCount + 1}</label>
        <input id="image" name="image" type="file" accept="image/*" required />
        <button type="submit">Upload to {horse.slug}</button>
      </form>

      <h2>Horse</h2>
      <dl>
        <Field label="Slug" value={horse.slug} />
        <Field label="Foaling date" value={horse.foalingDate} />
        <Field label="Sex" value={horse.sex} />
        <Field label="Colour" value={horse.colour} />
        <Field label="Breeder" value={horse.breeder} />
        <Field label="Sire" value={horse.sireName} />
        <Field label="Dam" value={horse.damName} />
        <Field label="Microchip" value={horse.microchip} />
        <Field label="Life number" value={horse.lifeNumber} />
        <Field label="Loveracing id" value={horse.loveracingId} />
        <Field label="Registered" value={horse.registered ? 'yes' : 'no'} />
      </dl>

      <h2>Soft slots</h2>
      <dl>
        <Field label="About the horse" value={horse.aboutHorse} />
        <Field label="Racing outlook and pedigree" value={horse.racingOutlookAndPedigree} />
        <Field label="Race expectation" value={horse.raceExpectation} />
      </dl>
      <pre>{JSON.stringify(horse.raceRecord, null, 2)}</pre>

      <h2>Trainer</h2>
      <dl>
        <Field label="Name" value={trainer === null ? null : trainer.name} />
        <Field label="Stable" value={trainer === null ? null : trainer.stable} />
        <Field label="Location" value={trainer === null ? null : trainer.location} />
        <Field label="Website" value={trainer === null ? null : trainer.website} />
      </dl>

      <h2>Owner</h2>
      <dl>
        <Field label="Entity" value={owner === null ? null : owner.entity} />
        <Field label="Contact" value={owner === null ? null : owner.contact} />
        <Field label="Website" value={owner === null ? null : owner.website} />
      </dl>

      <h2>Terms</h2>
      <dl>
        <Field label="Wholesale per 1% per month" value={dsl.wholesaleMonthlyPerPercent} />
        <Field label="Listed price per 1% per month" value={dsl.retailMonthlyPerPercent} />
        <Field label="Wholesale total at 100%" value={dsl.wholesaleMonthlyTotal} />
        <Field label="Investor split" value={dsl.investorSplit} />
        <Field label="Payment style" value={dsl.paymentModel} />
        <Field label="Close style" value={dsl.closeStyle} />
        <Field label="Listed stake" value={dsl.listedStake} />
        <Field label="Stake remaining" value={dsl.stakeRemaining} />
        <Field label="Minimum stake" value={dsl.minStake} />
        <Field label="Step" value={dsl.step} />
        <Field label="Term start" value={dsl.termStart} />
        <Field label="End date" value={dsl.endDate} />
        <Field label="Distribution schedule" value={dsl.distributionSchedule} />
      </dl>
    </main>
  )
}
