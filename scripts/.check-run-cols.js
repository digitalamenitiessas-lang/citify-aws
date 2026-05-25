/* eslint-disable */
const { Pool } = require('pg')
async function main() {
  const pool = new Pool({
    host: process.env.DB_HOST, port: 5432,
    database: process.env.DB_NAME, user: process.env.DB_USER,
    password: process.env.DB_PASSWORD, ssl: { rejectUnauthorized: false },
  })
  const r = await pool.query(`
    select column_name, data_type
      from information_schema.columns
     where table_schema='public' and table_name='iadmin_liquidation_runs'
     order by ordinal_position
  `)
  console.log('iadmin_liquidation_runs columns:')
  console.log(JSON.stringify(r.rows, null, 2))

  // Items
  const items = await pool.query(`
    select column_name, data_type
      from information_schema.columns
     where table_schema='public' and table_name='iadmin_liquidation_items'
     order by ordinal_position
  `)
  console.log('\niadmin_liquidation_items columns:')
  console.log(JSON.stringify(items.rows, null, 2))

  await pool.end()
}
module.exports = main
