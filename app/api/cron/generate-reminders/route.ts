import { NextResponse } from 'next/server'
import { pgQuery } from '@/lib/db/postgres'
import { generateRemindersForAdmin } from '@/lib/iadmin/reminder-generator'

// Endpoint disparado por EventBridge/cron externo. Recorre todas las
// administraciones activas y corre el generador. Auth via header
// X-Cron-Secret (compartido con el scheduler). No usa requireIAdmin
// porque no hay usuario humano — es un job de sistema.

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(request: Request) {
  const expected = process.env.CRON_SECRET
  if (!expected) {
    return NextResponse.json(
      { error: 'CRON_SECRET not configured' },
      { status: 500 },
    )
  }
  const provided = request.headers.get('x-cron-secret')
  if (provided !== expected) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const started = Date.now()
  const adminsRes = await pgQuery<{ id: string }>(
    `select id from public.iadmin_administrations`,
  )

  const results: Array<{
    administrationId: string
    created: number
    skipped: number
    error?: string
  }> = []

  let totalCreated = 0
  let totalSkipped = 0
  let totalFailed = 0

  for (const a of adminsRes.rows) {
    try {
      const { created, skipped } = await generateRemindersForAdmin({
        administrationId: a.id,
      })
      results.push({ administrationId: a.id, created, skipped })
      totalCreated += created
      totalSkipped += skipped
    } catch (err) {
      totalFailed += 1
      results.push({
        administrationId: a.id,
        created: 0,
        skipped: 0,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  return NextResponse.json({
    ok: true,
    administrations: adminsRes.rows.length,
    totals: { created: totalCreated, skipped: totalSkipped, failed: totalFailed },
    elapsedMs: Date.now() - started,
    results,
  })
}

export async function GET() {
  return NextResponse.json(
    { error: 'method not allowed, use POST with X-Cron-Secret header' },
    { status: 405 },
  )
}
