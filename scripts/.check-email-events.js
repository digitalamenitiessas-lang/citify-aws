/* eslint-disable */
const { Pool } = require('pg')
async function main() {
  const pool = new Pool({
    host: process.env.DB_HOST, port: 5432,
    database: process.env.DB_NAME, user: process.env.DB_USER,
    password: process.env.DB_PASSWORD, ssl: { rejectUnauthorized: false },
  })
  const r = await pool.query(
    `select template_key, to_email, status, ses_message_id, sent_at, error
       from public.email_events order by sent_at desc limit 5`,
  )
  console.log(JSON.stringify(r.rows, null, 2))
  await pool.end()
}
module.exports = main
