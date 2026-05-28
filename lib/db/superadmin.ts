import { pgQuery } from '@/lib/db/postgres'

export async function listAllPromotionsForSuperadminFromPostgres(): Promise<
  Array<{
    id: string
    business_id: string
    title: string
    description: string
    discount: string
    category: string | null
    expiration_date: string | null
    building_id: string | null
    image_path: string | null
    is_active: boolean
    created_at: string
    published_month: string | null
    source_promotion_id: string | null
    business_name: string | null
    business_logo_path: string | null
    redemption_count: number
  }>
> {
  const result = await pgQuery<{
    id: string
    business_id: string
    title: string
    description: string
    discount: string
    category: string | null
    expiration_date: string | null
    building_id: string | null
    image_path: string | null
    is_active: boolean
    created_at: string
    published_month: string | null
    source_promotion_id: string | null
    business_name: string | null
    business_logo_path: string | null
    redemption_count: number
  }>(
    `
      select
        p.id, p.business_id, p.title, p.description, p.discount, p.category,
        p.expiration_date::text as expiration_date, p.building_id,
        p.image_path, p.is_active, p.created_at::text as created_at,
        p.published_month::text as published_month,
        p.source_promotion_id,
        b.name as business_name,
        b.logo_path as business_logo_path,
        coalesce((select count(*)::int from public.promotion_redemptions r where r.promotion_id = p.id), 0) as redemption_count
      from public.promotions p
      left join public.businesses b on b.id = p.business_id
      order by p.created_at desc
    `,
  )
  return result.rows
}

export async function listAllRedemptionsByBuildingFromPostgres(): Promise<
  Array<{
    promotion_id: string
    building_id: string | null
    building_name: string | null
  }>
> {
  const result = await pgQuery<{
    promotion_id: string
    building_id: string | null
    building_name: string | null
  }>(
    `
      select r.promotion_id, p.building_id, b.name as building_name
      from public.promotion_redemptions r
      left join public.profiles p on p.id = r.profile_id
      left join public.buildings b on b.id = p.building_id
    `,
  )
  return result.rows
}

export async function countVecinoProfilesFromPostgres(): Promise<number> {
  const result = await pgQuery<{ c: number }>(
    `select count(*)::int as c from public.profiles where role = 'vecino'`,
  )
  return result.rows[0]?.c ?? 0
}

export async function listRedemptionsForBusinessFromPostgres(businessId: string): Promise<
  Array<{
    id: string
    profile_id: string
    promotion_id: string
    status: string
    redeemed_at: string | null
    created_at: string | null
    profile_full_name: string | null
    profile_floor: string | null
    profile_unit: string | null
    profile_building_id: string | null
    profile_building_name: string | null
    promotion_title: string | null
    promotion_discount: string | null
  }>
> {
  const result = await pgQuery<{
    id: string
    profile_id: string
    promotion_id: string
    status: string
    redeemed_at: string | null
    created_at: string | null
    profile_full_name: string | null
    profile_floor: string | null
    profile_unit: string | null
    profile_building_id: string | null
    profile_building_name: string | null
    promotion_title: string | null
    promotion_discount: string | null
  }>(
    `
      select
        r.id, r.profile_id, r.promotion_id, r.status::text as status,
        r.redeemed_at::text as redeemed_at, r.created_at::text as created_at,
        p.full_name as profile_full_name, p.floor as profile_floor, p.unit as profile_unit,
        b.id as profile_building_id, b.name as profile_building_name,
        pr.title as promotion_title, pr.discount as promotion_discount
      from public.promotion_redemptions r
      inner join public.promotions pr on pr.id = r.promotion_id
      left join public.profiles p on p.id = r.profile_id
      left join public.buildings b on b.id = p.building_id
      where pr.business_id = $1
      order by r.redeemed_at desc nulls last, r.created_at desc nulls last
    `,
    [businessId],
  )
  return result.rows
}

export async function listAllProfilesFromPostgres(): Promise<any[]> {
  const result = await pgQuery(`select * from public.profiles order by full_name asc nulls last`)
  return result.rows
}

export async function listAllBuildingsFromPostgres(): Promise<any[]> {
  const result = await pgQuery(`select * from public.buildings order by name asc`)
  return result.rows
}

export async function listAllBusinessesFromPostgres(): Promise<any[]> {
  const result = await pgQuery(`select * from public.businesses order by name asc`)
  return result.rows
}

export async function listBuildingAdminAssignmentsFromPostgres(): Promise<any[]> {
  const result = await pgQuery(
    `
      select
        baa.id,
        baa.profile_id,
        baa.building_id,
        baa.is_primary,
        baa.created_at,
        json_build_object(
          'id', p.id,
          'full_name', p.full_name,
          'email', p.email,
          'phone', p.phone
        ) as profiles
      from public.building_admin_assignments baa
      inner join public.profiles p on p.id = baa.profile_id
    `,
  )
  return result.rows
}

export async function listSuperadminManagedPropertiesFromPostgres(): Promise<any[]> {
  const result = await pgQuery(
    `
      select
        mp.*,
        json_build_object(
          'id', b.id,
          'name', b.name,
          'address', b.address,
          'total_units', b.total_units
        ) as buildings,
        case when a.id is not null then json_build_object(
          'id', a.id,
          'name', a.name,
          'legal_name', a.legal_name,
          'tax_id', a.tax_id,
          'contact_email', a.contact_email,
          'contact_phone', a.contact_phone,
          'is_active', a.is_active,
          'legal_info', a.legal_info,
          'created_at', a.created_at
        ) else null end as iadmin_administrations
      from public.iadmin_managed_properties mp
      inner join public.buildings b on b.id = mp.building_id
      left join public.iadmin_administrations a on a.id = mp.administration_id
      order by mp.created_at desc
    `,
  )
  return result.rows
}

export async function listAdminLoadStatsByBuildingFromPostgres(): Promise<
  Array<{
    building_id: string
    units_count: number
    building_info_count: number
    expenses_count: number
    last_activity_at: string | null
  }>
> {
  const result = await pgQuery<{
    building_id: string
    units_count: string | number
    building_info_count: string | number
    expenses_count: string | number
    last_activity_at: string | null
  }>(
    `
      with mp as (
        select id, building_id, administration_id, updated_at
          from public.iadmin_managed_properties
      ),
      unit_stats as (
        select mp.building_id,
               count(u.id)::int as units_count,
               max(u.updated_at) as last_unit_at
          from mp
          left join public.iadmin_units u on u.managed_property_id = mp.id
         group by mp.building_id
      ),
      info_stats as (
        select bi.building_id,
               count(*)::int as building_info_count,
               max(bi.updated_at) as last_info_at
          from public.building_information bi
         group by bi.building_id
      ),
      expense_stats as (
        select mp.building_id,
               count(e.id)::int as expenses_count,
               max(e.updated_at) as last_expense_at
          from mp
          left join public.iadmin_expenses e on e.administration_id = mp.administration_id
         group by mp.building_id
      )
      select mp.building_id,
             coalesce(us.units_count, 0) as units_count,
             coalesce(ist.building_info_count, 0) as building_info_count,
             coalesce(es.expenses_count, 0) as expenses_count,
             greatest(
               coalesce(us.last_unit_at, 'epoch'::timestamptz),
               coalesce(ist.last_info_at, 'epoch'::timestamptz),
               coalesce(es.last_expense_at, 'epoch'::timestamptz),
               coalesce(mp.updated_at, 'epoch'::timestamptz)
             ) as last_activity_at
        from mp
        left join unit_stats us on us.building_id = mp.building_id
        left join info_stats ist on ist.building_id = mp.building_id
        left join expense_stats es on es.building_id = mp.building_id
    `,
  )
  return result.rows.map((row: {
    building_id: string
    units_count: string | number
    building_info_count: string | number
    expenses_count: string | number
    last_activity_at: string | null
  }) => ({
    building_id: row.building_id,
    units_count: Number(row.units_count ?? 0),
    building_info_count: Number(row.building_info_count ?? 0),
    expenses_count: Number(row.expenses_count ?? 0),
    last_activity_at:
      row.last_activity_at && new Date(row.last_activity_at).getFullYear() > 1970
        ? row.last_activity_at
        : null,
  }))
}

export async function getAdministrationIdByBuildingFromPostgres(
  buildingId: string,
): Promise<string | null> {
  const result = await pgQuery<{ administration_id: string }>(
    `
      select administration_id
      from public.iadmin_managed_properties
      where building_id = $1
      limit 1
    `,
    [buildingId],
  )
  return result.rows[0]?.administration_id ?? null
}

export async function assignBuildingAdminInPostgres(
  profileId: string,
  buildingId: string,
): Promise<{ isPrimary: boolean }> {
  const existing = await pgQuery<{ c: number }>(
    `select count(*)::int as c from public.building_admin_assignments where profile_id = $1`,
    [profileId],
  )
  const isPrimary = (existing.rows[0]?.c ?? 0) === 0

  await pgQuery(
    `
      insert into public.building_admin_assignments (profile_id, building_id, is_primary)
      values ($1, $2, $3)
      on conflict (profile_id, building_id) do update set is_primary = excluded.is_primary
    `,
    [profileId, buildingId, isPrimary],
  )

  if (isPrimary) {
    await pgQuery(
      `update public.profiles set building_id = $1 where id = $2`,
      [buildingId, profileId],
    )
  }

  return { isPrimary }
}

export async function assignIAdminRoleGrantInPostgres(
  profileId: string,
  administrationId: string,
  operationalRole: string,
): Promise<void> {
  const existing = await pgQuery<{ c: number }>(
    `select count(*)::int as c from public.iadmin_role_grants where profile_id = $1`,
    [profileId],
  )
  const isPrimary = (existing.rows[0]?.c ?? 0) === 0

  await pgQuery(
    `
      insert into public.iadmin_role_grants (administration_id, profile_id, operational_role, is_primary)
      values ($1, $2, $3, $4)
      on conflict (administration_id, profile_id) do update set
        operational_role = excluded.operational_role,
        is_primary = excluded.is_primary
    `,
    [administrationId, profileId, operationalRole, isPrimary],
  )
}

export async function createBusinessInPostgres(input: {
  name: string
  category: string
  description: string
  address: string | null
}): Promise<{ id: string }> {
  const result = await pgQuery<{ id: string }>(
    `
      insert into public.businesses (name, category, description, address)
      values ($1, $2, $3, $4)
      returning id
    `,
    [input.name, input.category, input.description, input.address],
  )
  return { id: result.rows[0].id }
}

export async function callSuperadminCreateConsorcioInPostgres(input: {
  buildingName: string
  buildingAddress: string
  buildingTotalUnits: number
  buildingLatitude: number | null
  buildingLongitude: number | null
  administrationName: string
  administrationLegalName: string | null
  administrationTaxId: string | null
  administrationContactEmail: string | null
  administrationContactPhone: string | null
  propertyDisplayName: string | null
  propertyKind: string
  propertyTaxId: string | null
  propertyManagedSince: string | null
  propertyManagementFeePct: number | null
  propertyNotes: string | null
  adminProfileId: string
  creatorProfileId: string
}): Promise<{ building_id: string; administration_id: string; managed_property_id: string }> {
  const result = await pgQuery<{ result: { building_id: string; administration_id: string; managed_property_id: string } }>(
    `
      select public.superadmin_create_consorcio(
        building_name := $1,
        building_address := $2,
        building_total_units := $3,
        building_latitude := $4,
        building_longitude := $5,
        administration_name := $6,
        administration_legal_name := $7,
        administration_tax_id := $8,
        administration_contact_email := $9,
        administration_contact_phone := $10,
        property_display_name := $11,
        property_kind := $12::public.iadmin_property_kind,
        property_tax_id := $13,
        property_managed_since := $14::date,
        property_management_fee_pct := $15,
        property_notes := $16,
        admin_profile_id := $17,
        creator_profile_id := $18
      ) as result
    `,
    [
      input.buildingName,
      input.buildingAddress,
      input.buildingTotalUnits,
      input.buildingLatitude,
      input.buildingLongitude,
      input.administrationName,
      input.administrationLegalName,
      input.administrationTaxId,
      input.administrationContactEmail,
      input.administrationContactPhone,
      input.propertyDisplayName,
      input.propertyKind,
      input.propertyTaxId,
      input.propertyManagedSince,
      input.propertyManagementFeePct,
      input.propertyNotes,
      input.adminProfileId,
      input.creatorProfileId,
    ],
  )

  return result.rows[0].result
}

export async function getBuildingByIdFromPostgres(
  buildingId: string,
): Promise<{ id: string; name: string } | null> {
  const result = await pgQuery<{ id: string; name: string }>(
    `select id, name from public.buildings where id = $1 limit 1`,
    [buildingId],
  )
  return result.rows[0] ?? null
}

export async function updateBuildingInPostgres(input: {
  buildingId: string
  name: string
  address: string
  totalUnits: number
  latitude: number | null
  longitude: number | null
}): Promise<void> {
  const result = await pgQuery(
    `
      update public.buildings
      set name = $1, address = $2, total_units = $3, latitude = $4, longitude = $5
      where id = $6
    `,
    [
      input.name,
      input.address,
      input.totalUnits,
      input.latitude,
      input.longitude,
      input.buildingId,
    ],
  )
  if (result.rowCount === 0) {
    throw new Error('No se encontró el edificio que querés actualizar.')
  }
}

export async function getManagedPropertyIdByBuildingFromPostgres(
  buildingId: string,
): Promise<string | null> {
  const result = await pgQuery<{ id: string }>(
    `select id from public.iadmin_managed_properties where building_id = $1 limit 1`,
    [buildingId],
  )
  return result.rows[0]?.id ?? null
}

export async function listUnitsForOccupancyFromPostgres(
  propertyId: string,
): Promise<Array<{ id: string; code: string; floor: string | null; kind: string }>> {
  const result = await pgQuery<{ id: string; code: string; floor: string | null; kind: string }>(
    `select id, code, floor, kind::text as kind from public.iadmin_units where managed_property_id = $1`,
    [propertyId],
  )
  return result.rows
}

export async function findUnitByPropertyAndCodeIlikeFromPostgres(input: {
  managedPropertyId: string
  code: string
}): Promise<{ id: string } | null> {
  const result = await pgQuery<{ id: string }>(
    `select id from public.iadmin_units where managed_property_id = $1 and code ilike $2 limit 1`,
    [input.managedPropertyId, input.code],
  )
  return result.rows[0] ?? null
}

export async function setBusinessOwnerInPostgres(
  businessId: string,
  ownerProfileId: string,
): Promise<void> {
  await pgQuery(
    `update public.businesses set owner_profile_id = $1 where id = $2`,
    [ownerProfileId, businessId],
  )
}
