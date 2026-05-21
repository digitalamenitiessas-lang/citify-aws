import type { Profile, UserRole } from '@/lib/types'
import { pgQuery } from '@/lib/db/postgres'

function mapProfileRow(row: any): Profile {
  return {
    id: row.id,
    email: row.email ?? '',
    fullName: row.full_name ?? 'Usuario',
    role: row.role as UserRole,
    avatarText: row.avatar_text ?? (row.full_name?.slice(0, 2)?.toUpperCase() || 'U'),
    businessId: row.business_id ?? null,
    buildingId: row.building_id ?? null,
    floor: row.floor ?? null,
    unit: row.unit ?? null,
    phone: row.phone ?? null,
    passwordMustChange: row.password_must_change ?? false,
    createdAt: row.created_at,
  }
}

export async function findProfileByEmail(email: string) {
  const result = await pgQuery(
    `
      select *
      from public.profiles
      where lower(email) = lower($1)
      limit 1
    `,
    [email],
  )

  if (!result.rows[0]) {
    return null
  }

  return mapProfileRow(result.rows[0])
}

export async function upsertProfile(input: {
  id: string
  email: string
  fullName: string
  avatarText: string
  role: UserRole
  phone: string | null
  buildingId: string | null
  businessId: string | null
  // Si se pasa, se setea SOLO en el INSERT (no se pisa al hacer upsert sobre
  // un row existente). Para forzar el cambio en un user que ya existia,
  // hay que llamar a markPasswordMustChange().
  passwordMustChangeOnCreate?: boolean
}): Promise<Profile> {
  const result = await pgQuery(
    `
      insert into public.profiles (id, email, full_name, avatar_text, role, phone, building_id, business_id, password_must_change)
      values ($1, lower($2), $3, $4, $5, $6, $7, $8, coalesce($9, false))
      on conflict (id) do update set
        email = excluded.email,
        full_name = excluded.full_name,
        avatar_text = excluded.avatar_text,
        role = excluded.role,
        phone = excluded.phone,
        building_id = excluded.building_id,
        business_id = excluded.business_id
      returning *
    `,
    [
      input.id,
      input.email,
      input.fullName,
      input.avatarText,
      input.role,
      input.phone,
      input.buildingId,
      input.businessId,
      input.passwordMustChangeOnCreate ?? null,
    ],
  )

  return mapProfileRow(result.rows[0])
}

export async function clearPasswordMustChange(profileId: string): Promise<void> {
  await pgQuery(
    `update public.profiles set password_must_change = false where id = $1`,
    [profileId],
  )
}

export async function findProfileById(id: string) {
  const result = await pgQuery(
    `
      select *
      from public.profiles
      where id = $1
      limit 1
    `,
    [id],
  )

  if (!result.rows[0]) {
    return null
  }

  return mapProfileRow(result.rows[0])
}
