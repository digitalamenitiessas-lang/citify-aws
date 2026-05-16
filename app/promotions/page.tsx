import { PromotionsBrowser } from '@/components/promotions-browser'
import { getPromotionsPageData } from '@/lib/data'

// La data viene de RDS en runtime, no se puede SSG en build sin DB.
export const dynamic = 'force-dynamic'

export default async function PromotionsPage() {
  const { promotions } = await getPromotionsPageData()
  return <PromotionsBrowser promotions={promotions} />
}
