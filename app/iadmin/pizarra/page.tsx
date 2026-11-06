import { AdminBoardPanel } from '@/components/board/admin-board-panel'
import { BRAND_HERO } from '@/components/admin-backoffice/shared/brand'
import { requireIAdmin } from '@/lib/auth'
import { getIAdminPortfolio } from '@/lib/data'
import { listBoardPostsForAdmin } from '@/lib/db/board'
import { getCurrentPropertyId } from '@/lib/iadmin/current-property'

export const dynamic = 'force-dynamic'

export default async function PizarraPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>
}) {
  const params = await searchParams
  const { context } = await requireIAdmin({ capability: 'consorcio.view' })

  const header = (
    <header className={`${BRAND_HERO} p-6`}>
      <h1 className="font-serif text-2xl font-bold text-foreground">Pizarra de quejas</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Lo que los vecinos cuentan en la pizarra de su edificio. Tus respuestas las ven todos los vecinos.
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
  const posts = await listBoardPostsForAdmin(scoped.map((p) => p.buildingId))

  return (
    <div className="space-y-4">
      {header}
      <AdminBoardPanel
        posts={posts}
        showBuilding={scoped.length > 1}
        focusedId={params.id ?? null}
      />
    </div>
  )
}
