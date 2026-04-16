export type UserRole = 'super_admin' | 'negocio_admin' | 'consorcio_admin' | 'vecino'

export interface Building {
  id: string
  name: string
  address: string
  totalUnits: number
  createdAt: string
}

export interface Profile {
  id: string
  email: string
  fullName: string
  role: UserRole
  avatarText: string
  businessId: string | null
  buildingId: string | null
  floor: string | null
  unit: string | null
  phone: string | null
  createdAt: string
}

export interface Business {
  id: string
  name: string
  category: string
  description: string
  ownerProfileId: string | null
  logoPath: string | null
  logoUrl: string | null
  createdAt: string
}

export interface Promotion {
  id: string
  businessId: string
  businessName: string
  title: string
  description: string
  discount: string
  category: string
  expirationDate: string
  usageCount: number
  buildingId: string | null
  createdAt: string
  imagePath: string | null
  imageUrl: string | null
  isActive: boolean
}

export type MarketplaceCondition = 'Nuevo' | 'Como Nuevo' | 'Buen Estado' | 'Usado'

export interface MarketplaceItem {
  id: string
  title: string
  description: string
  price: number
  condition: MarketplaceCondition
  sellerId: string
  sellerName: string
  sellerAvatar: string
  sellerPhone: string | null
  buildingId: string
  createdAt: string
  imagePath: string | null
  imageUrl: string | null
  isActive: boolean
}

export interface HomeData {
  promotions: Promotion[]
}

export interface PromotionsPageData {
  promotions: Promotion[]
}

export interface BusinessDashboardData {
  business: Business | null
  promotions: Promotion[]
  consumersCount: number
  availableBuildings: Building[]
}

export interface BuildingAdminAssignment {
  id: string
  profileId: string
  buildingId: string
  isPrimary: boolean
  createdAt: string
}

export interface ConsorcioManagedBuilding {
  building: Building
  neighbors: Profile[]
  registeredNeighbors: number
  occupancyRate: number
}

export interface ConsorcioDashboardData {
  managedBuildings: ConsorcioManagedBuilding[]
  assignments: BuildingAdminAssignment[]
  primaryBuildingId: string | null
  totalBuildings: number
  totalUnits: number
  totalNeighbors: number
  averageOccupancyRate: number
}

export interface ConsorcioAdminInfo {
  profileId: string
  fullName: string
  email: string
  phone: string | null
  isPrimary: boolean
}

export interface SuperAdminBuildingDetail extends Building {
  admins: ConsorcioAdminInfo[]
  neighbors: Profile[]
  registeredNeighbors: number
  occupancyRate: number
}

export interface PromotionRedemptionByBuilding {
  buildingId: string
  buildingName: string
  count: number
}

export interface SuperAdminPromotionDetail extends Promotion {
  redemptionsByBuilding: PromotionRedemptionByBuilding[]
}

export interface SuperAdminBusinessDetail extends Business {
  promotions: SuperAdminPromotionDetail[]
  totalRedemptions: number
  topBuilding: string | null
}

export interface SuperAdminDashboardData {
  buildings: SuperAdminBuildingDetail[]
  users: Profile[]
  businesses: SuperAdminBusinessDetail[]
  promotions: Promotion[]
}

export interface ConsumerDashboardData {
  building: Building | null
  promotions: Promotion[]
  marketplaceItems: MarketplaceItem[]
  savedPromotionIds: string[]
  usedPromotionIds: string[]
}
