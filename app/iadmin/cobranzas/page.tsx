import { CobranzasOverview } from '@/components/admin-backoffice/cobranzas/cobranzas-overview'
import { PaymentsTable } from '@/components/admin-backoffice/cobranzas/payments-table'
import { can, requireIAdmin } from '@/lib/auth'
import { getIAdminCollectionsData } from '@/lib/data'
import type { IAdminCollectionsFilters } from '@/lib/types'

type SearchParams = {
  periodYear?: string
  periodMonth?: string
  unitId?: string
  status?: string
  method?: string
}

function parseFilters(sp: SearchParams): IAdminCollectionsFilters {
  const periodYear = sp.periodYear ? Number(sp.periodYear) : null
  const periodMonth = sp.periodMonth ? Number(sp.periodMonth) : null
  const statusInput = sp.status?.toLowerCase()
  const status: IAdminCollectionsFilters['status'] =
    statusInput === 'voided' ? 'voided' : statusInput === 'all' ? 'all' : 'live'
  return {
    periodYear: Number.isFinite(periodYear ?? NaN) ? periodYear : null,
    periodMonth: Number.isFinite(periodMonth ?? NaN) ? periodMonth : null,
    unitId: sp.unitId?.trim() || null,
    status,
    method: sp.method?.trim() || null,
  }
}

export default async function CobranzasPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const { context } = await requireIAdmin({ capability: 'collections.view' })
  const sp = await searchParams
  const filters = parseFilters(sp)

  const administrationId = context.primary?.administration.id
  if (!administrationId) {
    return (
      <div className="space-y-4">
        <header className="glass-card rounded-2xl p-6">
          <p className="text-xs uppercase tracking-wider text-primary font-medium">Cobranzas</p>
          <h1 className="font-serif text-2xl font-bold text-foreground mt-1">Cobranzas y deuda</h1>
        </header>
        <div className="glass-card rounded-2xl p-8 text-sm text-muted-foreground">
          Tu cuenta no tiene una administración asignada. Pedile al super admin que te vincule a
          una para empezar a registrar cobranzas.
        </div>
      </div>
    )
  }

  const data = await getIAdminCollectionsData(administrationId, filters)
  const canVoid = can(context, 'collections.void')
  const hasIssuedRuns = data.eligibleItems.length > 0 || data.payments.length > 0

  return (
    <div className="space-y-4">
      <header className="glass-card rounded-2xl p-6">
        <p className="text-xs uppercase tracking-wider text-primary font-medium">Cobranzas</p>
        <h1 className="font-serif text-2xl font-bold text-foreground mt-1">Cobranzas y deuda</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Registro de pagos contra liquidaciones emitidas. Cada pago genera un recibo numerado y un
          movimiento bancario asociado.
        </p>
      </header>

      <CobranzasOverview kpis={data.kpis} />

      <PaymentsTable
        payments={data.payments}
        filters={data.filters}
        eligibleItems={data.eligibleItems}
        cashAccounts={data.cashAccounts}
        canVoid={canVoid}
        hasIssuedRuns={hasIssuedRuns}
      />
    </div>
  )
}
