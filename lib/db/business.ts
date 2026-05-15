import { pgQuery } from '@/lib/db/postgres'

export async function updateBusinessFieldsInPostgres(
  businessId: string,
  patch: Partial<{
    logo_path: string | null
    address: string
    latitude: number
    longitude: number
  }>,
): Promise<void> {
  const cols: string[] = []
  const values: unknown[] = []
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue
    values.push(value)
    cols.push(`${key} = $${values.length}`)
  }
  if (cols.length === 0) return
  values.push(businessId)
  await pgQuery(
    `update public.businesses set ${cols.join(', ')} where id = $${values.length}`,
    values,
  )
}

export async function upsertPromotionInPostgres(input: {
  id: string
  businessId: string
  title: string
  description: string
  discount: string
  category: string
  expirationDate: string
  buildingId: string | null
  imagePath: string | null
  mode: 'create' | 'update'
}): Promise<void> {
  if (input.mode === 'update') {
    await pgQuery(
      `
        update public.promotions
        set title = $1,
            description = $2,
            discount = $3,
            category = $4,
            expiration_date = $5::date,
            building_id = $6,
            image_path = $7,
            is_active = true
        where id = $8 and business_id = $9
      `,
      [
        input.title,
        input.description,
        input.discount,
        input.category,
        input.expirationDate,
        input.buildingId,
        input.imagePath,
        input.id,
        input.businessId,
      ],
    )
    return
  }
  await pgQuery(
    `
      insert into public.promotions (
        id, business_id, title, description, discount, category,
        expiration_date, building_id, image_path, is_active
      )
      values ($1, $2, $3, $4, $5, $6, $7::date, $8, $9, true)
    `,
    [
      input.id,
      input.businessId,
      input.title,
      input.description,
      input.discount,
      input.category,
      input.expirationDate,
      input.buildingId,
      input.imagePath,
    ],
  )
}

export async function deletePromotionInPostgres(input: {
  promotionId: string
  businessId: string
}): Promise<void> {
  await pgQuery(`delete from public.promotions where id = $1 and business_id = $2`, [
    input.promotionId,
    input.businessId,
  ])
}
