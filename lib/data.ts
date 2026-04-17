import { CATEGORIES } from '@/lib/constants'
import type {
  Building,
  BuildingAdminAssignment,
  Business,
  BusinessDashboardData,
  ComplaintCaseDetailConsorcioView,
  ComplaintCaseDetailNeighborView,
  ComplaintCaseEvent,
  ComplaintCaseListItem,
  ComplaintCaseMentionableUser,
  ComplaintCaseMessageView,
  ComplaintCaseMessageMention,
  ComplaintCaseSummaryByBuilding,
  ComplaintCaseSummaryByReason,
  ComplaintReason,
  ComplaintCaseReasonSelection,
  ConsorcioAdminInfo,
  ConsorcioDashboardData,
  ConsorcioManagedBuilding,
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

function mapComplaintReason(row: any): ComplaintReason {
  return {
    id: row.id,
    slug: row.slug,
    label: row.label,
    description: row.description ?? null,
    isOther: Boolean(row.is_other),
    createdAt: row.created_at,
  }
}

function normalizeReasonRows(rows: any[] | null | undefined): ComplaintCaseReasonSelection[] {
  return (rows ?? [])
    .map((row: any) => (row?.complaint_reason_catalog ? row.complaint_reason_catalog : row))
    .filter(Boolean)
    .map((row: any) => ({
      id: row.id,
      slug: row.slug,
      label: row.label,
      isOther: Boolean(row.is_other),
    }))
}

function profileUnitLabel(row: any): string | null {
  return [row?.floor, row?.unit].filter(Boolean).join(' - ') || null
}

function buildMentionLabel(row: any): string {
  const fullName = row?.full_name ?? 'Usuario'
  if (row?.role === 'consorcio_admin') {
    return `Consorcio · ${fullName}`
  }
  const unitLabel = profileUnitLabel(row)
  return unitLabel ? `${fullName} (${unitLabel})` : fullName
}

function mapMentionableUser(row: any, buildingId: string): ComplaintCaseMentionableUser {
  return {
    profileId: row.id,
    fullName: row.full_name ?? 'Usuario',
    role: row.role,
    unitLabel: profileUnitLabel(row),
    buildingId,
    label: buildMentionLabel(row),
  }
}

function mapComplaintMessageMention(row: any): ComplaintCaseMessageMention {
  const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles
  return {
    id: row.id,
    messageId: row.message_id,
    mentionedProfileId: row.mentioned_profile_id,
    label: row.label ?? buildMentionLabel(profile),
  }
}

function mapComplaintMessage(row: any): ComplaintCaseMessageView {
  return {
    id: row.id,
    caseId: row.case_id,
    message: row.message,
    messageType: row.message_type,
    authorLabel: row.author_label ?? 'Sistema',
    authorRole: row.author_role ?? 'sistema',
    mentions: (row.complaint_case_message_mentions ?? row.mentions ?? []).map(mapComplaintMessageMention),
    createdAt: row.created_at,
  }
}

function mapComplaintEvent(row: any): ComplaintCaseEvent {
  return {
    id: row.id,
    caseId: row.case_id,
    eventType: row.event_type,
    actorLabel: row.actor_label ?? 'Sistema',
    actorRole: row.actor_role ?? 'sistema',
    summary: row.summary,
    metadata: row.metadata ?? null,
    createdAt: row.created_at,
  }
}

function buildComplaintCaseListItem(detail: ComplaintCaseDetailNeighborView | ComplaintCaseDetailConsorcioView): ComplaintCaseListItem {
  const lastEvent = [...detail.events].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]
  return {
    id: detail.id,
    caseCode: detail.caseCode,
    buildingId: detail.buildingId,
    buildingName: detail.buildingName,
    title: detail.title,
    status: detail.status,
    createdAt: detail.createdAt,
    updatedAt: detail.updatedAt,
    lastEventAt: lastEvent?.createdAt ?? detail.updatedAt,
    lastEventSummary: lastEvent?.summary ?? null,
    reasons: detail.reasons,
    otherReasonText: detail.otherReasonText,
    messageCount: detail.messages.length,
    eventCount: detail.events.length,
    canReply: detail.canReply,
    canChangeStatus: detail.canChangeStatus,
  }
}

function buildComplaintSummaryByBuilding(buildingId: string, buildingName: string, details: ComplaintCaseDetailConsorcioView[]): ComplaintCaseSummaryByBuilding {
  return {
    buildingId,
    buildingName,
    total: details.length,
    nuevo: details.filter((item) => item.status === 'nuevo').length,
    enRevision: details.filter((item) => item.status === 'en_revision').length,
    enDesarrollo: details.filter((item) => item.status === 'en_desarrollo').length,
    enEspera: details.filter((item) => item.status === 'en_espera').length,
    resuelto: details.filter((item) => item.status === 'resuelto').length,
    cerrado: details.filter((item) => item.status === 'cerrado').length,
  }
}

function buildComplaintReasonSummary(details: Array<ComplaintCaseDetailNeighborView | ComplaintCaseDetailConsorcioView>): ComplaintCaseSummaryByReason[] {
  const counts = new Map<string, ComplaintCaseSummaryByReason>()
  for (const detail of details) {
    for (const reason of detail.reasons) {
      const current = counts.get(reason.id) ?? { reasonId: reason.id, reasonLabel: reason.label, count: 0 }
      current.count += 1
      counts.set(reason.id, current)
    }
  }

  return Array.from(counts.values()).sort((a, b) => b.count - a.count || a.reasonLabel.localeCompare(b.reasonLabel))
}

function mapNeighborComplaintCaseDetail(row: any, mentionableUsers: ComplaintCaseMentionableUser[]): ComplaintCaseDetailNeighborView {
  return {
    id: row.id,
    caseCode: row.case_code,
    buildingId: row.building_id,
    buildingName: row.building_name ?? 'Edificio',
    title: row.title,
    description: row.description,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    resolvedAt: row.resolved_at ?? null,
    closedAt: row.closed_at ?? null,
    otherReasonText: row.other_reason_text ?? null,
    reasons: normalizeReasonRows(row.reasons),
    messages: (row.messages ?? []).map(mapComplaintMessage),
    events: (row.events ?? []).map(mapComplaintEvent),
    mentionableUsers,
    canReply: Boolean(row.can_reply),
    canChangeStatus: Boolean(row.can_change_status),
    defaultSection: 'summary',
  }
}

function mapConsorcioComplaintCaseDetail(row: any, mentionableUsers: ComplaintCaseMentionableUser[]): ComplaintCaseDetailConsorcioView {
  const building = Array.isArray(row.buildings) ? row.buildings[0] : row.buildings
  const author = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles
  const messages = (row.complaint_case_messages ?? []).map((message: any) => {
    const messageAuthor = Array.isArray(message.profiles) ? message.profiles[0] : message.profiles
    const role = messageAuthor?.role === 'consorcio_admin' ? 'consorcio' : messageAuthor?.role === 'super_admin' ? 'super_admin' : 'vecino'
    return mapComplaintMessage({
      ...message,
      author_label: role === 'vecino' ? messageAuthor?.full_name ?? 'Vecino' : role === 'consorcio' ? 'Consorcio' : 'Super admin',
      author_role: role,
    })
  })

  return {
    id: row.id,
    caseCode: row.case_code,
    buildingId: row.building_id,
    buildingName: building?.name ?? 'Edificio',
    title: row.title,
    description: row.description,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    resolvedAt: row.resolved_at ?? null,
    closedAt: row.closed_at ?? null,
    otherReasonText: row.other_reason_text ?? null,
    reasons: normalizeReasonRows(row.complaint_case_reasons),
    messages,
    events: (row.complaint_case_events ?? []).map(mapComplaintEvent),
    mentionableUsers,
    canReply: row.status !== 'cerrado',
    canChangeStatus: true,
    defaultSection: 'summary',
    author: {
      profileId: author?.id ?? row.author_profile_id,
      fullName: author?.full_name ?? 'Vecino',
      email: author?.email ?? '',
      avatarText: author?.avatar_text ?? 'VN',
      unitLabel: profileUnitLabel(author),
    },
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
      totalComplaintCases: 0,
      complaintSummaries: [],
      complaintReasonSummaries: [],
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
      totalComplaintCases: 0,
      complaintSummaries: [],
      complaintReasonSummaries: [],
    }
  }

  const [{ data: buildingsData }, { data: neighborsData }, { data: adminAssignmentsData }, { data: complaintCaseRows }] = await Promise.all([
    supabase.from('buildings').select('*').in('id', buildingIds).order('name'),
    supabase.from('profiles').select('*').eq('role', 'vecino').in('building_id', buildingIds).order('full_name'),
    supabase
      .from('building_admin_assignments')
      .select(`building_id, profiles!building_admin_assignments_profile_id_fkey ( id, full_name, role, floor, unit )`)
      .in('building_id', buildingIds),
    supabase
      .from('complaint_cases')
      .select(`
        *,
        buildings ( id, name ),
        profiles!complaint_cases_author_profile_id_fkey ( id, full_name, email, avatar_text, floor, unit ),
        complaint_case_reasons ( complaint_reason_catalog ( id, slug, label, is_other ) ),
        complaint_case_messages (
          id,
          case_id,
          message,
          message_type,
          created_at,
          profiles!complaint_case_messages_author_profile_id_fkey ( id, full_name, avatar_text, role, floor, unit ),
          complaint_case_message_mentions (
            id,
            message_id,
            mentioned_profile_id,
            profiles!complaint_case_message_mentions_mentioned_profile_id_fkey ( id, full_name, role, floor, unit )
          )
        ),
        complaint_case_events ( id, case_id, event_type, actor_label, actor_role, summary, metadata, created_at )
      `)
      .in('building_id', buildingIds)
      .order('created_at', { ascending: false }),
  ])

  const neighborsByBuilding = new Map<string, Profile[]>()
  for (const row of neighborsData ?? []) {
    const mapped = mapProfile(row)
    if (!mapped.buildingId) continue
    const current = neighborsByBuilding.get(mapped.buildingId) ?? []
    current.push(mapped)
    neighborsByBuilding.set(mapped.buildingId, current)
  }

  const adminProfilesByBuilding = new Map<string, ComplaintCaseMentionableUser[]>()
  for (const row of adminAssignmentsData ?? []) {
    const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles
    if (!profile?.id || !row.building_id) continue
    const current = adminProfilesByBuilding.get(row.building_id) ?? []
    if (!current.some((item) => item.profileId === profile.id)) {
      current.push(mapMentionableUser(profile, row.building_id))
    }
    adminProfilesByBuilding.set(row.building_id, current)
  }

  const caseDetailsByBuilding = new Map<string, ComplaintCaseDetailConsorcioView[]>()
  for (const row of complaintCaseRows ?? []) {
    const buildingId = row.building_id
    const mentionableUsers = [
      ...(neighborsByBuilding.get(buildingId) ?? []).map((neighbor) =>
        mapMentionableUser(
          {
            id: neighbor.id,
            full_name: neighbor.fullName,
            role: neighbor.role,
            floor: neighbor.floor,
            unit: neighbor.unit,
          },
          buildingId,
        ),
      ),
      ...(adminProfilesByBuilding.get(buildingId) ?? []),
    ].sort((a, b) => a.label.localeCompare(b.label))
    const detail = mapConsorcioComplaintCaseDetail(row, mentionableUsers)
    const current = caseDetailsByBuilding.get(detail.buildingId) ?? []
    current.push(detail)
    caseDetailsByBuilding.set(detail.buildingId, current)
  }

  const buildingsById = new Map((buildingsData ?? []).map((row: any) => [row.id, mapBuilding(row)]))
  const managedBuildings: ConsorcioManagedBuilding[] = assignments
    .map((assignment) => {
      const building = buildingsById.get(assignment.buildingId)
      if (!building) {
        return null
      }
      const neighbors = neighborsByBuilding.get(building.id) ?? []
      const complaintCaseDetails = (caseDetailsByBuilding.get(building.id) ?? []).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      const complaintCases = complaintCaseDetails.map(buildComplaintCaseListItem)
      const complaintMentionableUsers = [
        ...neighbors.map((neighbor) =>
          mapMentionableUser(
            { id: neighbor.id, full_name: neighbor.fullName, role: neighbor.role, floor: neighbor.floor, unit: neighbor.unit },
            building.id,
          ),
        ),
        ...(adminProfilesByBuilding.get(building.id) ?? []),
      ]
        .filter((user, index, array) => array.findIndex((item) => item.profileId === user.profileId) === index)
        .sort((a, b) => a.label.localeCompare(b.label))
      return {
        building,
        neighbors,
        registeredNeighbors: neighbors.length,
        occupancyRate: Math.round((neighbors.length / Math.max(building.totalUnits, 1)) * 100),
        complaintMentionableUsers,
        complaintCases,
        complaintCaseDetails,
        complaintSummary: buildComplaintSummaryByBuilding(building.id, building.name, complaintCaseDetails),
        reasonSummary: buildComplaintReasonSummary(complaintCaseDetails),
      }
    })
    .filter((item): item is ConsorcioManagedBuilding => Boolean(item))

  const totalUnits = managedBuildings.reduce((sum, item) => sum + item.building.totalUnits, 0)
  const totalNeighbors = managedBuildings.reduce((sum, item) => sum + item.registeredNeighbors, 0)
  const averageOccupancyRate = managedBuildings.length
    ? Math.round(managedBuildings.reduce((sum, item) => sum + item.occupancyRate, 0) / managedBuildings.length)
    : 0
  const complaintSummaries = managedBuildings.map((item) => item.complaintSummary)
  const complaintReasonSummaries = buildComplaintReasonSummary(managedBuildings.flatMap((item) => item.complaintCaseDetails))

  return {
    managedBuildings,
    assignments,
    primaryBuildingId: assignments.find((assignment) => assignment.isPrimary)?.buildingId ?? managedBuildings[0]?.building.id ?? null,
    totalBuildings: managedBuildings.length,
    totalUnits,
    totalNeighbors,
    averageOccupancyRate,
    totalComplaintCases: managedBuildings.reduce((sum, item) => sum + item.complaintCases.length, 0),
    complaintSummaries,
    complaintReasonSummaries,
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
    supabase
      .from('building_admin_assignments')
      .select(`*, profiles ( id, full_name, email, phone )`),
    supabase
      .from('promotion_redemptions')
      .select(`promotion_id, profiles ( building_id, buildings ( id, name ) )`),
  ])

  const allBuildings = (buildingsRes.data ?? []).map(mapBuilding)
  const allUsers = (usersRes.data ?? []).map(mapProfile)
  const allPromotionsRaw = (promotionsRes.data ?? []).map((row: any) => mapPromotion(supabase, row))

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

  const neighborsByBuilding = new Map<string, Profile[]>()
  for (const user of allUsers) {
    if (user.role !== 'vecino' || !user.buildingId) continue
    const existing = neighborsByBuilding.get(user.buildingId) ?? []
    existing.push(user)
    neighborsByBuilding.set(user.buildingId, existing)
  }

  const redemptionMap = new Map<string, Map<string, { name: string; count: number }>>()
  for (const row of redemptionsRes.data ?? []) {
    const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles
    const building = profile?.buildings ? (Array.isArray(profile.buildings) ? profile.buildings[0] : profile.buildings) : null
    if (!building?.id) continue
    if (!redemptionMap.has(row.promotion_id)) redemptionMap.set(row.promotion_id, new Map())
    const byBuilding = redemptionMap.get(row.promotion_id)!
    const current = byBuilding.get(building.id) ?? { name: building.name, count: 0 }
    current.count += 1
    byBuilding.set(building.id, current)
  }

  const allPromotions: SuperAdminPromotionDetail[] = allPromotionsRaw.map((promotion) => {
    const byBuilding = redemptionMap.get(promotion.id)
    const redemptionsByBuilding: PromotionRedemptionByBuilding[] = byBuilding
      ? Array.from(byBuilding.entries())
          .map(([buildingId, { name, count }]) => ({ buildingId, buildingName: name, count }))
          .sort((a, b) => b.count - a.count)
      : []
    return { ...promotion, redemptionsByBuilding }
  })

  const buildings: SuperAdminBuildingDetail[] = allBuildings.map((building) => {
    const neighbors = neighborsByBuilding.get(building.id) ?? []
    const admins = adminsByBuilding.get(building.id) ?? []
    const occupancyRate = Math.round((neighbors.length / Math.max(building.totalUnits, 1)) * 100)
    return { ...building, admins, neighbors, registeredNeighbors: neighbors.length, occupancyRate }
  })

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
    return {
      building: null,
      promotions: [],
      marketplaceItems: [],
      savedPromotionIds: [],
      usedPromotionIds: [],
      complaintReasons: [],
      complaintMentionableUsers: [],
      complaintCases: [],
      complaintCaseDetails: [],
    }
  }

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', profileId).single()
  const buildingId = profile?.building_id

  const [{ data: buildingData }, { data: promotionsData }, { data: marketplaceData }, { data: savedRows }, { data: usedRows }, { data: reasonRows }, { data: complaintRows }, { data: neighborRows }, { data: buildingAdminRows }] =
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
      supabase.from('complaint_reason_catalog').select('*').order('label'),
      buildingId ? supabase.rpc('get_neighbor_complaint_cases', { target_building_id: buildingId }) : Promise.resolve({ data: [] }),
      buildingId ? supabase.from('profiles').select('id, full_name, role, floor, unit').eq('role', 'vecino').eq('building_id', buildingId).order('full_name') : Promise.resolve({ data: [] }),
      buildingId
        ? supabase
            .from('building_admin_assignments')
            .select(`building_id, profiles!building_admin_assignments_profile_id_fkey ( id, full_name, role, floor, unit )`)
            .eq('building_id', buildingId)
        : Promise.resolve({ data: [] }),
    ])

  const mentionableUsers = [
    ...((neighborRows ?? []) as any[]).map((row: any) => mapMentionableUser(row, buildingId ?? '')),
    ...((buildingAdminRows ?? []) as any[])
      .map((row: any) => {
        const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles
        return profile ? mapMentionableUser(profile, row.building_id) : null
      })
      .filter(Boolean),
  ]
    .filter((user, index, array) => array.findIndex((item) => item.profileId === user.profileId) === index)
    .sort((a, b) => a.label.localeCompare(b.label))

  const complaintCaseDetails = (complaintRows ?? []).map((row: any) => mapNeighborComplaintCaseDetail(row, mentionableUsers))
  const complaintCases = complaintCaseDetails.map(buildComplaintCaseListItem).sort((a, b) => b.lastEventAt.localeCompare(a.lastEventAt))
  const promotions = (promotionsData ?? [])
    .map((row: any) => mapPromotion(supabase, row))
    .filter((promotion) => !promotion.buildingId || promotion.buildingId === buildingId)

  return {
    building: buildingData ? mapBuilding(buildingData) : null,
    promotions,
    marketplaceItems: (marketplaceData ?? []).map((row: any) => mapMarketplaceItem(supabase, row)),
    savedPromotionIds: (savedRows ?? []).map((row: any) => row.promotion_id),
    usedPromotionIds: (usedRows ?? []).map((row: any) => row.promotion_id),
    complaintReasons: (reasonRows ?? []).map((row: any) => mapComplaintReason(row)),
    complaintMentionableUsers: mentionableUsers,
    complaintCases,
    complaintCaseDetails,
  }
}

export function getCategoryOptions(promotions: Promotion[]) {
  const categories = new Set<string>(CATEGORIES)
  promotions.forEach((promotion) => categories.add(promotion.category))
  return ['Todas', ...Array.from(categories).filter((category) => category !== 'Todas')]
}
