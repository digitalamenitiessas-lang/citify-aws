/* eslint-disable */
const { Pool } = require('pg')
async function main() {
  const pool = new Pool({
    host: process.env.DB_HOST, port: 5432,
    database: process.env.DB_NAME, user: process.env.DB_USER,
    password: process.env.DB_PASSWORD, ssl: { rejectUnauthorized: false },
  })

  console.log('========== 1) Tablas requeridas existen ==========')
  const tables = await pool.query(`
    select table_name
      from information_schema.tables
     where table_schema='public'
       and table_name in (
         'iadmin_liquidation_runs',
         'iadmin_liquidation_items',
         'iadmin_accounting_periods',
         'iadmin_managed_properties',
         'iadmin_units',
         'iadmin_unit_holders',
         'iadmin_item_share_tokens',
         'iadmin_payments',
         'unit_profile_memberships',
         'building_admin_assignments',
         'buildings',
         'profiles'
       )
     order by table_name
  `)
  console.log(JSON.stringify(tables.rows.map((r) => r.table_name), null, 2))

  console.log('\n========== 2) Share-tokens schema ==========')
  const tokenCols = await pool.query(`
    select column_name, data_type, is_nullable
      from information_schema.columns
     where table_schema='public' and table_name='iadmin_item_share_tokens'
     order by ordinal_position
  `)
  console.log(JSON.stringify(tokenCols.rows, null, 2))

  console.log('\n========== 3) Membership schema (active + relationship_type) ==========')
  const memCols = await pool.query(`
    select column_name, data_type, is_nullable, column_default
      from information_schema.columns
     where table_schema='public' and table_name='unit_profile_memberships'
       and column_name in ('active','relationship_type','unit_id','profile_id')
     order by ordinal_position
  `)
  console.log(JSON.stringify(memCols.rows, null, 2))

  console.log('\n========== 4) Statuses validos del enum de liquidaciones ==========')
  const statuses = await pool.query(`
    select e.enumlabel
      from pg_enum e
      join pg_type t on t.oid = e.enumtypid
     where t.typname='iadmin_liquidation_status'
     order by e.enumsortorder
  `)
  console.log(JSON.stringify(statuses.rows.map((r) => r.enumlabel), null, 2))

  console.log('\n========== 5) Liquidaciones por estado ==========')
  const counts = await pool.query(`
    select status::text, count(*)
      from public.iadmin_liquidation_runs
     group by status
     order by status
  `)
  console.log(JSON.stringify(counts.rows, null, 2))

  console.log('\n========== 6) Sample issued run + chequeo: items, tokens, propietarios ==========')
  const issued = await pool.query(`
    select id, accounting_period_id, managed_property_id, status::text as status
      from public.iadmin_liquidation_runs
     where status in ('issued','closed')
     order by generated_at desc
     limit 1
  `)
  if (issued.rows.length === 0) {
    console.log('No hay runs en issued/closed. Sample: cualquier run reciente:')
    const any = await pool.query(`
      select id, status::text as status, generated_at
        from public.iadmin_liquidation_runs
       order by generated_at desc
       limit 1
    `)
    console.log(JSON.stringify(any.rows[0] ?? null, null, 2))
  } else {
    const runId = issued.rows[0].id
    console.log('Run de muestra:', JSON.stringify(issued.rows[0], null, 2))

    const itemsCheck = await pool.query(`
      select
        count(*) as total_items,
        count(*) filter (where t.token is not null) as items_with_token,
        count(distinct m.profile_id) filter (where m.relationship_type='propietario' and m.active=true) as owners_total
        from public.iadmin_liquidation_items li
        left join public.iadmin_item_share_tokens t
          on t.liquidation_item_id = li.id and t.revoked_at is null
        left join public.unit_profile_memberships m
          on m.unit_id = li.unit_id and m.relationship_type='propietario' and m.active=true
       where li.liquidation_run_id = $1
    `, [runId])
    console.log('Items + tokens + propietarios:', JSON.stringify(itemsCheck.rows[0], null, 2))
  }

  console.log('\n========== 7) Cuántos building_admins están configurados ==========')
  const adminCount = await pool.query(`
    select count(*) as building_admins
      from public.building_admin_assignments baa
      join public.profiles p on p.id = baa.profile_id
     where p.role = 'consorcio_admin'
  `)
  console.log(JSON.stringify(adminCount.rows[0], null, 2))

  await pool.end()
}
module.exports = main
