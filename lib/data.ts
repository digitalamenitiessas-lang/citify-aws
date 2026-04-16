import { CATEGORIES } from '@/lib/constants'
import type {
  Building,
  BuildingAdminAssignment,
  Business,
  BusinessDashboardData,
  ConsorcioAdminInfo,
  ConsorcioManagedBuilding,
  ConsorcioDashboardData,
  ConsumerDashboardData,
  HomeData,
  MarketplaceItem,
  Profile,
  Promotion,
  PromotionRedemptionByBuilding,
  PromotionsPageData,
  SuperAdminBuildingDetail,
  SuperAdminBusinessDetail,
  SuperAdminDashboardData,
  SuperAdminPromotionDetail,
} from '@/lib/types'
import { getSupabaseServerClient } from '@/lib/supabase/server'

function publicUrl(client: any, bucket: string, path: string | null | undefined) {
  if (!path) {
    return null
  }

  return client.storage.from(bucket).getPublicUrl(path).data.publicUrl
}

function mapBuilding(row: any): Building {
  return {
    id: row.id,
    name: row.name,
    address: row.address,
    totalUnits: row.total_units ?? 0,
    createdAt: row.created_at,
  }
}

function mapBuildingAssignment(row: any): BuildingAdminAssignment {
  return {
    id: row.id,
    profileId: row.profile_id,
    buildingId: row.building_id,
    isPrimary: Boolean(row.is_primary),
    createdAt: row.created_at,
  }
}

function mapProfile(row: any): Profile {
  return {
    id: row.id,
    email: row.email ?? '',
    fullName: row.full_name ?? 'Usuario',
    role: row.role,
    avatarText: row.avatar_text ?? 'U',
    businessId: row.business_id ?? null,
    buildingId: row.building_id ?? null,
    floor: row.floor ?? null,
    unit: row.unit ?? null,
    phone: row.phone ?? null,
    createdAt: row.created_at,
  }
}

function mapBusiness(client: any, row: any): Business {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    description: row.description ?? '',
    ownerProfileId: row.owner_profile_id ?? null,
    logoPath: row.logo_path ?? null,
    logoUrl: publicUrl(client, 'business-logos', row.logo_path),
    createdAt: row.created_at,
  }
}

function mapPromotion(client: any, row: any): Promotion {
  const business = Array.isArray(row.businesses) ? row.businesses[0] : row.businesses
  const redemptions = Array.isArray(row.promotion_redemptions) ? row.promotion_redemptions : []
  return {
    id: row.id,
    businessId: row.business_id,
    businessName: business?.name ?? 'Comercio',
    title: row.title,
    description: row.description,
    discount: row.discount,
    category: row.category,
    expirationDate: row.expiration_date,
    usageCount: redemptions.length,
    buildingId: row.building_id ?? null,
    createdAt: row.created_at,
    imagePath: row.image_path ?? null,
    imageUrl: publicUrl(client, 'promotion-images', row.image_path),
    isActive: Boolean(row.is_active),
  }
}

function mapMarketplaceItem(client: any, row: any): MarketplaceItem {
  const seller = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? '',
    price: Number(row.price ?? 0),
    condition: row.condition,
    sellerId: row.seller_profile_id,
    sellerName: seller?.full_name ?? 'Vecino',
    sellerAvatar: seller?.avatar_text ?? 'VN',
    sellerPhone: seller?.phone ?? null,
    buildingId: row.building_id,
    createdAt: row.created_at,
    imagePath: row.image_path ?? null,
    imageUrl: publicUrl(client, 'marketplace-images', row.image_path),
    isActive: Boolean(row.is_active),
  }
}

export async function getHomeData(): Promise<HomeData> {
  const supabase = await getSupabaseServerClient()
  if (!supabase) {
    return { promotions: [] }
  }

  const today = new Date().toISOString().slice(0, 10)
  const { data } = await supabase
    .from('promotions')
    .select(`
      *,
      businesses ( id, name, logo_path ),
      promotion_redemptions ( id )
    `)
    .eq('is_active', true)
    .gte('expiration_date', today)
    .order('created_at', { ascending: false })
    .limit(12)

  return {
    promotions: (data ?? []).map((row: any) => mapPromotion(supabase, row)),
  }
}

export async function getPromotionsPageData(): Promise<PromotionsPageData> {
  return getHomeData()
}

export async function getBusinessDashboardData(profileId: string): Promise<BusinessDashboardData> {
  const supabase = await getSupabaseServerClient()
  if (!supabase) {
    return { business: null, promotions: [], consumersCount: 0, availableBuildings: [] }
  }

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', profileId).single()
  const businessId = profile?.business_id

  const [{ data: businessData }, { data: promotionsData }, { count }, { data: buildingsData }] = await Promise.all([
    businessId ? supabase.from('businesses').select('*').eq('id', businessId).maybeSingle() : Promise.resolve({ data: null }),
    businessId
      ? supabase
          .from('promotions')
          .select(`*, businesses ( id, name ), promotion_redemptions ( id )`)
          .eq('business_id', businessId)
          .order('created_at', { ascending: false })
      : Promise.resolve({ data: [] }),
    supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'vecino'),
    supabase.from('buildings').select('*').order('name'),
  ])

  return {
    business: businessData ? mapBusiness(supabase, businessData) : null,
    promotions: (promotionsData ?? []).map((row: any) => mapPromotion(supabase, row)),
    consumersCount: count ?? 0,
    availableBuildings: (buildingsData ?? []).map(mapBuilding),
  }
}

export async function getConsorcioDashboardData(profileId: string): Promise<ConsorcioDashboardData> {
  const supabase = await getSupabaseServerClient()
  if (!supabase) {
    return {
      managedBuildings: [],
      assignments: [],
      primaryBuildingId: null,
      totalBuildings: 0,
      totalUnits: 0,
      totalNeighbors: 0,
      averageOccupancyRate: 0,
    }
  }

  const { data: assignmentsData } = await supabase
    .from('building_admin_assignments')
    .select('*')
    .eq('profile_id', profileId)
    .order('is_primary', { ascending: false })
    .order('created_at', { ascending: true })

  const assignments = (assignmentsData ?? []).map(mapBuildingAssignment)
  const buildingIds = assignments.map((assignment) => assignment.buildingId)

  if (buildingIds.length === 0) {
    return {
      managedBuildings: [],
      assignments,
      primaryBuildingId: null,
      totalBuildings: 0,
      totalUnits: 0,
      totalNeighbors: 0,
      averageOccupancyRate: 0,
    }
  }

  const [{ data: buildingsData }, { data: neighborsData }] = await Promise.all([
    supabase.from('buildings').select('*').in('id', buildingIds).order('name'),
    supabase.from('profiles').select('*').eq('role', 'vecino').in('building_id', buildingIds).order('full_name'),
  ])

  const neighborsByBuilding = new Map<string, Profile[]>()
  for (const row of neighborsData ?? []) {
    const mapped = mapProfile(row)
    const key = mapped.buildingId
    if (!key) continue
    const current = neighborsByBuilding.get(key) ?? []
    current.push(mapped)
    neighborsByBuilding.set(key, current)
  }

  const buildingsById = new Map((buildingsData ?? []).map((row: any) => [row.id, mapBuilding(row)]))
  const managedBuildings: ConsorcioManagedBuilding[] = assignments
    .map((assignment) => {
      const building = buildingsById.get(assignment.buildingId)
      if (!building) {
        return null
      }
      const neighbors = neighborsByBuilding.get(building.id) ?? []
      const occupancyRate = Math.round((neighbors.length / Math.max(building.totalUnits, 1)) * 100)
      return {
        building,
        neighbors,
        registeredNeighbors: neighbors.length,
        occupancyRate,
      }
    })
    .filter((item): item is ConsorcioManagedBuilding => Boolean(item))

  const totalUnits = managedBuildings.reduce((sum, item) => sum + item.building.totalUnits, 0)
  const totalNeighbors = managedBuildings.reduce((sum, item) => sum + item.registeredNeighbors, 0)
  const averageOccupancyRate = managedBuildings.length
    ? Math.round(managedBuildings.reduce((sum, item) => sum + item.occupancyRate, 0) / managedBuildings.length)
    : 0
  const primaryBuildingId = assignments.find((assignment) => assignment.isPrimary)?.buildingId ?? managedBuildings[0]?.building.id ?? null

  return {
    managedBuildings,
    assignments,
    primaryBuildingId,
    totalBuildings: managedBuildings.length,
    totalUnits,
    totalNeighbors,
    averageOccupancyRate,
  }
}

export async function getSuperAdminDashboardData(): Promise<SuperAdminDashboardData> {
  const supabase = await getSupabaseServerClient()
  if (!supabase) {
    return { buildings: [], users: [], businesses: [], promotions: [] }
  }

  const [buildingsRes, usersRes, businessesRes, promotionsRes, assignmentsRes, redemptionsRes] = await Promise.all([
    supabase.from('buildings').select('*').order('name'),
    supabase.from('profiles').select('*').order('full_name'),
    supabase.from('businesses').select('*').order('name'),
    supabase
      .from('promotions')
      .select(`*, businesses ( id, name ), promotion_redemptions ( id )`)
      .order('created_at', { ascending: false }),
    // admin assignments with profile info
    supabase
      .from('building_admin_assignments')
      .select(`*, profiles ( id, full_name, email, phone )`),
    // redemptions with the redeemer's building_id
    supabase
      .from('promotion_redemptions')
      .select(`promotion_id, profiles ( building_id, buildings ( id, name ) )`),
  ])

  const allBuildings = (buildingsRes.data ?? []).map(mapBuilding)
  const allUsers = (usersRes.data ?? []).map(mapProfile)
  const allPromotionsRaw = (promotionsRes.data ?? []).map((row: any) => mapPromotion(supabase, row))

  // Build map: buildingId -> consorcio admins
  const adminsByBuilding = new Map<string, ConsorcioAdminInfo[]>()
  for (const row of assignmentsRes.data ?? []) {
    const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles
    if (!profile) continue
    const info: ConsorcioAdminInfo = {
      profileId: profile.id,
      fullName: profile.full_name ?? 'Sin nombre',
      email: profile.email ?? '',
      phone: profile.phone ?? null,
      isPrimary: Boolean(row.is_primary),
    }
    const existing = adminsByBuilding.get(row.building_id) ?? []
    existing.push(info)
    adminsByBuilding.set(row.building_id, existing)
  }

  // Build map: buildingId -> neighbors (vecinos)
  const neighborsByBuilding = new Map<string, Profile[]>()
  for (const user of allUsers) {
    if (user.role !== 'vecino' || !user.buildingId) continue
    const existing = neighborsByBuilding.get(user.buildingId) ?? []
    existing.push(user)
    neighborsByBuilding.set(user.buildingId, existing)
  }

  // Build map: promotionId -> redemptions by building
  const redemptionMap = new Map<string, Map<string, { name: string; count: number }>>()
  for (const row of redemptionsRes.data ?? []) {
    const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles
    const building = profile?.buildings
      ? Array.isArray(profile.buildings) ? profile.buildings[0] : profile.buildings
      : null
    if (!building?.id) continue
    if (!redemptionMap.has(row.promotion_id)) redemptionMap.set(row.promotion_id, new Map())
    const byBuilding = redemptionMap.get(row.promotion_id)!
    const current = byBuilding.get(building.id) ?? { name: building.name, count: 0 }
    current.count += 1
    byBuilding.set(building.id, current)
  }

  // Enrich promotions
  const allPromotions: SuperAdminPromotionDetail[] = allPromotionsRaw.map((promotion) => {
    const byBuilding = redemptionMap.get(promotion.id)
    const redemptionsByBuilding: PromotionRedemptionByBuilding[] = byBuilding
      ? Array.from(byBuilding.entries())
          .map(([buildingId, { name, count }]) => ({ buildingId, buildingName: name, count }))
          .sort((a, b) => b.count - a.count)
      : []
    return { ...promotion, redemptionsByBuilding }
  })

  // Enrich buildings
  const buildings: SuperAdminBuildingDetail[] = allBuildings.map((building) => {
    const neighbors = neighborsByBuilding.get(building.id) ?? []
    const admins = adminsByBuilding.get(building.id) ?? []
    const occupancyRate = Math.round((neighbors.length / Math.max(building.totalUnits, 1)) * 100)
    return { ...building, admins, neighbors, registeredNeighbors: neighbors.length, occupancyRate }
  })

  // Enrich businesses
  const businessPromoMap = new Map<string, SuperAdminPromotionDetail[]>()
  for (const promotion of allPromotions) {
    const existing = businessPromoMap.get(promotion.businessId) ?? []
    existing.push(promotion)
    businessPromoMap.set(promotion.businessId, existing)
  }

  const businesses: SuperAdminBusinessDetail[] = (businessesRes.data ?? []).map((row: any) => {
    const business = mapBusiness(supabase, row)
    const promotions = businessPromoMap.get(business.id) ?? []
    const totalRedemptions = promotions.reduce((sum, p) => sum + p.usageCount, 0)

    // find building where this business's coupons are most used
    const buildingCounts = new Map<string, { name: string; count: number }>()
    for (const promotion of promotions) {
      for (const { buildingId, buildingName, count } of promotion.redemptionsByBuilding) {
        const existing = buildingCounts.get(buildingId) ?? { name: buildingName, count: 0 }
        existing.count += count
        buildingCounts.set(buildingId, existing)
      }
    }
    const topEntry = Array.from(buildingCounts.values()).sort((a, b) => b.count - a.count)[0]
    return { ...business, promotions, totalRedemptions, topBuilding: topEntry?.name ?? null }
  })

  return {
    buildings,
    users: allUsers,
    businesses,
    promotions: allPromotions,
  }
}

export async function getConsumerDashboardData(profileId: string): Promise<ConsumerDashboardData> {
  const supabase = await getSupabaseServerClient()
  if (!supabase) {
    return { building: null, promotions: [], marketplaceItems: [], savedPromotionIds: [], usedPromotionIds: [] }
  }

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', profileId).single()
  const buildingId = profile?.building_id

  const [{ data: buildingData }, { data: promotionsData }, { data: marketplaceData }, { data: savedRows }, { data: usedRows }] =
    await Promise.all([
      buildingId ? supabase.from('buildings').select('*').eq('id', buildingId).maybeSingle() : Promise.resolve({ data: null }),
      supabase
        .from('promotions')
        .select(`*, businesses ( id, name ), promotion_redemptions ( id )`)
        .eq('is_active', true)
        .order('created_at', { ascending: false }),
      buildingId
        ? supabase
            .from('marketplace_items')
            .select(`*, profiles ( full_name, avatar_text, phone )`)
            .eq('building_id', buildingId)
            .eq('is_active', true)
            .order('created_at', { ascending: false })
        : Promise.resolve({ data: [] }),
      supabase.from('saved_promotions').select('promotion_id').eq('profile_id', profileId),
      supabase.from('promotion_redemptions').select('promotion_id').eq('profile_id', profileId),
    ])

  const promotions = (promotionsData ?? [])
    .map((row: any) => mapPromotion(supabase, row))
    .filter((promotion) => !promotion.buildingId || promotion.buildingId === buildingId)

  return {
    building: buildingData ? mapBuilding(buildingData) : null,
    promotions,
    marketplaceItems: (marketplaceData ?? []).map((row: any) => mapMarketplaceItem(supabase, row)),
    savedPromotionIds: (savedRows ?? []).map((row: any) => row.promotion_id),
    usedPromotionIds: (usedRows ?? []).map((row: any) => row.promotion_id),
  }
}

export function getCategoryOptions(promotions: Promotion[]) {
  const categories = new Set<string>(CATEGORIES)
  promotions.forEach((promotion) => categories.add(promotion.category))
  return ['Todas', ...Array.from(categories).filter((category) => category !== 'Todas')]
}
