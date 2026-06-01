// Borra los gastos de un período para el admin de consorcio indicado.
// Uso (desde un entorno con acceso a la BD / VPC):
//   node scripts/delete-june-expenses.mjs           -> sólo preview (no borra)
//   node scripts/delete-june-expenses.mjs --apply   -> borra de verdad
import fs from 'node:fs'
import pg from 'pg'

for (const line of fs.readFileSync('.env.local', 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (m && !(m[1] in process.env)) {
    process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
}

const EMAIL = 'digitalamenitiessas@gmail.com'
const YEAR = 2026
const MONTH = 6
const APPLY = process.argv.includes('--apply')

const pool = new pg.Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: process.env.DB_SSL === 'disable' ? false : { rejectUnauthorized: false },
})

// Subconsulta reutilizable: ids de gastos del período para ese admin.
const idsCte = `
  with target as (
    select e.id
      from public.iadmin_expenses e
      inner join public.iadmin_accounting_periods ap on ap.id = e.accounting_period_id
      inner join public.iadmin_administrations a on a.id = e.administration_id
      inner join public.iadmin_role_grants g on g.administration_id = a.id
      inner join public.profiles p on p.id = g.profile_id
     where lower(p.email) = lower($1)
       and ap.period_year = $2
       and ap.period_month = $3
  )
`

const client = await pool.connect()
try {
  const preview = await client.query(
    `${idsCte}
     select e.id, e.description, e.amount::text as amount, e.currency,
            e.status::text as status, e.expense_kind::text as kind, e.managed_property_id
       from public.iadmin_expenses e
      where e.id in (select id from target)
      order by e.managed_property_id, e.created_at asc`,
    [EMAIL, YEAR, MONTH],
  )

  console.log(`\nGastos ${String(MONTH).padStart(2, '0')}/${YEAR} de ${EMAIL}: ${preview.rows.length}\n`)
  for (const r of preview.rows) {
    console.log(`  [${r.status}/${r.kind}] ${r.description} — ${r.currency} ${r.amount}`)
  }

  if (!APPLY) {
    console.log('\n(preview) No se borró nada. Corré con --apply para borrar.')
    await client.release()
    await pool.end()
    process.exit(0)
  }

  await client.query('begin')
  // Borrar dependencias primero por si hay FKs sin cascade.
  const del = await client.query(
    `${idsCte}
     delete from public.iadmin_expenses e
      where e.id in (select id from target)`,
    [EMAIL, YEAR, MONTH],
  )
  await client.query('commit')
  console.log(`\n✓ Borrados ${del.rowCount} gastos.`)
} catch (err) {
  await client.query('rollback').catch(() => {})
  console.error('Error, rollback aplicado:', err.message)
  process.exitCode = 1
} finally {
  client.release()
  await pool.end()
}
