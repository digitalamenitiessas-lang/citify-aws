import { PromotionsBrowser } from '@/components/promotions-browser'
import { SetupNotice } from '@/components/setup-notice'
import { getPromotionsPageData } from '@/lib/data'
import { isSupabaseConfigured } from '@/lib/supabase/env'

export default async function PromotionsPage() {
  if (!isSupabaseConfigured()) {
    return (
      <div className="min-h-screen bg-background pt-16">
        <SetupNotice />
      </div>
    )
  }

  const { promotions } = await getPromotionsPageData()
  return <PromotionsBrowser promotions={promotions} />
}
