/* eslint-disable */
const { Pool } = require('pg')
async function main() {
  const pool = new Pool({
    host: process.env.DB_HOST, port: 5432,
    database: process.env.DB_NAME, user: process.env.DB_USER,
    password: process.env.DB_PASSWORD, ssl: { rejectUnauthorized: false },
  })

  console.log('========== Profiles existentes ==========')
  const profiles = await pool.query(`
    select id, email, full_name, role, building_id, business_id
      from public.profiles
     order by created_at
  `)
  console.log(JSON.stringify(profiles.rows, null, 2))

  console.log('\n========== FKs que apuntan a profiles ==========')
  const fks = await pool.query(`
    select
      tc.table_name as referencing_table,
      kcu.column_name as referencing_column,
      rc.delete_rule
    from information_schema.table_constraints tc
    join information_schema.key_column_usage kcu
      on tc.constraint_name = kcu.constraint_name
     and tc.table_schema = kcu.table_schema
    join information_schema.referential_constraints rc
      on tc.constraint_name = rc.constraint_name
     and tc.table_schema = rc.constraint_schema
    join information_schema.constraint_column_usage ccu
      on rc.unique_constraint_name = ccu.constraint_name
     and rc.unique_constraint_schema = ccu.constraint_schema
    where tc.constraint_type = 'FOREIGN KEY'
      and tc.table_schema = 'public'
      and ccu.table_name = 'profiles'
    order by tc.table_name, kcu.column_name
  `)
  console.log(JSON.stringify(fks.rows, null, 2))

  await pool.end()
}
module.exports = main
