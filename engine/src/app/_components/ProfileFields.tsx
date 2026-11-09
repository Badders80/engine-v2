import type { LinkEntry } from '@/lib/dslStore'

import { Field, FieldGroup, TextArea, TextInput } from './forms'
import { LinkRows } from './LinkRows'

/**
 * The six profile fields on trainers and owners (U3): achievements, other,
 * three social URLs, and extra links. Fixed order — Profile → Achievements →
 * Other → Social → Links. Optional everywhere, so readiness and the legal
 * templates are untouched.
 */
export type ProfileDefaults = {
  achievements: string | null
  other: string | null
  xUrl: string | null
  facebookUrl: string | null
  instagramUrl: string | null
  links: LinkEntry[]
}

export function ProfileFields({
  profileName,
  profileLabel,
  profileHelp,
  profileValue,
  defaults,
}: {
  profileName: 'bio' | 'profile'
  profileLabel: string
  profileHelp?: string
  profileValue: string | null
  defaults: ProfileDefaults
}) {
  return (
    <>
      <Field label={profileLabel} htmlFor={profileName} help={profileHelp}>
        <TextArea
          id={profileName}
          name={profileName}
          rows={6}
          defaultValue={profileValue ?? ''}
        />
      </Field>

      <Field label="Achievements" htmlFor="achievements">
        <TextArea
          id="achievements"
          name="achievements"
          rows={4}
          defaultValue={defaults.achievements ?? ''}
        />
      </Field>

      <Field label="Other" htmlFor="other">
        <TextArea id="other" name="other" rows={4} defaultValue={defaults.other ?? ''} />
      </Field>

      <FieldGroup legend="Social">
        <Field label="X / Twitter" htmlFor="xUrl">
          <TextInput id="xUrl" name="xUrl" type="url" defaultValue={defaults.xUrl ?? ''} />
        </Field>
        <Field label="Facebook" htmlFor="facebookUrl">
          <TextInput
            id="facebookUrl"
            name="facebookUrl"
            type="url"
            defaultValue={defaults.facebookUrl ?? ''}
          />
        </Field>
        <Field label="Instagram" htmlFor="instagramUrl">
          <TextInput
            id="instagramUrl"
            name="instagramUrl"
            type="url"
            defaultValue={defaults.instagramUrl ?? ''}
          />
        </Field>
      </FieldGroup>

      <LinkRows defaultLinks={defaults.links} />
    </>
  )
}
