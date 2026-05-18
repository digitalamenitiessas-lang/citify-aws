/* eslint-disable */
const { Pool } = require('pg')

const PASSWORD = 'Test1234!'

// Subs Cognito creados en el paso previo (ver scripts/.subs.json)
const SUBS = {
  'admin@citify.com.ar':       '24d8d428-f051-706b-a34d-9ee6f4f178ce',
  'consorcio@citify.com.ar':   '54a87468-f031-70da-8ac7-10b3296d71dc',
  'propietario@citify.com.ar': 'e4d87428-d091-7021-e5f3-e2b384ea87a5',
  'vecino1@citify.com.ar':     'a4288438-30f1-70b2-72f4-8fae31c0c444',
  'vecino2@citify.com.ar':     '74782428-d0e1-7077-c1d7-a29abf855499',
  'vecino3@citify.com.ar':     'd4d88458-1011-70d4-63e8-ab94bb6c9692',
  'vecino4@citify.com.ar':     'd418a448-c091-70f6-39a4-f5205ce61115',
  'vecino5@citify.com.ar':     '94c88478-d0d1-70bb-e687-72dd336845d2',
  'vecino6@citify.com.ar':     '24584458-0091-70d8-7730-7292910670e6',
  'vecino7@citify.com.ar':     'f458b488-8001-70f1-6572-09418d0e7b17',
  'vecino8@citify.com.ar':     '04886498-d031-7047-8f81-315224ee5af6',
  'cafe@citify.com.ar':        '24a80408-4011-7063-f083-972ccdc73d4e',
  'almacen@citify.com.ar':     'f4082468-90f1-70fd-072a-b5059c1d5fd7',
}

const usersToCreate = [
  { email: 'admin@citify.com.ar', name: 'Super Admin', role: 'super_admin' },
  { email: 'consorcio@citify.com.ar', name: 'Laura Consorcio', role: 'consorcio_admin' },
  { email: 'propietario@citify.com.ar', name: 'Pedro Propietario', role: 'propietario' },
  { email: 'vecino1@citify.com.ar', name: 'Ana Vecino', role: 'vecino' },
  { email: 'vecino2@citify.com.ar', name: 'Bruno Vecino', role: 'vecino' },
  { email: 'vecino3@citify.com.ar', name: 'Carla Vecino', role: 'vecino' },
  { email: 'vecino4@citify.com.ar', name: 'Daniel Vecino', role: 'vecino' },
  { email: 'vecino5@citify.com.ar', name: 'Elena Vecino', role: 'vecino' },
  { email: 'vecino6@citify.com.ar', name: 'Federico Vecino', role: 'vecino' },
  { email: 'vecino7@citify.com.ar', name: 'Gabriela Vecino', role: 'vecino' },
  { email: 'vecino8@citify.com.ar', name: 'Hugo Vecino', role: 'vecino' },
  { email: 'cafe@citify.com.ar', name: 'Cafe Citify Admin', role: 'negocio_admin' },
  { email: 'almacen@citify.com.ar', name: 'Almacen Norte Admin', role: 'negocio_admin' },
]

async function main() {
  const pool = new Pool({
    host: process.env.DB_HOST,
    port: 5432,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: { rejectUnauthorized: false },
  })
  const client = await pool.connect()
  try {
    console.log('> TRUNCATE de tablas RDS...')
    const tables = [
      'iadmin_audit_logs', 'iadmin_reminders', 'iadmin_item_share_tokens',
      'iadmin_ai_document_extractions', 'iadmin_expense_documents',
      'iadmin_payments', 'iadmin_liquidation_items', 'iadmin_liquidation_runs',
      'iadmin_bank_movements', 'iadmin_expenses', 'iadmin_accounting_periods',
      'iadmin_cash_accounts', 'iadmin_providers',
      'iadmin_unit_holders', 'unit_profile_memberships', 'iadmin_units',
      'iadmin_role_capabilities', 'iadmin_role_grants',
      'iadmin_managed_properties', 'iadmin_administrations',
      'building_information', 'building_admin_assignments',
      'complaint_case_message_mentions', 'complaint_case_messages',
      'complaint_case_events', 'complaint_case_reasons', 'complaint_cases',
      'promotion_redemption_tokens', 'promotion_redemptions', 'saved_promotions',
      'promotions', 'marketplace_items',
      'push_subscriptions', 'iadmin_notifications',
      'businesses', 'profiles', 'buildings',
    ]
    const existing = await client.query(
      `select table_name from information_schema.tables where table_schema='public' and table_name = any($1::text[])`,
      [tables],
    )
    const existingTables = existing.rows.map((r) => r.table_name)
    if (existingTables.length > 0) {
      await client.query(`TRUNCATE ${existingTables.map((t) => `public.${t}`).join(', ')} CASCADE`)
    }
    console.log(`  - truncadas ${existingTables.length}/${tables.length} tablas`)

    const p = (email) => SUBS[email]

    // ─── Buildings ───────────────────────────────────────────────────────────
    console.log('> Insertando buildings...')
    const buildingCentro = '11111111-1111-1111-1111-111111111111'
    const buildingNorte = '22222222-2222-2222-2222-222222222222'
    await client.query(`
      insert into public.buildings (id, name, address, total_units) values
        ($1, 'Edificio Centro', 'Av. Corrientes 1234, CABA', 4),
        ($2, 'Edificio Norte',  'Av. Cabildo 5678, CABA', 4)
    `, [buildingCentro, buildingNorte])

    // ─── Profiles ────────────────────────────────────────────────────────────
    console.log('> Insertando profiles...')
    await client.query(`
      insert into public.profiles (id, email, full_name, avatar_text, role, building_id) values
        ($1,  lower('admin@citify.com.ar'),       'Super Admin',        'SA', 'super_admin',     null),
        ($2,  lower('consorcio@citify.com.ar'),   'Laura Consorcio',    'LC', 'consorcio_admin', $13),
        ($3,  lower('propietario@citify.com.ar'), 'Pedro Propietario',  'PP', 'propietario',     $13),
        ($4,  lower('vecino1@citify.com.ar'),     'Ana Vecino',         'AV', 'vecino',          $13),
        ($5,  lower('vecino2@citify.com.ar'),     'Bruno Vecino',       'BV', 'vecino',          $13),
        ($6,  lower('vecino3@citify.com.ar'),     'Carla Vecino',       'CV', 'vecino',          $13),
        ($7,  lower('vecino4@citify.com.ar'),     'Daniel Vecino',      'DV', 'vecino',          $13),
        ($8,  lower('vecino5@citify.com.ar'),     'Elena Vecino',       'EV', 'vecino',          $14),
        ($9,  lower('vecino6@citify.com.ar'),     'Federico Vecino',    'FV', 'vecino',          $14),
        ($10, lower('vecino7@citify.com.ar'),     'Gabriela Vecino',    'GV', 'vecino',          $14),
        ($11, lower('vecino8@citify.com.ar'),     'Hugo Vecino',        'HV', 'vecino',          $14),
        ($12, lower('cafe@citify.com.ar'),        'Cafe Citify Admin',  'CA', 'negocio_admin',   null)
    `, [
      p('admin@citify.com.ar'), p('consorcio@citify.com.ar'), p('propietario@citify.com.ar'),
      p('vecino1@citify.com.ar'), p('vecino2@citify.com.ar'), p('vecino3@citify.com.ar'), p('vecino4@citify.com.ar'),
      p('vecino5@citify.com.ar'), p('vecino6@citify.com.ar'), p('vecino7@citify.com.ar'), p('vecino8@citify.com.ar'),
      p('cafe@citify.com.ar'),
      buildingCentro, buildingNorte,
    ])
    await client.query(`
      insert into public.profiles (id, email, full_name, avatar_text, role)
      values ($1, lower('almacen@citify.com.ar'), 'Almacen Norte Admin', 'AN', 'negocio_admin')
    `, [p('almacen@citify.com.ar')])

    // ─── Administradora ──────────────────────────────────────────────────────
    console.log('> Insertando administracion + properties...')
    const adminId = '33333333-3333-3333-3333-333333333333'
    await client.query(`
      insert into public.iadmin_administrations (id, name, legal_name, tax_id, contact_email, contact_phone, is_active, legal_info)
      values ($1, 'Administración Citify', 'Citify Administraciones SA', '30-12345678-9', 'contacto@citify.com.ar', '+5491155556666', true, $2::jsonb)
    `, [adminId, JSON.stringify({
      bank: { name: 'Banco Nación', cbu: '0110000000000000000000', alias: 'CITIFY.ADMIN', account: '1234567/8' },
      accountantName: 'Estudio Contable Pérez',
      accountantPhone: '+5491144442222',
      collectionSchedule: 'Lunes a Viernes 9-17hs',
    })])

    await client.query(`
      insert into public.iadmin_role_grants (administration_id, profile_id, operational_role, is_primary)
      values ($1, $2, 'titular', true)
    `, [adminId, p('consorcio@citify.com.ar')])

    await client.query(`
      insert into public.building_admin_assignments (profile_id, building_id, is_primary) values
        ($1, $2, true),
        ($1, $3, false)
    `, [p('consorcio@citify.com.ar'), buildingCentro, buildingNorte])

    const mpCentro = '44444444-4444-4444-4444-444444444444'
    const mpNorte = '55555555-5555-5555-5555-555555555555'
    await client.query(`
      insert into public.iadmin_managed_properties (id, administration_id, building_id, display_name, property_kind, managed_since, management_fee_pct, is_active, legal_info)
      values
        ($1, $3, $4, 'Centro Premium', 'edificio', '2024-01-01', 8.5, true, $6::jsonb),
        ($2, $3, $5, 'Norte Familiar', 'edificio', '2024-03-15', 7.0, true, $6::jsonb)
    `, [mpCentro, mpNorte, adminId, buildingCentro, buildingNorte, JSON.stringify({})])

    // ─── Units ───────────────────────────────────────────────────────────────
    console.log('> Insertando units + holders...')
    const unitsCentro = [1, 2, 3, 4].map((i) => ({
      id: `aaaaaaaa-aaaa-aaaa-aaaa-c${String(i).padStart(11, '0')}`, code: `C${i}`,
    }))
    const unitsNorte = [1, 2, 3, 4].map((i) => ({
      id: `bbbbbbbb-bbbb-bbbb-bbbb-d${String(i).padStart(11, '0')}`, code: `N${i}`,
    }))
    const allUnits = [
      ...unitsCentro.map((u, i) => ({ ...u, mp: mpCentro, building: buildingCentro, floor: String(i + 1), prorata: 0.25 })),
      ...unitsNorte.map((u, i) => ({ ...u, mp: mpNorte, building: buildingNorte, floor: String(i + 1), prorata: 0.25 })),
    ]
    for (const u of allUnits) {
      await client.query(`
        insert into public.iadmin_units (id, managed_property_id, code, kind, floor, surface_m2, prorata_coefficient, is_active)
        values ($1, $2, $3, 'departamento', $4, 60, $5, true)
      `, [u.id, u.mp, u.code, u.floor, u.prorata])
    }

    const membershipsData = [
      { vecino: 'vecino1@citify.com.ar', unit: unitsCentro[0], building: buildingCentro },
      { vecino: 'vecino2@citify.com.ar', unit: unitsCentro[1], building: buildingCentro },
      { vecino: 'vecino3@citify.com.ar', unit: unitsCentro[2], building: buildingCentro },
      { vecino: 'vecino4@citify.com.ar', unit: unitsCentro[3], building: buildingCentro },
      { vecino: 'vecino5@citify.com.ar', unit: unitsNorte[0],  building: buildingNorte  },
      { vecino: 'vecino6@citify.com.ar', unit: unitsNorte[1],  building: buildingNorte  },
      { vecino: 'vecino7@citify.com.ar', unit: unitsNorte[2],  building: buildingNorte  },
      { vecino: 'vecino8@citify.com.ar', unit: unitsNorte[3],  building: buildingNorte  },
    ]
    for (const m of membershipsData) {
      await client.query(`
        insert into public.unit_profile_memberships (unit_id, building_id, profile_id, relationship_type, is_primary, active)
        values ($1, $2, $3, 'vecino_principal', false, true)
      `, [m.unit.id, m.building, p(m.vecino)])
    }
    // Propietario solo en C1 (su building_id es buildingCentro)
    {
      const u = unitsCentro[0]
      await client.query(`
        insert into public.unit_profile_memberships (unit_id, building_id, profile_id, relationship_type, is_primary, active)
        values ($1, $2, $3, 'propietario', true, true)
      `, [u.id, buildingCentro, p('propietario@citify.com.ar')])
      await client.query(`
        insert into public.iadmin_unit_holders (unit_id, profile_id, full_name, holder_kind, email, is_active)
        values ($1, $2, 'Pedro Propietario', 'propietario', lower('propietario@citify.com.ar'), true)
      `, [u.id, p('propietario@citify.com.ar')])
    }

    // ─── Cash + period + providers ──────────────────────────────────────────
    console.log('> Insertando cash accounts + accounting periods + providers...')
    const cashCentro = '66666666-6666-6666-6666-666666666666'
    const cashNorte = '77777777-7777-7777-7777-777777777777'
    await client.query(`
      insert into public.iadmin_cash_accounts (id, managed_property_id, name, kind, bank_name, cbu, alias, opening_balance, is_active)
      values
        ($1, $3, 'Cuenta corriente Centro', 'bank', 'Banco Nación', '0110000000000000111111', 'CENTRO.CITIFY', 0, true),
        ($2, $4, 'Cuenta corriente Norte',  'bank', 'Banco Nación', '0110000000000000222222', 'NORTE.CITIFY',  0, true)
    `, [cashCentro, cashNorte, mpCentro, mpNorte])

    const now = new Date()
    const year = now.getFullYear()
    const month = now.getMonth() + 1
    const periodCentro = '88888888-8888-8888-8888-888888888888'
    const periodNorte = '99999999-9999-9999-9999-999999999999'
    await client.query(`
      insert into public.iadmin_accounting_periods (id, managed_property_id, period_year, period_month, status)
      values ($1, $3, $5, $6, 'open'), ($2, $4, $5, $6, 'open')
    `, [periodCentro, periodNorte, mpCentro, mpNorte, year, month])

    const provEdenor = 'e0e0e0e0-e0e0-e0e0-e0e0-e0e0e0e0e0e0'
    const provAysa   = 'a0a0a0a0-a0a0-a0a0-a0a0-a0a0a0a0a0a0'
    const provAsc    = 'a5a5a5a5-a5a5-a5a5-a5a5-a5a5a5a5a5a5'
    await client.query(`
      insert into public.iadmin_providers (id, administration_id, name, category, default_category, default_description, is_recurring, recurring_amount, recurring_kind, is_active) values
        ($1, $4, 'Edenor',          'Servicios', 'Servicios', 'Luz mes',     true, 45000, 'ordinaria', true),
        ($2, $4, 'AYSA',            'Servicios', 'Servicios', 'Agua mes',    true, 18000, 'ordinaria', true),
        ($3, $4, 'Ascensores Otis', 'Mantenimiento', 'Mantenimiento', 'Service ascensor', true, 32000, 'ordinaria', true)
    `, [provEdenor, provAysa, provAsc, adminId])

    console.log('> Insertando gastos imputados del mes...')
    const issuedAt = `${year}-${String(month).padStart(2, '0')}-05`
    for (const mp of [{ id: mpCentro, period: periodCentro }, { id: mpNorte, period: periodNorte }]) {
      await client.query(`
        insert into public.iadmin_expenses (administration_id, managed_property_id, accounting_period_id, provider_id, category, description, amount, currency, issued_at, status, expense_kind, created_by, approved_by, approved_at) values
          ($1, $2, $3, $4, 'Servicios', 'Luz '||$8::text, 45000, 'ARS', $5::date, 'imputed', 'ordinaria', $6, $6, now()),
          ($1, $2, $3, $7, 'Servicios', 'Agua '||$8::text, 18000, 'ARS', $5::date, 'imputed', 'ordinaria', $6, $6, now()),
          ($1, $2, $3, $9, 'Mantenimiento', 'Ascensor '||$8::text, 32000, 'ARS', $5::date, 'imputed', 'ordinaria', $6, $6, now())
      `, [adminId, mp.id, mp.period, provEdenor, issuedAt, p('consorcio@citify.com.ar'), provAysa, `${month}/${year}`, provAsc])
    }

    // ─── Businesses + promotions ────────────────────────────────────────────
    console.log('> Insertando businesses + promotions...')
    const bizCafe = 'cccccccc-cccc-cccc-cccc-cccccccccccc'
    const bizAlmacen = 'dddddddd-dddd-dddd-dddd-dddddddddddd'
    await client.query(`
      insert into public.businesses (id, name, category, description, address, owner_profile_id) values
        ($1, 'Café Citify',   'Cafetería', 'Café de especialidad y tortas caseras',  'Av. Corrientes 1240, CABA', $3),
        ($2, 'Almacén Norte', 'Almacén',   'Almacén de barrio con productos locales','Av. Cabildo 5680, CABA',   $4)
    `, [bizCafe, bizAlmacen, p('cafe@citify.com.ar'), p('almacen@citify.com.ar')])

    await client.query(`update public.profiles set business_id = $1 where id = $2`, [bizCafe, p('cafe@citify.com.ar')])
    await client.query(`update public.profiles set business_id = $1 where id = $2`, [bizAlmacen, p('almacen@citify.com.ar')])

    const promo1 = 'f1f1f1f1-f1f1-f1f1-f1f1-f1f1f1f1f1f1'
    const promo2 = 'f2f2f2f2-f2f2-f2f2-f2f2-f2f2f2f2f2f2'
    const promo3 = 'f3f3f3f3-f3f3-f3f3-f3f3-f3f3f3f3f3f3'
    const exp = `${year}-12-31`
    await client.query(`
      insert into public.promotions (id, business_id, title, description, discount, category, expiration_date, building_id, is_active) values
        ($1, $4, '2x1 en café',    'Comprá un café y llevate otro gratis', '50% OFF', 'Cafetería', $7::date, null, true),
        ($2, $4, 'Torta del día',  'Porción de torta a $1500',             '$1500',   'Cafetería', $7::date, null, true),
        ($3, $5, '10% en almacén', '10% off en compras mayores a $5000',   '10% OFF', 'Almacén',   $7::date, $6,  true)
    `, [promo1, promo2, promo3, bizCafe, bizAlmacen, buildingNorte, exp])

    console.log('> OK seed completo')
    console.log(JSON.stringify({
      ok: true,
      password: PASSWORD,
      users: usersToCreate.map((u) => ({ email: u.email, role: u.role, password: PASSWORD })),
    }, null, 2))
  } finally {
    client.release()
    await pool.end()
  }
}

module.exports = main
