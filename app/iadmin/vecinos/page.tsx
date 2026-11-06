import Link from 'next/link'
import { Building2, UserPlus, Users } from 'lucide-react'
import { BRAND_HERO } from '@/components/admin-backoffice/shared/brand'
import { can, requireIAdmin } from '@/lib/auth'
import { getIAdminPortfolio } from '@/lib/data'
import { listBuildingNeighbors, type BuildingNeighbor } from '@/lib/db/iadmin-vecinos'
import { getCurrentPropertyId } from '@/lib/iadmin/current-property'

export const dynamic = 'force-dynamic'

const RELATIONSHIP_LABEL: Record<NonNullable<BuildingNeighbor['relationship']>, string> = {
  propietario: 'Propietario',
  vecino_principal: 'Titular',
  vecino_adicional: 'Familiar / conviviente',
}

export default async function VecinosPage() {
  const { context } = await requireIAdmin({ capability: 'consorcio.view' })

  const header = (
    <header className={`${BRAND_HERO} p-6`}>
      <h1 className="font-serif text-2xl font-bold text-foreground">Vecinos</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Quiénes tienen acceso a Citify en cada edificio. Para sumar vecinos, pegá la lista desde Excel o
        cargalos a mano: cada uno recibe un mail con su contraseña temporal.
      </p>
    </header>
  )

  const administrationId = context.primary?.administration.id
  if (!administrationId) {
    return (
      <div className="space-y-4">
        {header}
        <div className="glass-card rounded-2xl p-8 text-sm text-muted-foreground">
          Tu cuenta no tiene una administración asignada todavía.
        </div>
      </div>
    )
  }

  // Edificio elegido en el selector del encabezado; sin elegir, todos.
  const portfolio = await getIAdminPortfolio(administrationId)
  const properties = portfolio?.properties ?? []
  const currentPropertyId = await getCurrentPropertyId(properties.map((p) => p.id))
  const scoped = currentPropertyId ? properties.filter((p) => p.id === currentPropertyId) : properties
  const neighbors = await Promise.all(scoped.map((p) => listBuildingNeighbors(p.buildingId)))
  const canAdd = can(context, 'holders.manage', { administrationId })

  return (
    <div className="space-y-4">
      {header}

      {scoped.length === 0 ? (
        <div className="glass-card rounded-2xl p-8 text-sm text-muted-foreground">
          Todavía no tenés edificios cargados. Los da de alta el equipo de Citify.
        </div>
      ) : null}

      {scoped.map((property, i) => {
        const list = neighbors[i]
        const pending = list.filter((n) => n.pendingFirstLogin).length
        return (
          <section key={property.id} className="glass-card rounded-2xl p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--citify-blush)] text-[var(--citify-terracotta-dark)]">
                  <Building2 className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <h2 className="truncate font-semibold text-foreground">{property.displayName ?? property.buildingName}</h2>
                  <p className="text-xs text-muted-foreground">
                    {list.length} {list.length === 1 ? 'vecino' : 'vecinos'}
                    {pending > 0 ? ` · ${pending} todavía no ${pending === 1 ? 'entró' : 'entraron'}` : ''}
                  </p>
                </div>
              </div>
              {canAdd ? (
                <Link
                  href={`/iadmin/consorcios/${property.id}/vecinos-masivo`}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--citify-terracotta)] px-3.5 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
                >
                  <UserPlus className="h-4 w-4" />
                  Agregar vecinos
                </Link>
              ) : null}
            </div>

            {list.length === 0 ? (
              <div className="mt-4 rounded-xl border border-dashed border-border px-4 py-8 text-center">
                <Users className="mx-auto mb-2 h-8 w-8 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">Este edificio todavía no tiene vecinos con acceso.</p>
              </div>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                      <th className="py-2 pr-3 font-semibold">Unidad</th>
                      <th className="py-2 pr-3 font-semibold">Nombre</th>
                      <th className="hidden py-2 pr-3 font-semibold sm:table-cell">Email</th>
                      <th className="hidden py-2 pr-3 font-semibold md:table-cell">Vínculo</th>
                      <th className="py-2 font-semibold">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.map((n) => (
                      <tr key={n.id} className="border-b border-border/50 last:border-0">
                        <td className="py-2.5 pr-3 font-medium text-foreground">{n.unitCode ?? '—'}</td>
                        <td className="py-2.5 pr-3 text-foreground">
                          {n.fullName}
                          <span className="block text-xs text-muted-foreground sm:hidden">{n.email}</span>
                        </td>
                        <td className="hidden py-2.5 pr-3 text-muted-foreground sm:table-cell">{n.email}</td>
                        <td className="hidden py-2.5 pr-3 text-muted-foreground md:table-cell">
                          {n.relationship ? RELATIONSHIP_LABEL[n.relationship] : '—'}
                        </td>
                        <td className="py-2.5">
                          {n.pendingFirstLogin ? (
                            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:bg-amber-500/15 dark:text-amber-400">
                              No entró
                            </span>
                          ) : (
                            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400">
                              Activo
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )
      })}
    </div>
  )
}
