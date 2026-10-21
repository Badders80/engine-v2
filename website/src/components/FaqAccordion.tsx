'use client'

import { useState } from 'react'

export type FaqItem = {
  question: string
  answer: string
}

export function FaqAccordion({ items }: { items: readonly FaqItem[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  const toggle = (index: number) => {
    setOpenIndex(openIndex === index ? null : index)
  }

  return (
    <div className="divide-y divide-border border-y border-border">
      {items.map((item, index) => {
        const isOpen = openIndex === index
        return (
          <div key={item.question} className="py-6">
            <button
              type="button"
              onClick={() => toggle(index)}
              aria-expanded={isOpen}
              className="flex w-full items-center justify-between gap-4 text-left"
            >
              <span className="text-body font-light text-heading transition-colors duration-hover hover:text-gold md:text-card-heading">
                {item.question}
              </span>
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground transition-transform duration-micro">
                {isOpen ? '−' : '+'}
              </span>
            </button>
            {isOpen ? (
              <div className="mt-4 pr-12">
                <p className="text-body font-light leading-body text-ink">
                  {item.answer}
                </p>
              </div>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}
