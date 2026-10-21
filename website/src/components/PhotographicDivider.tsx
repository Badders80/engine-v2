import Image from 'next/image'

export function PhotographicDivider({
  src,
  alt,
}: {
  src: string
  alt: string
}) {
  return (
    <section className="relative h-[45vh] w-full overflow-hidden md:h-[55vh]" aria-hidden="true">
      <Image
        src={src}
        alt={alt}
        fill
        sizes="100vw"
        className="object-cover"
      />
      <div className="absolute inset-0 bg-canvas/25" />
    </section>
  )
}
