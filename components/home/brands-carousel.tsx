import Image from 'next/image'
import { buildPublicS3Url } from '@/lib/aws/s3'
import { getAllBusinessesFromPostgres } from '@/lib/db/businesses'

export async function BrandsCarousel() {
  let businesses: Awaited<ReturnType<typeof getAllBusinessesFromPostgres>> = []
  try {
    businesses = await getAllBusinessesFromPostgres()
  } catch (err) {
    console.error('[BrandsCarousel] error consultando businesses:', err)
    return null
  }

  if (businesses.length === 0) return null

  const items = businesses.map((b) => ({
    id: b.id,
    name: b.name,
    logoUrl: b.logo_path?.startsWith('public/') ? buildPublicS3Url(b.logo_path) : null,
  }))

  // Repetimos lo suficiente para que el marquee siempre se vea lleno.
  const minLoopItems = 8
  const repeats = Math.max(2, Math.ceil(minLoopItems / items.length))
  const loop = Array.from({ length: repeats }, () => items).flat()

  return (
    <section className="relative z-10 w-full border-y border-[var(--citify-terracotta)]/15 bg-white/70 py-10 backdrop-blur-sm dark:bg-[#1A1A1A]/60">
      <div className="mx-auto max-w-6xl px-6 text-center">
        <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--citify-terracotta)]">
          Negocios adheridos
        </p>
        <h2 className="mt-2 text-2xl font-bold tracking-tight text-foreground md:text-3xl">
          Marcas que ya forman parte
        </h2>
      </div>

      <div
        className="group relative mt-6 overflow-hidden"
        style={{
          maskImage:
            'linear-gradient(to right, transparent 0, #000 8%, #000 92%, transparent 100%)',
          WebkitMaskImage:
            'linear-gradient(to right, transparent 0, #000 8%, #000 92%, transparent 100%)',
        }}
      >
        <div className="brand-marquee-track flex w-max items-center gap-8 px-6">
          {loop.map((item, i) => (
            <div
              key={`${item.id}-${i}`}
              className="flex h-32 w-56 shrink-0 items-center justify-center rounded-2xl bg-card p-5 shadow-sm ring-1 ring-border/60"
              title={item.name}
            >
              {item.logoUrl ? (
                <Image
                  src={item.logoUrl}
                  alt={item.name}
                  width={200}
                  height={100}
                  className="h-full w-auto object-contain"
                  unoptimized
                />
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-center">
                  <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--citify-terracotta)]/10 text-xl font-semibold text-[var(--citify-terracotta)]">
                    {item.name.trim().charAt(0).toUpperCase() || '?'}
                  </span>
                  <span className="line-clamp-1 text-sm font-medium text-muted-foreground">
                    {item.name}
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
