/* eslint-disable */
const { Pool } = require('pg')
async function main() {
  const pool = new Pool({
    host: process.env.DB_HOST, port: 5432,
    database: process.env.DB_NAME, user: process.env.DB_USER,
    password: process.env.DB_PASSWORD, ssl: { rejectUnauthorized: false },
  })

  console.log('========== Counts BEFORE wipe ==========')
  const before = await pool.query(`
    select
      (select count(*) from public.profiles) as profiles,
      (select count(*) from public.unit_profile_memberships) as memberships,
      (select count(*) from public.building_admin_assignments) as building_admins,
      (select count(*) from public.iadmin_role_grants) as role_grants,
      (select count(*) from public.complaint_cases) as complaint_cases,
      (select count(*) from public.complaint_case_messages) as complaint_msgs,
      (select count(*) from public.marketplace_items) as marketplace_items,
      (select count(*) from public.iadmin_unit_holders) as unit_holders,
      (select count(*) from public.email_events) as email_events
  `)
  console.log(JSON.stringify(before.rows[0], null, 2))

  // El trigger validate_unit_profile_membership() falla cuando se hace
  // SET NULL sobre created_by_profile_id desde el cascade. Solucion:
  // borrar memberships PRIMERO (delete no dispara validate), despues
  // CASCADE/SET NULL de profiles se aplica sobre tablas que no tienen
  // ese trigger.
  console.log('\n========== Wipe ==========')

  // 1) Borrar dependencias que tienen triggers de validacion
  let res = await pool.query(`delete from public.unit_profile_memberships`)
  console.log(`deleted ${res.rowCount} unit_profile_memberships`)

  // 2) Borrar holders explicitamente (su FK es SET NULL pero queremos
  //    limpieza total, no orphans)
  res = await pool.query(`delete from public.iadmin_unit_holders`)
  console.log(`deleted ${res.rowCount} iadmin_unit_holders`)

  // 3) Borrar profiles. Las FKs restantes son CASCADE (limpian sus rows)
  //    o SET NULL sobre tablas sin trigger validador (audit, expenses,
  //    payments, accounting_periods.closed_by, etc).
  res = await pool.query(`delete from public.profiles returning id, email`)
  console.log(`deleted ${res.rowCount} profiles`)

  console.log('\n========== Counts AFTER wipe ==========')
  const after = await pool.query(`
    select
      (select count(*) from public.profiles) as profiles,
      (select count(*) from public.unit_profile_memberships) as memberships,
      (select count(*) from public.building_admin_assignments) as building_admins,
      (select count(*) from public.iadmin_role_grants) as role_grants,
      (select count(*) from public.complaint_cases) as complaint_cases,
      (select count(*) from public.complaint_case_messages) as complaint_msgs,
      (select count(*) from public.marketplace_items) as marketplace_items,
      (select count(*) from public.iadmin_unit_holders) as unit_holders,
      (select count(*) from public.email_events) as email_events,
      (select count(*) from public.buildings) as buildings,
      (select count(*) from public.iadmin_units) as units,
      (select count(*) from public.iadmin_accounting_periods) as periods,
      (select count(*) from public.iadmin_expenses) as expenses,
      (select count(*) from public.iadmin_administrations) as administrations,
      (select count(*) from public.iadmin_managed_properties) as managed_properties
  `)
  console.log(JSON.stringify(after.rows[0], null, 2))

  await pool.end()
}
module.exports = main
