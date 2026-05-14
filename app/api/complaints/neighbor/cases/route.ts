import { NextResponse } from 'next/server'
import { getCurrentProfile } from '@/lib/auth'
import { getSupabaseAdminClient } from '@/lib/supabase/admin'

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

  const admin = getSupabaseAdminClient()
  if (!admin) {
    return NextResponse.json({ error: 'Supabase admin no esta configurado.' }, { status: 500 })
  }

  const body = (await request.json().catch(() => null)) as CreateNeighborCaseBody | null
  const title = body?.title?.trim()
  const description = body?.description?.trim()
  const reasonIds = Array.isArray(body?.reasonIds) ? body!.reasonIds.filter((value): value is string => typeof value === 'string' && value.length > 0) : []
  const otherReasonText = body?.otherReasonText?.trim() || null

  if (!title || !description || reasonIds.length === 0) {
    return NextResponse.json({ error: 'Faltan datos del expediente.' }, { status: 400 })
  }

  const { data, error } = await admin.rpc('create_neighbor_complaint_case', {
    target_building_id: profile.buildingId,
    case_title: title,
    case_description: description,
    reason_ids: reasonIds,
    other_reason_text_input: otherReasonText,
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  const row = Array.isArray(data) ? data[0] : null
  if (!row) {
    return NextResponse.json({ error: 'No se pudo recuperar el expediente creado.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, case: row })
}
