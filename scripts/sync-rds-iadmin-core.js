const { Pool } = require('pg')

function requireEnv(name) {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing required env var: ${name}`)
  }
  return value
}

function quoteIdent(value) {
  return `"${String(value).replace(/"/g, '""')}"`
}

function normalizeValue(value) {
  if (value === undefined) return null
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    return JSON.stringify(value)
  }
  return value
}

async function fetchSupabaseRows(baseUrl, serviceRoleKey, table, extraParams = {}) {
  const url = new URL(`/rest/v1/${table}`, baseUrl)
  url.searchParams.set('select', '*')

  for (const [key, value] of Object.entries(extraParams)) {
    url.searchParams.set(key, value)
  }

  const response = await fetch(url, {
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
    },
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Failed to fetch ${table} from Supabase: ${response.status} ${body}`)
  }

  return response.json()
}

async function insertRows(client, table, rows) {
  if (!rows || rows.length === 0) return

  for (const row of rows) {
    const entries = Object.entries(row).filter(([, value]) => value !== undefined)
    const columns = entries.map(([key]) => quoteIdent(key))
    const values = entries.map(([, value]) => normalizeValue(value))
    const placeholders = values.map((_, index) => `$${index + 1}`)

    await client.query(
      `insert into public.${table} (${columns.join(', ')}) values (${placeholders.join(', ')})`,
      values,
    )
  }
}

async function main() {
  const supabaseUrl = requireEnv('NEXT_PUBLIC_SUPABASE_URL')
  const supabaseServiceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY')

  const pool = new Pool({
    host: requireEnv('DB_HOST'),
    port: Number(process.env.DB_PORT || '5432'),
    database: requireEnv('DB_NAME'),
    user: requireEnv('DB_USER'),
    password: requireEnv('DB_PASSWORD'),
    ssl: process.env.DB_SSL === 'false' ? false : { rejectUnauthorized: false },
  })

  const tableOrder = [
    'iadmin_administrations',
    'iadmin_role_grants',
    'iadmin_role_capabilities',
    'iadmin_managed_properties',
    'iadmin_providers',
    'iadmin_accounting_periods',
    'iadmin_expenses',
    'iadmin_expense_documents',
    'iadmin_ai_document_extractions',
    'iadmin_cash_accounts',
    'iadmin_bank_movements',
    'iadmin_units',
    'iadmin_liquidation_runs',
    'iadmin_liquidation_items',
    'iadmin_payments',
  ]

  const deleteOrder = [...tableOrder].reverse()

  const fetched = {}
  for (const table of tableOrder) {
    fetched[table] = await fetchSupabaseRows(supabaseUrl, supabaseServiceRoleKey, table)
  }

  const client = await pool.connect()
  try {
    await client.query('begin')

    for (const table of deleteOrder) {
      await client.query(`delete from public.${table}`)
    }

    for (const table of tableOrder) {
      if (table === 'iadmin_cash_accounts') {
        await client.query('delete from public.iadmin_cash_accounts')
      }
      await insertRows(client, table, fetched[table])
    }

    await client.query('commit')
  } catch (error) {
    await client.query('rollback')
    throw error
  } finally {
    client.release()
    await pool.end()
  }

  process.stdout.write(
    JSON.stringify(
      {
        ok: true,
        synced: Object.fromEntries(tableOrder.map((table) => [table, (fetched[table] || []).length])),
      },
      null,
      2,
    ),
  )
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
