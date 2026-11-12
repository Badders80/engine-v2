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
    <div className="border-y border-border">
      {items.map((item, index) => {
        const isOpen = openIndex === index
        return (
          <div key={item.question} className="border-b border-border py-8">
            <button
              type="button"
              onClick={() => toggle(index)}
              aria-expanded={isOpen}
              aria-controls={`faq-panel-${index}`}
              className="flex w-full items-center justify-between gap-6 text-left focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-edge"
            >
              <span className="text-body font-light text-heading transition-colors duration-hover hover:text-heading">
                {item.question}
              </span>
              <svg
                className={`h-5 w-5 shrink-0 transition-transform duration-micro ${
                  isOpen ? 'rotate-45 text-gold' : 'rotate-0 text-muted-foreground'
                }`}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.5}
                aria-hidden="true"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14" />
              </svg>
            </button>
            <div
              id={`faq-panel-${index}`}
              hidden={!isOpen}
              className="max-w-2xl pt-4 pb-2"
            >
              <p className="text-body font-light leading-body text-ink">{item.answer}</p>
            </div>
          </div>
        )
      })}
    </div>
  )
}
