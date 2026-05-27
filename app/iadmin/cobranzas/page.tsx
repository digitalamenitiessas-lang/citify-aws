import Link from 'next/link'
import { BarChart3, FileSpreadsheet } from 'lucide-react'
import { CobranzasOverview } from '@/components/admin-backoffice/cobranzas/cobranzas-overview'
import { PaymentsTable } from '@/components/admin-backoffice/cobranzas/payments-table'
import { PropertyFilterBanner } from '@/components/admin-backoffice/shell/property-filter-banner'
import { can, requireIAdmin } from '@/lib/auth'
import { getIAdminCollectionsData, getIAdminPortfolio } from '@/lib/data'
import { getCurrentPropertyId } from '@/lib/iadmin/current-property'
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

  const [data, portfolio] = await Promise.all([
    getIAdminCollectionsData(administrationId, filters),
    getIAdminPortfolio(administrationId),
  ])

  const allowedIds = (portfolio?.properties ?? []).map((p) => p.id)
  const currentPropertyId = await getCurrentPropertyId(allowedIds)
  const activeProperty = currentPropertyId
    ? portfolio?.properties.find((p) => p.id === currentPropertyId) ?? null
    : null

  // Aplicar filtro de property al payload (post-fetch). La query no soporta filtro
  // por managedPropertyId todavía, así que filtramos en memoria.
  const filteredPayments = currentPropertyId
    ? data.payments.filter((p) => p.managedPropertyId === currentPropertyId)
    : data.payments
  const filteredEligible = currentPropertyId
    ? data.eligibleItems.filter((it) => it.managedPropertyId === currentPropertyId)
    : data.eligibleItems
  const filteredCashAccounts = currentPropertyId
    ? data.cashAccounts.filter((a) => a.managedPropertyId === currentPropertyId)
    : data.cashAccounts

  const canVoid = can(context, 'collections.void')
  const canViewReports = can(context, 'reports.view')
  const hasIssuedRuns = filteredEligible.length > 0 || filteredPayments.length > 0

  return (
    <div className="space-y-4">
      <header className="glass-card rounded-2xl p-6">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <p className="text-xs uppercase tracking-wider text-primary font-medium">Cobranzas</p>
            <h1 className="font-serif text-2xl font-bold text-foreground mt-1">Cobranzas y deuda</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Registro de pagos contra liquidaciones emitidas. Cada pago genera un recibo numerado y
              un movimiento bancario asociado.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            <Link
              href="/iadmin/consorcios"
              className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-1.5 text-sm hover:bg-muted"
              title="Importar extracto bancario y conciliar"
            >
              <FileSpreadsheet className="w-4 h-4" />
              Conciliación bancaria
            </Link>
            {canViewReports ? (
              <Link
                href="/iadmin/cobranzas/reportes"
                className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-1.5 text-sm hover:bg-muted"
              >
                <BarChart3 className="w-4 h-4" />
                Ver reportes
              </Link>
            ) : null}
          </div>
        </div>
      </header>

      {activeProperty ? (
        <PropertyFilterBanner
          propertyName={activeProperty.displayName ?? activeProperty.buildingName}
          count={filteredPayments.length}
          itemLabel="pagos"
        />
      ) : null}

      <CobranzasOverview kpis={data.kpis} />

      <PaymentsTable
        payments={filteredPayments}
        filters={data.filters}
        eligibleItems={filteredEligible}
        cashAccounts={filteredCashAccounts}
        canVoid={canVoid}
        hasIssuedRuns={hasIssuedRuns}
      />
    </div>
  )
}
