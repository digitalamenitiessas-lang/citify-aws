#!/usr/bin/env node
/**
 * Datos de PRUEBA: 2 consorcios con unidades, un admin y vecinos cada uno.
 *
 *   node --env-file=<env> scripts/db/seed-demo.mjs            carga (idempotente)
 *   node --env-file=<env> scripts/db/seed-demo.mjs --borrar   borra todo lo de prueba
 *
 * En el VPS:
 *   cd /home/citify/citify-aws && set -a && . /etc/citify/app.env && set +a
 *   /opt/node22/bin/node scripts/db/seed-demo.mjs
 *
 * Como lo hace la app:
 *   - Los consorcios salen de citify.superadmin_create_consorcio (la misma
 *     funcion que usa el alta desde /superadmin): edificio + administracion +
 *     propiedad IAdmin + admin asignado.
 *   - Unidades, titulares (holders) y vinculos vecino<->unidad con los mismos
 *     inserts que lib/db/iadmin-writes.ts y lib/iadmin/unit-users.ts.
 *
 * Nadie queda con contraseña: un profile sin password_hash no puede loguear.
 * Para entrar se usa "Olvide mi contraseña", que ademas prueba el envio de
 * mails. Los usuarios inventados usan @demo.citify.test (dominio reservado, no
 * existe): ningun mail le llega a una persona real.
 *
 * Todo lo de prueba se reconoce por: edificios que empiezan con "[PRUEBA]" y
 * emails @demo.citify.test. --borrar saca solo eso (y el vinculo del email
 * real, sin borrar su cuenta).
 *
 * NO crea negocios ni promociones: viven en shared y se verian en Countrify.
 */

import pg from 'pg'

const DEMO_DOMAIN = 'demo.citify.test'
// Unico usuario real: el que va a probar los mails.
const REAL_USER = { email: 'lucianobonilla27@gmail.com', fullName: 'Luciano Bonilla' }

const EDIFICIOS = [
  {
    nombre: '[PRUEBA] Edificio Sarmiento',
    direccion: 'Av. Sarmiento 555, San Miguel de Tucumán',
    lat: -26.8241,
    lng: -65.2038,
    administracion: '[PRUEBA] Administración Sarmiento',
    admin: { email: `admin.sarmiento@${DEMO_DOMAIN}`, fullName: 'Marta Díaz (admin prueba)' },
    // La 1A es la del usuario real.
    vecinos: [
      { unidad: '1A', real: true },
      { unidad: '1B', email: `ana.gomez@${DEMO_DOMAIN}`, fullName: 'Ana Gómez' },
      { unidad: '2A', email: `jorge.perez@${DEMO_DOMAIN}`, fullName: 'Jorge Pérez' },
      { unidad: '2B', email: `lucia.fernandez@${DEMO_DOMAIN}`, fullName: 'Lucía Fernández' },
      { unidad: '3A', email: `carlos.ruiz@${DEMO_DOMAIN}`, fullName: 'Carlos Ruiz' },
    ],
  },
  {
    nombre: '[PRUEBA] Torre Mate de Luna',
    direccion: 'Av. Mate de Luna 1800, San Miguel de Tucumán',
    lat: -26.8318,
    lng: -65.2215,
    administracion: '[PRUEBA] Administración Mate de Luna',
    admin: { email: `admin.matedeluna@${DEMO_DOMAIN}`, fullName: 'Pablo Sosa (admin prueba)' },
    vecinos: [
      { unidad: '1A', email: `sofia.torres@${DEMO_DOMAIN}`, fullName: 'Sofía Torres' },
      { unidad: '1B', email: `diego.alvarez@${DEMO_DOMAIN}`, fullName: 'Diego Álvarez' },
      { unidad: '2A', email: `valentina.romero@${DEMO_DOMAIN}`, fullName: 'Valentina Romero' },
      { unidad: '3B', email: `martin.castro@${DEMO_DOMAIN}`, fullName: 'Martín Castro' },
    ],
  },
]
const UNIDADES = [
  { code: '1A', floor: '1' },
  { code: '1B', floor: '1' },
  { code: '2A', floor: '2' },
  { code: '2B', floor: '2' },
  { code: '3A', floor: '3' },
  { code: '3B', floor: '3' },
]

function env(name) {
  const v = process.env[name]
  if (!v) {
    console.error(`error: falta ${name}`)
    process.exit(2)
  }
  return v
}

const client = new pg.Client({
  host: env('DB_HOST'),
  port: Number(process.env.DB_PORT ?? 5432),
  database: env('DB_NAME'),
  user: env('DB_USER'),
  password: env('DB_PASSWORD'),
  ssl: process.env.DB_SSL === 'disable' ? false : { rejectUnauthorized: false },
  options: `-c search_path=${process.env.DB_SCHEMA ?? 'citify'},shared,public`,
})

const q = (sql, params) => client.query(sql, params)

function avatar(name) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('')
}

// Mismo insert que upsertProfile (lib/db/profiles.ts), sin password_hash.
async function asegurarProfile({ email, fullName, role, buildingId }) {
  const existing = await q(`select id, role from citify.profiles where lower(email) = lower($1)`, [email])
  if (existing.rows[0]) {
    await q(`update citify.profiles set building_id = coalesce($2, building_id) where id = $1`, [
      existing.rows[0].id,
      buildingId,
    ])
    return existing.rows[0].id
  }
  const r = await q(
    `insert into citify.profiles (id, email, full_name, avatar_text, role, building_id, password_must_change)
     values (gen_random_uuid(), lower($1), $2, $3, $4, $5, false)
     returning id`,
    [email, fullName, avatar(fullName), role, buildingId],
  )
  return r.rows[0].id
}

async function cargar() {
  const sa = await q(`select id from citify.profiles where role = 'super_admin' order by created_at limit 1`)
  const creatorId = sa.rows[0]?.id ?? null

  for (const e of EDIFICIOS) {
    const ya = await q(`select id from citify.buildings where name = $1`, [e.nombre])
    if (ya.rows[0]) {
      console.log(`= ${e.nombre}: ya existe, se saltea`)
      continue
    }

    await q('begin')
    try {
      const adminId = await asegurarProfile({ ...e.admin, role: 'consorcio_admin', buildingId: null })

      const res = await q(
        `select citify.superadmin_create_consorcio(
           building_name => $1, building_address => $2, building_total_units => $3,
           building_latitude => $4, building_longitude => $5,
           administration_name => $6, admin_profile_id => $7, creator_profile_id => $8
         ) as r`,
        [e.nombre, e.direccion, UNIDADES.length, e.lat, e.lng, e.administracion, adminId, creatorId],
      )
      const { building_id: buildingId, managed_property_id: propertyId } = res.rows[0].r

      const unitIds = {}
      for (const u of UNIDADES) {
        const r = await q(
          `insert into citify.iadmin_units (managed_property_id, code, kind, floor, prorata_coefficient, is_active)
           values ($1, $2, 'departamento', $3, $4, true) returning id`,
          [propertyId, u.code, u.floor, +(1 / UNIDADES.length).toFixed(6)],
        )
        unitIds[u.code] = r.rows[0].id
      }

      for (const v of e.vecinos) {
        const persona = v.real ? REAL_USER : v
        const profileId = await asegurarProfile({
          email: persona.email,
          fullName: persona.fullName,
          role: 'vecino',
          buildingId,
        })
        const unitId = unitIds[v.unidad]
        await q(
          `update citify.unit_profile_memberships set active = false
            where unit_id = $1 and relationship_type = 'vecino_principal' and active`,
          [unitId],
        )
        await q(
          `insert into citify.unit_profile_memberships
             (unit_id, building_id, profile_id, relationship_type, is_primary, active, created_by_profile_id)
           values ($1, $2, $3, 'vecino_principal', false, true, $4)`,
          [unitId, buildingId, profileId, creatorId],
        )
        await q(
          `insert into citify.iadmin_unit_holders (unit_id, profile_id, full_name, holder_kind, email, is_active)
           values ($1, $2, $3, 'propietario', lower($4), true)`,
          [unitId, profileId, persona.fullName, persona.email],
        )
      }

      await q('commit')
      console.log(`+ ${e.nombre}: ${UNIDADES.length} unidades, ${e.vecinos.length} vecinos, admin ${e.admin.email}`)
    } catch (err) {
      await q('rollback')
      throw err
    }
  }
}

async function borrar() {
  await q('begin')
  try {
    const b = await q(`select id from citify.buildings where name like '[PRUEBA]%'`)
    const ids = b.rows.map((r) => r.id)
    if (ids.length) {
      const props = await q(
        `select id, administration_id from citify.iadmin_managed_properties where building_id = any($1)`,
        [ids],
      )
      const propIds = props.rows.map((r) => r.id)
      const adminIds = [...new Set(props.rows.map((r) => r.administration_id))]
      // Primero lo que cuelga de las unidades y de los edificios, despues la
      // propiedad, la administracion y el edificio.
      await q(
        `delete from citify.unit_profile_memberships where building_id = any($1)`,
        [ids],
      )
      await q(
        `delete from citify.iadmin_unit_holders where unit_id in
           (select id from citify.iadmin_units where managed_property_id = any($1))`,
        [propIds],
      )
      await q(`delete from citify.iadmin_units where managed_property_id = any($1)`, [propIds])
      await q(`delete from citify.iadmin_managed_properties where id = any($1)`, [propIds])
      await q(`delete from citify.iadmin_administrations where id = any($1)`, [adminIds])
      await q(`delete from citify.building_admin_assignments where building_id = any($1)`, [ids])
      await q(`update citify.profiles set building_id = null where building_id = any($1)`, [ids])
      await q(`delete from citify.buildings where id = any($1)`, [ids])
    }
    const p = await q(`delete from citify.profiles where email like $1 returning email`, [`%@${DEMO_DOMAIN}`])
    await q('commit')
    console.log(`borrados: ${ids.length} edificios de prueba, ${p.rowCount} usuarios @${DEMO_DOMAIN}`)
    console.log(`(la cuenta de ${REAL_USER.email} se conserva, sin edificio)`)
  } catch (err) {
    await q('rollback')
    throw err
  }
}

await client.connect()
try {
  if (process.argv.includes('--borrar')) await borrar()
  else await cargar()
} finally {
  await client.end()
}
