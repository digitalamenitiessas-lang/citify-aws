import { notFound } from 'next/navigation'
import { MonthlyPlanilla } from '@/components/admin-backoffice/consorcio/monthly-planilla'
import { can, requireIAdmin } from '@/lib/auth'
import { getIAdminMonthlyGrid } from '@/lib/data'

export default async function PlanillaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { context } = await requireIAdmin({ capability: 'consorcio.view' })

  const grid = await getIAdminMonthlyGrid(id, { monthsCount: 3 })
  if (!grid) notFound()

  const canEmit = can(context, 'liquidations.create', { administrationId: grid.administrationId })
  const canManageRubros = can(context, 'providers.manage', { administrationId: grid.administrationId })

  return (
    <MonthlyPlanilla
      grid={grid}
      canEmit={canEmit}
      canManageRubros={canManageRubros}
    />
  )
}
