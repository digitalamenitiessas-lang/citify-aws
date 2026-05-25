/* eslint-disable */
const { Pool } = require('pg')
async function main() {
  const pool = new Pool({
    host: process.env.DB_HOST, port: 5432,
    database: process.env.DB_NAME, user: process.env.DB_USER,
    password: process.env.DB_PASSWORD, ssl: { rejectUnauthorized: false },
  })
  // Usuarios que pueden haber sido afectados por la rotacion automatica:
  // tienen password_must_change=true (lo seteamos en cada call de
  // findOrCreatePlatformProfile despues del fix). Listamos los actualizados
  // recientemente.
  const r = await pool.query(`
    select email, role, password_must_change, updated_at, created_at
      from public.profiles
     where password_must_change = true
       and updated_at > now() - interval '3 days'
     order by updated_at desc
     limit 50
  `)
  console.log('Users con password_must_change=true en los ultimos 3 dias:')
  console.log(JSON.stringify(r.rows, null, 2))
  console.log(`\nTotal: ${r.rows.length}`)
  await pool.end()
}
module.exports = main
