/* eslint-disable */
const { Pool } = require('pg')
async function main() {
  const pool = new Pool({
    host: process.env.DB_HOST, port: 5432,
    database: process.env.DB_NAME, user: process.env.DB_USER,
    password: process.env.DB_PASSWORD, ssl: { rejectUnauthorized: false },
  })

  console.log('========== email_events (ultimos 10 min) ==========')
  const events = await pool.query(`
    select template_key, to_email, status, ses_message_id, error,
           sent_at, metadata
      from public.email_events
     where sent_at > now() - interval '10 minutes'
     order by sent_at desc
  `)
  console.log(JSON.stringify(events.rows, null, 2))

  console.log('\n========== liquidation_runs recientes ==========')
  const runs = await pool.query(`
    select lr.id, lr.status::text as status, lr.generated_at,
           lr.issued_at, lr.closed_at,
           ap.period_year, ap.period_month,
           b.name as building_name
      from public.iadmin_liquidation_runs lr
      join public.iadmin_accounting_periods ap on ap.id = lr.accounting_period_id
      join public.iadmin_managed_properties mp on mp.id = lr.managed_property_id
      join public.buildings b on b.id = mp.building_id
     order by lr.generated_at desc
     limit 5
  `)
  console.log(JSON.stringify(runs.rows, null, 2))

  if (runs.rows.length > 0) {
    const lastRunId = runs.rows[0].id
    console.log(`\n========== Items + tokens del run ${lastRunId.slice(0,8)}... ==========`)
    const items = await pool.query(`
      select li.id as item_id, u.code as unit_code,
             li.ordinary_amount::text as ordinary,
             li.amount::text as amount,
             t.token,
             t.revoked_at,
             (select count(*) from public.unit_profile_memberships m
               where m.unit_id = li.unit_id
                 and m.active = true
                 and m.relationship_type in ('propietario', 'vecino_principal')
             ) as eligible_recipients
        from public.iadmin_liquidation_items li
        join public.iadmin_units u on u.id = li.unit_id
        left join public.iadmin_item_share_tokens t
          on t.liquidation_item_id = li.id and t.revoked_at is null
       where li.liquidation_run_id = $1
       order by u.code
    `, [lastRunId])
    console.log(JSON.stringify(items.rows, null, 2))
  }

  console.log('\n========== Memberships activos por unidad de Centro ==========')
  const members = await pool.query(`
    select u.code, m.relationship_type::text as rel,
           p.email, p.full_name, p.email_blocked
      from public.unit_profile_memberships m
      join public.profiles p on p.id = m.profile_id
      join public.iadmin_units u on u.id = m.unit_id
      join public.iadmin_managed_properties mp on mp.id = u.managed_property_id
      join public.buildings b on b.id = mp.building_id
     where m.active = true
       and b.name = 'Edificio Centro'
     order by u.code, m.relationship_type
  `)
  console.log(JSON.stringify(members.rows, null, 2))

  await pool.end()
}
module.exports = main
