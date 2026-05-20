'use client'

import { useState } from 'react'
import { Building2, Store } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ContactDialog, type ContactKind } from '@/components/home/contact-dialog'

const CONTACT_EMAIL = 'digitalamenitiessas@gmail.com'

export function AffiliateSection() {
  const [openKind, setOpenKind] = useState<ContactKind | null>(null)

  return (
    <section className="relative z-10 mx-auto w-full max-w-5xl px-6 py-20">
      <div className="text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--citify-terracotta)]">
          Sumate a la red
        </p>
        <h2 className="mt-3 text-3xl font-bold tracking-tight text-foreground md:text-4xl">
          Quiero afiliarme
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-sm text-muted-foreground md:text-base">
          Si administrás un edificio o tenés un negocio que quiere llegar a residentes de
          consorcios, escribinos y armamos el alta juntos.
        </p>
      </div>

      <div className="mt-12 grid gap-6 md:grid-cols-2">
        <article className="group flex flex-col rounded-3xl bg-card p-8 shadow-sm ring-1 ring-border/60 transition hover:shadow-md hover:ring-[var(--citify-terracotta)]/30">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--citify-terracotta)]/10 text-[var(--citify-terracotta)]">
            <Building2 className="h-6 w-6" />
          </div>
          <h3 className="mt-4 text-xl font-bold text-foreground">Soy un edificio</h3>
          <p className="mt-2 flex-1 text-sm text-muted-foreground">
            Llevá Citify a tu consorcio: beneficios exclusivos para vecinos, panel para la
            administración, expedientes, comunicación interna y mucho más.
          </p>
          <Button size="lg" className="mt-6 btn-premium" onClick={() => setOpenKind('building')}>
            Contactar para sumar mi edificio
          </Button>
        </article>

        <article className="group flex flex-col rounded-3xl bg-card p-8 shadow-sm ring-1 ring-border/60 transition hover:shadow-md hover:ring-[var(--citify-terracotta)]/30">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--citify-terracotta)]/10 text-[var(--citify-terracotta)]">
            <Store className="h-6 w-6" />
          </div>
          <h3 className="mt-4 text-xl font-bold text-foreground">Soy un negocio</h3>
          <p className="mt-2 flex-1 text-sm text-muted-foreground">
            Llegá a residentes de edificios y consorcios con promociones, descuentos y experiencias.
            Te acompañamos en el alta y la gestión.
          </p>
          <Button
            size="lg"
            variant="outline"
            className="mt-6 border-[var(--citify-terracotta)]/40 text-foreground hover:bg-[var(--citify-terracotta)]/5"
            onClick={() => setOpenKind('business')}
          >
            Quiero adherir mi negocio
          </Button>
        </article>
      </div>

      <p className="mt-10 text-center text-sm text-muted-foreground">
        O escribinos directo a{' '}
        <a
          href={`mailto:${CONTACT_EMAIL}`}
          className="font-semibold text-[var(--citify-terracotta)] underline-offset-4 hover:underline"
        >
          {CONTACT_EMAIL}
        </a>
      </p>

      <ContactDialog
        open={openKind !== null}
        onOpenChange={(open) => !open && setOpenKind(null)}
        kind={openKind ?? 'business'}
      />
    </section>
  )
}
