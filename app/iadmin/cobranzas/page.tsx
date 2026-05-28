import Link from 'next/link'
import { ArrowRight, Building2 } from 'lucide-react'
import { CollectionsByUnitView } from '@/components/admin-backoffice/cobranzas/collections-by-unit-view'
import { can, requireIAdmin } from '@/lib/auth'
import {
  getIAdminCashAccounts,
  getIAdminMesaState,
  getIAdminPortfolio,
} from '@/lib/data'
import { getCurrentPropertyId } from '@/lib/iadmin/current-property'

export const dynamic = 'force-dynamic'

export default async function CobranzasPage() {
  const { context } = await requireIAdmin({ capability: 'collections.view' })

  const administrationId = context.primary?.administration.id
  if (!administrationId) {
    return (
      <div className="space-y-4">
        <header className="glass-card rounded-2xl p-6">
          <p className="text-xs uppercase tracking-wider text-primary font-medium">Cobranzas</p>
          <h1 className="font-serif text-2xl font-bold text-foreground mt-1">Control de pagos</h1>
        </header>
        <div className="glass-card rounded-2xl p-8 text-sm text-muted-foreground">
          Tu cuenta no tiene una administración asignada todavía.
        </div>
      </div>
    )
  }

  const portfolio = await getIAdminPortfolio(administrationId)
  const properties = portfolio?.properties ?? []
  const allowedIds = properties.map((p) => p.id)
  const currentPropertyId = await getCurrentPropertyId(allowedIds)

  // Sin edificio activo y varios para elegir → mostrar lista para que pick uno.
  if (!currentPropertyId) {
    return (
      <div className="space-y-4">
        <header className="glass-card rounded-2xl p-6">
          <p className="text-xs uppercase tracking-wider text-primary font-medium">Cobranzas</p>
          <h1 className="font-serif text-2xl font-bold text-foreground mt-1">Control de pagos</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Elegí un edificio arriba (selector en el header) para ver y registrar pagos de sus
            unidades.
          </p>
        </header>

        {properties.length === 0 ? (
          <div className="glass-card rounded-2xl p-10 text-center text-sm text-muted-foreground">
            Todavía no tenés consorcios cargados.{' '}
            <Link href="/iadmin/cartera" className="text-primary hover:underline">
              Ir a Cartera
            </Link>
            .
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {properties.map((p) => (
              <Link
                key={p.id}
                href={`/iadmin/consorcios/${p.id}`}
                className="glass-card rounded-2xl p-5 hover:ring-2 hover:ring-primary/30 transition-all group"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                      <Building2 className="w-4 h-4" />
                    </span>
                    <div className="min-w-0">
                      <div className="font-medium text-foreground truncate group-hover:text-primary">
                        {p.displayName ?? p.buildingName}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {p.totalUnits} unidades
                      </div>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    )
  }

  // Hay edificio activo → cargar mesa state del período actual + cash accounts.
  const property = properties.find((p) => p.id === currentPropertyId)
  if (!property) {
    return (
      <div className="glass-card rounded-2xl p-8 text-sm text-muted-foreground">
        No se pudo cargar el edificio seleccionado.
      </div>
    )
  }

  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1

  const [state, cashAccounts] = await Promise.all([
    getIAdminMesaState(currentPropertyId, year, month),
    getIAdminCashAccounts(currentPropertyId),
  ])

  if (!state) {
    return (
      <div className="glass-card rounded-2xl p-8 text-sm text-muted-foreground">
        No se pudo cargar el estado de cobranzas del período actual.
      </div>
    )
  }

  const canRegisterPayments = can(context, 'collections.register', { administrationId })

  return (
    <div className="space-y-4">
      <header className="glass-card rounded-2xl p-6">
        <p className="text-xs uppercase tracking-wider text-primary font-medium">Cobranzas</p>
        <h1 className="font-serif text-2xl font-bold text-foreground mt-1">Control de pagos</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Registrá pagos rápido por unidad. Para cobros parciales, anular pagos o ver historial
          completo, abrí el detalle de cada unidad.
        </p>
      </header>

      <CollectionsByUnitView
        state={state}
        cashAccounts={cashAccounts}
        canRegisterPayments={canRegisterPayments}
        propertyId={currentPropertyId}
        propertyName={property.displayName ?? property.buildingName}
        year={year}
        month={month}
      />
    </div>
  )
}
