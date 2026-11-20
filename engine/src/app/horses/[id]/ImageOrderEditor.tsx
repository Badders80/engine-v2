'use client'

import { useState, type DragEvent } from 'react'

import {
  deleteHorseImageAction,
  saveHorseImageOrderAction,
} from '../../dsl/actions'

export type EditableImage = {
  key: string
  number: number
  url: string
}

function moved(order: number[], fromIndex: number, toIndex: number): number[] {
  if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0) return order
  const next = [...order]
  const [imageNumber] = next.splice(fromIndex, 1)
  if (imageNumber === undefined) return order
  next.splice(toIndex, 0, imageNumber)
  return next
}

export function ImageOrderEditor({
  horseId,
  back,
  images,
  initialOrder,
}: {
  horseId: string
  back: string
  images: EditableImage[]
  initialOrder: number[]
}) {
  const [editing, setEditing] = useState(false)
  const [order, setOrder] = useState(initialOrder)
  const [dragging, setDragging] = useState<number | null>(null)

  const imageByNumber = new Map(images.map((image) => [image.number, image]))
  const orderedImages = order.flatMap((imageNumber) => {
    const image = imageByNumber.get(imageNumber)
    return image === undefined ? [] : [image]
  })

  function beginEditing() {
    setOrder(initialOrder)
    setDragging(null)
    setEditing(true)
  }

  function cancelEditing() {
    setOrder(initialOrder)
    setDragging(null)
    setEditing(false)
  }

  function moveImage(imageNumber: number, direction: -1 | 1) {
    const fromIndex = order.indexOf(imageNumber)
    if (fromIndex === -1) return
    setOrder(moved(order, fromIndex, fromIndex + direction))
  }

  function dragOver(event: DragEvent<HTMLLIElement>, targetNumber: number) {
    event.preventDefault()
    if (dragging === null || dragging === targetNumber) return

    setOrder((current) => {
      const fromIndex = current.indexOf(dragging)
      const toIndex = current.indexOf(targetNumber)
      return moved(current, fromIndex, toIndex)
    })
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-body text-low">
          {editing
            ? 'Drag an image onto another position, or use its arrow buttons. Image 1 is the cover.'
            : 'Image 1 is the cover. The remaining images follow in this order.'}
        </p>
        {editing ? (
          <button type="button" onClick={cancelEditing} className="shrink-0">
            Cancel
          </button>
        ) : (
          <button
            type="button"
            onClick={beginEditing}
            disabled={orderedImages.length < 2}
            className="shrink-0"
          >
            Edit positions
          </button>
        )}
      </div>

      <ol className="grid grid-cols-[repeat(auto-fill,minmax(8rem,1fr))] gap-3">
        {orderedImages.map((image, index) => (
          <li
            key={image.key}
            draggable={editing}
            onDragStart={(event) => {
              if (!editing) return
              setDragging(image.number)
              event.dataTransfer.effectAllowed = 'move'
              event.dataTransfer.setData('text/plain', String(image.number))
            }}
            onDragOver={(event) => dragOver(event, image.number)}
            onDrop={(event) => {
              event.preventDefault()
              setDragging(null)
            }}
            onDragEnd={() => setDragging(null)}
            className={`overflow-hidden rounded-sm border bg-panel transition-colors duration-200 motion-reduce:transition-none ${
              dragging === image.number ? 'border-accent opacity-50' : 'border-line'
            } ${editing ? 'cursor-grab active:cursor-grabbing' : ''}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={image.url}
              alt=""
              width={240}
              height={180}
              draggable={false}
              className="h-full w-full object-cover"
            />
            <div className="grid gap-2 p-2">
              <p className="font-figure text-caption uppercase tracking-caption text-muted">
                {index === 0 ? 'Cover' : `Position ${index + 1}`} · Image {image.number}
              </p>

              {editing ? (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => moveImage(image.number, -1)}
                    disabled={index === 0}
                    aria-label={`Move image ${image.number} earlier`}
                  >
                    ←
                  </button>
                  <button
                    type="button"
                    onClick={() => moveImage(image.number, 1)}
                    disabled={index === orderedImages.length - 1}
                    aria-label={`Move image ${image.number} later`}
                  >
                    →
                  </button>
                </div>
              ) : (
                <form action={deleteHorseImageAction}>
                  <input type="hidden" name="horseId" value={horseId} />
                  <input type="hidden" name="back" value={back} />
                  <input type="hidden" name="imageNumber" value={image.number} />
                  <button type="submit">Remove {image.number}</button>
                </form>
              )}
            </div>
          </li>
        ))}
      </ol>

      <p className="sr-only" role="status" aria-live="polite">
        Image order: {order.join(', ')}
      </p>

      {editing ? (
        <form action={saveHorseImageOrderAction} className="mt-3 flex items-center gap-3">
          <input type="hidden" name="horseId" value={horseId} />
          <input type="hidden" name="back" value={back} />
          {order.map((imageNumber) => (
            <input key={imageNumber} type="hidden" name="order" value={imageNumber} />
          ))}
          <button type="submit">Save image order</button>
        </form>
      ) : null}
    </div>
  )
}
