import { pgQuery } from '@/lib/db/postgres'

// Lista de vecinos de un edificio para la seccion Vecinos del administrador.

export interface BuildingNeighbor {
  id: string
  fullName: string
  email: string
  phone: string | null
  unitCode: string | null
  relationship: 'propietario' | 'vecino_principal' | 'vecino_adicional' | null
  /** Todavia tiene la contraseña temporal: nunca entro. */
  pendingFirstLogin: boolean
}

export async function listBuildingNeighbors(buildingId: string): Promise<BuildingNeighbor[]> {
  const res = await pgQuery<{
    id: string
    full_name: string | null
    email: string
    phone: string | null
    unit_code: string | null
    relationship_type: BuildingNeighbor['relationship']
    password_must_change: boolean | null
  }>(
    `select p.id, p.full_name, p.email, p.phone, u.code as unit_code, m.relationship_type,
            p.password_must_change
       from citify.profiles p
       left join lateral (
         select um.relationship_type, um.unit_id
           from citify.unit_profile_memberships um
          where um.profile_id = p.id and um.building_id = $1 and um.active
          order by um.is_primary desc, um.created_at
          limit 1
       ) m on true
       left join citify.iadmin_units u on u.id = m.unit_id
      where p.role = 'vecino'
        and (p.building_id = $1 or m.unit_id is not null)
      order by u.code nulls last, p.full_name`,
    [buildingId],
  )
  return res.rows.map((r) => ({
    id: r.id,
    fullName: r.full_name?.trim() || r.email,
    email: r.email,
    phone: r.phone,
    unitCode: r.unit_code,
    relationship: r.relationship_type,
    pendingFirstLogin: Boolean(r.password_must_change),
  }))
}

/** Vecinos registrados en un conjunto de edificios (para el inicio). */
export async function countBuildingNeighbors(buildingIds: string[]): Promise<number> {
  if (buildingIds.length === 0) return 0
  const res = await pgQuery<{ n: number }>(
    `select count(distinct p.id)::int as n
       from citify.profiles p
      where p.role = 'vecino'
        and (p.building_id = any($1::uuid[])
             or exists (select 1 from citify.unit_profile_memberships um
                         where um.profile_id = p.id and um.active and um.building_id = any($1::uuid[])))`,
    [buildingIds],
  )
  return res.rows[0]?.n ?? 0
}
