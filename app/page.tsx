import { existsSync } from 'fs'
import path from 'path'
import { LandingExperience3D } from '@/components/landing/landing-experience-3d'
import { SetupNotice } from '@/components/setup-notice'
import { getHomeData } from '@/lib/data'
import { isSupabaseConfigured } from '@/lib/supabase/env'

export default async function HomePage() {
  if (!isSupabaseConfigured()) {
    return (
      <div className="min-h-screen bg-background pt-16">
        <SetupNotice />
      </div>
    )
  }

  const { promotions } = await getHomeData()
  const featuredPromotions = promotions.slice(0, 3)
  const hasOptimizedModels =
    existsSync(path.join(process.cwd(), 'public', 'models', 'modern-apartment-landing.optimized.glb')) &&
    existsSync(path.join(process.cwd(), 'public', 'models', 'modern-apartment-landing.mobile.glb'))

  return <LandingExperience3D featuredPromotions={featuredPromotions} hasOptimizedModels={hasOptimizedModels} />
}
