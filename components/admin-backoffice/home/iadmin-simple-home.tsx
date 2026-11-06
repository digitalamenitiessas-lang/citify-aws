import Link from 'next/link'
import { ArrowRight, Megaphone, StickyNote, UserPlus, Users } from 'lucide-react'
import { BRAND_HERO } from '@/components/admin-backoffice/shared/brand'
import { KpiCard } from '@/components/admin-backoffice/shared/kpi-card'
import { BoardStatusBadge, timeAgo } from '@/components/board/board-shared'
import { PushToggle } from '@/components/pwa/push-toggle'
import { boardAuthorLabel, type BoardPost } from '@/lib/board'

/**
 * Inicio del administrador mientras las finanzas estan apagadas
 * (lib/features.ts): la pizarra, los vecinos y los comunicados. El tablero de
 * cobranzas (iadmin-dashboard.tsx) vuelve solo cuando se prendan.
 */
export function IAdminSimpleHome({
  administrationName,
  administratorName,
  openPosts,
  latestPosts,
  neighborCount,
  announcementsLast30,
  showBuilding,
}: {
  administrationName: string
  administratorName: string
  openPosts: number
  latestPosts: BoardPost[]
  neighborCount: number
  announcementsLast30: number
  showBuilding: boolean
}) {
  const firstName = administratorName.split(' ')[0]

  return (
    <div className="space-y-6">
      <PushToggle variant="banner" audience="admin" />

      <section className={`${BRAND_HERO} p-6`}>
        <p className="text-xs font-medium uppercase tracking-wider text-primary">
          Inicio
        </p>
        <h1 className="mt-1 font-serif text-2xl font-bold text-foreground">{administrationName}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {firstName ? `Hola ${firstName}. ` : ''}
          {openPosts === 0
            ? 'No hay quejas pendientes en la pizarra.'
            : `Tenés ${openPosts} ${openPosts === 1 ? 'queja sin resolver' : 'quejas sin resolver'} en la pizarra.`}
        </p>
      </section>

      <div className="grid gap-3 sm:grid-cols-3">
        <KpiCard
          icon={StickyNote}
          label="Quejas sin resolver"
          value={openPosts}
          tone={openPosts > 0 ? 'warning' : 'success'}
          hint="Ver la pizarra"
          href="/iadmin/pizarra"
        />
        <KpiCard icon={Users} label="Vecinos registrados" value={neighborCount} hint="Ver vecinos" href="/iadmin/vecinos" />
        <KpiCard
          icon={Megaphone}
          label="Comunicados (30 días)"
          value={announcementsLast30}
          hint="Publicar uno nuevo"
          href="/iadmin/comunicaciones"
        />
      </div>

      <section className="glass-card rounded-2xl p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-semibold text-foreground">Últimas quejas</h2>
          <Link href="/iadmin/pizarra" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
            Ir a la pizarra <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        {latestPosts.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">
            Todavía nadie escribió en la pizarra. Cuando un vecino publique una queja, te llega un aviso.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-border/60">
            {latestPosts.map((post) => (
              <li key={post.id}>
                <Link
                  href={`/iadmin/pizarra?id=${post.id}`}
                  className="-mx-2 flex items-start gap-3 rounded-lg px-2 py-3 transition-colors hover:bg-muted/40"
                >
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-sm text-foreground">{post.body}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {boardAuthorLabel(post)}
                      {showBuilding ? ` · ${post.buildingName}` : ''} · {timeAgo(post.createdAt)}
                      {post.supportCount > 0 ? ` · ${post.supportCount} se sumaron` : ''}
                    </p>
                  </div>
                  <BoardStatusBadge status={post.status} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="grid gap-3 sm:grid-cols-2">
        <Link
          href="/iadmin/comunicaciones"
          className="glass-card flex items-center gap-3 rounded-2xl p-4 transition-all hover:ring-1 hover:ring-primary/40"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--citify-blush)] text-[var(--citify-terracotta-dark)]">
            <Megaphone className="h-5 w-5" />
          </span>
          <span>
            <span className="block text-sm font-semibold text-foreground">Publicar un comunicado</span>
            <span className="block text-xs text-muted-foreground">Les llega a todos los vecinos al celular y por mail</span>
          </span>
        </Link>
        <Link
          href="/iadmin/vecinos"
          className="glass-card flex items-center gap-3 rounded-2xl p-4 transition-all hover:ring-1 hover:ring-primary/40"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--citify-blush)] text-[var(--citify-terracotta-dark)]">
            <UserPlus className="h-5 w-5" />
          </span>
          <span>
            <span className="block text-sm font-semibold text-foreground">Agregar vecinos</span>
            <span className="block text-xs text-muted-foreground">Pegá la lista desde Excel o cargalos a mano</span>
          </span>
        </Link>
      </div>
    </div>
  )
}
