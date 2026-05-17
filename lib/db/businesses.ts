import { pgQuery } from '@/lib/db/postgres'

export interface BusinessRow {
  id: string
  name: string
  category: string
  description: string
  owner_profile_id: string | null
  logo_path: string | null
  address: string | null
  latitude: number | null
  longitude: number | null
  created_at: string
  updated_at: string
}

const SELECT_COLS = `
  id,
  name,
  category,
  description,
  owner_profile_id,
  logo_path,
  address,
  latitude::float8 as latitude,
  longitude::float8 as longitude,
  created_at::text as created_at,
  updated_at::text as updated_at
`

export async function getBusinessByIdFromPostgres(id: string): Promise<BusinessRow | null> {
  const result = await pgQuery<BusinessRow>(
    `select ${SELECT_COLS} from public.businesses where id = $1 limit 1`,
    [id],
  )

  return result.rows[0] ?? null
}

export async function getAllBusinessesFromPostgres(): Promise<BusinessRow[]> {
  const result = await pgQuery<BusinessRow>(
    `select ${SELECT_COLS} from public.businesses order by name asc`,
  )

  return result.rows
}
