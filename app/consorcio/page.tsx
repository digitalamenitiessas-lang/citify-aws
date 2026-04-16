import { SetupNotice } from '@/components/setup-notice'
import { ConsorcioDashboard } from '@/components/dashboards/consorcio-dashboard'
import { requireProfile } from '@/lib/auth'
import { getConsorcioDashboardData } from '@/lib/data'
import { isSupabaseConfigured } from '@/lib/supabase/env'

export default async function ConsorcioPage() {
  if (!isSupabaseConfigured()) {
    return (
      <div className="min-h-screen bg-background pt-16">
        <SetupNotice />
      </div>
    )
  }

  const { profile } = await requireProfile(['consorcio_admin', 'super_admin'])
  const data = await getConsorcioDashboardData(profile.id)

  return (
    <div className="min-h-screen bg-background pt-20">
      <ConsorcioDashboard data={data} />
    </div>
  )
}

