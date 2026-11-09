'use client'

import { useState } from 'react'

import { Button, Field, TextInput } from './forms'

/**
 * One company/stable can hold more than one trainer (Wexford runs two). The
 * row still stores one name string, joined with ` & `, because a horse attaches
 * to a single `trainer_id` and the PDS prints `trainer.name`. Splitting the
 * names into separate rows would silently drop the second name from documents.
 */
export function TrainerNames({ defaultNames }: { defaultNames: string[] }) {
  const [names, setNames] = useState<string[]>(
    defaultNames.length > 0 ? defaultNames : [''],
  )

  const setAt = (index: number, value: string) => {
    setNames(names.map((name, position) => (position === index ? value : name)))
  }

  return (
    <div className="grid gap-3">
      {names.map((name, index) => (
        <div key={index} className="flex items-end gap-2">
          <div className="min-w-0 flex-1">
            <Field label="Trainer name" htmlFor={`trainerName-${index}`}>
              <TextInput
                id={`trainerName-${index}`}
                name="trainerNames"
                value={name}
                onChange={(event) => setAt(index, event.target.value)}
                required={index === 0}
              />
            </Field>
          </div>

          {names.length > 1 ? (
            <Button
              type="button"
              aria-label={`Remove trainer name ${index + 1}`}
              onClick={() => setNames(names.filter((_, position) => position !== index))}
            >
              Remove
            </Button>
          ) : null}
        </div>
      ))}

      <Button
        type="button"
        className="justify-self-start"
        onClick={() => setNames([...names, ''])}
      >
        + Add another trainer
      </Button>
    </div>
  )
}
