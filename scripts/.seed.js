/* eslint-disable */
const { Pool } = require('pg')
const {
  CognitoIdentityProviderClient,
  ListUsersCommand,
  AdminDeleteUserCommand,
  AdminCreateUserCommand,
  AdminSetUserPasswordCommand,
  AdminGetUserCommand,
  UsernameExistsException,
} = require('@aws-sdk/client-cognito-identity-provider')
const { S3Client, ListObjectsV2Command, DeleteObjectsCommand } = require('@aws-sdk/client-s3')

const PASSWORD = 'Test1234!'
const REGION = 'us-east-1'
const POOL_ID = process.env.AWS_COGNITO_USER_POOL_ID
const BUCKET = process.env.AWS_S3_BUCKET || 'citify-prod-assets'

const cognito = new CognitoIdentityProviderClient({ region: REGION })
const s3 = new S3Client({ region: REGION })

async function listAllCognitoUsers() {
  const users = []
  let token = undefined
  while (true) {
    const resp = await cognito.send(new ListUsersCommand({ UserPoolId: POOL_ID, Limit: 60, PaginationToken: token }))
    for (const u of resp.Users || []) users.push(u.Username)
    if (!resp.PaginationToken) break
    token = resp.PaginationToken
  }
  return users
}

async function deleteAllCognitoUsers() {
  const users = await listAllCognitoUsers()
  console.log(`> Borrando ${users.length} users de Cognito...`)
  for (const username of users) {
    try {
      await cognito.send(new AdminDeleteUserCommand({ UserPoolId: POOL_ID, Username: username }))
    } catch (e) {
      console.error(`  - falla borrando ${username}:`, e.message)
    }
  }
}

async function emptyS3Bucket() {
  console.log(`> Vaciando bucket s3://${BUCKET}/ ...`)
  let token = undefined
  let total = 0
  while (true) {
    const resp = await s3.send(new ListObjectsV2Command({ Bucket: BUCKET, ContinuationToken: token }))
    const keys = (resp.Contents || []).map((o) => ({ Key: o.Key }))
    if (keys.length > 0) {
      await s3.send(new DeleteObjectsCommand({ Bucket: BUCKET, Delete: { Objects: keys, Quiet: true } }))
      total += keys.length
    }
    if (!resp.IsTruncated) break
    token = resp.NextContinuationToken
  }
  console.log(`  - ${total} objetos borrados`)
}

async function createCognitoUser(email, fullName) {
  try {
    await cognito.send(new AdminCreateUserCommand({
      UserPoolId: POOL_ID,
      Username: email,
      MessageAction: 'SUPPRESS',
      UserAttributes: [
        { Name: 'email', Value: email },
        { Name: 'email_verified', Value: 'true' },
        { Name: 'name', Value: fullName },
      ],
    }))
  } catch (e) {
    if (!(e instanceof UsernameExistsException)) throw e
  }
  await cognito.send(new AdminSetUserPasswordCommand({
    UserPoolId: POOL_ID, Username: email, Password: PASSWORD, Permanent: true,
  }))
  const desc = await cognito.send(new AdminGetUserCommand({ UserPoolId: POOL_ID, Username: email }))
  const sub = desc.UserAttributes.find((a) => a.Name === 'sub').Value
  return sub
}

async function main() {
  await deleteAllCognitoUsers()
  await emptyS3Bucket()

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
    // Truncar en orden inverso de dependencia (CASCADE limpia el resto)
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
    await client.query(`TRUNCATE ${tables.map((t) => `public.${t}`).join(', ')} CASCADE`)
    console.log(`  - truncadas ${tables.length} tablas`)

    console.log('> Creando users en Cognito y RDS...')
    const subs = {}
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
    for (const u of usersToCreate) {
      subs[u.email] = await createCognitoUser(u.email, u.name)
      console.log(`  + ${u.email} → ${subs[u.email]}`)
    }

    // ─── Buildings ───────────────────────────────────────────────────────────
    console.log('> Insertando buildings...')
    const buildingCentro = '11111111-1111-1111-1111-111111111111'
    const buildingNorte = '22222222-2222-2222-2222-222222222222'
    await client.query(`
      insert into public.buildings (id, name, address, total_units) values
        ($1, 'Edificio Centro', 'Av. Corrientes 1234, CABA', 4),
        ($2, 'Edificio Norte',  'Av. Cabildo 5678, CABA', 4)
    `, [buildingCentro, buildingNorte])

    // ─── Profiles (uno por user Cognito) ─────────────────────────────────────
    console.log('> Insertando profiles...')
    const p = (email) => subs[email]
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
    // almacen profile (separado para incluir el business_id luego)
    await client.query(`
      insert into public.profiles (id, email, full_name, avatar_text, role)
      values ($1, lower('almacen@citify.com.ar'), 'Almacen Norte Admin', 'AN', 'negocio_admin')
    `, [p('almacen@citify.com.ar')])

    // ─── Administradora ──────────────────────────────────────────────────────
    console.log('> Insertando administracion + properties...')
    const adminId = '33333333-3333-3333-3333-333333333333'
    await client.query(`
      insert into public.iadmin_administrations (id, name, legal_name, tax_id, contact_email, contact_phone, is_active, legal_info)
      values ($1, 'Administración Citify', 'Citify Administraciones SA', '30-12345678-9', 'contacto@citify.com.ar', '+5491155556666', true,
        $2::jsonb)
    `, [adminId, JSON.stringify({
      bank: { name: 'Banco Nación', cbu: '0110000000000000000000', alias: 'CITIFY.ADMIN', account: '1234567/8' },
      accountantName: 'Estudio Contable Pérez',
      accountantPhone: '+5491144442222',
      collectionSchedule: 'Lunes a Viernes 9-17hs',
    })])

    // role grant para consorcio_admin
    await client.query(`
      insert into public.iadmin_role_grants (administration_id, profile_id, operational_role, is_primary)
      values ($1, $2, 'titular', true)
    `, [adminId, p('consorcio@citify.com.ar')])

    // building_admin_assignments
    await client.query(`
      insert into public.building_admin_assignments (profile_id, building_id, is_primary) values
        ($1, $2, true),
        ($1, $3, false)
    `, [p('consorcio@citify.com.ar'), buildingCentro, buildingNorte])

    // managed_properties
    const mpCentro = '44444444-4444-4444-4444-444444444444'
    const mpNorte = '55555555-5555-5555-5555-555555555555'
    await client.query(`
      insert into public.iadmin_managed_properties (id, administration_id, building_id, display_name, property_kind, managed_since, management_fee_pct, is_active, legal_info)
      values
        ($1, $3, $5, 'Centro Premium', 'edificio', '2024-01-01', 8.5, true, $7::jsonb),
        ($2, $3, $6, 'Norte Familiar', 'edificio', '2024-03-15', 7.0, true, $7::jsonb)
    `, [mpCentro, mpNorte, adminId, null, buildingCentro, buildingNorte, JSON.stringify({})])

    // ─── Units (4 por edificio) ──────────────────────────────────────────────
    console.log('> Insertando units + holders...')
    const unitsCentro = ['c1', 'c2', 'c3', 'c4'].map((s) => ({
      id: `aaaaaaaa-aaaa-aaaa-aaaa-${s.padEnd(12, '0')}`, code: s.toUpperCase(),
    }))
    const unitsNorte = ['n1', 'n2', 'n3', 'n4'].map((s) => ({
      id: `bbbbbbbb-bbbb-bbbb-bbbb-${s.padEnd(12, '0')}`, code: s.toUpperCase(),
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

    // ─── Memberships + Holders ───────────────────────────────────────────────
    // Vecinos 1-4 en Centro (C1-C4), vecinos 5-8 en Norte (N1-N4)
    // Propietario tiene C1 + N1 como holder
    const membershipsData = [
      { vecino: 'vecino1@citify.com.ar', unit: unitsCentro[0], building: buildingCentro, kind: 'vecino_principal' },
      { vecino: 'vecino2@citify.com.ar', unit: unitsCentro[1], building: buildingCentro, kind: 'vecino_principal' },
      { vecino: 'vecino3@citify.com.ar', unit: unitsCentro[2], building: buildingCentro, kind: 'vecino_principal' },
      { vecino: 'vecino4@citify.com.ar', unit: unitsCentro[3], building: buildingCentro, kind: 'vecino_principal' },
      { vecino: 'vecino5@citify.com.ar', unit: unitsNorte[0],  building: buildingNorte,  kind: 'vecino_principal' },
      { vecino: 'vecino6@citify.com.ar', unit: unitsNorte[1],  building: buildingNorte,  kind: 'vecino_principal' },
      { vecino: 'vecino7@citify.com.ar', unit: unitsNorte[2],  building: buildingNorte,  kind: 'vecino_principal' },
      { vecino: 'vecino8@citify.com.ar', unit: unitsNorte[3],  building: buildingNorte,  kind: 'vecino_principal' },
    ]
    for (const m of membershipsData) {
      await client.query(`
        insert into public.unit_profile_memberships (unit_id, building_id, profile_id, relationship_type, is_primary, active)
        values ($1, $2, $3, $4, false, true)
      `, [m.unit.id, m.building, p(m.vecino), m.kind])
    }
    // Propietario en C1 y N1 (membership)
    for (const u of [unitsCentro[0], unitsNorte[0]]) {
      await client.query(`
        insert into public.unit_profile_memberships (unit_id, building_id, profile_id, relationship_type, is_primary, active)
        values ($1, $2, $3, 'propietario', true, true)
      `, [u.id, u === unitsCentro[0] ? buildingCentro : buildingNorte, p('propietario@citify.com.ar')])
      await client.query(`
        insert into public.iadmin_unit_holders (unit_id, profile_id, full_name, holder_kind, email, is_active)
        values ($1, $2, 'Pedro Propietario', 'propietario', lower('propietario@citify.com.ar'), true)
      `, [u.id, p('propietario@citify.com.ar')])
    }

    // ─── Cash accounts ───────────────────────────────────────────────────────
    console.log('> Insertando cash accounts + accounting periods + providers...')
    const cashCentro = '66666666-6666-6666-6666-666666666666'
    const cashNorte = '77777777-7777-7777-7777-777777777777'
    await client.query(`
      insert into public.iadmin_cash_accounts (id, managed_property_id, name, kind, bank_name, cbu, alias, opening_balance, is_active)
      values
        ($1, $3, 'Cuenta corriente Centro', 'bank', 'Banco Nación', '0110000000000000111111', 'CENTRO.CITIFY', 0, true),
        ($2, $4, 'Cuenta corriente Norte',  'bank', 'Banco Nación', '0110000000000000222222', 'NORTE.CITIFY',  0, true)
    `, [cashCentro, cashNorte, mpCentro, mpNorte])

    // ─── Accounting period del mes actual ────────────────────────────────────
    const now = new Date()
    const year = now.getFullYear()
    const month = now.getMonth() + 1
    const periodCentro = '88888888-8888-8888-8888-888888888888'
    const periodNorte = '99999999-9999-9999-9999-999999999999'
    await client.query(`
      insert into public.iadmin_accounting_periods (id, managed_property_id, period_year, period_month, status)
      values ($1, $3, $5, $6, 'open'), ($2, $4, $5, $6, 'open')
    `, [periodCentro, periodNorte, mpCentro, mpNorte, year, month])

    // ─── Providers ──────────────────────────────────────────────────────────
    const provEdenor = 'e0e0e0e0-e0e0-e0e0-e0e0-e0e0e0e0e0e0'
    const provAysa   = 'a0a0a0a0-a0a0-a0a0-a0a0-a0a0a0a0a0a0'
    const provAsc    = 'a5a5a5a5-a5a5-a5a5-a5a5-a5a5a5a5a5a5'
    await client.query(`
      insert into public.iadmin_providers (id, administration_id, name, category, default_category, default_description, is_recurring, recurring_amount, recurring_kind, is_active) values
        ($1, $4, 'Edenor',          'Servicios', 'Servicios', 'Luz mes',     true, 45000, 'ordinaria', true),
        ($2, $4, 'AYSA',            'Servicios', 'Servicios', 'Agua mes',    true, 18000, 'ordinaria', true),
        ($3, $4, 'Ascensores Otis', 'Mantenimiento', 'Mantenimiento', 'Service ascensor', true, 32000, 'ordinaria', true)
    `, [provEdenor, provAysa, provAsc, adminId])

    // ─── Expenses imputados del mes ──────────────────────────────────────────
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

    // actualizar profiles para tener business_id
    await client.query(`update public.profiles set business_id = $1 where id = $2`, [bizCafe, p('cafe@citify.com.ar')])
    await client.query(`update public.profiles set business_id = $1 where id = $2`, [bizAlmacen, p('almacen@citify.com.ar')])

    const promo1 = 'f1f1f1f1-f1f1-f1f1-f1f1-f1f1f1f1f1f1'
    const promo2 = 'f2f2f2f2-f2f2-f2f2-f2f2-f2f2f2f2f2f2'
    const promo3 = 'f3f3f3f3-f3f3-f3f3-f3f3-f3f3f3f3f3f3'
    const exp = `${year}-12-31`
    await client.query(`
      insert into public.promotions (id, business_id, title, description, discount, category, expiration_date, building_id, is_active) values
        ($1, $4, '2x1 en café',         'Comprá un café y llevate otro gratis',    '50% OFF',  'Cafetería', $7::date, null, true),
        ($2, $4, 'Torta del día',       'Porción de torta a $1500',                '$1500',    'Cafetería', $7::date, null, true),
        ($3, $5, '10% en almacén',      '10% off en compras mayores a $5000',      '10% OFF',  'Almacén',   $7::date, $6,  true)
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
