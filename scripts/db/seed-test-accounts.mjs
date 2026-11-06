#!/usr/bin/env node
/**
 * Cuentas de PRUEBA para entrar a mano: una por rol, todas con la misma
 * contraseña. Va encima de scripts/db/seed-demo.mjs (que crea los edificios
 * "[PRUEBA]" y sus usuarios sin contraseña).
 *
 *   SEED_TEST_PASSWORD='...' node --env-file=<env> scripts/db/seed-test-accounts.mjs
 *   node --env-file=<env> scripts/db/seed-test-accounts.mjs --borrar
 *
 * En el VPS:
 *   cd /home/citify/citify-aws && set -a && . /etc/citify/app.env && set +a
 *   read -rs -p "Password: " SEED_TEST_PASSWORD; echo; export SEED_TEST_PASSWORD
 *   /opt/node22/bin/node scripts/db/seed-test-accounts.mjs
 *
 * Cuentas:
 *   superadmin.prueba@demo.citify.test   super_admin (nueva)
 *   admin.sarmiento@demo.citify.test     consorcio_admin de "[PRUEBA] Edificio Sarmiento" (de seed-demo)
 *   ana.gomez@demo.citify.test           vecina de la 1B del mismo edificio (de seed-demo)
 *   negocio.prueba@demo.citify.test      negocio_admin de "[PRUEBA] Café Demo" (nuevo, con una promo)
 *
 * OJO:
 *   - NO valida la politica de passwords a proposito: se pidio una contraseña
 *     corta para probar. Si la cuenta la cambia desde la app, la app exige la
 *     politica normal.
 *   - El negocio y su promo viven en el schema shared: se ven tambien en
 *     Countrify. --borrar los saca.
 *   - Una cuenta super_admin con contraseña debil en produccion es un riesgo:
 *     borrarla (--borrar) apenas se termine de probar.
 *
 * --borrar: borra superadmin.prueba, negocio.prueba, el negocio "[PRUEBA] Café
 * Demo" (y su promo), y les saca la contraseña a las dos cuentas de seed-demo
 * (quedan como estaban: sin poder loguear).
 */

import { randomUUID } from 'node:crypto'
import { hash } from '@node-rs/argon2'
import pg from 'pg'

const DOMAIN = 'demo.citify.test'
const SUPERADMIN = { email: `superadmin.prueba@${DOMAIN}`, fullName: 'Superadmin Prueba' }
const NEGOCIO = { email: `negocio.prueba@${DOMAIN}`, fullName: 'Negocio Prueba' }
const DE_SEED_DEMO = [`admin.sarmiento@${DOMAIN}`, `ana.gomez@${DOMAIN}`]
const BUSINESS_NAME = '[PRUEBA] Café Demo'

// Los mismos parametros que lib/auth/password.ts.
const HASH_OPTIONS = { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 }

function env(name) {
  const value = process.env[name]?.trim()
  if (!value) {
    console.error(`error: falta la variable de entorno ${name}`)
    process.exit(1)
  }
  return value
}

function initials(name) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('')
}

const client = new pg.Client({
  host: env('DB_HOST'),
  port: Number(process.env.DB_PORT ?? 5432),
  database: env('DB_NAME'),
  user: env('DB_USER'),
  password: env('DB_PASSWORD'),
  ssl: process.env.DB_SSL === 'disable' ? false : { rejectUnauthorized: false },
})
const q = (sql, params) => client.query(sql, params)

async function upsertProfile({ email, fullName, role, businessId = null }, passwordHash) {
  const existing = await q(`select id from citify.profiles where lower(email) = lower($1)`, [email])
  if (existing.rows[0]) {
    await q(
      `update citify.profiles
          set role = $2, business_id = $3, password_hash = $4, password_must_change = false
        where id = $1`,
      [existing.rows[0].id, role, businessId, passwordHash],
    )
    return existing.rows[0].id
  }
  const id = randomUUID()
  await q(
    `insert into citify.profiles (id, email, full_name, avatar_text, role, business_id, password_hash, password_must_change)
     values ($1, lower($2), $3, $4, $5, $6, $7, false)`,
    [id, email, fullName, initials(fullName), role, businessId, passwordHash],
  )
  return id
}

async function crear() {
  const password = env('SEED_TEST_PASSWORD')
  const passwordHash = await hash(password, HASH_OPTIONS)

  const faltan = []
  for (const email of DE_SEED_DEMO) {
    const r = await q(`select 1 from citify.profiles where lower(email) = lower($1)`, [email])
    if (!r.rows[0]) faltan.push(email)
  }
  if (faltan.length) {
    console.error(`error: faltan ${faltan.join(', ')} — correr antes scripts/db/seed-demo.mjs`)
    process.exit(1)
  }

  await q('begin')
  try {
    await upsertProfile({ ...SUPERADMIN, role: 'super_admin' }, passwordHash)

    for (const email of DE_SEED_DEMO) {
      await q(
        `update citify.profiles set password_hash = $2, password_must_change = false where lower(email) = lower($1)`,
        [email, passwordHash],
      )
    }

    // Negocio + promo (shared: se ve tambien en Countrify)
    let business = (await q(`select id from shared.businesses where name = $1`, [BUSINESS_NAME])).rows[0]
    if (!business) {
      business = (
        await q(
          `insert into shared.businesses (name, category, description, address, latitude, longitude)
           values ($1, 'Gastronomía', 'Negocio de prueba para probar la plataforma.', 'Av. Sarmiento 600, San Miguel de Tucumán', -26.8236, -65.2031)
           returning id`,
          [BUSINESS_NAME],
        )
      ).rows[0]
    }
    const negocioId = await upsertProfile({ ...NEGOCIO, role: 'negocio_admin', businessId: business.id }, passwordHash)
    await q(`update shared.businesses set owner_profile_id = $2 where id = $1`, [business.id, negocioId])

    const promo = await q(`select 1 from shared.promotions where business_id = $1`, [business.id])
    if (!promo.rows[0]) {
      await q(
        `insert into shared.promotions (id, business_id, title, description, discount, category, expiration_date, building_id, is_active)
         values ($1, $2, '[PRUEBA] 2x1 en café', 'Promo de prueba: dos cafés al precio de uno.', '2x1', 'Gastronomía', (current_date + interval '3 months')::date, null, true)`,
        [randomUUID(), business.id],
      )
    }
    await q('commit')
  } catch (error) {
    await q('rollback')
    throw error
  }

  console.log('listo — cuentas de prueba (todas con la misma contraseña):')
  console.log(`  super_admin      ${SUPERADMIN.email}`)
  console.log(`  consorcio_admin  ${DE_SEED_DEMO[0]}`)
  console.log(`  vecino           ${DE_SEED_DEMO[1]}`)
  console.log(`  negocio_admin    ${NEGOCIO.email}  (${BUSINESS_NAME})`)
}

async function borrar() {
  await q('begin')
  try {
    const b = await q(`delete from shared.businesses where name = $1 returning id`, [BUSINESS_NAME])
    const p = await q(`delete from citify.profiles where lower(email) in (lower($1), lower($2)) returning email`, [
      SUPERADMIN.email,
      NEGOCIO.email,
    ])
    const s = await q(
      `update citify.profiles set password_hash = null where lower(email) = any($1::text[]) returning email`,
      [DE_SEED_DEMO.map((e) => e.toLowerCase())],
    )
    await q('commit')
    console.log(`borrados: ${b.rowCount} negocio(s), ${p.rowCount} cuenta(s); sin contraseña: ${s.rowCount} cuenta(s) de seed-demo`)
  } catch (error) {
    await q('rollback')
    throw error
  }
}

await client.connect()
try {
  if (process.argv.includes('--borrar')) await borrar()
  else await crear()
} catch (error) {
  console.error('error:', error instanceof Error ? error.message : error)
  process.exitCode = 1
} finally {
  await client.end()
}
