import type { HorseRow } from '@/lib/dslStore'

import {
  Button,
  ErrorSlot,
  Field,
  FieldGroup,
  FormShell,
  TextArea,
  TextInput,
} from '../../_components/forms'

/**
 * The horse form, shared by add and edit so the two can never drift.
 *
 * No slug field: the slug is the official name and a rename is a migration,
 * not an edit (`HORSE-IDENTITY-NAMING-LAW.md` §7). No owner field: an owner is
 * a party to a deal and attaches to the DSL.
 */
export function HorseForm({
  action,
  horse = null,
  horseId = null,
  raceRecordJson,
  submitLabel,
  error = null,
}: {
  action: (formData: FormData) => void | Promise<void>
  horse?: Partial<HorseRow> | null
  horseId?: string | null
  raceRecordJson: string
  submitLabel: string
  error?: string | null
}) {
  return (
    <FormShell>
      <ErrorSlot message={error} />

      <form action={action} className="grid gap-8">
        {horseId === null ? null : <input type="hidden" name="id" value={horseId} />}

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
            <TextInput id="barnName" name="barnName" defaultValue={horse?.barnName ?? ''} />
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
              <TextInput id="damName" name="damName" defaultValue={horse?.damName ?? ''} required />
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
            {submitLabel}
          </Button>
        </div>
      </form>
    </FormShell>
  )
}
