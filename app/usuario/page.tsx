import { ConsumerDashboard } from '@/components/dashboards/consumer-dashboard'
import { requireProfile } from '@/lib/auth'
import { resolveVecinoBuildingId } from '@/lib/board-access'
import { getConsumerDashboardData } from '@/lib/data'
import { listBoardPostsForVecino } from '@/lib/db/board'

export default async function UsuarioPage() {
  const { profile } = await requireProfile(['vecino', 'super_admin'])
  const [data, buildingId] = await Promise.all([
    getConsumerDashboardData(profile.id),
    resolveVecinoBuildingId(profile),
  ])
  const boardPosts = buildingId ? await listBoardPostsForVecino(profile.id, buildingId) : []

  return (
    <div className="min-h-screen bg-background pt-16">
      <ConsumerDashboard
        initialData={data}
        boardPosts={boardPosts}
        profileId={profile.id}
        profileName={profile.fullName}
        avatarText={profile.avatarText}
      />
    </div>
  )
}
