/* eslint-disable */
const { Pool } = require('pg')

const TENANT_SUB = process.env.TENANT_SUB
const UNIT_C1 = 'aaaaaaaa-aaaa-aaaa-aaaa-c00000000001'
const BUILDING_CENTRO = '11111111-1111-1111-1111-111111111111'

async function main() {
  const pool = new Pool({
    host: process.env.DB_HOST, port: 5432,
    database: process.env.DB_NAME, user: process.env.DB_USER,
    password: process.env.DB_PASSWORD, ssl: { rejectUnauthorized: false },
  })

  console.log('TENANT_SUB:', TENANT_SUB)

  // role='vecino' (top-level), relationship_type='vecino_principal' (linkeo a unidad).
  await pool.query(
    `insert into public.profiles
       (id, email, full_name, avatar_text, role, building_id, business_id, password_must_change)
     values ($1, 'lucianobonilla27+vecino@gmail.com', 'Test Vecino Principal', 'TV', 'vecino', $2, null, false)`,
    [TENANT_SUB, BUILDING_CENTRO],
  )
  console.log('inserted profile')

  await pool.query(
    `insert into public.unit_profile_memberships
       (unit_id, building_id, profile_id, relationship_type, is_primary, active)
     values ($1, $2, $3, 'vecino_principal', false, true)`,
    [UNIT_C1, BUILDING_CENTRO, TENANT_SUB],
  )
  console.log('inserted unit_profile_membership for vecino_principal')

  // Confirmacion
  const r = await pool.query(`
    select p.email, p.role::text as role, m.relationship_type::text as relationship, u.code
      from public.unit_profile_memberships m
      join public.profiles p on p.id = m.profile_id
      join public.iadmin_units u on u.id = m.unit_id
     where u.code = 'C1'
     order by m.relationship_type
  `)
  console.log('Memberships en C1:')
  console.log(JSON.stringify(r.rows, null, 2))

  await pool.end()
}
module.exports = main
