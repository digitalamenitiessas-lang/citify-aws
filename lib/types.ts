export type UserRole = 'super_admin' | 'negocio_admin' | 'consorcio_admin' | 'vecino'

export interface Building {
  id: string
  name: string
  address: string
  latitude: number | null
  longitude: number | null
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
  address: string | null
  latitude: number | null
  longitude: number | null
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

export type ComplaintCaseStatus = 'nuevo' | 'en_revision' | 'en_desarrollo' | 'en_espera' | 'resuelto' | 'cerrado'
export type ComplaintCaseEventType = 'created' | 'status_changed' | 'message_posted' | 'resolved' | 'closed' | 'migrated'
export type ComplaintCaseMessageType = 'comment' | 'status_note'
export type ComplaintMessageActorRole = 'vecino' | 'consorcio' | 'super_admin' | 'sistema'
export type ComplaintCaseSection = 'summary' | 'forum' | 'events'

export interface ComplaintReason {
  id: string
  slug: string
  label: string
  description: string | null
  isOther: boolean
  createdAt: string
}

export interface ComplaintCaseReasonSelection {
  id: string
  slug: string
  label: string
  isOther: boolean
}

export interface ComplaintCaseListItem {
  id: string
  caseCode: string
  buildingId: string
  buildingName: string
  title: string
  status: ComplaintCaseStatus
  createdAt: string
  updatedAt: string
  lastEventAt: string
  lastEventSummary: string | null
  reasons: ComplaintCaseReasonSelection[]
  otherReasonText: string | null
  messageCount: number
  eventCount: number
  canReply: boolean
  canChangeStatus: boolean
}

export interface ComplaintCaseEvent {
  id: string
  caseId: string
  eventType: ComplaintCaseEventType
  actorLabel: string
  actorRole: ComplaintMessageActorRole
  summary: string
  metadata: Record<string, string | number | boolean | null> | null
  createdAt: string
}

export interface ComplaintCaseMessageMention {
  id: string
  messageId: string
  mentionedProfileId: string
  label: string
}

export interface ComplaintCaseMentionableUser {
  profileId: string
  fullName: string
  role: UserRole
  unitLabel: string | null
  buildingId: string
  label: string
}

export interface ComplaintCaseMessageView {
  id: string
  caseId: string
  message: string
  messageType: ComplaintCaseMessageType
  authorLabel: string
  authorRole: ComplaintMessageActorRole
  mentions: ComplaintCaseMessageMention[]
  createdAt: string
}

export interface ComplaintCaseAuthorInfo {
  profileId: string
  fullName: string
  email: string
  avatarText: string
  unitLabel: string | null
}

export interface ComplaintCaseBaseDetail {
  id: string
  caseCode: string
  buildingId: string
  buildingName: string
  title: string
  description: string
  status: ComplaintCaseStatus
  createdAt: string
  updatedAt: string
  resolvedAt: string | null
  closedAt: string | null
  otherReasonText: string | null
  reasons: ComplaintCaseReasonSelection[]
  messages: ComplaintCaseMessageView[]
  events: ComplaintCaseEvent[]
  mentionableUsers: ComplaintCaseMentionableUser[]
  canReply: boolean
  canChangeStatus: boolean
  defaultSection?: ComplaintCaseSection
}

export interface ComplaintCaseDetailNeighborView extends ComplaintCaseBaseDetail {}

export interface ComplaintCaseDetailConsorcioView extends ComplaintCaseBaseDetail {
  author: ComplaintCaseAuthorInfo
}

export interface ComplaintCaseSummaryByBuilding {
  buildingId: string
  buildingName: string
  total: number
  nuevo: number
  enRevision: number
  enDesarrollo: number
  enEspera: number
  resuelto: number
  cerrado: number
}

export interface ComplaintCaseSummaryByReason {
  reasonId: string
  reasonLabel: string
  count: number
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
  complaintMentionableUsers: ComplaintCaseMentionableUser[]
  complaintCases: ComplaintCaseListItem[]
  complaintCaseDetails: ComplaintCaseDetailConsorcioView[]
  complaintSummary: ComplaintCaseSummaryByBuilding
  reasonSummary: ComplaintCaseSummaryByReason[]
}

export interface ConsorcioDashboardData {
  managedBuildings: ConsorcioManagedBuilding[]
  assignments: BuildingAdminAssignment[]
  primaryBuildingId: string | null
  totalBuildings: number
  totalUnits: number
  totalNeighbors: number
  averageOccupancyRate: number
  totalComplaintCases: number
  complaintSummaries: ComplaintCaseSummaryByBuilding[]
  complaintReasonSummaries: ComplaintCaseSummaryByReason[]
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
  businesses: Business[]
  promotions: Promotion[]
  marketplaceItems: MarketplaceItem[]
  savedPromotionIds: string[]
  usedPromotionIds: string[]
  complaintReasons: ComplaintReason[]
  complaintMentionableUsers: ComplaintCaseMentionableUser[]
  complaintCases: ComplaintCaseListItem[]
  complaintCaseDetails: ComplaintCaseDetailNeighborView[]
}

export type ComplaintStatus = 'sin_completar' | 'en_desarrollo' | 'resuelto'

export interface NeighborComplaintView {
  id: string
  buildingId: string
  title: string
  description: string
  status: ComplaintStatus
  isAnonymous: boolean
  createdAt: string
  updatedAt: string
  resolvedAt: string | null
  authorLabel: string
  authorUnit: string | null
}
