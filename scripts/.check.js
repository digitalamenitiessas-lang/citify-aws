const { Pool } = require('pg')
async function main() {
  const pool = new Pool({
    host: process.env.DB_HOST, port: 5432,
    database: process.env.DB_NAME, user: process.env.DB_USER,
    password: process.env.DB_PASSWORD, ssl: { rejectUnauthorized: false },
  })
  // Test the exact query findProfileById uses
  const r = await pool.query(`select * from public.profiles where id = $1 limit 1`, ['24a80408-4011-7063-f083-972ccdc73d4e'])
  console.log('keys:', Object.keys(r.rows[0] || {}))
  console.log('row:', JSON.stringify(r.rows[0], null, 2))
  await pool.end()
}
module.exports = main
