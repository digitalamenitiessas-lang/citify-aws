/* eslint-disable */
const { Pool } = require('pg')
async function main() {
  const pool = new Pool({
    host: process.env.DB_HOST, port: 5432,
    database: process.env.DB_NAME, user: process.env.DB_USER,
    password: process.env.DB_PASSWORD, ssl: { rejectUnauthorized: false },
  })
  // 1) Profiles schema (columnas)
  const cols = await pool.query(`
    select column_name, data_type, is_nullable, column_default
      from information_schema.columns
     where table_schema = 'public' and table_name = 'profiles'
     order by ordinal_position
  `)
  console.log('=== profiles columns ===')
  console.log(JSON.stringify(cols.rows, null, 2))

  // 2) Businesses schema (countrify comparte esta tabla)
  const biz = await pool.query(`
    select column_name, data_type, is_nullable
      from information_schema.columns
     where table_schema = 'public' and table_name = 'businesses'
     order by ordinal_position
  `)
  console.log('\n=== businesses columns ===')
  console.log(JSON.stringify(biz.rows, null, 2))

  // 3) Tablas nuevas que pueden haber aparecido (de countrify)
  const tables = await pool.query(`
    select table_name
      from information_schema.tables
     where table_schema = 'public'
       and (table_name like '%country%' or table_name like '%countrify%')
     order by table_name
  `)
  console.log('\n=== countrify-ish tables ===')
  console.log(JSON.stringify(tables.rows, null, 2))

  // 4) Triggers en profiles (alguno nuevo podria romper insert/update)
  const trg = await pool.query(`
    select trigger_name, event_manipulation, action_timing
      from information_schema.triggers
     where event_object_schema='public' and event_object_table='profiles'
  `)
  console.log('\n=== profiles triggers ===')
  console.log(JSON.stringify(trg.rows, null, 2))

  // 5) Una row de muestra
  const sample = await pool.query(`select * from public.profiles where email='vecino1@citify.com.ar' limit 1`)
  console.log('\n=== sample profile ===')
  console.log(JSON.stringify(sample.rows[0] ?? null, null, 2))

  await pool.end()
}
module.exports = main
