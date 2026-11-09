import type { PartyRow } from '@/lib/dslStore'

import {
  Button,
  ErrorSlot,
  Field,
  FieldGroup,
  FormShell,
  TextInput,
} from './forms'
import { ProfileFields } from './ProfileFields'

/**
 * One profile form, shared by the trainer and owner routes (ruling 10).
 *
 * Shared fields live once. The role ticks say what this profile is to a deal;
 * they are relationships, never permissions (ruling 22). The trainer block
 * (company) and owner block (contact) are visible because both roles are
 * available to tick.
 */
export function PartyForm({
  action,
  mode,
  party = null,
  submitLabel,
  error = null,
}: {
  action: (formData: FormData) => void | Promise<void>
  mode: 'trainer' | 'owner'
  party?: PartyRow | null
  submitLabel: string
  error?: string | null
}) {
  const roles = party?.roles ?? [mode]

  return (
    <FormShell>
      <ErrorSlot message={error} />

      <form action={action} className="grid gap-8">
        {party === null ? null : <input type="hidden" name="id" value={party.id} />}
        <input type="hidden" name="from" value={mode} />

        <FieldGroup legend="Roles">
          <label className="flex items-center gap-3 text-body">
            <input
              type="checkbox"
              name="roleTrainer"
              defaultChecked={roles.includes('trainer')}
            />
            Add as a trainer
          </label>
          <label className="flex items-center gap-3 text-body">
            <input
              type="checkbox"
              name="roleOwner"
              defaultChecked={roles.includes('owner')}
            />
            Add as an owner
          </label>
        </FieldGroup>

        <FieldGroup legend="Profile">
          <Field
            label="Name / entity"
            htmlFor="displayName"
            help="A trainer company's people names joined with ' & ', or the owning entity."
          >
            <TextInput
              id="displayName"
              name="displayName"
              defaultValue={party?.displayName ?? ''}
              required
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Company / stable" htmlFor="company" help="The trainer block.">
              <TextInput id="company" name="company" defaultValue={party?.company ?? ''} />
            </Field>
            <Field label="Contact person" htmlFor="contact" help="The owner block.">
              <TextInput id="contact" name="contact" defaultValue={party?.contact ?? ''} />
            </Field>
            <Field label="Location" htmlFor="location">
              <TextInput id="location" name="location" defaultValue={party?.location ?? ''} />
            </Field>
            <Field label="Website" htmlFor="website">
              <TextInput
                id="website"
                name="website"
                type="url"
                defaultValue={party?.website ?? ''}
              />
            </Field>
          </div>
        </FieldGroup>

        <ProfileFields
          profileName="bio"
          profileLabel="Profile / bio"
          profileHelp="The trainer bio or owner profile. Blank it only while no Available DSL depends on it."
          profileValue={party?.bio ?? null}
          defaults={
            party ?? {
              achievements: null,
              other: null,
              xUrl: null,
              facebookUrl: null,
              instagramUrl: null,
              links: [],
            }
          }
        />

        <div>
          <Button type="submit" variant="primary">
            {submitLabel}
          </Button>
        </div>
      </form>
    </FormShell>
  )
}
