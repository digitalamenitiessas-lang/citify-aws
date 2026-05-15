import { pgQuery } from '@/lib/db/postgres'

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

export async function setBusinessOwnerInPostgres(
  businessId: string,
  ownerProfileId: string,
): Promise<void> {
  await pgQuery(
    `update public.businesses set owner_profile_id = $1 where id = $2`,
    [ownerProfileId, businessId],
  )
}
