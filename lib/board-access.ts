import { pgQuery } from '@/lib/db/postgres'
import type { IAdminContext, Profile } from '@/lib/types'

// Quien puede ver y tocar que en la Pizarra de quejas. Solo servidor.

/** El edificio del vecino: el de su perfil o, si no tiene, el de su primera unidad. */
export async function resolveVecinoBuildingId(profile: Profile): Promise<string | null> {
  if (profile.buildingId) return profile.buildingId
  const res = await pgQuery<{ building_id: string }>(
    `select building_id
       from citify.unit_profile_memberships
      where profile_id = $1 and active
      order by is_primary desc, created_at
      limit 1`,
    [profile.id],
  )
  return res.rows[0]?.building_id ?? null
}

/**
 * Los edificios que administra la persona: los de todas las administraciones
 * a las que pertenece. Null = super admin, que puede todos.
 */
export async function adminBuildingIds(context: IAdminContext): Promise<string[] | null> {
  if (context.isSuperAdmin) return null
  const administrationIds = context.memberships.map((m) => m.administration.id)
  if (administrationIds.length === 0) return []
  const res = await pgQuery<{ building_id: string }>(
    `select distinct building_id
       from citify.iadmin_managed_properties
      where administration_id = any($1::uuid[])
        and is_active`,
    [administrationIds],
  )
  return res.rows.map((r) => r.building_id)
}

export async function adminCanManageBuilding(context: IAdminContext, buildingId: string): Promise<boolean> {
  const ids = await adminBuildingIds(context)
  return ids === null || ids.includes(buildingId)
}
