/* eslint-disable */
const { Pool } = require('pg')

const SUPER_SUB = process.env.SUPER_SUB
const ADMIN_SUB = process.env.ADMIN_SUB
const OWNER_SUB = process.env.OWNER_SUB

const UNIT_C1 = 'aaaaaaaa-aaaa-aaaa-aaaa-c00000000001'
const BUILDING_CENTRO = '11111111-1111-1111-1111-111111111111'
const BUILDING_NORTE = '22222222-2222-2222-2222-222222222222'
const ADMINISTRATION_ID = '33333333-3333-3333-3333-333333333333'

async function main() {
  const pool = new Pool({
    host: process.env.DB_HOST, port: 5432,
    database: process.env.DB_NAME, user: process.env.DB_USER,
    password: process.env.DB_PASSWORD, ssl: { rejectUnauthorized: false },
  })

  console.log('Subs recibidos:', { SUPER_SUB, ADMIN_SUB, OWNER_SUB })

  // 1) Profiles. password_must_change=false para test directo (no obligamos
  //    cambio en el primer login). Email_notifications con defaults.
  await pool.query(
    `insert into public.profiles
       (id, email, full_name, avatar_text, role, building_id, business_id, password_must_change)
     values
       ($1, 'lucianobonilla27@gmail.com', 'Luciano Bonilla', 'LB', 'super_admin', null, null, false),
       ($2, 'digitalamenitiessas@gmail.com', 'Digital Amenities Admin', 'DA', 'consorcio_admin', $4, null, false),
       ($3, 'lucianobonilla27+propietario@gmail.com', 'Test Propietario', 'TP', 'propietario', $4, null, false)`,
    [SUPER_SUB, ADMIN_SUB, OWNER_SUB, BUILDING_CENTRO],
  )
  console.log('inserted 3 profiles')

  // 2) Consorcio admin asignado a ambos buildings.
  await pool.query(
    `insert into public.building_admin_assignments (profile_id, building_id, is_primary)
     values
       ($1, $2, true),
       ($1, $3, false)`,
    [ADMIN_SUB, BUILDING_CENTRO, BUILDING_NORTE],
  )
  console.log('inserted 2 building_admin_assignments')

  // 3) Iadmin role grant para el consorcio_admin sobre la administracion.
  //    Rol operacional 'titular' para que pueda hacer todas las
  //    transiciones de liquidacion.
  await pool.query(
    `insert into public.iadmin_role_grants (profile_id, administration_id, operational_role, is_primary)
     values ($1, $2, 'titular', true)`,
    [ADMIN_SUB, ADMINISTRATION_ID],
  )
  console.log('inserted iadmin_role_grant')

  // 4) Propietario linkeado a unit C1 en Centro.
  await pool.query(
    `insert into public.unit_profile_memberships
       (unit_id, building_id, profile_id, relationship_type, is_primary, active)
     values ($1, $2, $3, 'propietario', true, true)`,
    [UNIT_C1, BUILDING_CENTRO, OWNER_SUB],
  )
  console.log('inserted unit_profile_membership for propietario')

  // 5) Verificacion final
  console.log('\n========== State after seed ==========')
  const verify = await pool.query(`
    select p.email, p.role::text as role, p.full_name,
           p.building_id is not null as has_building
      from public.profiles p
     order by case p.role
                when 'super_admin' then 1
                when 'consorcio_admin' then 2
                when 'propietario' then 3
                else 9
              end
  `)
  console.log('Profiles:')
  console.log(JSON.stringify(verify.rows, null, 2))

  const grants = await pool.query(`
    select p.email, baa.building_id, baa.is_primary
      from public.building_admin_assignments baa
      join public.profiles p on p.id = baa.profile_id
  `)
  console.log('\nBuilding admin assignments:')
  console.log(JSON.stringify(grants.rows, null, 2))

  const members = await pool.query(`
    select p.email, m.unit_id, m.relationship_type, m.active
      from public.unit_profile_memberships m
      join public.profiles p on p.id = m.profile_id
  `)
  console.log('\nUnit memberships:')
  console.log(JSON.stringify(members.rows, null, 2))

  await pool.end()
}
module.exports = main
