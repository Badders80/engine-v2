'use client'

import { useState } from 'react'

import type { LinkEntry } from '@/lib/dslStore'

import { Button, Field, TextInput } from './forms'

/**
 * A plain registry of links. Paste the raw URL; `+ Add another link` adds the
 * next, exactly like trainer names. Nothing is fetched or rewritten here — the
 * link is stored as given, for the operator to reference headlessly later.
 */
export function LinkRows({ defaultLinks }: { defaultLinks: LinkEntry[] }) {
  const [urls, setUrls] = useState<string[]>(
    defaultLinks.length > 0 ? defaultLinks.map((link) => link.url) : [''],
  )

  const setAt = (index: number, value: string) => {
    setUrls(urls.map((url, position) => (position === index ? value : url)))
  }

  return (
    <div className="grid gap-3">
      {urls.map((url, index) => (
        <div key={index} className="flex items-end gap-2">
          <div className="min-w-0 flex-1">
            <Field label="Link" htmlFor={`linkUrl-${index}`}>
              <TextInput
                id={`linkUrl-${index}`}
                name="linkUrl"
                type="url"
                placeholder="https://…"
                value={url}
                onChange={(event) => setAt(index, event.target.value)}
              />
            </Field>
          </div>

          {urls.length > 1 ? (
            <Button
              type="button"
              aria-label={`Remove link ${index + 1}`}
              onClick={() =>
                setUrls(urls.filter((_, position) => position !== index))
              }
            >
              Remove
            </Button>
          ) : null}
        </div>
      ))}

      <Button
        type="button"
        className="justify-self-start"
        onClick={() => setUrls([...urls, ''])}
      >
        + Add another link
      </Button>
    </div>
  )
}
