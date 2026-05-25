/* eslint-disable */
const { Pool } = require('pg')
async function main() {
  const pool = new Pool({
    host: process.env.DB_HOST, port: 5432,
    database: process.env.DB_NAME, user: process.env.DB_USER,
    password: process.env.DB_PASSWORD, ssl: { rejectUnauthorized: false },
  })

  // 1) Snapshot previo para tener cómo revertir
  const before = await pool.query(`
    select id, email, full_name
      from public.profiles
     where email in ('propietario@citify.com.ar', 'consorcio@citify.com.ar')
  `)
  console.log('BEFORE:')
  console.log(JSON.stringify(before.rows, null, 2))

  // 2) Redirigir a addresses verificadas en SES sandbox.
  //    Pedro Propietario -> lucianobonilla27@gmail.com (recibe liquidation_issued)
  //    Laura Consorcio   -> digitalamenitiessas@gmail.com (recibe liquidation_closed)
  await pool.query(
    `update public.profiles
        set email = 'lucianobonilla27@gmail.com',
            email_blocked = false,
            email_blocked_reason = null,
            email_blocked_at = null
      where email = 'propietario@citify.com.ar'`,
  )
  await pool.query(
    `update public.profiles
        set email = 'digitalamenitiessas@gmail.com',
            email_blocked = false,
            email_blocked_reason = null,
            email_blocked_at = null
      where email = 'consorcio@citify.com.ar'`,
  )

  const after = await pool.query(`
    select id, email, full_name
      from public.profiles
     where full_name in ('Pedro Propietario', 'Laura Consorcio')
  `)
  console.log('\nAFTER:')
  console.log(JSON.stringify(after.rows, null, 2))
  await pool.end()
}
module.exports = main
