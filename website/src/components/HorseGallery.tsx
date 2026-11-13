'use client'

import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'

function ArrowIcon({ direction }: { direction: 'left' | 'right' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d={direction === 'left' ? 'M15 18l-6-6 6-6' : 'M9 18l6-6-6-6'}
      />
    </svg>
  )
}

export function HorseGallery({ images, horseName }: { images: readonly string[]; horseName: string }) {
  const [current, setCurrent] = useState(0)
  const [open, setOpen] = useState(false)
  const closeRef = useRef<HTMLButtonElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)

  const previous = () => setCurrent((index) => (index - 1 + images.length) % images.length)
  const next = () => setCurrent((index) => (index + 1) % images.length)

  useEffect(() => {
    if (!open) return

    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeRef.current?.focus()

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
        return
      }

      if (event.key === 'ArrowLeft') {
        setCurrent((index) => (index - 1 + images.length) % images.length)
        return
      }

      if (event.key === 'ArrowRight') {
        setCurrent((index) => (index + 1) % images.length)
        return
      }

      if (event.key !== 'Tab' || !dialogRef.current) return

      const controls = [...dialogRef.current.querySelectorAll<HTMLElement>('button, [href]')].filter(
        (element) => !element.hasAttribute('disabled'),
      )
      const first = controls.at(0)
      const last = controls.at(-1)
      if (!first || !last) return

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
      previouslyFocused?.focus()
    }
  }, [images.length, open])

  return (
    <>
      <div className="space-y-4">
        <div className="relative aspect-[16/10] overflow-hidden rounded-lg bg-surface">
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Open image full size"
            className="group absolute inset-0 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-edge"
          >
            <Image
              src={images[current] ?? images[0] ?? ''}
              alt={`${horseName} image ${String(current + 1)}`}
              fill
              priority
              sizes="(max-width: 1023px) calc(100vw - 96px), 760px"
              className="object-contain"
            />
          </button>

          {images.length > 1 ? (
            <>
              <button
                type="button"
                onClick={previous}
                aria-label="Previous image"
                className="absolute left-3 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-pill border border-border bg-canvas/80 text-heading backdrop-blur-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-edge"
              >
                <span className="size-4">
                  <ArrowIcon direction="left" />
                </span>
              </button>
              <button
                type="button"
                onClick={next}
                aria-label="Next image"
                className="absolute right-3 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-pill border border-border bg-canvas/80 text-heading backdrop-blur-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-edge"
              >
                <span className="size-4">
                  <ArrowIcon direction="right" />
                </span>
              </button>
            </>
          ) : null}

          <p className="label-spec absolute bottom-4 right-4 rounded-sm border border-border bg-canvas/85 px-3 py-1.5 text-heading backdrop-blur-md">
            {String(current + 1).padStart(2, '0')} · {String(images.length).padStart(2, '0')}
          </p>
        </div>

        {images.length > 1 ? (
          <div className="flex gap-3 overflow-x-auto pb-1" aria-label={`${horseName} gallery`}>
            {images.map((image, index) => {
              const active = index === current
              return (
                <button
                  key={image}
                  type="button"
                  aria-label={`Show image ${String(index + 1)}`}
                  aria-current={active ? 'true' : undefined}
                  onClick={() => setCurrent(index)}
                  className={`relative h-16 w-24 shrink-0 overflow-hidden rounded-sm border focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-edge ${
                    active ? 'border-gold' : 'border-border opacity-60'
                  }`}
                >
                  <Image src={image} alt="" fill sizes="96px" className="object-cover" />
                </button>
              )
            })}
          </div>
        ) : null}
      </div>

      {open ? (
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-label={`${horseName} image ${String(current + 1)} of ${String(images.length)}`}
          className="fixed inset-0 z-modal flex items-center justify-center bg-canvas/95 p-4 md:p-10"
        >
          <button
            type="button"
            aria-label="Close image viewer"
            onClick={() => setOpen(false)}
            className="absolute inset-0 cursor-default"
          />
          <div className="relative z-10 flex h-full max-h-[90dvh] w-full max-w-6xl flex-col">
            <div className="flex justify-end">
              <button
                ref={closeRef}
                type="button"
                aria-label="Close image viewer"
                onClick={() => setOpen(false)}
                className="flex size-11 items-center justify-center rounded-pill border border-border bg-surface text-heading focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-edge"
              >
                <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>
            <div className="relative mt-3 min-h-0 flex-1">
              <Image
                src={images[current] ?? images[0] ?? ''}
                alt={`${horseName} image ${String(current + 1)} full size`}
                fill
                sizes="100vw"
                className="object-contain"
              />
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
