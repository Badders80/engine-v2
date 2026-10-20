/**
 * The one operator form. PLAN.md step 4.
 *
 * Horse, trainer, and owner are written from this page. They have no screens of
 * their own, so this is the only place those rows come in.
 *
 * The branding controls at the bottom carry no `name` attribute. That is the
 * whole point: an input without a name is never submitted, so a branding choice
 * on this page cannot reach the database even by accident.
 */

import type { DslDraft, HorseDraft } from '@/lib/dsl'

import { PaymentModelField } from './PaymentModelField'
import { TermDatesField } from './TermDatesField'

export type DslFormDefaults = {
  horse?: Partial<HorseDraft>
  trainer?: {
    name?: string
    stable?: string
    location?: string
    website?: string | null
    bio?: string | null
  }
  owner?: {
    entity?: string
    contact?: string
    website?: string | null
    profile?: string | null
  }
  dsl?: Partial<DslDraft>
}

type Props = {
  action: (formData: FormData) => Promise<void>
  submitLabel: string
  defaults?: DslFormDefaults
  error?: string | null
  dslId?: string
}

export function DslForm({ action, submitLabel, defaults = {}, error = null, dslId }: Props) {
  const horse = defaults.horse ?? {}
  const trainer = defaults.trainer ?? {}
  const owner = defaults.owner ?? {}
  const dsl = defaults.dsl ?? {}

  return (
    <form action={action}>
      {error !== null ? <p role="alert">{error}</p> : null}
      {dslId !== undefined ? <input type="hidden" name="dslId" value={dslId} /> : null}

      <fieldset>
        <legend>Horse</legend>

        <label>
          Legal name
          <input name="legalName" defaultValue={horse.legalName ?? ''} required />
        </label>

        <label>
          Foaling date
          <input type="date" name="foalingDate" defaultValue={horse.foalingDate ?? ''} required />
        </label>

        <label>
          Sex
          <input name="sex" defaultValue={horse.sex ?? ''} required />
        </label>

        <label>
          Colour
          <input name="colour" defaultValue={horse.colour ?? ''} required />
        </label>

        <label>
          Breeder
          <input name="breeder" defaultValue={horse.breeder ?? ''} />
        </label>

        <label>
          Sire, entered by hand
          <input name="sireName" defaultValue={horse.sireName ?? ''} required />
        </label>

        <label>
          Dam, entered by hand
          <input name="damName" defaultValue={horse.damName ?? ''} required />
        </label>

        <label>
          Microchip
          <input name="microchip" defaultValue={horse.microchip ?? ''} />
        </label>

        <label>
          Life number
          <input name="lifeNumber" defaultValue={horse.lifeNumber ?? ''} />
        </label>

        <label>
          Loveracing id
          <input name="loveracingId" defaultValue={horse.loveracingId ?? ''} />
        </label>

        <label>
          <input type="checkbox" name="registered" defaultChecked={horse.registered ?? false} />
          Registered with loveracing.nz
        </label>

        <label>
          Images already in the bucket
          <input
            type="number"
            min="0"
            step="1"
            name="imageCount"
            defaultValue={horse.imageCount ?? 0}
          />
        </label>

        <label>
          Race record, one json object
          <textarea
            name="raceRecord"
            rows={8}
            defaultValue={JSON.stringify(horse.raceRecord ?? {}, null, 2)}
          />
        </label>
      </fieldset>

      <fieldset>
        <legend>The three soft slots, written by hand</legend>

        <label>
          About the horse
          <textarea name="aboutHorse" rows={4} defaultValue={horse.aboutHorse ?? ''} />
        </label>

        <label>
          Racing outlook and pedigree
          <textarea
            name="racingOutlookAndPedigree"
            rows={4}
            defaultValue={horse.racingOutlookAndPedigree ?? ''}
          />
        </label>

        <label>
          Race expectation
          <textarea name="raceExpectation" rows={4} defaultValue={horse.raceExpectation ?? ''} />
        </label>
      </fieldset>

      <fieldset>
        <legend>Trainer</legend>

        <label>
          Name
          <input name="trainerName" defaultValue={trainer.name ?? ''} required />
        </label>

        <label>
          Stable
          <input name="trainerStable" defaultValue={trainer.stable ?? ''} required />
        </label>

        <label>
          Location
          <input name="trainerLocation" defaultValue={trainer.location ?? ''} required />
        </label>

        <label>
          Website
          <input name="trainerWebsite" defaultValue={trainer.website ?? ''} />
        </label>

        <label>
          Bio
          <textarea name="trainerBio" rows={4} defaultValue={trainer.bio ?? ''} />
        </label>
      </fieldset>

      <fieldset>
        <legend>Owner</legend>

        <label>
          Entity
          <input name="ownerEntity" defaultValue={owner.entity ?? ''} required />
        </label>

        <label>
          Contact
          <input name="ownerContact" defaultValue={owner.contact ?? ''} required />
        </label>

        <label>
          Website
          <input name="ownerWebsite" defaultValue={owner.website ?? ''} />
        </label>

        <label>
          Profile
          <textarea name="ownerProfile" rows={4} defaultValue={owner.profile ?? ''} />
        </label>
      </fieldset>

      <fieldset>
        <legend>Commercial terms</legend>

        <label>
          Wholesale cost per 1%, per month
          <input
            type="number"
            step="0.01"
            min="0.01"
            name="wholesaleMonthlyPerPercent"
            defaultValue={dsl.wholesaleMonthlyPerPercent ?? ''}
            required
          />
        </label>

        <p>
          The engine derives the listed price from that one figure: wholesale times 1.05
          times 1.03, rounded up to the next whole dollar.
        </p>

        <label>
          Investor split, 50 to 85
          <input
            type="number"
            step="0.01"
            min="50"
            max="85"
            name="investorSplit"
            defaultValue={dsl.investorSplit ?? ''}
          />
        </label>

        <PaymentModelField
          defaultValue={dsl.paymentModel ?? 'subscription_float'}
          defaultTermStart={dsl.termStart ?? ''}
          defaultEndDate={dsl.endDate ?? ''}
        />

        <label>
          Close style
          <select name="closeStyle" defaultValue={dsl.closeStyle ?? 'fourteen_day'}>
            <option value="fourteen_day">fourteen_day</option>
            <option value="three_x_remaining">three_x_remaining</option>
          </select>
        </label>

        <label>
          Status
          <select name="status" defaultValue={dsl.status ?? 'coming_soon'}>
            <option value="coming_soon">coming_soon</option>
            <option value="available">available</option>
            <option value="fully_allocated">fully_allocated</option>
            <option value="completed">completed</option>
          </select>
        </label>

        <label>
          <input type="checkbox" name="published" defaultChecked={dsl.published ?? false} />
          Published
        </label>

        <label>
          Listed stake
          <input
            type="number"
            step="0.01"
            name="listedStake"
            defaultValue={dsl.listedStake ?? ''}
            required
          />
        </label>

        <label>
          Minimum stake
          <input
            type="number"
            step="0.01"
            name="minStake"
            defaultValue={dsl.minStake ?? ''}
            required
          />
        </label>

        <label>
          Step
          <input type="number" step="0.01" name="step" defaultValue={dsl.step ?? ''} required />
        </label>

        <TermDatesField
          defaultTermStart={dsl.termStart ?? ''}
          defaultEndDate={dsl.endDate ?? ''}
        />

        <label>
          Distribution schedule
          <input
            name="distributionSchedule"
            defaultValue={dsl.distributionSchedule ?? ''}
          />
        </label>
      </fieldset>

      <fieldset>
        <legend>Branding</legend>

        <p>
          These choices show on this page and go no further. No branding field is stored, so
          none of the controls below carries a name and none of them is submitted.
        </p>

        <label>
          Primary colour
          <input type="color" defaultValue="#1b3a2f" />
        </label>

        <label>
          Accent colour
          <input type="color" defaultValue="#c8a24a" />
        </label>

        <label>
          <input type="checkbox" defaultChecked />
          Show the trainer panel on the listing
        </label>
      </fieldset>

      <button type="submit">{submitLabel}</button>
    </form>
  )
}
