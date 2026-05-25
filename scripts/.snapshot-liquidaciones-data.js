/* eslint-disable */
const { Pool } = require('pg')
async function main() {
  const pool = new Pool({
    host: process.env.DB_HOST, port: 5432,
    database: process.env.DB_NAME, user: process.env.DB_USER,
    password: process.env.DB_PASSWORD, ssl: { rejectUnauthorized: false },
  })

  console.log('========== Buildings con managed_property ==========')
  const buildings = await pool.query(`
    select b.id as building_id, b.name as building_name, b.total_units,
           mp.id as property_id, mp.administration_id, mp.display_name,
           a.name as admin_name
      from public.buildings b
      left join public.iadmin_managed_properties mp on mp.building_id = b.id
      left join public.iadmin_administrations a on a.id = mp.administration_id
     order by b.name
  `)
  console.log(JSON.stringify(buildings.rows, null, 2))

  console.log('\n========== Unidades por building ==========')
  const units = await pool.query(`
    select mp.building_id, b.name as building_name,
           count(u.id) as units,
           count(u.id) filter (where u.is_active) as active_units
      from public.iadmin_managed_properties mp
      join public.buildings b on b.id = mp.building_id
      left join public.iadmin_units u on u.managed_property_id = mp.id
     group by mp.building_id, b.name
     order by b.name
  `)
  console.log(JSON.stringify(units.rows, null, 2))

  console.log('\n========== Propietarios activos (memberships) ==========')
  const owners = await pool.query(`
    select p.email, p.full_name,
           b.name as building_name,
           u.code as unit_code,
           m.relationship_type,
           m.active
      from public.unit_profile_memberships m
      join public.profiles p on p.id = m.profile_id
      join public.iadmin_units u on u.id = m.unit_id
      join public.iadmin_managed_properties mp on mp.id = u.managed_property_id
      join public.buildings b on b.id = mp.building_id
     where m.relationship_type = 'propietario'
       and m.active = true
     order by b.name, u.code
  `)
  console.log(JSON.stringify(owners.rows, null, 2))

  console.log('\n========== Periodos contables existentes ==========')
  const periods = await pool.query(`
    select ap.id, b.name as building_name,
           ap.period_year, ap.period_month, ap.status::text as status, ap.closed_at
      from public.iadmin_accounting_periods ap
      join public.iadmin_managed_properties mp on mp.id = ap.managed_property_id
      join public.buildings b on b.id = mp.building_id
     order by b.name, ap.period_year desc, ap.period_month desc
     limit 20
  `)
  console.log(JSON.stringify(periods.rows, null, 2))

  console.log('\n========== Gastos en periodos abiertos ==========')
  const expenses = await pool.query(`
    select b.name as building_name, ap.period_year, ap.period_month,
           count(e.id) as count_total,
           count(e.id) filter (where e.status::text in ('approved','imputed')) as count_ready,
           coalesce(sum(case when e.status::text in ('approved','imputed') then e.amount else 0 end), 0)::text as ready_amount
      from public.iadmin_managed_properties mp
      join public.buildings b on b.id = mp.building_id
      join public.iadmin_accounting_periods ap on ap.managed_property_id = mp.id
      left join public.iadmin_expenses e on e.managed_property_id = mp.id and e.accounting_period_id = ap.id
     where ap.status = 'open'
     group by b.name, ap.period_year, ap.period_month
     order by b.name, ap.period_year desc, ap.period_month desc
  `)
  console.log(JSON.stringify(expenses.rows, null, 2))

  console.log('\n========== Building admins asignados ==========')
  const admins = await pool.query(`
    select p.email, p.full_name, b.name as building_name, baa.is_primary
      from public.building_admin_assignments baa
      join public.profiles p on p.id = baa.profile_id
      join public.buildings b on b.id = baa.building_id
     order by b.name, baa.is_primary desc
  `)
  console.log(JSON.stringify(admins.rows, null, 2))

  await pool.end()
}
module.exports = main
