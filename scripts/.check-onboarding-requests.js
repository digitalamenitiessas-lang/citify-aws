/* eslint-disable */
const { Pool } = require('pg')
async function main() {
  const pool = new Pool({
    host: process.env.DB_HOST, port: 5432,
    database: process.env.DB_NAME, user: process.env.DB_USER,
    password: process.env.DB_PASSWORD, ssl: { rejectUnauthorized: false },
  })
  const r = await pool.query(
    `select name, email, kind::text as kind, status::text as status, message, created_at
       from public.onboarding_requests order by created_at desc limit 5`,
  )
  console.log(JSON.stringify(r.rows, null, 2))
  console.log('Total:', r.rowCount)
  await pool.end()
}
module.exports = main
