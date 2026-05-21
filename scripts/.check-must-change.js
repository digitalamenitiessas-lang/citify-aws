/* eslint-disable */
const { Pool } = require('pg')
async function main() {
  const pool = new Pool({
    host: process.env.DB_HOST, port: 5432,
    database: process.env.DB_NAME, user: process.env.DB_USER,
    password: process.env.DB_PASSWORD, ssl: { rejectUnauthorized: false },
  })
  const r = await pool.query(
    `select email, role, password_must_change, created_at, updated_at
       from public.profiles
       order by created_at desc
       limit 10`,
  )
  console.log(JSON.stringify(r.rows, null, 2))
  await pool.end()
}
module.exports = main
