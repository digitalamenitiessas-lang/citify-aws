import { ConsorcioCasesPanel } from '@/components/complaints/consorcio-cases-panel'
import { requireProfile } from '@/lib/auth'
import { getConsorcioDashboardData } from '@/lib/data'

export const dynamic = 'force-dynamic'

export default async function ExpedientesPage() {
  const { profile } = await requireProfile(['consorcio_admin', 'super_admin'])
  const data = await getConsorcioDashboardData(profile.id)

  return (
    <div className="space-y-4">
      <header>
        <h1 className="font-serif text-2xl font-semibold text-foreground">Expedientes</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Reclamos y comunicaciones de los vecinos de tus edificios.
        </p>
      </header>
      <ConsorcioCasesPanel data={data} />
    </div>
  )
}
