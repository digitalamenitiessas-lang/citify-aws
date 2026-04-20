import Link from 'next/link'
import { Building2, FileText, Home, ShieldAlert } from 'lucide-react'
import type { IAdminPortfolio } from '@/lib/types'

export function PortfolioOverview({ portfolio }: { portfolio: IAdminPortfolio }) {
  const stats = [
    { label: 'Consorcios administrados', value: portfolio.stats.totalProperties, icon: Building2 },
    { label: 'Unidades en cartera', value: portfolio.stats.totalUnits, icon: Home },
    { label: 'Gastos abiertos', value: portfolio.stats.openExpenses, icon: FileText },
    { label: 'Documentos por validar', value: portfolio.stats.pendingDocs, icon: ShieldAlert },
  ]

  return (
    <div className="space-y-6">
      <section className="glass-card rounded-2xl p-6">
        <p className="text-xs uppercase tracking-wider text-primary font-medium">Cartera</p>
        <h1 className="font-serif text-2xl font-bold text-foreground mt-1">
          {portfolio.administration.name}
        </h1>
        <p className="text-sm text-muted-foreground mt-1.5">
          Vista consolidada de los consorcios bajo administracion. Operacion centralizada de gastos,
          liquidaciones y comunicaciones.
        </p>
      </section>

      <section className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        {stats.map((stat) => {
          const Icon = stat.icon
          return (
            <div key={stat.label} className="glass-card rounded-2xl p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                <Icon className="w-4 h-4 text-primary" />
              </div>
              <div>
                <div className="text-2xl font-bold text-foreground tabular-nums">{stat.value}</div>
                <div className="text-xs text-muted-foreground">{stat.label}</div>
              </div>
            </div>
          )
        })}
      </section>

      <section className="glass-card rounded-2xl overflow-hidden">
        <header className="px-5 py-4 border-b border-border/40">
          <h2 className="font-serif text-lg font-semibold text-foreground">Consorcios</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Click en una fila para abrir el detalle operativo.
          </p>
        </header>

        {portfolio.properties.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-muted-foreground">
            Aun no hay consorcios cargados en esta administracion.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-muted-foreground uppercase tracking-wider border-b border-border/40 bg-muted/30">
                <th className="text-left px-5 py-3 font-medium">Consorcio</th>
                <th className="text-left px-5 py-3 font-medium">Tipo</th>
                <th className="text-left px-5 py-3 font-medium">Direccion</th>
                <th className="text-right px-5 py-3 font-medium">Unidades</th>
                <th className="text-left px-5 py-3 font-medium">Inicio gestion</th>
              </tr>
            </thead>
            <tbody>
              {portfolio.properties.map((property) => (
                <tr key={property.id} className="border-b border-border/30 last:border-0 hover:bg-muted/40 transition-colors">
                  <td className="px-5 py-3">
                    <Link
                      href={`/iadmin/consorcios/${property.id}`}
                      className="font-medium text-foreground hover:text-primary"
                    >
                      {property.displayName ?? property.buildingName}
                    </Link>
                  </td>
                  <td className="px-5 py-3 capitalize text-muted-foreground">
                    {property.propertyKind.replace('_', ' ')}
                  </td>
                  <td className="px-5 py-3 text-muted-foreground">{property.buildingAddress}</td>
                  <td className="px-5 py-3 text-right tabular-nums text-foreground">{property.totalUnits}</td>
                  <td className="px-5 py-3 text-muted-foreground">
                    {property.managedSince ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}
