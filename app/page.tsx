import Image from 'next/image'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { AffiliateSection } from '@/components/home/affiliate-section'
import { BrandsCarousel } from '@/components/home/brands-carousel'
import { SiteFooter } from '@/components/home/site-footer'
import { getCurrentProfile } from '@/lib/auth'
import { ROLE_HOME } from '@/lib/constants'

export default async function HomePage() {
  const profile = await getCurrentProfile()
  if (profile?.role) {
    redirect(ROLE_HOME[profile.role])
  }

  return (
    <main className="relative min-h-[100dvh] overflow-hidden bg-background text-foreground">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(circle at 15% 12%, rgba(240, 78, 35, 0.18), transparent 55%),' +
            'radial-gradient(circle at 85% 90%, rgba(245, 165, 93, 0.20), transparent 55%)',
        }}
      />

      <section className="relative z-10 mx-auto flex max-w-4xl flex-col items-center px-6 pb-16 pt-24 text-center md:pt-32">
        <Image
          src="/citify-isologo.svg"
          alt="Citify"
          width={180}
          height={180}
          priority
          className="mb-8 h-28 w-auto md:h-36 dark:hidden"
        />
        <Image
          src="/citify-isologo-light.svg"
          alt="Citify"
          width={180}
          height={180}
          priority
          className="mb-8 hidden h-28 w-auto md:h-36 dark:block"
        />

        <h1 className="text-4xl font-bold tracking-tight text-foreground md:text-6xl">
          Beneficios exclusivos para tu{' '}
          <span className="text-[var(--citify-terracotta)]">edificio</span>
        </h1>

        <p className="mt-6 max-w-xl text-base text-muted-foreground md:text-lg">
          Descuentos en gastronomía, wellness, eventos y experiencias diseñadas
          para vecinos de edificios y consorcios.
        </p>

        <div className="mt-10 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
          <Button asChild size="lg" className="btn-premium px-8">
            <Link href="/login">Ingresar</Link>
          </Button>
          <Button
            asChild
            size="lg"
            variant="outline"
            className="border-[var(--citify-terracotta)]/40 text-foreground hover:bg-[var(--citify-terracotta)]/5"
          >
            <Link href="/promotions">Ver promociones</Link>
          </Button>
          <Button asChild size="lg" variant="ghost" className="text-foreground hover:bg-[var(--citify-terracotta)]/10">
            <Link href="#afiliarme">Quiero afiliarme</Link>
          </Button>
        </div>
      </section>

      <BrandsCarousel />

      <div id="afiliarme">
        <AffiliateSection />
      </div>

      <SiteFooter />
    </main>
  )
}
