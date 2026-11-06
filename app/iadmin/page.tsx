import Link from 'next/link'
import { IAdminDashboard } from '@/components/admin-backoffice/home/iadmin-dashboard'
import { IAdminSimpleHome } from '@/components/admin-backoffice/home/iadmin-simple-home'
import { requireIAdmin } from '@/lib/auth'
import { getIAdminPortfolio, getIAdminPortfolioOverview } from '@/lib/data'
import { countOpenBoardPosts, listBoardPostsForAdmin } from '@/lib/db/board'
import { countBuildingNeighbors } from '@/lib/db/iadmin-vecinos'
import { pgQuery } from '@/lib/db/postgres'
import { IADMIN_FINANZAS } from '@/lib/features'
import { getCurrentPropertyId } from '@/lib/iadmin/current-property'

function parsePeriodParam(raw: string | undefined | null): { year: number; month: number } | null {
  if (!raw) return null
  const m = /^(\d{4})-(\d{2})$/.exec(raw)
  if (!m) return null
  const year = Number(m[1])
  const month = Number(m[2])
  if (year < 2020 || year > 2100 || month < 1 || month > 12) return null
  return { year, month }
}

export const dynamic = 'force-dynamic'

export default async function IAdminHomePage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>
}) {
  const params = await searchParams
  const { context, profile } = await requireIAdmin({ capability: 'portfolio.view' })

  const administrationId = context.primary?.administration.id
  if (!administrationId) {
    return (
      <div className="glass-card rounded-2xl p-8 text-sm text-muted-foreground">
        Tu cuenta no tiene una administración asignada todavía. Pedile al super admin que te
        vincule a una para empezar.
      </div>
    )
  }

  if (!IADMIN_FINANZAS) {
    return <SimpleHome administrationId={administrationId} administratorName={profile.fullName ?? ''} />
  }

  const selectedPeriod = parsePeriodParam(params.period)
  const overview = await getIAdminPortfolioOverview(administrationId, selectedPeriod)

  if (!overview) {
    return (
      <div className="glass-card rounded-2xl p-8 text-sm text-muted-foreground">
        No se pudo cargar el resumen.{' '}
        <Link href="/iadmin/cartera" className="text-primary hover:underline">
          Ir a Cartera
        </Link>
        .
      </div>
    )
  }

  return (
    <IAdminDashboard
      overview={overview}
      administratorName={profile.fullName ?? ''}
    />
  )
}

// Inicio con las finanzas apagadas (lib/features.ts): pizarra, vecinos y
// comunicados del edificio elegido arriba, o de todos.
async function SimpleHome({
  administrationId,
  administratorName,
}: {
  administrationId: string
  administratorName: string
}) {
  const portfolio = await getIAdminPortfolio(administrationId)
  const properties = portfolio?.properties ?? []
  const currentPropertyId = await getCurrentPropertyId(properties.map((p) => p.id))
  const scoped = currentPropertyId ? properties.filter((p) => p.id === currentPropertyId) : properties
  const buildingIds = scoped.map((p) => p.buildingId)

  const [openPosts, posts, neighborCount, announcements] = await Promise.all([
    countOpenBoardPosts(buildingIds),
    listBoardPostsForAdmin(buildingIds),
    countBuildingNeighbors(buildingIds),
    buildingIds.length === 0
      ? Promise.resolve(0)
      : pgQuery<{ n: number }>(
          `select count(*)::int as n
             from citify.building_announcements
            where building_id = any($1::uuid[])
              and published_at > now() - interval '30 days'`,
          [buildingIds],
        ).then((r) => r.rows[0]?.n ?? 0),
  ])

  return (
    <IAdminSimpleHome
      administrationName={portfolio?.administration.name ?? ''}
      administratorName={administratorName}
      openPosts={openPosts}
      latestPosts={posts.filter((p) => !p.hidden && p.status !== 'resuelta').slice(0, 5)}
      neighborCount={neighborCount}
      announcementsLast30={announcements}
      showBuilding={scoped.length > 1}
    />
  )
}
