import { notFound } from 'next/navigation'
import { UnitsImportWizard } from '@/components/admin-backoffice/consorcio/units-import-wizard'
import { requireIAdmin } from '@/lib/auth'
import { getIAdminConsorcioDetail } from '@/lib/data'
import { BRAND_HERO } from '@/components/admin-backoffice/shared/brand'

export default async function ImportarPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await requireIAdmin({ capability: 'units.manage' })

  const detail = await getIAdminConsorcioDetail(id)
  if (!detail) notFound()

  return (
    <div className="space-y-6">
      <header className={`${BRAND_HERO} p-6`}>
        <p className="text-xs uppercase tracking-wider text-primary font-medium">Importar</p>
        <h1 className="font-serif text-2xl font-bold text-foreground mt-1">
          Subir Excel de unidades y titulares
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Si ya tenés tu cartera en una planilla Excel/CSV, subila acá y la IA mapea las columnas automáticamente.
          Útil para onboarding de consorcios nuevos o sincronizar cambios masivos.
        </p>
      </header>

      <UnitsImportWizard
        administrationId={detail.property.administrationId}
        propertyId={id}
        propertyName={detail.property.displayName ?? detail.property.buildingName}
      />
    </div>
  )
}
