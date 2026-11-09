import Link from 'next/link'

import { loadLoveracingPage } from '@/lib/loveracingFetch'

import {
  Button,
  ErrorSlot,
  Field,
  FieldGroup,
  FormShell,
  Select,
  TextArea,
  TextInput,
} from '../../_components/forms'
import { recordStore } from '../../records/store'
import { createHorseAction } from '../../records/actions'

export const dynamic = 'force-dynamic'

/**
 * Add a horse (U12). Horse only: identity, registration, the loveracing load,
 * and an optional current trainer picked from the existing rows. No owner — an
 * owner is a party to a deal and attaches to the DSL. Confirm lands on the new
 * profile; no DSL is created.
 */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ loveracing?: string; error?: string }>
}) {
  const params = await searchParams
  const link = (params.loveracing ?? '').trim()
  const loaded = link === '' ? null : await loadLoveracingPage(link)

  const trainers = await recordStore().listTrainers()
  const horse = loaded !== null && loaded.ok ? loaded.value.horse : null
  const raceRecordJson =
    loaded !== null && loaded.ok ? JSON.stringify(loaded.value.raceRecord, null, 2) : '{}'

  return (
    <main className="grid gap-8">
      <header>
        <p className="text-caption uppercase tracking-caption text-low">
          <Link href="/horses">Horses</Link> / New
        </p>
        <h1 className="mt-1">Add a horse</h1>
        <p className="mt-2 max-w-2xl text-body text-muted">
          The horse is the record. Its owner is a party to a deal and is attached to the
          DSL later, so nothing here creates a listing.
        </p>
      </header>

      <section className="rounded-md border border-line bg-panel p-5">
        <h3 className="mb-3">Start from a loveracing.nz link</h3>
        <form method="get" className="flex flex-wrap items-end gap-3">
          <label className="grid min-w-64 flex-1 gap-1">
            <span className="text-caption uppercase tracking-caption text-muted">
              loveracing.nz link
            </span>
            <input
              type="url"
              name="loveracing"
              defaultValue={link}
              placeholder="https://loveracing.nz/..."
            />
          </label>
          <Button type="submit">Load</Button>
        </form>

        {loaded !== null && !loaded.ok ? (
          <div className="mt-4">
            <ErrorSlot message={loaded.reason} />
          </div>
        ) : null}

        {loaded !== null && loaded.ok ? (
          <p className="mt-4 text-body text-muted">
            Loaded {loaded.value.horse.legalName}, foaled {loaded.value.horse.foalingDate}.
            Correct anything that is wrong before saving.
          </p>
        ) : null}
      </section>

      <FormShell>
        <ErrorSlot message={params.error ?? null} />

        <form action={createHorseAction} className="grid gap-8">
          <FieldGroup legend="Identity">
            <Field label="Legal name" htmlFor="legalName">
              <TextInput
                id="legalName"
                name="legalName"
                defaultValue={horse?.legalName ?? ''}
                required
              />
            </Field>

            <Field
              label="Barn name"
              htmlFor="barnName"
              help="Optional. The nickname the yard actually uses (Coco, Nellie). Leave blank if there isn't one — never repeat the official name."
            >
              <TextInput
                id="barnName"
                name="barnName"
                defaultValue=""
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Foaling date" htmlFor="foalingDate">
                <TextInput
                  id="foalingDate"
                  type="date"
                  name="foalingDate"
                  defaultValue={horse?.foalingDate ?? ''}
                  required
                />
              </Field>
              <Field label="Sex" htmlFor="sex">
                <TextInput id="sex" name="sex" defaultValue={horse?.sex ?? ''} required />
              </Field>
              <Field label="Colour" htmlFor="colour">
                <TextInput id="colour" name="colour" defaultValue={horse?.colour ?? ''} required />
              </Field>
              <Field label="Breeder" htmlFor="breeder">
                <TextInput id="breeder" name="breeder" defaultValue={horse?.breeder ?? ''} />
              </Field>
              <Field label="Sire" htmlFor="sireName">
                <TextInput
                  id="sireName"
                  name="sireName"
                  defaultValue={horse?.sireName ?? ''}
                  required
                />
              </Field>
              <Field label="Dam" htmlFor="damName">
                <TextInput
                  id="damName"
                  name="damName"
                  defaultValue={horse?.damName ?? ''}
                  required
                />
              </Field>
              <Field label="Microchip" htmlFor="microchip">
                <TextInput
                  id="microchip"
                  name="microchip"
                  defaultValue={horse?.microchip ?? ''}
                />
              </Field>
              <Field label="Life number" htmlFor="lifeNumber">
                <TextInput
                  id="lifeNumber"
                  name="lifeNumber"
                  defaultValue={horse?.lifeNumber ?? ''}
                />
              </Field>
              <Field label="Loveracing id" htmlFor="loveracingId">
                <TextInput
                  id="loveracingId"
                  name="loveracingId"
                  defaultValue={horse?.loveracingId ?? ''}
                />
              </Field>
            </div>
          </FieldGroup>

          <FieldGroup legend="Registration">
            <label className="flex items-center gap-3 text-body">
              <input
                type="checkbox"
                name="registered"
                defaultChecked={horse?.registered ?? false}
              />
              Registered with loveracing.nz
            </label>
          </FieldGroup>

          <FieldGroup legend="Trainer">
            <Field
              label="Current trainer"
              htmlFor="trainerId"
              help="Optional. Pick an existing trainer, or leave unassigned and attach one later."
            >
              <Select id="trainerId" name="trainerId" defaultValue="">
                <option value="">No trainer assigned</option>
                {trainers.map((trainer) => (
                  <option key={trainer.id} value={trainer.id}>
                    {trainer.name} — {trainer.stable}
                  </option>
                ))}
              </Select>
            </Field>
          </FieldGroup>

          <details className="rounded-md border border-line bg-panel p-5">
            <summary className="cursor-pointer text-caption uppercase tracking-caption text-muted">
              Race record (JSON)
            </summary>
            <p className="mt-2 text-caption text-low">
              One json object, filled from the loveracing page when one is loaded.
            </p>
            <div className="mt-3">
              <Field label="Race record" htmlFor="raceRecord">
                <TextArea
                  id="raceRecord"
                  name="raceRecord"
                  rows={10}
                  defaultValue={raceRecordJson}
                  className="font-figure"
                />
              </Field>
            </div>
          </details>

          <div>
            <Button type="submit" variant="primary">
              Save horse
            </Button>
          </div>
        </form>
      </FormShell>
    </main>
  )
}
