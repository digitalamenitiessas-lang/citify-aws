/* eslint-disable */
const { Pool } = require('pg')
async function main() {
  const pool = new Pool({
    host: process.env.DB_HOST, port: 5432,
    database: process.env.DB_NAME, user: process.env.DB_USER,
    password: process.env.DB_PASSWORD, ssl: { rejectUnauthorized: false },
  })

  const r = await pool.query(`
    select u.id as unit_id, u.code, b.id as building_id, b.name as building_name,
           mp.id as managed_property_id, mp.administration_id
      from public.iadmin_units u
      join public.iadmin_managed_properties mp on mp.id = u.managed_property_id
      join public.buildings b on b.id = mp.building_id
     where b.name = 'Edificio Centro' and u.code = 'C1'
     limit 1
  `)
  console.log('UNIT C1 IN CENTRO:')
  console.log(JSON.stringify(r.rows[0], null, 2))

  const buildings = await pool.query(`
    select id, name from public.buildings order by name
  `)
  console.log('\nBUILDINGS:')
  console.log(JSON.stringify(buildings.rows, null, 2))

  await pool.end()
}
module.exports = main
