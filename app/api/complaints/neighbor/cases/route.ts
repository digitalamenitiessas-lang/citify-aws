import { NextResponse } from 'next/server'
import { getCurrentProfile } from '@/lib/auth'
import { pgQueryAsProfile } from '@/lib/db/postgres'

type CreateNeighborCaseBody = {
  title?: string
  description?: string
  reasonIds?: string[]
  otherReasonText?: string | null
}

export async function POST(request: Request) {
  const profile = await getCurrentProfile()
  if (!profile) {
    return NextResponse.json({ error: 'No autenticado.' }, { status: 401 })
  }

  if (!profile.buildingId) {
    return NextResponse.json({ error: 'No hay edificio asignado al perfil actual.' }, { status: 400 })
  }

  const body = (await request.json().catch(() => null)) as CreateNeighborCaseBody | null
  const title = body?.title?.trim()
  const description = body?.description?.trim()
  const reasonIds = Array.isArray(body?.reasonIds)
    ? body!.reasonIds.filter((value): value is string => typeof value === 'string' && value.length > 0)
    : []
  const otherReasonText = body?.otherReasonText?.trim() || null

  if (!title || !description || reasonIds.length === 0) {
    return NextResponse.json({ error: 'Faltan datos del expediente.' }, { status: 400 })
  }

  try {
    const result = await pgQueryAsProfile(
      profile.id,
      `select * from public.create_neighbor_complaint_case($1, $2, $3, $4::uuid[], $5)`,
      [profile.buildingId, title, description, reasonIds, otherReasonText],
    )
    const row = result.rows[0]
    if (!row) {
      return NextResponse.json({ error: 'No se pudo recuperar el expediente creado.' }, { status: 500 })
    }
    return NextResponse.json({ ok: true, case: row })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al crear expediente' },
      { status: 400 },
    )
  }
}
