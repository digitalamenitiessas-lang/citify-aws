/* eslint-disable */
const { Pool } = require('pg')
async function main() {
  const pool = new Pool({
    host: process.env.DB_HOST, port: 5432,
    database: process.env.DB_NAME, user: process.env.DB_USER,
    password: process.env.DB_PASSWORD, ssl: { rejectUnauthorized: false },
  })
  const biz = await pool.query(`select id, name, logo_path from public.businesses order by name`)
  console.log('businesses:', biz.rows)
  const promos = await pool.query(`
    select p.id, p.title, p.business_id, b.name as business_name, b.logo_path as business_logo_path
    from public.promotions p
    left join public.businesses b on b.id = p.business_id
    where p.is_active = true
    order by p.created_at desc
    limit 10
  `)
  console.log('promos:', promos.rows)
  await pool.end()
}
module.exports = main
