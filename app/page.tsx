import { existsSync } from 'fs'
import path from 'path'
import { redirect } from 'next/navigation'
import { LandingExperience3D } from '@/components/landing/landing-experience-3d'
import { getCurrentProfile } from '@/lib/auth'
import { ROLE_HOME } from '@/lib/constants'
import { getHomeData } from '@/lib/data'

export default async function HomePage() {
  const profile = await getCurrentProfile()
  if (profile?.role) {
    redirect(ROLE_HOME[profile.role])
  }

  let featuredPromotions: Awaited<ReturnType<typeof getHomeData>>['promotions'] = []
  try {
    const { promotions } = await getHomeData()
    featuredPromotions = promotions.slice(0, 3)
  } catch (error) {
    console.error('[HomePage] No se pudieron cargar las promociones destacadas:', error)
  }

  const hasOptimizedModels =
    existsSync(path.join(process.cwd(), 'public', 'models', 'modern-apartment-landing.optimized.glb')) &&
    existsSync(path.join(process.cwd(), 'public', 'models', 'modern-apartment-landing.mobile.glb'))

  return <LandingExperience3D featuredPromotions={featuredPromotions} hasOptimizedModels={hasOptimizedModels} />
}
