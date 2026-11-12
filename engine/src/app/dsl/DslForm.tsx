/**
 * The DSL form. Chunk 2, ruling 11.
 *
 * The DSL attaches existing records: one horse, one trainer, one owner, all
 * picked by id. It authors none of them. The horse prose, the trainer bio and
 * the owner profile live in Records; the narrative editor that signs them off
 * arrives with chunk 3.
 *
 * The branding controls carry no `name` attribute, so a branding choice here
 * cannot reach the database even by accident.
 */

import type { DslDraft } from '@/lib/dsl'

import { PaymentModelField } from './PaymentModelField'
import { TermDatesField } from './TermDatesField'

export type DslFormDefaults = {
  /** A DSL row is nullable on every commercial field. */
  dsl?: { [K in keyof DslDraft]?: DslDraft[K] | null }
}

type Props = {
  action: (formData: FormData) => Promise<void>
  submitLabel: string
  defaults?: DslFormDefaults
  error?: string | null
  dslId?: string
  horseOptions: readonly { id: string; legalName: string; slug: string }[]
  trainerOptions: readonly { id: string; displayName: string; company: string | null }[]
  ownerOptions: readonly { id: string; displayName: string }[]
  currentHorseId?: string | null
  currentTrainerId?: string | null
  currentOwnerId?: string | null
}

export function DslForm({
  action,
  submitLabel,
  defaults = {},
  error = null,
  dslId,
  horseOptions,
  trainerOptions,
  ownerOptions,
  currentHorseId = null,
  currentTrainerId = null,
  currentOwnerId = null,
}: Props) {
  const dsl = defaults.dsl ?? {}

  return (
    <form action={action}>
      {error !== null ? <p role="alert">{error}</p> : null}
      {dslId !== undefined ? <input type="hidden" name="dslId" value={dslId} /> : null}

      <fieldset>
        <legend>Parties</legend>

        <label>
          Horse
          <select name="horseId" defaultValue={currentHorseId ?? ''} required>
            <option value="">— choose a horse —</option>
            {horseOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.legalName} — {option.slug}
              </option>
            ))}
          </select>
        </label>

        <label>
          Trainer
          <select name="trainerId" defaultValue={currentTrainerId ?? ''}>
            <option value="">— no trainer yet (Coming Soon only) —</option>
            {trainerOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.displayName}
                {option.company === null ? '' : ` — ${option.company}`}
              </option>
            ))}
          </select>
        </label>

        <label>
          Owner
          <select name="ownerId" defaultValue={currentOwnerId ?? ''}>
            <option value="">— no owner yet (Coming Soon only) —</option>
            {ownerOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.displayName}
              </option>
            ))}
          </select>
        </label>

        <p>
          <small>
            These are Records. Create or edit them on <code>/horses</code>,{' '}
            <code>/trainers</code> and <code>/owners</code>; this page only links them.
          </small>
        </p>
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
          The engine derives the listed price from that one figure: wholesale multiplied
          by 1 plus the summed expense rates (currently 5% + 3% = 1.08), rounded up to
          the next whole dollar.
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

        {/* Status and published are not form fields. A new DSL is a draft, and
            it goes live from the term sheet with Publish, after a look. */}

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
