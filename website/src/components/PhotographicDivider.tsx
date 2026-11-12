import Image from 'next/image'

export function PhotographicDivider({
  src,
  alt,
}: {
  src: string
  alt: string
}) {
  return (
    <section className="relative h-[50vh] w-full overflow-hidden" aria-hidden="true">
      <Image
        src={src}
        alt={alt}
        fill
        sizes="100vw"
        className="object-cover"
      />
    </section>
  )
}
