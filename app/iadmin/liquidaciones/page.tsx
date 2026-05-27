import { LiquidationsTable } from '@/components/admin-backoffice/liquidaciones/liquidations-table'
import { requireIAdmin } from '@/lib/auth'
import { getIAdminLiquidationRuns } from '@/lib/data'

export default async function LiquidacionesPage() {
  const { context } = await requireIAdmin({ capability: 'liquidations.view' })

  const administrationId = context.primary?.administration.id
  const runs = administrationId ? await getIAdminLiquidationRuns(administrationId) : []

  return (
    <div className="space-y-6">
      <header className="glass-card rounded-2xl p-6">
        <p className="text-xs uppercase tracking-wider text-primary font-medium">Liquidaciones</p>
        <h1 className="font-serif text-2xl font-bold text-foreground mt-1">Corridas mensuales</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Cada corrida se genera por consorcio y período. Flujo:{' '}
          <span className="font-medium text-foreground">Borrador</span> →{' '}
          <span className="font-medium text-foreground">Calculada</span> →{' '}
          <span className="font-medium text-foreground">Emitida</span> →{' '}
          <span className="font-medium text-foreground">Cerrada</span>. Una vez cerrada queda bloqueada.
        </p>
      </header>
      <LiquidationsTable runs={runs} />
    </div>
  )
}
