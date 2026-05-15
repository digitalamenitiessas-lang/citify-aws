/* eslint-disable @typescript-eslint/no-require-imports */
// Carga .env.local si existe (sin requerir dotenv como dependencia)
const fs = require('fs')
const path = require('path')
try {
  const envPath = path.join(__dirname, '..', '.env.local')
  if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/)
      if (!match) continue
      const [, key, rawValue] = match
      if (process.env[key]) continue
      const value = rawValue.replace(/^['"]|['"]$/g, '')
      process.env[key] = value
    }
  }
} catch {}

// Crea (o reutiliza) un usuario consorcio_admin end-to-end:
//   - Usuario en Cognito (idempotente)
//   - profile en RDS (rol consorcio_admin)
//   - building_admin_assignments (si pasas --building-id)
//   - iadmin_role_grants (si pasas --administration-id)
//
// Uso (PowerShell):
//   node scripts/create-consorcio-admin.js `
//     --email admin@ejemplo.com `
//     --password 'Citify2026!' `
//     --name 'Juan Perez' `
//     --building-id <uuid opcional> `
//     --administration-id <uuid opcional>

const { Pool } = require('pg')
const {
  CognitoIdentityProviderClient,
  AdminCreateUserCommand,
  AdminGetUserCommand,
  AdminSetUserPasswordCommand,
  UsernameExistsException,
} = require('@aws-sdk/client-cognito-identity-provider')

function requireEnv(name) {
  const value = process.env[name]
  if (!value) throw new Error(`Falta env var ${name}`)
  return value
}

function parseArgs(argv) {
  const out = {}
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i]
    if (!arg.startsWith('--')) continue
    const key = arg.slice(2)
    const next = argv[i + 1]
    if (!next || next.startsWith('--')) {
      out[key] = true
    } else {
      out[key] = next
      i++
    }
  }
  return out
}

function avatarFromName(name) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('') || 'U'
  )
}

async function ensureCognitoUser(client, userPoolId, { email, password, fullName }) {
  const username = email.trim().toLowerCase()

  let alreadyExisted = false
  try {
    await client.send(
      new AdminCreateUserCommand({
        UserPoolId: userPoolId,
        Username: username,
        MessageAction: 'SUPPRESS',
        UserAttributes: [
          { Name: 'email', Value: username },
          { Name: 'email_verified', Value: 'true' },
          { Name: 'name', Value: fullName },
        ],
      }),
    )
  } catch (error) {
    if (error instanceof UsernameExistsException) {
      alreadyExisted = true
    } else {
      throw error
    }
  }

  await client.send(
    new AdminSetUserPasswordCommand({
      UserPoolId: userPoolId,
      Username: username,
      Password: password,
      Permanent: true,
    }),
  )

  const describe = await client.send(
    new AdminGetUserCommand({ UserPoolId: userPoolId, Username: username }),
  )
  const sub = describe.UserAttributes?.find((a) => a.Name === 'sub')?.Value
  if (!sub) throw new Error('Cognito no devolvio sub.')

  return { sub, alreadyExisted }
}

async function main() {
  const args = parseArgs(process.argv)
  const email = args.email
  const password = args.password
  const fullName = args.name
  const buildingId = args['building-id'] || null
  const administrationId = args['administration-id'] || null

  if (!email || !password || !fullName) {
    console.error('Uso: --email <email> --password <pass> --name <"Nombre Apellido"> [--building-id <uuid>] [--administration-id <uuid>]')
    process.exit(1)
  }

  const region = requireEnv('AWS_COGNITO_REGION')
  const userPoolId = requireEnv('AWS_COGNITO_USER_POOL_ID')

  const cognito = new CognitoIdentityProviderClient({ region })
  const pool = new Pool({
    host: requireEnv('DB_HOST'),
    port: Number(process.env.DB_PORT || '5432'),
    database: requireEnv('DB_NAME'),
    user: requireEnv('DB_USER'),
    password: requireEnv('DB_PASSWORD'),
    ssl: process.env.DB_SSL === 'false' ? false : { rejectUnauthorized: false },
  })

  console.log(`> Cognito ensure user ${email}...`)
  const { sub, alreadyExisted } = await ensureCognitoUser(cognito, userPoolId, {
    email,
    password,
    fullName,
  })
  console.log(`  sub=${sub} ${alreadyExisted ? '(ya existia)' : '(creado)'}`)

  const client = await pool.connect()
  try {
    await client.query('begin')

    console.log('> Upsert profile en RDS...')
    await client.query(
      `
        insert into public.profiles (id, email, full_name, avatar_text, role, building_id)
        values ($1, lower($2), $3, $4, 'consorcio_admin', $5)
        on conflict (id) do update set
          email = excluded.email,
          full_name = excluded.full_name,
          avatar_text = excluded.avatar_text,
          role = excluded.role,
          building_id = coalesce(excluded.building_id, public.profiles.building_id)
      `,
      [sub, email.toLowerCase(), fullName, avatarFromName(fullName), buildingId],
    )

    if (buildingId) {
      console.log(`> Asignacion al building ${buildingId}...`)
      const existing = await client.query(
        `select count(*)::int as c from public.building_admin_assignments where profile_id = $1`,
        [sub],
      )
      const isPrimary = existing.rows[0].c === 0
      await client.query(
        `
          insert into public.building_admin_assignments (profile_id, building_id, is_primary)
          values ($1, $2, $3)
          on conflict (profile_id, building_id) do update set is_primary = excluded.is_primary
        `,
        [sub, buildingId, isPrimary],
      )
      if (isPrimary) {
        await client.query(`update public.profiles set building_id = $1 where id = $2`, [buildingId, sub])
      }
    }

    if (administrationId) {
      console.log(`> Role grant en administration ${administrationId}...`)
      const existing = await client.query(
        `select count(*)::int as c from public.iadmin_role_grants where profile_id = $1`,
        [sub],
      )
      const isPrimary = existing.rows[0].c === 0
      await client.query(
        `
          insert into public.iadmin_role_grants (administration_id, profile_id, operational_role, is_primary)
          values ($1, $2, 'titular', $3)
          on conflict (administration_id, profile_id) do update set
            operational_role = excluded.operational_role,
            is_primary = excluded.is_primary
        `,
        [administrationId, sub, isPrimary],
      )
    }

    await client.query('commit')
    console.log('> OK')
    console.log(JSON.stringify({ ok: true, profileId: sub, email, role: 'consorcio_admin', buildingId, administrationId }, null, 2))
  } catch (error) {
    await client.query('rollback')
    throw error
  } finally {
    client.release()
    await pool.end()
  }
}

main().catch((error) => {
  console.error('ERROR:', error.message || error)
  process.exit(1)
})
